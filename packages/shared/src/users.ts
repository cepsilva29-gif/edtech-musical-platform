import type { UserStatus } from './auth';

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  status?: UserStatus;
  role?: string;
  search?: string;
}

export interface UpdateUserRolesRequest {
  roles: string[];
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
}
