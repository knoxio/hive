/**
 * Client-side auth token management (MH-007).
 *
 * Stores the JWT in localStorage so it survives page reloads.  The token is
 * read on every request — there is no in-memory cache to keep in sync.
 */

const TOKEN_KEY = 'hive-auth-token';

/** Retrieve the stored JWT, or null if not authenticated. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist a JWT after successful login. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored JWT (logout). */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Return true when a token is present (does not validate signature/expiry). */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Build an Authorization header value from the stored token.
 * Returns undefined when no token is present.
 */
export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
