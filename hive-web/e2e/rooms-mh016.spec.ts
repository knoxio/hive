/**
 * MH-016: Room list API — GET /api/rooms and POST /api/rooms
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

type RequestFixture = Parameters<Parameters<typeof test>[1]>[0]['request'];

async function loginAsAdmin(request: RequestFixture): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
}

// ---------------------------------------------------------------------------
// GET /api/rooms
// ---------------------------------------------------------------------------

test.describe('MH-016: GET /api/rooms', () => {
  test('returns 401 when no token provided', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`);
    expect(res.status()).toBe(401);
  });

  test('returns 401 when token is invalid', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: 'Bearer garbage.token.value' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 200 with rooms array and total when authenticated', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rooms)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBe(body.rooms.length);
  });

  test('each room entry has id, name, workspace_id, workspace_name, added_at', async ({ request }) => {
    const token = await loginAsAdmin(request);

    // Create a room first so we have at least one to inspect.
    await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `inspect-room-${Date.now()}` },
    });

    const res = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
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
  test('returns 401 when no token provided', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/rooms`, {
      data: { name: 'no-auth-room' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 201 and the new room on valid request', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const name = `e2e-room-${Date.now()}`;
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(typeof body.name).toBe('string');
    expect(typeof body.workspace_id).toBe('number');
  });

  test('created room appears in subsequent GET /api/rooms', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const name = `listed-room-${Date.now()}`;

    const createRes = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    expect(createRes.status()).toBe(201);
    const { id } = await createRes.json();

    const listRes = await request.get(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { rooms } = await listRes.json();
    const found = (rooms as Array<{ id: string }>).find((r) => r.id === id);
    expect(found).toBeDefined();
  });

  test('returns 400 for empty room name', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('returns 400 for name with invalid characters', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'bad name!' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 for name longer than 80 characters', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'a'.repeat(81) },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 404 for non-existent workspace_id', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'valid-name', workspace_id: 999999 },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('workspace');
  });

  test('room id is derived from name (lowercase slug)', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `MyRoom-${Date.now()}` },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(body.id.toLowerCase());
  });
});
