export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: AuthenticatedUser;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING_VERIFICATION';

/** Resposta de GET /users/me. */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: string[];
  emailVerifiedAt: string | null;
  createdAt: string;
}
