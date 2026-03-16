import { test, expect } from '@playwright/test';

/**
 * FE-001: App Shell with Three-Panel Layout and Tab Navigation
 */
test.describe('FE-001: App Shell Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
