'use client';

import type { UserProfile } from 'shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../services/api';
import { ApiError, setUnauthenticatedHandler } from '../services/api-client';
import { authStorage } from '../services/auth-storage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: UserProfile | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const loadProfile = useCallback(async () => {
    const accessToken = authStorage.getAccessToken();
    if (!accessToken) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const profile = await authApi.me();
      setUser(profile);
      setStatus('authenticated');
    } catch (error) {
      if (error instanceof ApiError) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
    // Bootstrap unico ao montar - le o token salvo (localStorage) e valida contra a API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();

    return () => setUnauthenticatedHandler(null);
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    authStorage.saveTokens(result);
    const profile = await authApi.me();
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    authStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.');
  }
  return context;
}
