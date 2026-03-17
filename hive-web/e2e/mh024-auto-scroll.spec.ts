/**
 * MH-024: Auto-scroll and unseen-message badge.
 *
 * Tests cover:
 *   - data-testid="chat-timeline" present when a room is open
 *   - data-testid="new-messages-badge" hidden when no messages exist
 *   - badge hidden when the user is already at the bottom
 *   - badge appears when the user scrolls up and a new WS message arrives
 *   - badge shows "1 new message ↓" for a single unseen message
 *   - badge shows "N new messages ↓" for multiple unseen messages
 *   - clicking the badge hides it
 *   - switching rooms resets the badge to hidden
 *
 * All tests run in a mocked environment — no running backend required.
 */

import { test, expect, type Page } from '@playwright/test';

const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJ1c2VyIiwianRpIjoibWgyNCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.' +
  'MOCKSIG';

const MOCK_ROOMS = [
  { id: 'alpha', name: 'alpha' },
  { id: 'beta', name: 'beta' },
];

/** Build a realistic RoomMessage JSON string for WS injection. */
function makeWsMessage(
  id: string,
  content: string,
  user = 'alice',
  room = 'alpha',
): string {
  return JSON.stringify({
    type: 'message',
    id,
    room,
    user,
    ts: new Date().toISOString(),
    content,
  });
}

/** Build a history API response with `count` messages (oldest first). */
function makeHistoryResponse(count: number, roomId = 'alpha') {
  const messages = Array.from({ length: count }, (_, i) => ({
    type: 'message',
    id: `hist-${roomId}-${i}`,
    room: roomId,
    user: 'alice',
    ts: new Date(Date.now() - (count - i) * 60_000).toISOString(),
    content: `History message ${i + 1}`,
  }));
  return JSON.stringify({ messages, has_more: false });
}

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

async function setupMocks(
  page: Page,
  opts: { historyCount?: number; roomId?: string } = {},
) {
  const { historyCount = 0, roomId = 'alpha' } = opts;

  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
    localStorage.setItem('hive-joined-rooms', 'alpha,beta');
  }, MOCK_TOKEN);

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
    const url = route.request().url();
    const match = /\/api\/rooms\/([^/]+)\/messages/.exec(url);
    const rid = match?.[1] ?? roomId;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: makeHistoryResponse(historyCount, rid),
    });
  });
}

