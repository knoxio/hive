/**
 * Login page at /login (MH-007, MH-008).
 *
 * Username + password form that calls POST /api/auth/login, stores the
 * returned JWT, and redirects to the originally requested URL (or /).
 * Shows a "Session expired" banner when redirected from a protected route
 * with an expired or revoked token.
 */

import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, setToken } from '../lib/auth';
import { FieldError } from './FieldError';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface LoginResponse {
  token: string;
  expires_at: string;
  user: { username: string; role: string };
}

/**
 * Login page.
 *
 * Accessible at /login (no auth required).  Already-authenticated users are
 * redirected immediately to the dashboard.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Already logged in → go straight to the dashboard
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  // After login, restore the originally requested URL or fall back to /
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';
  const sessionExpired =
    (location.state as { sessionExpired?: boolean } | null)?.sessionExpired ?? false;

  return <LoginForm from={from} navigate={navigate} sessionExpired={sessionExpired} />;
}

// ---------------------------------------------------------------------------
// Inner form component — separated to allow hooks after the auth redirect guard
// ---------------------------------------------------------------------------

interface LoginFormProps {
  from: string;
  navigate: ReturnType<typeof useNavigate>;
  sessionExpired: boolean;
}

function LoginForm({ from, navigate, sessionExpired }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data: LoginResponse = await res.json();
        setToken(data.token);
        navigate(from, { replace: true });
        return;
      }

      // Failed login — keep username, clear password, show error
      setPassword('');
      if (res.status === 401) {
        setError('Invalid username or password.');
      } else if (res.status === 429) {
        setError('Too many login attempts — please wait a moment.');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch {
      setError('Could not reach the server — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-900 flex items-center justify-center px-4"
      data-testid="login-page"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-sm">
        {/* Session expired banner */}
        {sessionExpired && (
          <div
            role="alert"
            data-testid="session-expired-banner"
            className="mb-4 rounded-md bg-yellow-900 border border-yellow-700 px-3 py-2 text-sm text-yellow-200"
          >
            Your session has expired. Please sign in again.
          </div>
        )}

        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-1">Hive</h1>
        <p className="text-gray-400 text-sm mb-6">Sign in to continue</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Username */}
          <div>
            <label
              htmlFor="login-username"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="login-username"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your-username"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                data-testid="login-toggle-password"
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-200 focus:outline-none focus:text-gray-200"
              >
                {showPassword ? (
                  // Eye-off icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                  </svg>
                ) : (
                  // Eye icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Inline error */}
          <FieldError message={error} data-testid="login-error" />

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            data-testid="login-submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                aria-hidden="true"
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
