import { test, expect } from '@playwright/test';

/**
 * FE-001: App Shell with Three-Panel Layout and Tab Navigation
 *
 * Tests use a mock JWT token and mocked API routes — no running backend required.
 */

// A mock JWT with admin role (payload: sub=1, username=admin, role=admin, exp=far future)
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

/** Mount the app in an authenticated state with setup complete and no rooms. */
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

  await page.route('**/api/rooms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rooms: [], total: 0 }),
    }),
  );

  await page.goto('/');
}

test.describe('FE-001: App Shell Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('renders three-panel layout', async ({ page }) => {
    // Left sidebar
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();

    // Main content
    const main = page.locator('[data-testid="main-content"], main, [class*="main"]').first();
    await expect(main).toBeVisible();

    // Context panel (right)
    const context = page.locator('[data-testid="context-panel"], [class*="context"], [class*="right-panel"]').first();
    await expect(context).toBeVisible();
  });

  test('renders four navigation tabs: Rooms, Agents, Tasks, Costs', async ({ page }) => {
    for (const tab of ['Rooms', 'Agents', 'Tasks', 'Costs']) {
      const tabEl = page.getByRole('tab', { name: tab }).or(page.getByText(tab, { exact: true }));
      await expect(tabEl).toBeVisible();
    }
  });

  test('clicking tab switches view without full reload', async ({ page }) => {
    const tabs = ['Agents', 'Tasks', 'Costs', 'Rooms'];
    for (const tab of tabs) {
      const tabEl = page.getByRole('tab', { name: tab }).or(page.getByText(tab, { exact: true })).first();
      await tabEl.click();
      // URL should update
      await expect(page).toHaveURL(new RegExp(`/${tab.toLowerCase()}`));
    }
  });

  test('active tab is visually highlighted', async ({ page }) => {
    const roomsTab = page.getByRole('tab', { name: 'Rooms' }).or(page.getByText('Rooms', { exact: true })).first();
    await roomsTab.click();
    // Active tab should have a distinct class or aria-selected
    await expect(roomsTab).toHaveAttribute('aria-selected', 'true').or(
      expect(roomsTab).toHaveClass(/active|selected/)
    );
  });

  test('keyboard shortcuts switch tabs', async ({ page }) => {
    await page.keyboard.press('Control+2');
    await expect(page).toHaveURL(/\/agents/);
    await page.keyboard.press('Control+3');
    await expect(page).toHaveURL(/\/tasks/);
    await page.keyboard.press('Control+4');
    await expect(page).toHaveURL(/\/costs/);
    await page.keyboard.press('Control+1');
    await expect(page).toHaveURL(/\/rooms/);
  });
});
