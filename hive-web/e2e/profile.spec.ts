/**
 * Playwright e2e tests for MH-011 — User Profile page.
 *
 * All API calls are intercepted with `page.route()` so no backend is needed.
 * Tokens are fabricated JWTs — only the payload field is read by the frontend.
 */

import { test, expect, type Page } from '@playwright/test';

/** Build a fake JWT whose payload decodes to `data`. Signature is not verified. */
function makeToken(data: {
  sub: string;
  username: string;
  role: string;
  exp?: number;
}): string {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: data.sub,
      username: data.username,
      role: data.role,
      jti: 'test-jti',
      iat: 0,
      exp: data.exp ?? 9_999_999_999,
    }),
  ).toString('base64url');
  return `${header}.${payload}.fake-signature`;
}

const DEFAULT_PROFILE = { id: '1', username: 'alice', role: 'admin' };
const DEFAULT_TOKEN = makeToken({ sub: '1', username: 'alice', role: 'admin' });

/**
 * Set auth token in localStorage and stub the common protected endpoints.
 */
async function setupAuth(
  page: Page,
  opts: {
    profile?: typeof DEFAULT_PROFILE;
    token?: string;
    apiStatus?: number;
  } = {},
) {
  const profile = opts.profile ?? DEFAULT_PROFILE;
  const token = opts.token ?? makeToken({ sub: profile.id, username: profile.username, role: profile.role });

  // Navigate once to set localStorage (must be on the origin first).
  await page.goto('/login');
  await page.evaluate((tok) => localStorage.setItem('hive-auth-token', tok), token);

  // Stub /api/users/me
  if (opts.apiStatus && opts.apiStatus >= 400) {
    await page.route('**/api/users/me', (route) =>
      route.fulfill({
        status: opts.apiStatus!,
        json: { code: 'INTERNAL_ERROR', message: 'server error' },
      }),
    );
  } else {
    await page.route('**/api/users/me', (route) =>
      route.fulfill({ json: profile }),
    );
  }

  // Stub other protected endpoints to prevent noise
  await page.route('**/api/rooms', (route) => route.fulfill({ json: { rooms: [] } }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { sub: profile.id, username: profile.username, role: profile.role, exp: 9_999_999_999 },
    }),
  );
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({ status: 200, json: { message: 'logged out' } }),
  );
}

// ---------------------------------------------------------------------------

test.describe('Profile page', () => {
  test('renders profile page at /profile', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/profile');

    await expect(page.getByTestId('profile-page')).toBeVisible();
  });

  test('shows username in heading and detail row', async ({ page }) => {
    await setupAuth(page, { profile: { id: '7', username: 'alice', role: 'admin' } });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-username-heading')).toHaveText('alice');
    await expect(page.getByTestId('profile-username-field')).toHaveText('alice');
  });

  test('shows admin role badge', async ({ page }) => {
    await setupAuth(page, { profile: { id: '1', username: 'alice', role: 'admin' } });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-role-badge')).toHaveText('admin');
    await expect(page.getByTestId('profile-role-field')).toHaveText('admin');
  });

  test('shows user role badge for non-admin', async ({ page }) => {
    await setupAuth(page, { profile: { id: '2', username: 'bob', role: 'user' } });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-role-badge')).toHaveText('user');
  });

  test('avatar shows two-char initials from username', async ({ page }) => {
    await setupAuth(page, { profile: { id: '1', username: 'alice', role: 'admin' } });
    await page.goto('/profile');

    const avatar = page.getByTestId('profile-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('AL');
  });

  test('single-char username shows one-char initials', async ({ page }) => {
    await setupAuth(page, { profile: { id: '3', username: 'x', role: 'user' } });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-avatar')).toHaveText('X');
  });

  test('shows user ID in detail row', async ({ page }) => {
    await setupAuth(page, { profile: { id: '42', username: 'alice', role: 'admin' } });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-id-field')).toContainText('42');
  });

  test('back link navigates to home', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/profile');

    await page.getByTestId('profile-back-link').click();
    await expect(page).toHaveURL('/');
  });

  test('back link is keyboard-focusable', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/profile');

    const backLink = page.getByTestId('profile-back-link');
    await backLink.focus();
    await expect(backLink).toBeFocused();
  });

  test('shows error state when API returns 500', async ({ page }) => {
    await setupAuth(page, { apiStatus: 500 });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-error-state')).toBeVisible();
    const errEl = page.getByTestId('profile-error');
    await expect(errEl).toBeVisible();
    // Must not show raw status code
    await expect(errEl).not.toContainText('500');
  });

  test('error state includes back link', async ({ page }) => {
    await setupAuth(page, { apiStatus: 503 });
    await page.goto('/profile');

    await expect(page.getByTestId('profile-error-back')).toBeVisible();
  });

  test('profile nav button is visible in app', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');

    await expect(page.getByTestId('profile-nav-button')).toBeVisible();
  });

  test('profile nav button navigates to /profile', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');

    await page.getByTestId('profile-nav-button').click();
    await expect(page).toHaveURL('/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible();
  });

  test('unauthenticated access to /profile redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('hive-auth-token'));
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/login/);
  });
});
