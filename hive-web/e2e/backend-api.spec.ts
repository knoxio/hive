import { test, expect } from '@playwright/test';

const API_BASE = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-001: Health endpoint', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  test('health response includes version', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`);
    const body = await resp.json();
    expect(body.version).toBeTruthy();
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('health response includes uptime', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`);
    const body = await resp.json();
    expect(body.uptime_secs).toBeGreaterThanOrEqual(0);
  });
});

test.describe('BE-003: WebSocket relay', () => {
  test('WS endpoint accepts connection on /ws/:room_id', async ({ request }) => {
    // Verify the WS upgrade endpoint exists (returns 426 without upgrade header)
    const resp = await request.get(`${API_BASE}/ws/test-room`);
    // WebSocket endpoints return 400 or 426 when accessed via HTTP
    expect([400, 426].includes(resp.status())).toBeTruthy();
  });
});

test.describe('BE-004: REST proxy', () => {
  test('unknown API routes return 404', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/nonexistent`);
    expect(resp.status()).toBe(404);
  });
});
