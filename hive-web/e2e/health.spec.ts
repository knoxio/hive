import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-001: Health Endpoint', () => {
  test('GET /api/health returns 200 with valid status', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    // 'ok' when daemon connected, 'degraded' when daemon unavailable
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('health response includes daemon_connected field', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    expect(typeof body.daemon_connected).toBe('boolean');
    expect(body.daemon_url).toBeDefined();
  });

  test('health response includes version', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe('string');
  });

  test('health response includes uptime', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    expect(body.uptime_secs).toBeDefined();
    expect(typeof body.uptime_secs).toBe('number');
    expect(body.uptime_secs).toBeGreaterThanOrEqual(0);
  });
});
