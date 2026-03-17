/**
 * Client-side auth token management (MH-007, MH-008).
 *
 * Stores the JWT in localStorage so it survives page reloads.  The token is
 * read on every request — there is no in-memory cache to keep in sync.
 */

export const TOKEN_KEY = 'hive-auth-token';

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

// ---------------------------------------------------------------------------
// JWT payload helpers (MH-008)
// ---------------------------------------------------------------------------

/** Decoded JWT payload fields relevant to the client. */
export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
  exp: number;
  iat: number;
}

/**
 * Decode the JWT payload without verifying the signature.
 *
 * For client-side use only — do NOT use this for authorization decisions.
 * Returns null on any parse failure.
 */
export function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the stored JWT is expired based on its `exp` claim.
 * A missing or unparseable token is treated as expired.
 */
export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  // Compare in seconds; add 5s leeway for clock skew.
  return Date.now() / 1000 >= payload.exp - 5;
}

/**
 * Extract user info from the stored JWT payload without contacting the server.
 * Returns null when no token is present or the payload cannot be decoded.
 */
export function getUserFromToken(): { username: string; role: string; sub: string } | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  return { username: payload.username, role: payload.role, sub: payload.sub };
}