/** Navigate to a room and wait for the chat timeline to be visible. */
async function goToRoom(page: Page, roomId = 'alpha') {
  await page.goto(`/rooms/${roomId}`);
  await page.waitForSelector('[data-testid="chat-timeline"]', { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// 1. Structural — data-testid presence
// ---------------------------------------------------------------------------

test.describe('MH-024: chat-timeline structure', () => {
  test('data-testid="chat-timeline" is present when a room is open', async ({ page }) => {
    await setupMocks(page);
    await page.route('**/ws/**', (route) => route.abort());
    await goToRoom(page);
    await expect(page.getByTestId('chat-timeline')).toBeVisible();
  });

  test('data-testid="new-messages-badge" is not rendered when no messages exist', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 0 });
    await page.route('**/ws/**', (route) => route.abort());
    await goToRoom(page);
    await expect(page.getByTestId('new-messages-badge')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Badge hidden when at bottom
// ---------------------------------------------------------------------------

test.describe('MH-024: badge hidden when at bottom', () => {
  test('badge is not visible immediately after loading history messages', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 10 });
    await page.route('**/ws/**', (route) => route.abort());
    await goToRoom(page);
    // On initial load the timeline auto-scrolls to bottom — badge must be hidden.
    await expect(page.getByTestId('new-messages-badge')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Badge appears when scrolled up and new WS message arrives
// ---------------------------------------------------------------------------

test.describe('MH-024: unseen badge when scrolled up', () => {
  test('badge appears when user is scrolled up and a new message arrives', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 30 });

    // Use routeWebSocket to control messages sent to the page.
    let sendToPage: ((msg: string) => void) | undefined;
    await page.routeWebSocket('**/ws/**', (ws) => {
      sendToPage = (msg) => ws.send(msg);
      ws.onMessage(() => {/* ignore outbound */});
    });

    await goToRoom(page);

    // Scroll to the top of the timeline so isAtBottom becomes false.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-timeline"]');
      if (el) el.scrollTop = 0;
    });

    // Dispatch a scroll event so React updates isAtBottom state.
    await page.getByTestId('chat-timeline').dispatchEvent('scroll');

    // Wait briefly for state to update.
    await page.waitForTimeout(100);

    // Send a new message via the mocked WebSocket.
    sendToPage?.(makeWsMessage('live-001', 'A brand new live message'));

    // Badge should become visible.
    await expect(page.getByTestId('new-messages-badge')).toBeVisible({
      timeout: 3000,
    });
  });

  test('badge shows "1 new message ↓" for a single unseen message', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 30 });

    let sendToPage: ((msg: string) => void) | undefined;
    await page.routeWebSocket('**/ws/**', (ws) => {
      sendToPage = (msg) => ws.send(msg);
      ws.onMessage(() => {/* ignore outbound */});
    });

    await goToRoom(page);

    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-timeline"]');
      if (el) el.scrollTop = 0;
    });
    await page.getByTestId('chat-timeline').dispatchEvent('scroll');
    await page.waitForTimeout(100);

    sendToPage?.(makeWsMessage('live-001', 'One message'));

    const badge = page.getByTestId('new-messages-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toContainText('1 new message');
    // Singular — must NOT say "messages"
    await expect(badge).not.toContainText('1 new messages');
  });

  test('badge shows plural "new messages ↓" for multiple unseen messages', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 30 });

    let sendToPage: ((msg: string) => void) | undefined;
    await page.routeWebSocket('**/ws/**', (ws) => {
      sendToPage = (msg) => ws.send(msg);
      ws.onMessage(() => {/* ignore outbound */});
    });

    await goToRoom(page);

    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-timeline"]');
      if (el) el.scrollTop = 0;
    });
    await page.getByTestId('chat-timeline').dispatchEvent('scroll');
    await page.waitForTimeout(100);

    sendToPage?.(makeWsMessage('live-001', 'First'));
    sendToPage?.(makeWsMessage('live-002', 'Second'));
    sendToPage?.(makeWsMessage('live-003', 'Third'));

    const badge = page.getByTestId('new-messages-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toContainText('new messages');
  });
});

// ---------------------------------------------------------------------------
// 4. Clicking badge scrolls to bottom and hides it
// ---------------------------------------------------------------------------

test.describe('MH-024: clicking badge dismisses it', () => {
  test('clicking the badge hides it', async ({ page }) => {
    await setupMocks(page, { historyCount: 30 });

    let sendToPage: ((msg: string) => void) | undefined;
    await page.routeWebSocket('**/ws/**', (ws) => {
      sendToPage = (msg) => ws.send(msg);
      ws.onMessage(() => {/* ignore outbound */});
    });

    await goToRoom(page);

    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-timeline"]');
      if (el) el.scrollTop = 0;
    });
    await page.getByTestId('chat-timeline').dispatchEvent('scroll');
    await page.waitForTimeout(100);

    sendToPage?.(makeWsMessage('live-001', 'New message'));

    const badge = page.getByTestId('new-messages-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });

    await badge.click();

    // Badge must disappear after clicking.
    await expect(badge).not.toBeVisible({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// 5. Room switch resets the badge
// ---------------------------------------------------------------------------

test.describe('MH-024: room switch resets badge', () => {
  test('badge is not visible after switching to a different room', async ({
    page,
  }) => {
    await setupMocks(page, { historyCount: 30 });

    let sendToPage: ((msg: string) => void) | undefined;
    await page.routeWebSocket('**/ws/**', (ws) => {
      sendToPage = (msg) => ws.send(msg);
      ws.onMessage(() => {/* ignore outbound */});
    });

    await goToRoom(page, 'alpha');

    // Scroll up and trigger unseen badge.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-timeline"]');
      if (el) el.scrollTop = 0;
    });
    await page.getByTestId('chat-timeline').dispatchEvent('scroll');
    await page.waitForTimeout(100);

    sendToPage?.(makeWsMessage('live-001', 'Unseen message in alpha'));

    await expect(page.getByTestId('new-messages-badge')).toBeVisible({
      timeout: 3000,
    });

    // Switch to the other room.
    await page.getByText('#beta').click();
    await page.waitForSelector('[data-testid="chat-timeline"]', { timeout: 5000 });

    // Badge must be gone after the room switch.
    await expect(page.getByTestId('new-messages-badge')).not.toBeVisible();
  });
});
