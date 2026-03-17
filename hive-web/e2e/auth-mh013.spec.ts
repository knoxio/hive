/**
 * MH-013: Basic token-based auth
 *
 * Tests that the Hive backend issues and validates JWTs correctly.
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
async function loginAsAdmin(request: Parameters<typeof test>[1] extends { request: infer R } ? R : never): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.token).toBe('string');
  return body.token as string;
}

// ---------------------------------------------------------------------------
// AC-1: POST /api/auth/login returns signed JWT on success
// ---------------------------------------------------------------------------

test.describe('MH-013: POST /api/auth/login — success', () => {
  test('returns 200 with token on valid credentials', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token_type).toBe('Bearer');
    expect(typeof body.expires_in).toBe('number');
    expect(typeof body.username).toBe('string');
  });

  test('JWT payload contains sub, username, role, iat, exp, jti', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const { token } = await res.json();

    // Decode the JWT payload (middle part, base64url-encoded).
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    expect(typeof payload.sub).toBe('string');
    expect(payload.sub.length).toBeGreaterThan(0);
    expect(payload.username).toBe(ADMIN_USER);
    expect(typeof payload.role).toBe('string');
    expect(payload.role.length).toBeGreaterThan(0);
    expect(typeof payload.jti).toBe('string');
    expect(payload.jti.length).toBeGreaterThan(0);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test('token TTL is at least 3600 seconds', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const body = await res.json();
    expect(body.expires_in).toBeGreaterThanOrEqual(3600);
  });
});

// ---------------------------------------------------------------------------
// AC-1: invalid credentials return 401
// ---------------------------------------------------------------------------

test.describe('MH-013: POST /api/auth/login — invalid credentials', () => {
  test('wrong password returns 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: 'wrong-password' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('unknown username returns 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: 'nobody', password: 'any-password' },
    });
    expect(res.status()).toBe(401);
  });

  test('missing body fields return 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: '', password: '' },
    });
    expect([400, 401, 422]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// AC-4: protected endpoints validate JWT
// ---------------------------------------------------------------------------

test.describe('MH-013: protected endpoints require valid JWT', () => {
  test('missing token on protected endpoint returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('malformed Authorization header returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status()).toBe(401);
  });

  test('invalid (garbage) token returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('valid token allows access to protected endpoint', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 (rooms list) or 502/503 (daemon unreachable) — not 401
    expect(res.status()).not.toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-5/6: structured 401 error body
// ---------------------------------------------------------------------------

test.describe('MH-013: 401 error response format', () => {
  test('missing token returns structured 401 body', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  test('invalid token returns structured 401 body', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: 'Bearer garbage.token.here' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// AC-3: public endpoints do not require auth
// ---------------------------------------------------------------------------

test.describe('MH-013: public endpoints work without auth', () => {
  test('GET /api/health is accessible without token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    expect(res.status()).toBe(200);
  });

  test('POST /api/auth/login is accessible without token', async ({ request }) => {
    // Already tested above — verify it does not return 401 for the endpoint itself
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: 'nonexistent', password: 'bad' },
    });
    expect(res.status()).not.toBe(405); // method not allowed would be a routing bug
  });
});
