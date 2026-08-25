import type { AuthResult, AuthTokens, LoginRequest, UserProfile } from 'shared';
import { apiRequest } from '../api-client';

export const authApi = {
  login: (body: LoginRequest) =>
    apiRequest<AuthResult>('/auth/login', { method: 'POST', body, auth: false }),

  logout: (refreshToken: string) =>
    apiRequest<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  me: () => apiRequest<UserProfile>('/users/me'),
};
