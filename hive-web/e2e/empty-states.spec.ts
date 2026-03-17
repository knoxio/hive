/**
 * MH-005: Empty states with guidance
 *
 * Tests that the Hive UI shows contextual empty/offline states instead of
 * blank panels, across the room list, agent panel, and daemon-offline scenarios.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Room list empty state (HTTP 200 with empty array — no rooms exist)
// ---------------------------------------------------------------------------

test.describe('MH-005: Room list — no rooms empty state', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the rooms API to return an empty list
    await page.route('**/api/rooms', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) })
    );
    await page.goto('/');
    // Wait past the 300ms minimum skeleton timer
    await page.waitForTimeout(400);
  });

  test('shows "No rooms yet" empty state', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No rooms yet');
  });

  test('empty state includes contextual description', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toContainText('Create');
  });

  test('"Create your first room" CTA button is keyboard-focusable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create your first room/i });
    await expect(btn).toBeVisible();
    await btn.focus();
    await expect(btn).toBeFocused();
  });

  test('empty state has accessible role and label', async ({ page }) => {
    const status = page.getByRole('status');
    await expect(status).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Room list daemon-offline state (HTTP 503 — daemon unreachable)
// ---------------------------------------------------------------------------

test.describe('MH-005: Room list — daemon offline state (503)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rooms', (route) =>
      route.fulfill({ status: 503, body: 'Service Unavailable' })
    );
    await page.goto('/');
    await page.waitForTimeout(400);
  });

  test('shows "Daemon offline" empty state', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Daemon offline');
  });

  test('displays the configured daemon URL', async ({ page }) => {
    // Default daemon URL is http://localhost:3000
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toContainText('localhost:3000');
  });

  test('"Retry" button is visible and keyboard-focusable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /retry/i });
    await expect(btn).toBeVisible();
    await btn.focus();
    await expect(btn).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Room list daemon-offline state (network error — fetch throws)
// ---------------------------------------------------------------------------

test.describe('MH-005: Room list — daemon offline state (network error)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rooms', (route) => route.abort('connectionrefused'));
    await page.goto('/');
    await page.waitForTimeout(400);
  });

  test('shows "Daemon offline" empty state on network failure', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Daemon offline');
  });
});

// ---------------------------------------------------------------------------
// Loading state is visually distinct (skeleton shown during fetch)
// ---------------------------------------------------------------------------

test.describe('MH-005: Loading state is distinct from empty state', () => {
  test('skeleton shown before rooms load, not the empty state', async ({ page }) => {
    // Delay the rooms response by 500ms so we can observe the loading state
    await page.route('**/api/rooms', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) });
    });
    await page.goto('/');

    // During load the empty state must NOT be present
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).not.toBeVisible();

    // After load completes, the empty state appears
    await expect(emptyState).toBeVisible({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// Agent panel — no agents empty state
// ---------------------------------------------------------------------------

test.describe('MH-005: Agent panel — no agents empty state', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rooms', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) })
    );
    await page.route('**/api/agents', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agents: [] }) })
    );
    await page.goto('/agents');
    await page.waitForTimeout(400);
  });

  test('shows "No agents connected" empty state', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No agents connected');
  });

  test('documentation link is present and keyboard-focusable', async ({ page }) => {
    const link = page.getByRole('link', { name: /view documentation/i });
    await expect(link).toBeVisible();
    await link.focus();
    await expect(link).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Agent panel — daemon offline state (network error)
// ---------------------------------------------------------------------------

test.describe('MH-005: Agent panel — daemon offline state', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rooms', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [] }) })
    );
    await page.route('**/api/agents', (route) => route.abort('connectionrefused'));
    await page.goto('/agents');
    await page.waitForTimeout(400);
  });

  test('shows "Daemon offline" empty state', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Daemon offline');
  });

  test('"Retry" button is visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /retry/i });
    await expect(btn).toBeVisible();
  });
});
