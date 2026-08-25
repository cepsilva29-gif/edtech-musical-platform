import type { LivePlaybackUrl, LiveSession, PaginatedResult } from 'shared';
import { apiRequest } from '../api-client';

/**
 * "App do aluno" (docs/00-primeira-entrega.md, secao 3) - so leitura/playback. Gerenciar uma live
 * (go-live/end/cancel/CRUD) e acao de professor/admin e pertence ao painel administrativo
 * (apps/admin, FASE 11), nao a este app.
 */
export const liveSessionsApi = {
  list: (query?: { instrumentId?: string; status?: string; page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<LiveSession>>('/live-sessions', { query }),

  get: (id: string) => apiRequest<LiveSession>(`/live-sessions/${id}`),

  getPlaybackUrl: (id: string) => apiRequest<LivePlaybackUrl>(`/live-sessions/${id}/playback`),
};
