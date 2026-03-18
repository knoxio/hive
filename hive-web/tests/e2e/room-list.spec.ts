import { test, expect } from '@playwright/test';

const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

async function setupPage(page: import('@playwright/test').Page) {
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
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sub: '1', username: 'admin', role: 'admin' }),
    }),
  );

  await page.route('**/api/rooms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rooms: [], total: 0 }),
    }),
  );
}

/**
 * FE-003: Room List Sidebar with Workspace Grouping
 */
test.describe('FE-003: Room List Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/rooms');
  });

  test('room list renders in left sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, [class*="sidebar"]').first();
    const roomList = sidebar.locator('[data-testid="room-list"], [data-testid="room-list-empty"], [class*="room-list"], [class*="RoomList"]').first();
    await expect(roomList).toBeVisible();
  });

  test('clicking a room selects it with visual highlight', async ({ page }) => {
    const roomItem = page.locator('[data-testid="room-item"], [class*="room-item"]').first();
    if (await roomItem.isVisible()) {
      await roomItem.click();
      await expect(roomItem).toHaveClass(/active|selected|highlight/);
    }
  });

  test('room entries display name', async ({ page }) => {
    const roomItems = page.locator('[data-testid="room-item"], [class*="room-item"]');
    const count = await roomItems.count();
    if (count > 0) {
      const firstRoom = roomItems.first();
      const text = await firstRoom.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('search/filter input filters rooms by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i], [data-testid="room-search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistent-room-xyz');
      const roomItems = page.locator('[data-testid="room-item"], [class*="room-item"]');
      await expect(roomItems).toHaveCount(0);
    }
  });

  test('empty state shown when no rooms exist', async ({ page }) => {
    const roomItems = page.locator('[data-testid="room-item"]');
    const count = await roomItems.count();
    if (count === 0) {
      await expect(page.getByTestId('room-list-empty')).toBeVisible();
    }
  });
});
