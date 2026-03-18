/**
 * MH-020: Member list per room
 *
 * Tests cover:
 * - MemberPanel renders with API-fetched members
 * - Online/offline grouping
 * - Agents shown in separate section
 * - Empty state when no members
 * - Member count badge
 * - Hover profile card
 * - Admin badge in panel and profile card
 *
 * All tests use mocked API responses — no running backend required.
 */

import { test, expect } from '@playwright/test';

const TEST_ROOM = { id: 'test-room-mh020', name: 'test-room-mh020' };

/** Build a valid JWT-format mock token (frontend only checks structure/expiry). */
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
      jti: 'mh020',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiMember {
  username: string;
  display_name: string | null;
  role: string;
  presence: string;
}

async function setupPage(
  page: import('@playwright/test').Page,
  members: ApiMember[] = [],
) {
  await page.addInitScript(
    ({ token, roomId }: { token: string; roomId: string }) => {
      localStorage.setItem('hive-auth-token', token);
      localStorage.setItem('hive-joined-rooms', roomId);
    },
    { token: MOCK_TOKEN, roomId: TEST_ROOM.id },
  );

  await page.route('**/api/setup/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setup_complete: true, has_admin: true }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'testuser', role: 'admin' }),
    });
  });

  // Mock GET /api/rooms
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rooms: [
          {
            id: TEST_ROOM.id,
            name: TEST_ROOM.name,
            workspace_id: 1,
            workspace_name: 'default',
            added_at: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
    });
  });

  // Mock GET /api/rooms/:id/members
  await page.route(`**/api/rooms/${TEST_ROOM.id}/members`, async (route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members }),
    });
  });

  // Mock GET /api/rooms/:id/messages
  await page.route(`**/api/rooms/${TEST_ROOM.id}/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], has_more: false }),
    });
  });

  // Abort WebSocket connections — tests do not require live WS
  await page.route('**/ws/**', (route) => route.abort());

  await page.goto('/rooms');
  await page.getByText(`#${TEST_ROOM.id}`).click();
}

// ---------------------------------------------------------------------------
// Panel visibility
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — visibility', () => {
  test('member panel is visible when a room is selected', async ({ page }) => {
    await setupPage(page);
    await expect(page.locator('[data-testid="member-count"]')).toBeVisible();
  });

  test('shows empty state when room has no members', async ({ page }) => {
    await setupPage(page, []);
    await expect(page.getByTestId('member-panel-empty')).toBeVisible();
    await expect(page.getByTestId('member-panel-empty')).toContainText('No members');
  });

  test('member count shows 0 online · 0 total for empty room', async ({ page }) => {
    await setupPage(page, []);
    await expect(page.getByTestId('member-count')).toContainText('0 online');
    await expect(page.getByTestId('member-count')).toContainText('0 total');
  });
});

// ---------------------------------------------------------------------------
// Member rendering
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — member items', () => {
  test('shows member by username', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await expect(page.getByTestId('member-item-alice')).toBeVisible();
  });

  test('shows display name when available', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: 'Alice Smith', role: 'user', presence: 'offline' },
    ]);
    const card = page.getByTestId('member-item-alice');
    await expect(card).toContainText('Alice Smith');
  });

  test('shows multiple members', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
      { username: 'bob', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await expect(page.getByTestId('member-item-alice')).toBeVisible();
    await expect(page.getByTestId('member-item-bob')).toBeVisible();
  });

  test('member count reflects loaded members', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
      { username: 'bob', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await expect(page.getByTestId('member-count')).toContainText('2 total');
  });
});

