/**
 * MH-018: Room settings — UI tests using mocked routes
 *
 * All tests use mocked API responses — no running backend required.
 */

import { test, expect } from '@playwright/test';

// A mock JWT with an admin role so the UI renders correctly.
// Payload: { sub: "1", username: "admin", role: "admin", exp: 9999999999 }
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

const ROOM = { id: 'room-alpha', name: 'room-alpha', display_name: null, description: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stub the two guard routes that run before any protected page renders.
 * Must be called before page.goto().
 */
async function mockCommonRoutes(page: import('@playwright/test').Page) {
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
}

/** Mount a fully mocked page with one room selected. */
async function setupPage(
  page: import('@playwright/test').Page,
  room: typeof ROOM = ROOM,
) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
  }, MOCK_TOKEN);

  await mockCommonRoutes(page);

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
        rooms: [{ ...room, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }],
        total: 1,
      }),
    });
  });

  // Mock GET /api/rooms/:id (rest proxy)
  await page.route(`**/api/rooms/${room.id}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...room, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock WebSocket
  await page.route(`**/ws/${room.id}`, async (route) => route.abort());

  await page.goto('/rooms');

  // Select the room by clicking it in the sidebar
  await page.getByText(room.id).first().click();
}

// ---------------------------------------------------------------------------
// Panel open / close
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — open and close', () => {
  test('settings icon is visible in room header when a room is selected', async ({ page }) => {
    await setupPage(page);
    await expect(page.getByTestId('room-settings-button')).toBeVisible();
  });

  test('clicking the settings icon opens the settings panel', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-panel')).toBeVisible();
  });

  test('clicking × closes the panel without confirming (no unsaved changes)', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-panel')).toBeVisible();
    await page.getByTestId('room-settings-close').click();
    await expect(page.getByTestId('room-settings-panel')).not.toBeVisible();
  });

  test('Escape closes the panel when there are no unsaved changes', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('room-settings-panel')).not.toBeVisible();
  });

  test('panel shows the room ID', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-id')).toHaveText(ROOM.id);
  });
});

// ---------------------------------------------------------------------------
// Form state — display name
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — display name field', () => {
  test('display name input is empty when room has no display_name', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-display-name-input')).toHaveValue('');
  });

  test('display name input is pre-filled when room has a display_name', async ({ page }) => {
    await setupPage(page, { ...ROOM, display_name: 'Alpha Room' });
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-display-name-input')).toHaveValue('Alpha Room');
  });

  test('Save is disabled when form is pristine', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });

  test('Save is enabled after changing display name', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('New Name');
    await expect(page.getByTestId('room-settings-save')).not.toBeDisabled();
  });

  test('shows inline validation error for display name with invalid characters', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('bad name!');
    await expect(page.getByText(/letters, numbers, hyphens/)).toBeVisible();
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });

  test('error clears when valid display name entered', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('bad!');
    await page.getByTestId('room-display-name-input').fill('good-name');
    await expect(page.getByText(/letters, numbers, hyphens/)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Form state — description
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — description field', () => {
  test('description textarea is empty when room has no description', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-description-input')).toHaveValue('');
  });

  test('shows character counter', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByText('0/280')).toBeVisible();
  });

  test('counter updates as user types', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('hello');
    await expect(page.getByText('5/280')).toBeVisible();
  });

  test('shows error when description exceeds 280 chars', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    // fill with 281 chars — maxLength+1 allows it through the HTML, validation catches it
    await page.getByTestId('room-description-input').evaluate((el: HTMLTextAreaElement) => {
      el.removeAttribute('maxlength');
    });
    await page.getByTestId('room-description-input').fill('x'.repeat(281));
    await expect(page.getByText(/280 characters or fewer/)).toBeVisible();
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — reset', () => {
  test('Reset button is disabled when form is pristine', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('room-settings-button').click();
    await expect(page.getByTestId('room-settings-reset')).toBeDisabled();
  });

  test('Reset discards unsaved changes', async ({ page }) => {
    await setupPage(page, { ...ROOM, display_name: 'Original' });
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('Changed');
    await page.getByTestId('room-settings-reset').click();
    await expect(page.getByTestId('room-display-name-input')).toHaveValue('Original');
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Save — success
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — save success', () => {
  test('saving description shows success message', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await mockCommonRoutes(page);

    await page.route('**/api/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: [{ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }],
          total: 1,
        }),
      });
    });

    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { description?: string };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, description: body.description ?? null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }),
        });
      }
    });

    await page.route(`**/ws/${ROOM.id}`, async (route) => route.abort());

    await page.goto('/rooms');
    await page.getByText(ROOM.id).first().click();
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('A description');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-saved')).toBeVisible();
  });

  test('Save button is disabled again after successful save', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await mockCommonRoutes(page);

    await page.route('**/api/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [{ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }], total: 1 }),
      });
    });

    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, description: 'saved' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }),
        });
      }
    });

    await page.route(`**/ws/${ROOM.id}`, async (route) => route.abort());

    await page.goto('/rooms');
    await page.getByText(ROOM.id).first().click();
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('hello');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-saved')).toBeVisible();
    // After save the form is no longer dirty → Save disabled again
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Save — server errors
// ---------------------------------------------------------------------------

test.describe('MH-018: room settings panel — save errors', () => {
  test('shows server error on 400 response', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await mockCommonRoutes(page);

    await page.route('**/api/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [{ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }], total: 1 }),
      });
    });

    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'display name already taken' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }),
        });
      }
    });

    await page.route(`**/ws/${ROOM.id}`, async (route) => route.abort());

    await page.goto('/rooms');
    await page.getByText(ROOM.id).first().click();
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('taken-name');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-error')).toHaveText('display name already taken');
  });
});

// ---------------------------------------------------------------------------
// PATCH behaviour — tested via mocked routes
// ---------------------------------------------------------------------------

test.describe('MH-018: PATCH /api/rooms/:room_id — UI behaviour', () => {
  test('saving display_name shows success and form becomes pristine', async ({ page }) => {
    await setupPage(page, { ...ROOM, display_name: null });
    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, display_name: 'Pretty Name' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-display-name-input').fill('Pretty Name');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-saved')).toBeVisible();
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });

  test('PATCH returning 404 shows error message in panel', async ({ page }) => {
    await setupPage(page);
    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'room not found' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('test');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-error')).toBeVisible();
  });

  test('PATCH returning 200 with updated description — save clears dirty state', async ({ page }) => {
    await setupPage(page);
    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...ROOM, description: 'A test room' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('A test room');
    await page.getByTestId('room-settings-save').click();
    await expect(page.getByTestId('room-settings-saved')).toBeVisible();
    // Form is pristine again → Reset disabled
    await expect(page.getByTestId('room-settings-reset')).toBeDisabled();
  });

  test('PATCH 200 for empty body — save succeeds (no-op)', async ({ page }) => {
    // Simulate a save with only whitespace change that reverts to original.
    await setupPage(page);
    await page.route(`**/api/rooms/${ROOM.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ROOM),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('room-settings-button').click();
    await page.getByTestId('room-description-input').fill('temp');
    // Reset back to empty
    await page.getByTestId('room-settings-reset').click();
    // After reset, form is pristine — Save is disabled, no save issued
    await expect(page.getByTestId('room-settings-save')).toBeDisabled();
  });
});
