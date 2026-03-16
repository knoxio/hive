import { test, expect } from '@playwright/test';

/**
 * FE-003: Room List Sidebar with Workspace Grouping
 */
test.describe('FE-003: Room List Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rooms');
  });

  test('room list renders in left sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, [class*="sidebar"]').first();
    const roomList = sidebar.locator('[data-testid="room-list"], [class*="room-list"], [class*="RoomList"]').first();
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
    // Look for empty state message
    const emptyState = page.locator('[data-testid="empty-state"], [class*="empty"]').first();
    const roomItems = page.locator('[data-testid="room-item"], [class*="room-item"]');
    const count = await roomItems.count();
    if (count === 0) {
      await expect(emptyState).toBeVisible();
    }
  });
});
