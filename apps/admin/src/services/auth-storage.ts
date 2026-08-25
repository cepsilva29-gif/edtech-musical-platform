import type { AuthTokens } from 'shared';

const ACCESS_TOKEN_KEY = 'admin.auth.accessToken';
const REFRESH_TOKEN_KEY = 'admin.auth.refreshToken';

/**
 * `localStorage` (client-side apenas, sem SSR de sessao) - escolha deliberada de simplicidade
 * para este painel interno (decisao em docs/ARCHITECTURE.md): a alternativa mais segura seria um
 * cookie httpOnly + sessao no servidor (Next.js middleware), mas isso exigiria uma camada de
 * backend-for-frontend so para isto. Como o `apps/api` ja e a fonte de verdade de autorizacao
 * (todo endpoint sensivel revalida o token de qualquer forma), o risco adicional de XSS aqui e
 * aceito para o estagio atual do produto.
 */
export const authStorage = {
  saveTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
