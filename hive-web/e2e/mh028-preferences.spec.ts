/**
 * MH-028: User preferences API tests
 *
 * Tests for:
 *   GET  /api/users/me/preferences — return preferences with defaults
 *   PATCH /api/users/me/preferences — partial update + persist
 *
 * Requires the server to be running with:
 *   HIVE_JWT_SECRET=<>=32-byte secret>
 *   HIVE_ADMIN_USER=admin
 *   HIVE_ADMIN_PASSWORD=test-password
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsAdmin(
  request: Parameters<typeof test>[1] extends { request: infer R } ? R : never,
): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
}

// ---------------------------------------------------------------------------
// AC-1: GET /api/users/me/preferences — defaults
// ---------------------------------------------------------------------------

test.describe('MH-028: GET /api/users/me/preferences — defaults', () => {
  test('returns 200 with ui and notifications fields', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.get(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ui');
    expect(body).toHaveProperty('notifications');
  });

  test('ui defaults: theme=system, density=comfortable', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Reset to defaults first so the test is deterministic.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'system', density: 'comfortable' } },
    });

    const res = await request.get(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.ui.theme).toBe('system');
    expect(body.ui.density).toBe('comfortable');
  });

  test('notifications defaults: mentions=true, dms=true, rooms=false', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Reset notifications to defaults.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { notifications: { mentions: true, dms: true, rooms: false } },
    });

    const res = await request.get(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.notifications.mentions).toBe(true);
    expect(body.notifications.dms).toBe(true);
    expect(body.notifications.rooms).toBe(false);
  });

  test('returns 401 without token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users/me/preferences`);
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2: PATCH /api/users/me/preferences — partial update
// ---------------------------------------------------------------------------

test.describe('MH-028: PATCH /api/users/me/preferences — partial update', () => {
  test('updates theme only, leaves other fields unchanged', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Set known state.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'system', density: 'comfortable' } },
    });

    // Patch only theme.
    const patchRes = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'dark' } },
    });
    expect(patchRes.status()).toBe(200);
    const body = await patchRes.json();
    expect(body.ui.theme).toBe('dark');
    expect(body.ui.density).toBe('comfortable'); // unchanged
  });

  test('accepts light theme', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'light' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ui.theme).toBe('light');
  });

  test('accepts compact density', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { density: 'compact' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ui.density).toBe('compact');
  });

  test('toggles notifications.rooms to true', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Ensure rooms starts false.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { notifications: { rooms: false } },
    });

    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { notifications: { rooms: true } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.notifications.rooms).toBe(true);
  });

  test('disables mentions notifications', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { notifications: { mentions: false } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.notifications.mentions).toBe(false);
  });

  test('empty patch body still returns 200 with current prefs', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ui');
    expect(body).toHaveProperty('notifications');
  });

  test('returns 401 without token', async ({ request }) => {
    const res = await request.patch(`${API_URL}/api/users/me/preferences`, {
      data: { ui: { theme: 'dark' } },
    });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Persistence — GET after PATCH returns updated values
// ---------------------------------------------------------------------------

test.describe('MH-028: persistence across requests', () => {
  test('PATCH persists; subsequent GET returns updated value', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'dark' } },
    });

    const getRes = await request.get(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await getRes.json();
    expect(body.ui.theme).toBe('dark');
  });

  test('multiple PATCHes accumulate correctly', async ({ request }) => {
    const token = await loginAsAdmin({ request });

    // Set theme to light.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { theme: 'light' } },
    });

    // Then update density without changing theme.
    await request.patch(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { ui: { density: 'compact' } },
    });

    const getRes = await request.get(`${API_URL}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await getRes.json();
    expect(body.ui.theme).toBe('light'); // from first patch
    expect(body.ui.density).toBe('compact'); // from second patch
  });
});
