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
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const loadProfile = useCallback(async () => {
    const accessToken = await authStorage.getAccessToken();
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
    // Bootstrap unico ao montar: verifica se ja existe um token salvo (expo-secure-store) e
    // valida contra a API. Nao ha estado derivavel do render para isto - e uma leitura de
    // sistema externo (keychain/keystore) que so pode acontecer em um efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();

    return () => setUnauthenticatedHandler(null);
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    await authStorage.saveTokens(result);
    const profile = await authApi.me();
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });
    await authStorage.saveTokens(result);
    const profile = await authApi.me();
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await authStorage.getRefreshToken();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    await authStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refreshProfile: loadProfile }),
    [user, status, login, register, logout, loadProfile],
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
