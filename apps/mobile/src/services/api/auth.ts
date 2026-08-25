import type {
  AuthResult,
  AuthTokens,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserProfile,
} from 'shared';
import { apiRequest } from '../api-client';

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<AuthResult>('/auth/register', { method: 'POST', body, auth: false }),

  login: (body: LoginRequest) =>
    apiRequest<AuthResult>('/auth/login', { method: 'POST', body, auth: false }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    apiRequest<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  logoutAll: () => apiRequest<{ loggedOut: true }>('/auth/logout-all', { method: 'POST' }),

  changePassword: (body: ChangePasswordRequest) =>
    apiRequest<{ changed: true }>('/auth/change-password', { method: 'POST', body }),

  forgotPassword: (body: ForgotPasswordRequest) =>
    apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body,
      auth: false,
    }),

  resetPassword: (body: ResetPasswordRequest) =>
    apiRequest<{ reset: true }>('/auth/reset-password', { method: 'POST', body, auth: false }),

  me: () => apiRequest<UserProfile>('/users/me'),
};
