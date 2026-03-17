/**
 * Auth provider (MH-008).
 *
 * Manages the authentication lifecycle:
 * - Synchronous init from localStorage to avoid a flash of the login page.
 * - Async background validation via GET /api/auth/me to catch revoked tokens.
 * - Cross-tab logout via the `storage` event.
 *
 * Wrap the app with <AuthProvider> in main.tsx. Components read state via
 * the `useAuth` hook from `hooks/useAuth.ts`.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  TOKEN_KEY,
  authHeader,
  clearToken,
  getToken,
  getUserFromToken,
  isTokenExpired,
  setToken,
} from '../lib/auth';
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
} from './auth-context';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// State type (internal)
// ---------------------------------------------------------------------------

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
}

// ---------------------------------------------------------------------------
// Synchronous initial state
// ---------------------------------------------------------------------------

/**
 * Compute the initial auth state synchronously from localStorage.
 * This runs before the first render, preventing a flash of the login page.
 */
function computeInitialState(): AuthState {
  const expired = isTokenExpired();
  if (expired) {
    const hadToken = !!localStorage.getItem(TOKEN_KEY);
    if (hadToken) {
      // Token was present but expired — clear it and flag expiry.
      clearToken();
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        sessionExpired: true,
      };
    }
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: false,
    };
  }

  // Token present and not client-side expired → treat as authenticated
  // immediately; validate with server in the background.
  const user = getUserFromToken();
  return {
    user,
    isAuthenticated: true,
    isLoading: true,
    sessionExpired: false,
  };
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

/** Wrap the app with this provider in main.tsx. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(computeInitialState);

  // ------------------------------------------------------------------
  // Background server-side validation (runs once on mount)
  // ------------------------------------------------------------------
  useEffect(() => {
    // Read from localStorage directly so this effect has no state dependencies.
    const token = getToken();
    if (!token || isTokenExpired()) return;

    let cancelled = false;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: authHeader(),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as AuthUser;
          setState((s) => ({
            ...s,
            user: { sub: data.sub, username: data.username, role: data.role },
            isLoading: false,
          }));
        } else {
          // 401 → token was revoked or is invalid server-side.
          clearToken();
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            sessionExpired: true,
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network error — keep optimistic auth state; stop loading.
        setState((s) => ({ ...s, isLoading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, []); // intentionally empty: reads from localStorage, not from state

  // ------------------------------------------------------------------
  // Cross-tab logout
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && e.newValue === null) {
        // Another tab cleared the token (logout).
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionExpired: false,
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const login = (token: string) => {
    setToken(token);
    const user = getUserFromToken();
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
    });
  };

  const logout = () => {
    clearToken();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: false,
    });
  };

  const value: AuthContextValue = { ...state, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
