/**
 * MH-007: Login page wired into router.
 *
 * Tests use mocked /api/auth/login responses so they do not require a running
 * backend.  localStorage is cleared before each test to ensure a clean state.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock a successful login response. */
async function mockLoginSuccess(page: import('@playwright/test').Page, token = 'test-jwt-token') {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token,
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
        user: { username: 'admin', role: 'admin' },
      }),
    }),
  );
}

/** Mock a failed (401) login response. */
async function mockLoginFailure(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', message: 'bad credentials' }),
    }),
  );
}

/** Clear auth token from localStorage. */
async function clearAuth(page: import('@playwright/test').Page) {
  await page.evaluate(() => localStorage.removeItem('hive-auth-token'));
}

/** Set a fake auth token in localStorage. */
async function setAuth(page: import('@playwright/test').Page, token = 'existing-token') {
  await page.evaluate((t) => localStorage.setItem('hive-auth-token', t), token);
}

// ---------------------------------------------------------------------------
// MH-007 — Login page renders
// ---------------------------------------------------------------------------

test.describe('MH-007: Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await clearAuth(page);
  });

  test('login page renders at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-page')).toBeVisible();
  });

  test('login form has username and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-username')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
  });

  test('login form has a submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('submit button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeDisabled();
  });

  test('submit button enables when both fields are filled', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('secret');
    await expect(page.getByTestId('login-submit')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// MH-007 — Show/hide password toggle
// ---------------------------------------------------------------------------

test.describe('MH-007: Password show/hide toggle', () => {
  test('password field is hidden by default', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
  });

  test('toggle reveals password', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-password').fill('secret');
    await page.getByTestId('login-toggle-password').click();
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text');
  });

  test('toggle hides password again on second click', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-toggle-password').click();
    await page.getByTestId('login-toggle-password').click();
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
  });

  test('toggle button is keyboard-focusable', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-toggle-password').focus();
    await expect(page.getByTestId('login-toggle-password')).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// MH-007 — Successful login flow
// ---------------------------------------------------------------------------

test.describe('MH-007: Successful login', () => {
  test('successful login stores token and navigates to /', async ({ page }) => {
    await clearAuth(page);
    await mockLoginSuccess(page, 'my-jwt');
    await page.route('**/api/rooms', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) }),
    );

    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL('/');
    const token = await page.evaluate(() => localStorage.getItem('hive-auth-token'));
    expect(token).toBe('my-jwt');
  });

  test('login form shows loading state while request is in flight', async ({ page }) => {
    await clearAuth(page);
    let resolveRoute: () => void;
    await page.route('**/api/auth/login', async (route) => {
      await new Promise<void>((resolve) => { resolveRoute = resolve; });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 't', expires_at: '', user: { username: 'a', role: 'a' } }),
      });
    });

    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();

    // During the in-flight request, button should be disabled / show loading text
    await expect(page.getByTestId('login-submit')).toBeDisabled();
    await expect(page.getByTestId('login-submit')).toContainText('Signing in');

    // Resolve the request so the test can clean up
    resolveRoute!();
  });

  test('Enter key submits the form', async ({ page }) => {
    await clearAuth(page);
    await mockLoginSuccess(page);
    await page.route('**/api/rooms', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) }),
    );

    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-password').press('Enter');

    await expect(page).toHaveURL('/');
  });
});

// ---------------------------------------------------------------------------
// MH-007 — Failed login
// ---------------------------------------------------------------------------

test.describe('MH-007: Failed login', () => {
  test('failed login shows inline error without clearing username', async ({ page }) => {
    await clearAuth(page);
    await mockLoginFailure(page);

    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    // Error shown
    const error = page.getByTestId('login-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Invalid username or password');

    // Username not cleared
    await expect(page.getByTestId('login-username')).toHaveValue('admin');

    // Still on /login
    await expect(page).toHaveURL('/login');
  });

  test('password field is cleared after failed login', async ({ page }) => {
    await clearAuth(page);
    await mockLoginFailure(page);

    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-password')).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// MH-007 — Already authenticated redirect
// ---------------------------------------------------------------------------

test.describe('MH-007: Already authenticated redirect', () => {
  test('navigating to /login when already authed redirects to /', async ({ page }) => {
    // Set a token before navigating
    await page.goto('/login');
    await setAuth(page);
    await page.route('**/api/rooms', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) }),
    );

    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});
