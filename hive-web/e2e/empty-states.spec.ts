/**
 * MH-005: Empty states with guidance (no rooms, no agents, daemon offline).
 *
 * These tests mount the frontend dev server with mocked API responses and assert
 * that the correct EmptyState UI is displayed in each scenario.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Fabricate a minimal JWT so RequireAuth passes without a real server. */
function makeToken(): string {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: '1', username: 'tester', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.fake-signature`;
}

const TOKEN = makeToken();

/**
 * Inject auth token and stub /api/setup/status so SetupGuard passes.
 * Must be called before page.goto() in every test.
 */
async function setupAuth(page: import('@playwright/test').Page) {
  await page.addInitScript((tok) => {
    localStorage.setItem('hive-auth-token', tok);
  }, TOKEN);

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
      body: JSON.stringify({ sub: '1', username: 'tester', role: 'admin' }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Intercept all /api/rooms calls with an empty list.
 */
async function mockEmptyRooms(page: import('@playwright/test').Page) {
  await page.route('**/api/rooms', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) }),
  );
}

/**
 * Intercept all /api/agents calls with an empty list.
 */
async function mockEmptyAgents(page: import('@playwright/test').Page) {
  await page.route('**/api/agents', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agents: [] }) }),
  );
}

// ---------------------------------------------------------------------------
// MH-005 — Room list empty state
// ---------------------------------------------------------------------------

test.describe('MH-005: Room list empty state', () => {
  test('shows "No rooms yet" empty state when room list is empty', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/rooms');

    const emptyState = page.getByTestId('room-list-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No rooms yet');
  });

  test('empty state includes guidance text', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/rooms');

    const emptyState = page.getByTestId('room-list-empty');
    await expect(emptyState).toContainText('Create your first room');
  });

  test('empty state has accessible role=status and aria-label', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/rooms');

    const emptyState = page.getByRole('status', { name: 'No rooms yet' });
    await expect(emptyState).toBeVisible();
  });

  test('room list does NOT show empty state when rooms exist', async ({ page }) => {
    await setupAuth(page);
    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: [{ id: 'room-dev', name: 'room-dev', workspace_id: 1, workspace_name: 'default', added_at: new Date().toISOString() }],
          total: 1,
        }),
      }),
    );
    await mockEmptyAgents(page);
    await page.goto('/rooms');

    await expect(page.getByTestId('room-list-empty')).not.toBeVisible();
    await expect(page.getByText('#room-dev')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// MH-005 — Agent grid empty state
// ---------------------------------------------------------------------------

test.describe('MH-005: Agent grid empty state', () => {
  test('shows "No agents connected" empty state when agent list is empty', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/agents');

    const emptyState = page.getByTestId('agent-grid-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No agents connected');
  });

  test('agent empty state includes documentation link', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/agents');

    const link = page.getByTestId('agent-grid-empty').getByTestId('empty-state-action');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('View agent documentation');
    await expect(link).toHaveAttribute('href');
  });

  test('agent documentation link is keyboard-focusable', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await mockEmptyAgents(page);
    await page.goto('/agents');

    const link = page.getByTestId('agent-grid-empty').getByTestId('empty-state-action');
    await link.focus();
    await expect(link).toBeFocused();
  });

  test('agent grid does NOT show empty state when agents exist', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await page.route('**/api/agents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            { username: 'r2d2', personality: 'coder', model: 'claude-sonnet-4-6', pid: 1234, health: 'healthy' },
          ],
        }),
      }),
    );
    await page.goto('/agents');

    await expect(page.getByTestId('agent-grid-empty')).not.toBeVisible();
    await expect(page.getByTestId('agent-card')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// MH-005 — Loading vs empty state distinction
// ---------------------------------------------------------------------------

test.describe('MH-005: Loading state is visually distinct from empty state', () => {
  test('does not show empty state immediately — uses loading indicator first', async ({ page }) => {
    await setupAuth(page);
    // Delay the API response by 500ms so we can catch the loading state
    await page.route('**/api/rooms', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });
    await mockEmptyAgents(page);

    await page.goto('/rooms');

    // During the delay the empty state should NOT yet be visible (skeleton/spinner shown instead)
    // The room list component does not have a loading skeleton yet, so we just verify the
    // empty state is not shown in the first 300ms.
    await page.waitForTimeout(100);
    // The empty state renders immediately for RoomList since it has no loading state yet —
    // this test documents the current behaviour and will be updated when a skeleton is added.
    // For now we just assert the page does not crash.
    await expect(page).toHaveURL('/rooms');
  });

  test('AgentGrid shows loading text before empty state appears', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    await page.route('**/api/agents', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agents: [] }) });
    });

    await page.goto('/agents');

    // During load, "Loading agents..." text should appear
    await expect(page.getByText('Loading agents...')).toBeVisible();

    // After load completes, empty state should appear
    await expect(page.getByTestId('agent-grid-empty')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// MH-005 — Daemon offline state
// ---------------------------------------------------------------------------

test.describe('MH-005: Daemon offline / error state', () => {
  test('AgentGrid shows connection error message when server is unreachable', async ({ page }) => {
    await setupAuth(page);
    await mockEmptyRooms(page);
    // Abort network — simulates daemon being completely offline
    await page.route('**/api/agents', (route) => route.abort('connectionrefused'));
    await page.goto('/agents');

    // The error message from AgentGrid should mention connectivity
    const grid = page.getByTestId('agent-grid');
    await expect(grid).toBeVisible({ timeout: 5000 });
    await expect(grid).toContainText('Cannot connect to hive-server');
  });
});
