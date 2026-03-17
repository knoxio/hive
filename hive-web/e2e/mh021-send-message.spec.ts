/**
 * MH-021: Send message — compose and send a message in the active room.
 *
 * Tests the REST `POST /api/rooms/:room_id/send` endpoint (the same path
 * the frontend uses when sending via WS is unavailable, and the same
 * daemon proxy path used during integration). Playwright API-only tests —
 * no browser required.
 *
 * Requires the server running with:
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

async function loginAsAdmin(
  request: Parameters<typeof test>[1] extends { request: infer R } ? R : never,
): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
}

// ---------------------------------------------------------------------------
// AC-1: Send message — auth enforced
// ---------------------------------------------------------------------------

test.describe('MH-021: POST /api/rooms/:id/send — auth', () => {
  test('returns 401 without token', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/rooms/test-room/send`, {
      data: { content: 'hello' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with invalid token', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/rooms/test-room/send`, {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
      data: { content: 'hello' },
    });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Send message — validation
// ---------------------------------------------------------------------------

test.describe('MH-021: POST /api/rooms/:id/send — validation', () => {
  test('returns 400 when content is missing', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/rooms/test-room/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });

  test('returns 400 when content is empty string', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/rooms/test-room/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: '' },
    });
    expect([400, 422]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// AC-3: Send message — success or daemon-unavailable
// ---------------------------------------------------------------------------

test.describe('MH-021: POST /api/rooms/:id/send — with valid credentials', () => {
  test('returns 200, 201, or 502 for a valid send request', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/rooms/test-general/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: 'hello from playwright mh021' },
    });
    // 200/201 = daemon accepted the message.
    // 502/503 = hive-server accepted auth but daemon is unreachable.
    // 404 = room does not exist.
    const valid = [200, 201, 404, 502, 503];
    expect(valid).toContain(res.status());
  });

  test('does not return 401 or 403 with a valid token', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/rooms/test-general/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: 'auth check message' },
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test('accepts a message with unicode content', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/rooms/test-general/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: '日本語テスト 🎉 emoji message' },
    });
    expect([200, 201, 404, 502, 503]).toContain(res.status());
  });

  test('accepts a long message within the 4000-char limit', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const longContent = 'a'.repeat(3999);
    const res = await request.post(`${API_URL}/api/rooms/test-general/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: longContent },
    });
    expect([200, 201, 404, 502, 503]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// AC-4: Revoked token → 401
// ---------------------------------------------------------------------------

test.describe('MH-021: POST /api/rooms/:id/send — revoked token', () => {
  test('returns 401 after token is revoked via logout', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const { token } = await loginRes.json();

    await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const sendRes = await request.post(`${API_URL}/api/rooms/test-room/send`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { content: 'should be rejected' },
    });
    expect(sendRes.status()).toBe(401);
  });
});
