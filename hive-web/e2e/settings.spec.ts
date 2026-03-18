import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

async function loginAsAdmin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
}

test.describe('MH-003: App settings API', () => {
  test('GET /api/settings returns 200 with a JSON object', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const resp = await request.get(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('GET /api/settings includes daemon_url key', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const resp = await request.get(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('daemon_url');
    expect(typeof body.daemon_url).toBe('string');
    expect(body.daemon_url.length).toBeGreaterThan(0);
  });

  test('PATCH /api/settings updates a setting and returns updated object', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const newUrl = 'ws://patched-daemon:9999';
    const resp = await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { daemon_url: newUrl },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.daemon_url).toBe(newUrl);
  });

  test('PATCH /api/settings persists the change on subsequent GET', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const newUrl = 'ws://persisted-daemon:8888';
    await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { daemon_url: newUrl },
    });

    const getResp = await request.get(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getResp.status()).toBe(200);
    const body = await getResp.json();
    expect(body.daemon_url).toBe(newUrl);
  });

  test('PATCH /api/settings accepts arbitrary key/value pairs', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const resp = await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { custom_flag: 'enabled' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.custom_flag).toBe('enabled');
  });

  test('PATCH /api/settings with empty object returns 400', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const resp = await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(resp.status()).toBe(400);
  });

  test('PATCH /api/settings with multiple fields updates all', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const resp = await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { key_a: 'value_a', key_b: 'value_b' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.key_a).toBe('value_a');
    expect(body.key_b).toBe('value_b');
  });

  test('settings are persisted across subsequent reads', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const sentinel = `ws://sentinel-${Date.now()}:1234`;
    await request.patch(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { daemon_url: sentinel },
    });

    const r1 = await request.get(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const r2 = await request.get(`${API_BASE}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect((await r1.json()).daemon_url).toBe(sentinel);
    expect((await r2.json()).daemon_url).toBe(sentinel);
  });
});
