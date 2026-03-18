/**
 * Playwright e2e tests for MH-025 Agent List (AgentGrid component).
 *
 * All tests use page.route() to mock /api/agents — no live backend required.
 * Auth token is injected via localStorage.
 */
import { test, expect } from '@playwright/test';

/** Fabricate a minimal JWT so RequireAuth passes without a real server. */
function makeToken(data: {
  sub: string;
  username: string;
  role: string;
  exp?: number;
}): string {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...data }),
  ).toString('base64url');
  return `${header}.${payload}.fake-signature`;
}

const TOKEN = makeToken({ sub: '1', username: 'tester', role: 'admin' });

const MOCK_USER = { sub: '1', username: 'tester', role: 'admin', exp: 9_999_999_999 };

/** Inject auth token and stub all required endpoints so the app loads cleanly. */
async function setupPage(page: import('@playwright/test').Page) {
  await page.addInitScript((tok) => {
    localStorage.setItem('hive-auth-token', tok);
  }, TOKEN);

  // SetupGuard calls this; must return setup_complete=true or app redirects to /setup.
  await page.route('**/api/setup/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setup_complete: true, has_admin: true }),
    }),
  );

  // AuthProvider validates the token in the background; 401 would log the user out.
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: MOCK_USER }),
  );

  // App.tsx fetches rooms on mount regardless of the active tab.
  await page.route('**/api/rooms', (route) =>
    route.fulfill({ json: { rooms: [], total: 0 } }),
  );

  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        version: '0.1.0',
        uptime_secs: 120,
        daemon_connected: true,
        daemon_url: 'ws://127.0.0.1:4200',
      }),
    }),
  );
}

test.describe('MH-025: Agent List', () => {
  test('agent-grid data-testid is present on page load', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agents: [] }),
      }),
    );

    await page.goto('/agents');
    await expect(page.locator('[data-testid="agent-grid"]')).toBeVisible({ timeout: 10000 });
  });

  test('renders one agent-card per agent returned by the API', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            { username: 'alice', health: 'healthy' },
            { username: 'bob', health: 'warning' },
            { username: 'carol', health: 'stale' },
          ],
        }),
      }),
    );

    await page.goto('/agents');
    await expect(page.locator('[data-testid="agent-card"]').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="agent-card"]')).toHaveCount(3);
  });

  test('agent card displays username', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [{ username: 'r2d2', health: 'healthy' }],
        }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText('r2d2')).toBeVisible({ timeout: 10000 });
  });

  test('shows empty state when no agents are registered', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agents: [] }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText(/no agents connected/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows error banner when API returns 500', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'internal', message: 'Internal server error' }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText(/cannot connect/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows error banner when network request fails', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) => route.abort());

    await page.goto('/agents');
    await expect(page.getByText(/cannot connect/i)).toBeVisible({ timeout: 10000 });
  });

  test('summary bar shows correct plural agent count', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            { username: 'alice', health: 'healthy' },
            { username: 'bob', health: 'healthy' },
            { username: 'carol', health: 'stale' },
          ],
        }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText('3 agents')).toBeVisible({ timeout: 10000 });
  });

  test('summary bar shows singular "agent" for count of 1', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [{ username: 'solo', health: 'healthy' }],
        }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText('1 agent')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1 agents')).not.toBeVisible();
  });

  test('agent card displays status field when present', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            {
              username: 'worker',
              health: 'healthy',
              status: 'implementing PR #42',
            },
          ],
        }),
      }),
    );

    await page.goto('/agents');
    await expect(page.getByText('implementing PR #42')).toBeVisible({ timeout: 10000 });
  });

  test('GET /api/agents request includes Authorization Bearer header', async ({ page }) => {
    await setupPage(page);

    const authHeaders: string[] = [];
    await page.route('**/api/agents', (route) => {
      const authHeader = route.request().headers()['authorization'];
      if (authHeader) authHeaders.push(authHeader);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agents: [] }),
      });
    });

    await page.goto('/agents');
    await page.waitForTimeout(1500);
    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders[0]).toMatch(/^Bearer /);
  });
});
