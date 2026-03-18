import { test, expect, type Page } from '@playwright/test';

/**
 * FE-004: Chat Timeline with Real-Time Message Streaming
 */

/** Build a valid JWT-format mock token (not verified by backend — frontend only checks expiry). */
function makeToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payload = btoa(
    JSON.stringify({
      sub: '1',
      username: 'testuser',
      role: 'admin',
      jti: 'fe004',
      iat: 1700000000,
      exp: 9999999999,
    }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.MOCKSIG`;
}

const MOCK_TOKEN = makeToken();

const MOCK_ROOMS = [
  { id: 'general', name: 'general' },
  { id: 'random', name: 'random' },
];

/** Set up common route mocks and inject auth token before navigation. */
async function setupPage(page: Page) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
    localStorage.setItem('hive-joined-rooms', 'general,random');
  }, MOCK_TOKEN);

  await page.route('**/api/setup/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setup_complete: true }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'testuser', role: 'admin' }),
    });
  });

  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rooms: MOCK_ROOMS, total: MOCK_ROOMS.length }),
    });
  });

  await page.route('**/api/rooms/*/members', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    });
  });

  await page.route('**/api/rooms/*/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], has_more: false }),
    });
  });
}

test.describe('FE-004: Chat Timeline', () => {
  test('chat timeline renders in main content area', async ({ page }) => {
    await setupPage(page);
    await page.route('**/ws/**', (route) => route.abort());
    await page.goto('/rooms/general');
    const timeline = page.getByTestId('chat-timeline');
    await expect(timeline).toBeVisible();
  });

  test('data-testid="message" present on regular messages', async ({ page }) => {
    await setupPage(page);

    // Override messages mock to return one message
    await page.route('**/api/rooms/general/messages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              type: 'message',
              id: 'msg-001',
              room: 'general',
              user: 'alice',
              ts: new Date().toISOString(),
              content: 'Hello world',
            },
          ],
          has_more: false,
        }),
      });
    });

    await page.route('**/ws/**', (route) => route.abort());
    await page.goto('/rooms/general');
    await page.waitForSelector('[data-testid="chat-timeline"]', { timeout: 5000 });

    await expect(page.getByTestId('message').first()).toBeVisible();
    await expect(page.getByTestId('message-sender').first()).toBeVisible();
    await expect(page.getByTestId('message-content').first()).toBeVisible();
  });

  test('data-testid="system-message" present on system messages', async ({ page }) => {
    await setupPage(page);

    // Override messages mock to return a system message
    await page.route('**/api/rooms/general/messages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              type: 'join',
              id: 'sys-001',
              room: 'general',
              user: 'alice',
              ts: new Date().toISOString(),
            },
          ],
          has_more: false,
        }),
      });
    });

    await page.route('**/ws/**', (route) => route.abort());
    await page.goto('/rooms/general');
    await page.waitForSelector('[data-testid="chat-timeline"]', { timeout: 5000 });

    await expect(page.getByTestId('system-message').first()).toBeVisible();
  });

  test('new messages badge hidden when at bottom', async ({ page }) => {
    await setupPage(page);
    await page.route('**/ws/**', (route) => route.abort());
    await page.goto('/rooms/general');
    await page.waitForSelector('[data-testid="chat-timeline"]', { timeout: 5000 });

    await expect(page.getByTestId('new-messages-badge')).not.toBeVisible();
  });
});
