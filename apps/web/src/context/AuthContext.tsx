import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import i18n from 'i18next';
import type { User } from '@compasso/shared';
import { setSessionExpiredHandler } from '@/services/authEvents';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string, displayName?: string, locale?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

function syncLocale(user: User) {
  const locale = user.locale || 'en';
  i18n.changeLanguage(locale);
  localStorage.setItem('compasso-locale', locale);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setUser(data.data);
          syncLocale(data.data);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Register session expired handler to clear user state
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    setUser(data.data.user);
    syncLocale(data.data.user);
  }, []);

  const register = useCallback(
    async (username: string, password: string, email: string, displayName?: string, locale?: string) => {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password, email, displayName, locale }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      setUser(data.data.user);
      syncLocale(data.data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors during logout
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
