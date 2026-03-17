/**
 * SetupGuard — redirects to /setup when the first-run wizard is incomplete (MH-004).
 *
 * Checks GET /api/setup/status on first render. While the status is loading,
 * children are not rendered (avoids a flash of the protected app). Once the
 * status resolves:
 *
 * - setup_complete=true  → render children normally
 * - setup_complete=false → redirect to /setup
 *
 * The /setup route itself must NOT be wrapped by SetupGuard to avoid a loop.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface SetupStatusResponse {
  setup_complete: boolean;
  has_admin: boolean;
}

interface SetupGuardProps {
  children: ReactNode;
}

/**
 * Wrap protected routes with SetupGuard to enforce first-run wizard completion.
 *
 * @example
 * <Route path="/*" element={<SetupGuard><RequireAuth><App /></RequireAuth></SetupGuard>} />
 */
export function SetupGuard({ children }: SetupGuardProps) {
  const [status, setStatus] = useState<'loading' | 'complete' | 'incomplete'>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/setup/status`)
      .then((res) => res.json() as Promise<SetupStatusResponse>)
      .then((data) => {
        if (!cancelled) {
          setStatus(data.setup_complete ? 'complete' : 'incomplete');
        }
      })
      .catch(() => {
        // If the server is unreachable treat as incomplete so the wizard
        // can surface the connectivity problem.
        if (!cancelled) setStatus('incomplete');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    // Minimal spinner; avoids layout flash while fetching status.
    return (
      <div
        className="min-h-screen bg-gray-900 flex items-center justify-center"
        data-testid="setup-guard-loading"
      >
        <svg
          aria-label="Loading"
          className="animate-spin h-8 w-8 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (status === 'incomplete') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
