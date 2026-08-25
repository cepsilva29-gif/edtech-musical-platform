import type { ApiResponse } from 'shared';

/**
 * Cliente HTTP minimo, so para estes testes: chama a API real via `fetch` (Node 20+ nativo), sem
 * nenhum bootstrap em processo - ao contrario de `apps/api/test/*.e2e-spec.ts` (que criam o
 * NestJS app em memoria e tem acesso direto ao PrismaService), este pacote so enxerga a API pela
 * fronteira HTTP publica, exatamente como um cliente real (admin/mobile) enxergaria. Isso e
 * deliberado: FASE 12 quer PELO MENOS uma camada de teste que nao sabe nada sobre a implementacao
 * interna da API, so sobre o contrato publico documentado em `packages/shared`.
 */

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const parsed = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !parsed.success) {
    const body = !parsed.success ? parsed.error : undefined;
    throw new ApiError(response.status, body?.code ?? 'ERROR', body?.message ?? 'Erro inesperado.');
  }

  return parsed.data;
}

/** Igual a `apiRequest`, mas devolve status+corpo em vez de lancar - util para asserts de erro. */
export async function apiRequestRaw(
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: ApiResponse<unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return { status: response.status, body: (await response.json()) as ApiResponse<unknown> };
}
