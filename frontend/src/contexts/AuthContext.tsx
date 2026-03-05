import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getMe, setToken, logout as apiLogout } from '../services/api';
import type { User } from '../types';

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

const DEV_TOKEN = 'dev-token';
const DEV_USER: User = { id: 'dev-user-001', name: 'Développeur AlternApp', email: 'dev@alternapp.local' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_USER);
  const [token, setTokenState] = useState<string | null>(DEV_TOKEN);

  // Synchronise le token de démarrage dans le module api.ts
  setToken(DEV_TOKEN);

  /**
   * Valide le token en appelant GET /auth/me.
   * Rejette si le serveur renvoie une erreur (le appelant peut catch).
   */
  const setAuthToken = useCallback(async (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    try {
      const me = await getMe();
      setUser(me);
    } catch (err) {
      setToken(null);
      setTokenState(null);
      setUser(null);
      throw err;
    }
  }, []);

  const loginDev = useCallback(() => {
    setUser({ id: 'dev', name: 'Dev User', email: 'dev@alternapp.local' });
    setTokenState('dev-token');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      setToken(null);
    }
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading: false,
        isAuthenticated: !!user,
        setAuthToken,
        loginDev,
        logout,
      }}
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
