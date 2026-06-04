import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types';
import { authApi } from '../services/auth';
import { ApiError } from '../lib/apiClient';

interface AuthContextValue {
  user: AuthUser | null;
  /** True only during the initial "am I logged in?" check. */
  loading: boolean;
  setUser: (user: AuthUser) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUserState(me);
    } catch (err) {
      // 401 just means "not logged in"; anything else we also treat as guest.
      if (!(err instanceof ApiError)) console.error('[auth] refresh falhou', err);
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    // Initial "am I logged in?" check against the backend; async data-fetch effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUserState(null);
    }
  }, []);

  const setUser = useCallback((u: AuthUser) => setUserState(u), []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
