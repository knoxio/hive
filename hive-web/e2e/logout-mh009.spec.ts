/**
 * MH-009: Logout functionality
 *
 * Tests that the logout flow correctly:
 * - Calls POST /api/auth/logout and receives 200
 * - Revokes the token (subsequent requests return 401)
 * - Clears local auth state
 * - Redirects to /login
 *
 * Requires the server running with HIVE_JWT_SECRET + HIVE_ADMIN_USER/PASSWORD.
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
  const { token } = await res.json();
  expect(typeof token).toBe('string');
  return token as string;
}

// ---------------------------------------------------------------------------
// AC-2: POST /api/auth/logout returns 200 with a valid token
// ---------------------------------------------------------------------------

test.describe('MH-009: POST /api/auth/logout — success', () => {
  test('returns 200 with {message} on valid Bearer token', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  test('token is revoked after logout — protected endpoint returns 401', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Confirm access before logout.
    const before = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(before.status()).not.toBe(401);

    // Logout.
    await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // The same token must now be rejected.
    const after = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status()).toBe(401);
    const body = await after.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('double-logout with same token is idempotent — returns 401 on second call', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Second logout with revoked token → auth_middleware rejects it.
    const res = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC: missing / invalid token on logout endpoint
// ---------------------------------------------------------------------------

test.describe('MH-009: POST /api/auth/logout — auth required', () => {
  test('missing token returns 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/logout`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('invalid token returns 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: 'Bearer garbage.token.value' },
    });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC: UI — logout button clears token and redirects (browser tests)
// ---------------------------------------------------------------------------

test.describe('MH-009: logout UI', () => {
  test.beforeEach(async ({ page, request }) => {
    // Seed localStorage with a valid token before navigating to the app.
    const token = await loginAsAdmin({ request });
    await page.goto(`${process.env.HIVE_WEB_URL || 'http://localhost:5173'}/`);
    await page.evaluate((t) => localStorage.setItem('hive-auth-token', t), token);
    await page.reload();
  });

  test('logout button is visible in the top nav', async ({ page }) => {
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('clicking logout redirects to /login', async ({ page }) => {
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('local storage token is cleared after logout', async ({ page }) => {
    await page.getByTestId('logout-button').click();
    await page.waitForURL(/\/login/);
    const token = await page.evaluate(() => localStorage.getItem('hive-auth-token'));
    expect(token).toBeNull();
  });

  test('navigating to protected route after logout redirects to /login', async ({ page }) => {
    await page.getByTestId('logout-button').click();
    await page.waitForURL(/\/login/);
    await page.goto(`${process.env.HIVE_WEB_URL || 'http://localhost:5173'}/rooms`);
    await expect(page).toHaveURL(/\/login/);
  });
});
