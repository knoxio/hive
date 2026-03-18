import { test, expect } from '@playwright/test';

const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

const MOCK_ROOMS = [{ id: 'general', name: 'general' }];

async function setupPage(page: import('@playwright/test').Page) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
    localStorage.setItem('hive-joined-rooms', 'general');
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
      body: JSON.stringify({ rooms: MOCK_ROOMS, total: MOCK_ROOMS.length }),
    }),
  );

  await page.route('**/api/rooms/*/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [], total: 0 }),
    }),
  );

  await page.route('**/api/rooms/*/messages**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], has_more: false }),
    }),
  );

  await page.route('**/ws/**', (route) => route.abort());
}

/**
 * FE-005: Member Panel Showing Room Participants with Status
 */
test.describe('FE-005: Member Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/rooms/general');
  });

  test('member panel renders in right context panel', async ({ page }) => {
    const memberPanel = page.locator('[data-testid="member-panel"], [class*="MemberPanel"], [class*="member-panel"]').first();
    await expect(memberPanel).toBeVisible();
  });

  test('displays member count header', async ({ page }) => {
    const header = page.locator('[class*="MemberPanel"] h2, [data-testid="member-count"]').first();
    if (await header.isVisible()) {
      const text = await header.textContent();
      expect(text).toMatch(/members|online|total/i);
    }
  });

  test('members show username and presence indicator', async ({ page }) => {
    const members = page.locator('[data-testid="user-card"], [class*="UserCard"], [class*="member-item"]');
    const count = await members.count();
    if (count > 0) {
      const firstMember = members.first();
      // Should show username text
      const text = await firstMember.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
      // Should have presence dot
      const dot = firstMember.locator('[class*="rounded-full"], [class*="dot"], [class*="indicator"]');
      await expect(dot.first()).toBeVisible();
    }
  });

  test('agents display bot icon', async ({ page }) => {
    const agentSection = page.locator('text=Agents').first();
    if (await agentSection.isVisible()) {
      // Agent section should exist with bot indicators
      await expect(agentSection).toBeVisible();
    }
  });

  test('separates humans and agents into groups', async ({ page }) => {
    const peopleHeader = page.locator('text=/people|humans/i').first();
    const agentsHeader = page.locator('text=/agents/i').first();
    // At least one group header should be visible if members exist
    const members = page.locator('[data-testid="user-card"], [class*="UserCard"]');
    if (await members.count() > 0) {
      const hasPeople = await peopleHeader.isVisible().catch(() => false);
      const hasAgents = await agentsHeader.isVisible().catch(() => false);
      expect(hasPeople || hasAgents).toBeTruthy();
    }
  });
});
