/**
 * MH-014: Create room — UI and backend integration
 *
 * UI tests use mocked API responses (no backend required).
 * API tests require a running server with valid credentials.
 */

import { test, expect } from '@playwright/test';

// A mock JWT with admin role so the app renders past the auth guard.
// Payload: { sub: "1", username: "admin", role: "admin", exp: 9999999999 }
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

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

/** Set up a page with a mocked auth token and mocked room list + create APIs. */
async function setupAuthenticatedPage(
  page: import('@playwright/test').Page,
  initialRooms: Array<{ id: string; name: string }> = [],
) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
  }, MOCK_TOKEN);

  await mockCommonRoutes(page);

  // Mock GET /api/rooms
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: initialRooms.map((r) => ({
            ...r,
            workspace_id: 1,
            workspace_name: 'default',
            added_at: new Date().toISOString(),
          })),
          total: initialRooms.length,
        }),
      });
    } else {
      // POST — return the new room
      const body = route.request().postDataJSON() as { name: string };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: body.name.toLowerCase(),
          name: body.name.toLowerCase(),
          workspace_id: 1,
        }),
      });
    }
  });

  await page.goto('/rooms');
}

// ---------------------------------------------------------------------------
// Modal open/close
// ---------------------------------------------------------------------------

test.describe('MH-014: create room modal — open and close', () => {
  test('clicking + button opens the create room modal', async ({ page }) => {
    await setupAuthenticatedPage(page);
    const plusBtn = page.getByTestId('create-room-button');
    await plusBtn.click();
    await expect(page.getByTestId('create-room-modal')).toBeVisible();
  });

  test('empty state "Create your first room" opens the modal', async ({ page }) => {
    await setupAuthenticatedPage(page, []);
    await expect(page.getByText('Create your first room')).toBeVisible();
    await page.getByText('Create your first room').click();
    await expect(page.getByTestId('create-room-modal')).toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('create-room-modal')).not.toBeVisible();
  });

  test('Escape key closes the modal', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('create-room-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('create-room-modal')).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    // Click the backdrop (outside the dialog box)
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('create-room-modal')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

test.describe('MH-014: create room modal — form validation', () => {
  test('submit button is disabled when name is empty', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await expect(page.getByTestId('create-room-submit')).toBeDisabled();
  });

  test('shows inline error for invalid characters', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('bad name!');
    await expect(page.getByText(/letters, numbers, hyphens/)).toBeVisible();
    await expect(page.getByTestId('create-room-submit')).toBeDisabled();
  });

  test('clears error when valid name entered', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('bad name!');
    await page.getByTestId('room-name-input').fill('good-name');
    await expect(page.getByText(/letters, numbers, hyphens/)).not.toBeVisible();
    await expect(page.getByTestId('create-room-submit')).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Successful create
// ---------------------------------------------------------------------------

test.describe('MH-014: create room — success flow', () => {
  test('creates room and closes modal on success', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('my-new-room');
    await page.getByTestId('create-room-submit').click();
    await expect(page.getByTestId('create-room-modal')).not.toBeVisible();
  });

  test('new room appears in sidebar after creation', async ({ page }) => {
    await setupAuthenticatedPage(page, [{ id: 'existing', name: 'existing' }]);
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('brand-new');
    await page.getByTestId('create-room-submit').click();
    await expect(page.getByText('#brand-new')).toBeVisible();
  });

  test('description field is optional', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('nodesc-room');
    // Leave description empty
    await page.getByTestId('create-room-submit').click();
    await expect(page.getByTestId('create-room-modal')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test.describe('MH-014: create room — error handling', () => {
  test('shows server error message on 400 response', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('hive-auth-token', token);
    }, MOCK_TOKEN);

    await mockCommonRoutes(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ rooms: [], total: 0 }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'room name may only contain alphanumerics' }),
        });
      }
    });

    await page.goto('/rooms');
    await page.getByTestId('create-room-button').click();
    await page.getByTestId('room-name-input').fill('valid-name');
    await page.getByTestId('create-room-submit').click();
    await expect(page.getByTestId('create-room-error')).toBeVisible();
  });
});

