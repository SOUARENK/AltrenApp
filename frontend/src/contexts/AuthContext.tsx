import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe, setToken, logout as apiLogout } from '../services/api';
import type { User } from '../types';

const STORAGE_KEY = 'alternapp_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuthToken: (token: string) => Promise<void>;
  loginDev: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Au chargement : restaure la session depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setIsLoading(false);
      return;
    }
    setToken(saved);
    getMe()
      .then((me) => {
        setTokenState(saved);
        setUser(me);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setAuthToken = useCallback(async (newToken: string) => {
    setToken(newToken);
    const me = await getMe();
    setTokenState(newToken);
    setUser(me);
    localStorage.setItem(STORAGE_KEY, newToken);
  }, []);

  const loginDev = useCallback(() => {
    const devToken = 'dev-token';
    setToken(devToken);
    setTokenState(devToken);
    setUser({ id: 'dev', name: 'Dev User', email: 'dev@alternapp.local' });
    localStorage.setItem(STORAGE_KEY, devToken);
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setToken(null);
    setTokenState(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated: !!user, setAuthToken, loginDev, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
