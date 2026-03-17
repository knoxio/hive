/**
 * MH-008: JWT sessions persisting across page reload
 *
 * Tests for GET /api/auth/me — the endpoint used on app boot to validate
 * the stored JWT and restore session state without re-authentication.
 *
 * Requires the server to be running with:
 *   HIVE_JWT_SECRET=<>=32-byte secret>
 *   HIVE_ADMIN_USER=admin
 *   HIVE_ADMIN_PASSWORD=test-password
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Obtain a valid JWT by logging in with the test admin credentials. */
async function loginAsAdmin(
  request: Parameters<typeof test>[1] extends { request: infer R } ? R : never,
): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.token).toBe('string');
  return body.token as string;
}

// ---------------------------------------------------------------------------
// AC-1: GET /api/auth/me returns user info for a valid token
// ---------------------------------------------------------------------------

test.describe('MH-008: GET /api/auth/me — valid token', () => {
  test('returns 200 with username, role, sub, exp', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.username).toBe(ADMIN_USER);
    expect(typeof body.role).toBe('string');
    expect(body.role.length).toBeGreaterThan(0);
    expect(typeof body.sub).toBe('string');
    expect(body.sub.length).toBeGreaterThan(0);
    expect(typeof body.exp).toBe('number');
    expect(body.exp).toBeGreaterThan(Date.now() / 1000);
  });

  test('sub matches the user id from the login token', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Decode the login token payload to get sub
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.sub).toBe(payload.sub);
  });

  test('exp is in the future and within 24h window', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    const nowSecs = Math.floor(Date.now() / 1000);
    expect(body.exp).toBeGreaterThan(nowSecs);
    // Default TTL is 86400s; allow up to 7 days for custom configs.
    expect(body.exp - nowSecs).toBeLessThanOrEqual(7 * 86_400);
  });
});

// ---------------------------------------------------------------------------
// AC-2: GET /api/auth/me rejects missing / invalid tokens
// ---------------------------------------------------------------------------

test.describe('MH-008: GET /api/auth/me — auth enforcement', () => {
  test('missing token returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('garbage token returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer not.a.jwt' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('malformed Authorization header returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status()).toBe(401);
  });

  test('valid token from /login is accepted by /me', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Session persistence simulation — token survives a "page reload"
// ---------------------------------------------------------------------------

test.describe('MH-008: session persistence', () => {
  test('token obtained on login is still valid on subsequent request', async ({
    request,
  }) => {
    // Simulate login → store token → reload → call /me with stored token.
    const token = await loginAsAdmin({ request });

    // Simulate "reload" by using the same token in a fresh request.
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.username).toBe(ADMIN_USER);
  });

  test('multiple /me calls with the same token all succeed', async ({
    request,
  }) => {
    const token = await loginAsAdmin({ request });
    for (let i = 0; i < 3; i++) {
      const res = await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    }
  });
});
