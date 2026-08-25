import type {
  ListUsersQuery,
  PaginatedResult,
  UpdateUserRolesRequest,
  UpdateUserStatusRequest,
  UserProfile,
} from 'shared';
import { apiRequest } from '../api-client';

export const usersApi = {
  list: (query?: ListUsersQuery) =>
    apiRequest<PaginatedResult<UserProfile>>('/users', {
      query: query as Record<string, string | number | boolean | undefined> | undefined,
    }),

  get: (id: string) => apiRequest<UserProfile>(`/users/${id}`),

  updateRoles: (id: string, body: UpdateUserRolesRequest) =>
    apiRequest<UserProfile>(`/users/${id}/roles`, { method: 'PATCH', body }),

  updateStatus: (id: string, body: UpdateUserStatusRequest) =>
    apiRequest<UserProfile>(`/users/${id}/status`, { method: 'PATCH', body }),
};
