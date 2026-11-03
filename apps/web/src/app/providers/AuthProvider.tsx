// apps/web/src/app/providers/AuthProvider.tsx
import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authEvents, http, restoreSession, tokenStore } from '@/shared/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  /** Call after a successful login to mark session as established */
  markAuthenticated: (accessToken: string) => void;
  /** Clear session state (called on logout or session-expired) */
  markUnauthenticated: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Manages authentication state:
 * - On mount: attempts to restore the session via the HttpOnly refresh cookie.
 * - Subscribes to authEvents.onSessionExpired: clears query cache and redirects.
 *
 * Phase 0: /auth/me is stubbed — the full current-user fetch is added in Phase 1.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const markUnauthenticated = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setStatus('unauthenticated');
    navigate('/login', { replace: true });
  }, [queryClient, navigate]);

  const markAuthenticated = useCallback((accessToken: string) => {
    tokenStore.set(accessToken);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    // Wait for the server to revoke the session and expire the HttpOnly cookie.
    // Do not report a successful logout when the server request failed.
    await http.post('/auth/logout', {});
    markUnauthenticated();
  }, [markUnauthenticated]);
  // ─── Restore session on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then((token) => {
        if (!cancelled) {
          markAuthenticated(token);
        }
      })
      .catch(() => {
        // No valid refresh cookie — user must log in
        if (!cancelled) {
          setStatus('unauthenticated');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [markAuthenticated]);

  // ─── Listen for session expiry events from the Axios interceptor ─────────
  useEffect(() => {
    const unsubscribe = authEvents.onSessionExpired(markUnauthenticated);
    return unsubscribe;
  }, [markUnauthenticated]);

  return (
    <AuthContext.Provider value={{ status, markAuthenticated, markUnauthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
