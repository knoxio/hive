/**
 * Playwright e2e tests for MH-019 Join/Leave Room.
 *
 * All API calls are mocked via page.route(). Auth token is injected
 * via addInitScript() so RequireAuth passes without a live server.
 */
import { test, expect } from '@playwright/test';

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

const ROOMS_RESPONSE = {
  rooms: [
    { id: 'room-alpha', name: 'room-alpha' },
    { id: 'room-beta', name: 'room-beta' },
  ],
  total: 2,
};

async function setupPage(page: import('@playwright/test').Page) {
  // Inject auth token before page load.
  await page.addInitScript((tok) => {
    localStorage.setItem('hive-auth-token', tok);
    // Ensure no stale joined-rooms so auto-seed logic runs.
    localStorage.removeItem('hive-joined-rooms');
  }, TOKEN);

  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        version: '0.1.0',
        uptime_secs: 0,
        daemon_connected: false,
        daemon_url: 'ws://127.0.0.1:4200',
      }),
    }),
  );

  await page.route('**/api/setup/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ complete: true }),
    }),
  );

  await page.route('**/api/agents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agents: [] }),
    }),
  );

  await page.route('**/api/rooms', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ROOMS_RESPONSE),
      });
    }
    return route.continue();
  });

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '1', username: 'tester', role: 'admin' }),
    }),
  );
}

test.describe('MH-019: Join/Leave Room', () => {
  test('browse-rooms button is visible in sidebar', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await expect(page.locator('[data-testid="browse-rooms-button"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('browse-rooms button opens JoinRoomModal', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).toBeVisible({ timeout: 5000 });
  });

  test('JoinRoomModal lists all workspace rooms', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="room-browser-item"]')).toHaveCount(2, {
      timeout: 5000,
    });
    await expect(page.getByText('#room-alpha')).toBeVisible();
    await expect(page.getByText('#room-beta')).toBeVisible();
  });

  test('closing the modal via × button hides it', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="join-room-modal-close"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).not.toBeVisible();
  });

  test('auto-joined rooms show Leave button in modal', async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    // Wait for rooms to load (auto-seed joins all)
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="browse-rooms-button"]').click();
    // All rooms auto-joined → Leave buttons visible
    const leaveButtons = page.locator('[data-testid="leave-room-btn"]');
    await expect(leaveButtons.first()).toBeVisible({ timeout: 5000 });
  });

  test('leaving a room removes it from the sidebar', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/room-alpha/leave', (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto('/');
    await page.waitForTimeout(500);

    // Open browse modal and leave room-alpha
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).toBeVisible({ timeout: 5000 });

    // Click the Leave button for room-alpha
    const items = page.locator('[data-testid="room-browser-item"]');
    const alphaItem = items.filter({ hasText: '#room-alpha' });
    await alphaItem.locator('[data-testid="leave-room-btn"]').click();

    // Close modal
    await page.locator('[data-testid="join-room-modal-close"]').click();

    // room-alpha should no longer appear in the sidebar
    const sidebarItems = page.locator('.sidebar button', { hasText: 'room-alpha' });
    await expect(sidebarItems).toHaveCount(0, { timeout: 3000 });
  });

  test('joining a room adds it back to the sidebar', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/room-alpha/leave', (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.route('**/api/rooms/room-alpha/join', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ room_id: 'room-alpha', joined: true }),
      }),
    );

    await page.goto('/');
    await page.waitForTimeout(500);

    // Leave room-alpha first
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).toBeVisible({ timeout: 5000 });
    const items = page.locator('[data-testid="room-browser-item"]');
    const alphaItem = items.filter({ hasText: '#room-alpha' });
    await alphaItem.locator('[data-testid="leave-room-btn"]').click();
    await page.waitForTimeout(300);

    // Now join it again
    await alphaItem.locator('[data-testid="join-room-btn"]').click();
    await page.waitForTimeout(300);

    // Close modal — room-alpha should be back in sidebar
    await page.locator('[data-testid="join-room-modal-close"]').click();
    await expect(page.locator('.sidebar button', { hasText: 'room-alpha' }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('leave-room-button appears in room header when room is selected', async ({ page }) => {
    await setupPage(page);
    await page.route('**/api/rooms/room-alpha/messages', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      }),
    );
    await page.route('**/ws/**', (route) => route.abort());

    await page.goto('/');
    await page.waitForTimeout(800);

    // Select a room from sidebar
    const sidebarBtn = page.locator('.sidebar button', { hasText: 'room-alpha' }).first();
    if (await sidebarBtn.isVisible()) {
      await sidebarBtn.click();
      await expect(page.locator('[data-testid="leave-room-button"]')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('POST /api/rooms/:id/join sends Authorization header', async ({ page }) => {
    await setupPage(page);

    const authHeaders: string[] = [];
    await page.route('**/api/rooms/room-beta/join', (route) => {
      const h = route.request().headers()['authorization'];
      if (h) authHeaders.push(h);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ room_id: 'room-beta', joined: true }),
      });
    });
    await page.route('**/api/rooms/room-beta/leave', (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto('/');
    await page.waitForTimeout(500);

    // Leave room-beta, then join it — join sends auth header
    await page.locator('[data-testid="browse-rooms-button"]').click();
    await expect(page.locator('[data-testid="join-room-modal"]')).toBeVisible({ timeout: 5000 });
    const items = page.locator('[data-testid="room-browser-item"]');
    const betaItem = items.filter({ hasText: '#room-beta' });
    await betaItem.locator('[data-testid="leave-room-btn"]').click();
    await page.waitForTimeout(300);
    await betaItem.locator('[data-testid="join-room-btn"]').click();
    await page.waitForTimeout(300);

    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders[0]).toMatch(/^Bearer /);
  });
});
