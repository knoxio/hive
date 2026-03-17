/**
 * Route guard that redirects unauthenticated users to /login (MH-007).
 *
 * Saves the current location so LoginPage can restore it after a successful
 * login (the `state.from` pattern).
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

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

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
