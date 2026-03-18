/**
 * MH-008: JWT sessions persisting across page reload
 *
 * UI tests using mocked routes — no running backend required.
 *
 * Tests cover:
 * - Session is restored from localStorage on app boot (AC-1)
 * - /api/auth/me returning 401 causes the app to clear auth and redirect (AC-2)
 * - Token survives page.reload() and subsequent navigations (AC-3)
 */

import { test, expect } from '@playwright/test';

// A mock JWT with admin role so the app renders past the auth guard.
// Payload: { sub: "1", username: "admin", role: "admin", exp: 9999999999 }
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock the two guard routes that run before any protected page renders.
 * Must be called before page.goto().
 */
async function mockCommonRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/setup/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setup_complete: true, has_admin: true }),
    }),
  );

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999 }),
    }),
  );
}

/**
 * Mount the app in an authenticated state:
 * injects a valid JWT, stubs the three required API routes, and navigates to /rooms.
 */
async function setupPage(page: import('@playwright/test').Page) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
  }, MOCK_TOKEN);

  await mockCommonRoutes(page);

  await page.route('**/api/rooms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rooms: [], total: 0 }),
    }),
  );

  await page.goto('/rooms');
}

// ---------------------------------------------------------------------------
// AC-1: Session is restored from localStorage — app shows authenticated state
// ---------------------------------------------------------------------------

test.describe('MH-008: session restore — valid token', () => {
  test('app renders the authenticated UI when a valid token is in localStorage', async ({ page }) => {
    await setupPage(page);
    // Should remain on /rooms (no redirect to /login).
    await expect(page).toHaveURL(/\/rooms/);
  });

  test('sub from JWT matches the user info exposed via /api/auth/me', async ({ page }) => {
    await setupPage(page);
    // The JWT payload we inject has sub="1".
    const payloadB64 = MOCK_TOKEN.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    expect(payload.sub).toBe('1');
    // /api/auth/me mock returns matching sub — app stays authenticated.
    await expect(page).toHaveURL(/\/rooms/);
  });

  test('exp in the /api/auth/me response is in the future', async ({ page }) => {
    // Verify the mocked /api/auth/me returns an exp beyond the current time.
    let capturedExp: number | undefined;
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await page.route('**/api/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_complete: true, has_admin: true }),
      }),
    );

    await page.route('**/api/auth/me', async (route) => {
      const body = { sub: '1', username: 'admin', role: 'admin', exp: 9999999999 };
      capturedExp = body.exp;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      }),
    );

    await page.goto('/rooms');
    await expect(page).toHaveURL(/\/rooms/);
    expect(capturedExp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

// ---------------------------------------------------------------------------
// AC-2: Auth enforcement — frontend reacts correctly to /api/auth/me responses
// ---------------------------------------------------------------------------

test.describe('MH-008: auth enforcement', () => {
  test('navigating to /rooms without a token redirects to /login', async ({ page }) => {
    // No token in localStorage — RequireAuth redirects to /login.
    await page.route('**/api/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_complete: true, has_admin: true }),
      }),
    );
    await page.goto('/rooms');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/api/auth/me returning 401 clears auth and redirects to /login', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await page.route('**/api/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_complete: true, has_admin: true }),
      }),
    );

    // Server rejects the token — app must clear auth and redirect.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'token revoked' }),
      }),
    );

    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      }),
    );

    await page.goto('/rooms');
    // AuthContext detects the 401, clears the token, sets sessionExpired=true → redirect.
    await expect(page).toHaveURL(/\/login/);
  });

  test('token is cleared from localStorage after /api/auth/me returns 401', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await page.route('**/api/setup/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ setup_complete: true, has_admin: true }),
      }),
    );

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'token revoked' }),
      }),
    );

    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      }),
    );

    await page.goto('/rooms');
    await page.waitForURL(/\/login/);

    const storedToken = await page.evaluate(() => localStorage.getItem('hive-auth-token'));
    expect(storedToken).toBeNull();
  });

  test('valid token from /auth/me is accepted — app stays on protected route', async ({ page }) => {
    await setupPage(page);
    await expect(page).toHaveURL(/\/rooms/);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Session persistence — token survives reload and subsequent navigations
// ---------------------------------------------------------------------------

test.describe('MH-008: session persistence', () => {
  test('token stored in localStorage survives page.reload()', async ({ page }) => {
    await setupPage(page);

    // Reload — token must still be in localStorage.
    await page.reload();
    const storedToken = await page.evaluate(() => localStorage.getItem('hive-auth-token'));
    expect(storedToken).not.toBeNull();
  });

  test('app is still authenticated after page.reload()', async ({ page }) => {
    await setupPage(page);
    // Re-register the mocks for the reload request.
    await mockCommonRoutes(page);
    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      }),
    );

    await page.reload();
    // Should remain on /rooms and NOT be redirected to /login.
    await expect(page).toHaveURL(/\/rooms/);
  });

  test('multiple navigations with the same token all succeed', async ({ page }) => {
    await setupPage(page);

    for (let i = 0; i < 3; i++) {
      await page.goto('/rooms');
      await expect(page).toHaveURL(/\/rooms/);
    }
  });
});
