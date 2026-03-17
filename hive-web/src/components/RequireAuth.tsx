/**
 * Route guard that redirects unauthenticated users to /login (MH-007, MH-008).
 *
 * Saves the current location so LoginPage can restore it after a successful
 * login (the `state.from` pattern).  When the session has expired, passes
 * `sessionExpired: true` in location state so LoginPage can show a banner.
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Wrap protected routes with RequireAuth.
 *
 * @example
 * <Route path="/*" element={<RequireAuth><App /></RequireAuth>} />
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const { isAuthenticated, sessionExpired } = useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, sessionExpired }}
        replace
      />
    );
  }

  return <>{children}</>;
}
