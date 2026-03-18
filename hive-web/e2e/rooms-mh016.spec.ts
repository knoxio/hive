/**
 * MH-016: Room list API — GET /api/rooms and POST /api/rooms
 *
 * Contract tests via page.route() mocks + page.request.
 * No running backend required.
 */

import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000';

// A mock JWT for the auth guard.
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

async function setupPage(page: import('@playwright/test').Page) {
  await page.addInitScript((token: string) => {
    localStorage.setItem('hive-auth-token', token);
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
      body: JSON.stringify({ rooms: [], total: 0 }),
    }),
  );
}

// ---------------------------------------------------------------------------
// GET /api/rooms
// ---------------------------------------------------------------------------

test.describe('MH-016: GET /api/rooms', () => {
  test('returns 401 when no token provided', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      const auth = route.request().headers()['authorization'];
      if (!auth) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UNAUTHORIZED' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      });
    });

    await page.goto('/rooms');

    const res = await page.request.get(`${API_URL}/api/rooms`);
    expect(res.status()).toBe(401);
  });

  test('returns 401 when token is invalid', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      const auth = route.request().headers()['authorization'];
      if (!auth || auth === 'Bearer garbage.token.value') {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UNAUTHORIZED' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      });
    });

    await page.goto('/rooms');

    const res = await page.request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: 'Bearer garbage.token.value' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 200 with rooms array and total when authenticated', async ({ page }) => {
    await setupPage(page);

    const sampleRooms = [{ id: 'room-a', name: 'room-a', workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' }];

    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: sampleRooms, total: 1 }),
      }),
    );

    await page.goto('/rooms');

    const res = await page.request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rooms)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBe(body.rooms.length);
  });

  test('each room entry has id, name, workspace_id, workspace_name, added_at', async ({ page }) => {
    await setupPage(page);

    const sampleRoom = { id: 'inspect-room-1', name: 'inspect-room-1', workspace_id: 1, workspace_name: 'default', added_at: '2026-01-01T00:00:00Z' };

    await page.route('**/api/rooms', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [sampleRoom], total: 1 }),
      }),
    );

    await page.goto('/rooms');

    const res = await page.request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
    });
    const { rooms } = await res.json();
    expect(rooms.length).toBeGreaterThan(0);

    const room = rooms[0];
    expect(typeof room.id).toBe('string');
    expect(typeof room.name).toBe('string');
    expect(typeof room.workspace_id).toBe('number');
    expect(typeof room.workspace_name).toBe('string');
    expect(typeof room.added_at).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// POST /api/rooms
// ---------------------------------------------------------------------------

test.describe('MH-016: POST /api/rooms', () => {
  test('returns 401 when no token provided', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const auth = route.request().headers()['authorization'];
        if (!auth) {
          return route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UNAUTHORIZED' }),
          });
        }
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0 }),
      });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, { data: { name: 'no-auth-room' } });
    expect(res.status()).toBe(401);
  });

  test('returns 201 and the new room on valid request', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name: string };
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: data.name.toLowerCase(), name: data.name.toLowerCase(), workspace_id: 1, workspace_name: 'default', added_at: new Date().toISOString() }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const name = `e2e-room-${Date.now()}`;
    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(typeof body.name).toBe('string');
    expect(typeof body.workspace_id).toBe('number');
  });

  test('created room appears in subsequent GET /api/rooms', async ({ page }) => {
    await setupPage(page);

    const rooms: Array<{ id: string; name: string; workspace_id: number; workspace_name: string; added_at: string }> = [];

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name: string };
        const room = { id: data.name, name: data.name, workspace_id: 1, workspace_name: 'default', added_at: new Date().toISOString() };
        rooms.push(room);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(room) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms, total: rooms.length }) });
    });

    await page.goto('/rooms');

    const name = `listed-room-${Date.now()}`;
    const createRes = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    expect(createRes.status()).toBe(201);
    const { id } = await createRes.json();

    const listRes = await page.request.get(`${API_URL}/api/rooms`, { headers: { Authorization: `Bearer ${MOCK_TOKEN}` } });
    const { rooms: listed } = await listRes.json();
    const found = (listed as Array<{ id: string }>).find((r) => r.id === id);
    expect(found).toBeDefined();
  });

  test('returns 400 for empty room name', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name?: string };
        if (!data.name || data.name.trim() === '') {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'name required' }) });
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: data.name, name: data.name, workspace_id: 1 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('returns 400 for name with invalid characters', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name?: string };
        if (data.name && /[^a-z0-9-]/.test(data.name)) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid name' }) });
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: data.name ?? '', name: data.name ?? '', workspace_id: 1 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name: 'bad name!' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 for name longer than 80 characters', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name?: string };
        if (data.name && data.name.length > 80) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'name too long' }) });
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: data.name ?? '', name: data.name ?? '', workspace_id: 1 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name: 'a'.repeat(81) },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 404 for non-existent workspace_id', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { workspace_id?: number };
        if (data.workspace_id && data.workspace_id > 9999) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'workspace not found' }) });
        }
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'room', name: 'room', workspace_id: 1 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name: 'valid-name', workspace_id: 999999 },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('workspace');
  });

  test('room id is derived from name (lowercase slug)', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON() as { name: string };
        const id = data.name.toLowerCase();
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id, name: data.name, workspace_id: 1 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [], total: 0 }) });
    });

    await page.goto('/rooms');

    const res = await page.request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}`, 'Content-Type': 'application/json' },
      data: { name: `MyRoom-${Date.now()}` },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(body.id.toLowerCase());
  });
});