// ---------------------------------------------------------------------------
// Online / offline grouping
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — online/offline groups', () => {
  test('online members appear in Online section', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'online' },
    ]);
    const panel = page.locator('.flex-col.h-full');
    await expect(panel).toContainText('Online');
    await expect(page.getByTestId('member-item-alice')).toBeVisible();
  });

  test('offline members appear in Offline section', async ({ page }) => {
    await setupPage(page, [
      { username: 'bob', display_name: null, role: 'user', presence: 'offline' },
    ]);
    const panel = page.locator('.flex-col.h-full');
    await expect(panel).toContainText('Offline');
    await expect(page.getByTestId('member-item-bob')).toBeVisible();
  });

  test('online members shown before offline members', async ({ page }) => {
    await setupPage(page, [
      { username: 'zara', display_name: null, role: 'user', presence: 'offline' },
      { username: 'alice', display_name: null, role: 'user', presence: 'online' },
    ]);
    const aliceBox = await page.getByTestId('member-item-alice').boundingBox();
    const zaraBox = await page.getByTestId('member-item-zara').boundingBox();
    expect(aliceBox).not.toBeNull();
    expect(zaraBox).not.toBeNull();
    // alice (online) must appear higher on the page than zara (offline)
    expect(aliceBox!.y).toBeLessThan(zaraBox!.y);
  });

  test('member count shows correct online count', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'online' },
      { username: 'bob', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await expect(page.getByTestId('member-count')).toContainText('1 online');
    await expect(page.getByTestId('member-count')).toContainText('2 total');
  });
});

// ---------------------------------------------------------------------------
// Agents section
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — agents section', () => {
  test('agent members appear in Agents section', async ({ page }) => {
    await setupPage(page, [
      { username: 'wall-e', display_name: null, role: 'user', presence: 'offline' },
    ]);
    const panel = page.locator('.flex-col.h-full');
    await expect(panel).toContainText('Agents');
    await expect(page.getByTestId('member-item-wall-e')).toBeVisible();
  });

  test('agents and humans shown in separate sections', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
      { username: 'wall-e', display_name: null, role: 'user', presence: 'offline' },
    ]);
    const panel = page.locator('.flex-col.h-full');
    await expect(panel).toContainText('Offline');
    await expect(panel).toContainText('Agents');
  });
});

// ---------------------------------------------------------------------------
// Admin badge
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — admin badge', () => {
  test('admin role shows admin badge in member row', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'admin', presence: 'offline' },
    ]);
    const card = page.getByTestId('member-item-alice');
    await expect(card).toContainText('admin');
  });

  test('non-admin members do not show admin badge', async ({ page }) => {
    await setupPage(page, [
      { username: 'bob', display_name: null, role: 'user', presence: 'offline' },
    ]);
    const card = page.getByTestId('member-item-bob');
    await expect(card).not.toContainText('admin');
  });
});

// ---------------------------------------------------------------------------
// Hover profile card
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — profile card on hover', () => {
  test('hovering a member shows profile card', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await page.getByTestId('member-item-alice').hover();
    await expect(page.getByTestId('member-profile-card')).toBeVisible();
  });

  test('profile card shows display name', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: 'Alice Smith', role: 'user', presence: 'offline' },
    ]);
    await page.getByTestId('member-item-alice').hover();
    const card = page.getByTestId('member-profile-card');
    await expect(card).toContainText('Alice Smith');
    await expect(card).toContainText('@alice');
  });

  test('profile card shows admin badge for admin members', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'admin', presence: 'offline' },
    ]);
    await page.getByTestId('member-item-alice').hover();
    const card = page.getByTestId('member-profile-card');
    await expect(card).toContainText('admin');
  });

  test('moving mouse away hides profile card', async ({ page }) => {
    await setupPage(page, [
      { username: 'alice', display_name: null, role: 'user', presence: 'offline' },
    ]);
    await page.getByTestId('member-item-alice').hover();
    await expect(page.getByTestId('member-profile-card')).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('member-profile-card')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Room name in panel header
// ---------------------------------------------------------------------------

test.describe('MH-020: member panel — room name', () => {
  test('panel header includes room name', async ({ page }) => {
    await setupPage(page);
    await expect(page.getByTestId('member-count')).toContainText(TEST_ROOM.id);
  });
});
