import type { ApiErrorBody, ApiResponse, AuthTokens } from 'shared';
import { getApiBaseUrl } from './config';
import { authStorage } from './auth-storage';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Registrado pelo AuthProvider para redirecionar ao login quando o refresh tambem falhar. */
let onUnauthenticated: (() => void) | null = null;

export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), getApiBaseUrl().replace(/\/?$/, '/'));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function rawRequest<T>(path: string, options: RequestOptions, accessToken: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let parsed: ApiResponse<T> | undefined;
  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    // corpo vazio (ex. 204) - trata como sucesso sem dados.
  }

  return { response, parsed };
}

async function refreshTokens(): Promise<AuthTokens | null> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const { response, parsed } = await rawRequest<AuthTokens>(
    '/auth/refresh',
    { method: 'POST', body: { refreshToken }, auth: false },
    null,
  );

  if (!response.ok || !parsed?.success) {
    return null;
  }

  return parsed.data;
}

/**
 * Cliente HTTP tipado para a API (apps/api, /api/v1) - mesmo contrato de
 * apps/mobile/src/services/api-client.ts, adaptado para o browser (localStorage em vez de
 * expo-secure-store, sincrono em vez de assincrono para leitura do token).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = options.auth === false ? null : authStorage.getAccessToken();
  const { response, parsed } = await rawRequest<T>(path, options, accessToken);

  if (response.status === 401 && options.auth !== false) {
    const tokens = await refreshTokens();
    if (tokens) {
      authStorage.saveTokens(tokens);
      const retry = await rawRequest<T>(path, options, tokens.accessToken);
      if (retry.response.ok && retry.parsed?.success) {
        return retry.parsed.data;
      }
      throw toApiError(retry.parsed, retry.response.status);
    }

    authStorage.clear();
    onUnauthenticated?.();
    throw new ApiError('UNAUTHENTICATED', 'Sessao expirada. Faca login novamente.', 401);
  }

  if (!response.ok || !parsed?.success) {
    throw toApiError(parsed, response.status);
  }

  return parsed.data;
}

function toApiError(parsed: ApiResponse<unknown> | undefined, status: number): ApiError {
  const body: ApiErrorBody | undefined = parsed && !parsed.success ? parsed.error : undefined;
  return new ApiError(body?.code ?? 'ERROR', body?.message ?? 'Erro inesperado.', status);
}
