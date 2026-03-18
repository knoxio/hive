/**
 * MH-015: Delete room — UI and backend integration
 *
 * UI tests use mocked API responses (no backend required).
 * API tests require a running server with valid credentials.
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

const TEST_ROOM = { id: 'room-to-delete', name: 'room-to-delete' };

/** Build a minimal but structurally valid JWT (header.payload.sig). */
function makeToken(
  opts: { sub?: string; username?: string; role?: string; exp?: number } = {},
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: opts.sub ?? '1',
      username: opts.username ?? 'tester',
      role: opts.role ?? 'admin',
      exp: opts.exp ?? 9_999_999_999,
    }),
  ).toString('base64url');
  return `${header}.${payload}.fake-sig`;
}

const MOCK_TOKEN = makeToken();
const MOCK_USER = { sub: '1', username: 'tester', role: 'admin', exp: 9_999_999_999 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up a page with a mocked token, a room list, and a DELETE stub.
 * Navigates to /rooms, clicks the room, and waits for the header to appear.
 */
async function setupWithRoom(
  page: import('@playwright/test').Page,
  deleteStatus = 204,
) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
  }, MOCK_TOKEN);

  // SetupGuard calls this; must return setup_complete=true or app redirects to /setup.
  await page.route('**/api/setup/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ setup_complete: true, has_admin: true }),
    }),
  );

  // AuthProvider validates the token in the background; 401 would log the user out.
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: MOCK_USER }),
  );

  // Mock GET /api/rooms
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rooms: [
          {
            ...TEST_ROOM,
            workspace_id: 1,
            workspace_name: 'default',
            added_at: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
    });
  });

  // Mock DELETE /api/rooms/:room_id
  await page.route(`**/api/rooms/${TEST_ROOM.id}`, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.continue();
      return;
    }
    if (deleteStatus === 204) {
      await route.fulfill({ status: 204 });
    } else if (deleteStatus === 404) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'room not found' }),
      });
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal error' }),
      });
    }
  });

  await page.goto('/rooms');

  // Select the room so the room header appears
  await page.getByText(`#${TEST_ROOM.id}`).click();
  await expect(page.getByTestId('delete-room-button')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Modal open/close
// ---------------------------------------------------------------------------

test.describe('MH-015: delete room modal — open and close', () => {
  test('trash icon is visible when a room is selected', async ({ page }) => {
    await setupWithRoom(page);
    await expect(page.getByTestId('delete-room-button')).toBeVisible();
  });

  test('clicking trash icon opens the delete room modal', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await expect(page.getByTestId('delete-room-modal')).toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('delete-room-modal')).not.toBeVisible();
  });

  test('Escape key closes the modal', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await expect(page.getByTestId('delete-room-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('delete-room-modal')).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('delete-room-modal')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Confirmation input
// ---------------------------------------------------------------------------

test.describe('MH-015: delete room modal — confirmation', () => {
  test('delete button is disabled before typing the room name', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await expect(page.getByTestId('delete-room-submit')).toBeDisabled();
  });

  test('delete button is disabled when partial name entered', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill('room-to');
    await expect(page.getByTestId('delete-room-submit')).toBeDisabled();
  });

  test('delete button is enabled only when full room name matches', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await expect(page.getByTestId('delete-room-submit')).not.toBeDisabled();
  });

  test('modal shows the room name in the instructions', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await expect(page.getByTestId('delete-room-modal')).toContainText(TEST_ROOM.id);
  });
});

// ---------------------------------------------------------------------------
// Success flow
// ---------------------------------------------------------------------------

test.describe('MH-015: delete room — success flow', () => {
  test('modal closes after successful deletion', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await page.getByTestId('delete-room-submit').click();
    await expect(page.getByTestId('delete-room-modal')).not.toBeVisible();
  });

  test('deleted room is removed from sidebar', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await page.getByTestId('delete-room-submit').click();
    await expect(page.getByText(`#${TEST_ROOM.id}`)).not.toBeVisible();
  });

  test('room header is hidden after deletion (room deselected)', async ({ page }) => {
    await setupWithRoom(page);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await page.getByTestId('delete-room-submit').click();
    await expect(page.getByTestId('delete-room-button')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test.describe('MH-015: delete room — error handling', () => {
  test('shows error when server returns 404', async ({ page }) => {
    await setupWithRoom(page, 404);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await page.getByTestId('delete-room-submit').click();
    await expect(page.getByTestId('delete-room-error')).toBeVisible();
    await expect(page.getByTestId('delete-room-error')).toContainText('already been deleted');
  });

  test('shows generic error on server failure', async ({ page }) => {
    await setupWithRoom(page, 500);
    await page.getByTestId('delete-room-button').click();
    await page.getByTestId('delete-room-confirmation-input').fill(TEST_ROOM.id);
    await page.getByTestId('delete-room-submit').click();
    await expect(page.getByTestId('delete-room-error')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// API tests (requires running backend)
// ---------------------------------------------------------------------------

test.describe('MH-015: DELETE /api/rooms/:room_id — API tests', () => {
  async function getToken(request: Parameters<Parameters<typeof test>[1]>[0]['request']): Promise<string> {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.token as string;
  }

  async function createRoom(
    request: Parameters<Parameters<typeof test>[1]>[0]['request'],
    token: string,
    name: string,
  ): Promise<string> {
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return body.id as string;
  }

  test('DELETE /api/rooms/:id returns 204 for existing room', async ({ request }) => {
    const token = await getToken(request);
    const roomId = await createRoom(request, token, `del-test-${Date.now()}`);
    const res = await request.delete(`${API_URL}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });

  test('DELETE /api/rooms/:id returns 404 for non-existent room', async ({ request }) => {
    const token = await getToken(request);
    const res = await request.delete(`${API_URL}/api/rooms/does-not-exist-xyz`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test('DELETE /api/rooms/:id returns 401 without token', async ({ request }) => {
    const res = await request.delete(`${API_URL}/api/rooms/some-room`);
    expect(res.status()).toBe(401);
  });

  test('room is absent from GET /api/rooms after deletion', async ({ request }) => {
    const token = await getToken(request);
    const roomId = await createRoom(request, token, `del-verify-${Date.now()}`);

    // Confirm it exists first
    const listBefore = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyBefore = await listBefore.json();
    const ids: string[] = bodyBefore.rooms.map((r: { id: string }) => r.id);
    expect(ids).toContain(roomId);

    // Delete it
    await request.delete(`${API_URL}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Confirm it is gone
    const listAfter = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyAfter = await listAfter.json();
    const idsAfter: string[] = bodyAfter.rooms.map((r: { id: string }) => r.id);
    expect(idsAfter).not.toContain(roomId);
  });
});
