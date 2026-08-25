import type {
  CreateLiveSessionRequest,
  LivePlaybackUrl,
  LiveSession,
  PaginatedResult,
  UpdateLiveSessionRequest,
} from 'shared';
import { apiRequest } from '../api-client';

export const liveSessionsApi = {
  list: (query?: { instrumentId?: string; status?: string; page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<LiveSession>>('/live-sessions', { query }),
  get: (id: string) => apiRequest<LiveSession>(`/live-sessions/${id}`),
  create: (body: CreateLiveSessionRequest) =>
    apiRequest<LiveSession>('/live-sessions', { method: 'POST', body }),
  update: (id: string, body: UpdateLiveSessionRequest) =>
    apiRequest<LiveSession>(`/live-sessions/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/live-sessions/${id}`, { method: 'DELETE' }),
  goLive: (id: string) =>
    apiRequest<LiveSession>(`/live-sessions/${id}/go-live`, { method: 'POST' }),
  end: (id: string) => apiRequest<LiveSession>(`/live-sessions/${id}/end`, { method: 'POST' }),
  cancel: (id: string) =>
    apiRequest<LiveSession>(`/live-sessions/${id}/cancel`, { method: 'POST' }),
  getPlaybackUrl: (id: string) => apiRequest<LivePlaybackUrl>(`/live-sessions/${id}/playback`),
};
