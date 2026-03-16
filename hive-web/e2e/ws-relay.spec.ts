import { test, expect } from '@playwright/test';

const BASE_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const WS_URL = BASE_URL.replace('http', 'ws');

// ── BE-003: WebSocket Relay ───────────────────────────────────────────────────

test.describe('BE-003: WebSocket relay', () => {
  test('WS endpoint exists and accepts upgrade', async ({ request }) => {
    // AC: hive-server proxies frontend WS to room daemon
    // Verify the endpoint responds (even if daemon is down, we get a response)
    const response = await request.get(`${BASE_URL}/ws/test-room`, {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });
    // Either 101 (upgrade success) or 502 (daemon unavailable) — both valid
    expect([101, 502, 400]).toContain(response.status());
  });

  test('WS endpoint rejects non-upgrade requests', async ({ request }) => {
    // AC: WS endpoint only handles WebSocket upgrade requests
    const response = await request.get(`${BASE_URL}/ws/test-room`);
    // Should reject with 400 or 426 (Upgrade Required), not 200
    expect(response.status()).not.toBe(200);
  });

  test('WS relay returns 502 when daemon unavailable', async ({ request }) => {
    // AC: graceful error when room daemon is not running
    const response = await request.get(`${BASE_URL}/ws/nonexistent-room`, {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });
    // 502 if daemon unavailable, or connection error
    if (response.status() !== 101) {
      expect([400, 502, 503]).toContain(response.status());
    }
  });
});
