/**
 * Auth context definition and hook (MH-008).
 *
 * Separated from AuthContext.tsx so that the provider component file
 * can satisfy the react-refresh/only-export-components rule.
 */

import { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  sub: string;
  username: string;
  role: string;
}

export interface AuthContextValue {
  /** Currently authenticated user, or null. */
  user: AuthUser | null;
  /** True when a valid, non-expired token is present. */
  isAuthenticated: boolean;
  /**
   * True while the background /api/auth/me request is in-flight.
   * UI renders protected content immediately; this flag is for spinners or
   * stale-content indicators.
   */
  isLoading: boolean;
  /**
   * True when the previous session was invalidated (expired or revoked).
   * LoginPage reads this to show the "Session expired" banner.
   */
  sessionExpired: boolean;
  /** Call after a successful login to update context without reloading. */
  login: (token: string) => void;
  /** Clear the stored token and reset auth state. */
  logout: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook to consume the AuthContext.
 *
 * @throws when called outside <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
