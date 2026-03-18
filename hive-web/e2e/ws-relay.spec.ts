/**
 * BE-003: WebSocket relay tests.
 *
 * Uses Node.js's built-in `http` module to make a real WebSocket upgrade
 * request and detect whether the server responds with 101 Switching Protocols.
 * This replaces the previous try/catch + timeout-as-success pattern, which
 * was fragile because a timeout can occur for reasons unrelated to WS support.
 */
import * as http from 'http';
import { test, expect } from '@playwright/test';

const API_BASE = process.env.HIVE_API_URL || 'http://localhost:3000';

/** Result of a WebSocket upgrade attempt. */
interface WsResult {
  /** `'upgraded'` when the server responded with 101; otherwise the HTTP status code. */
  statusOrUpgraded: 'upgraded' | number;
}

/**
 * Attempt a WebSocket upgrade to `url` and return whether the server accepted
 * it (101) or returned a plain HTTP response.
 */
function tryWsUpgrade(url: string): Promise<WsResult> {
  return new Promise((resolve) => {
    const parsed = new URL(url.replace(/^ws/, 'http'));
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 80,
      path: parsed.pathname + parsed.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        // Static key — only the format matters for the handshake check
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        Host: `${parsed.hostname}:${parsed.port}`,
      },
    };

    const req = http.request(options);

    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve({ statusOrUpgraded: 'upgraded' });
    });

    req.on('response', (res) => {
      // Server declined the upgrade and returned a plain HTTP response
      resolve({ statusOrUpgraded: res.statusCode ?? 0 });
    });

    req.on('error', () => {
      resolve({ statusOrUpgraded: 0 });
    });

    req.end();
  });
}

/** Convert API_BASE (http://…) to ws://… */
function wsUrl(path: string): string {
  return API_BASE.replace(/^http/, 'ws') + path;
}

test.describe('BE-003: WebSocket relay', () => {
  test('WS endpoint accepts upgrade or returns a defined HTTP error', async () => {
    const result = await tryWsUpgrade(wsUrl('/ws/test-room'));
    // 'upgraded' → server accepted the WS handshake (101)
    // 400/401/502/503 → server declined upgrade for a known reason (missing token, daemon unavailable, etc.)
    const valid: Array<WsResult['statusOrUpgraded']> = ['upgraded', 400, 401, 502, 503];
    expect(valid).toContain(result.statusOrUpgraded);
  });

  test('WS endpoint rejects plain HTTP GET with a non-200 status', async ({ request }) => {
    // Plain HTTP GET (no Upgrade header) must not return 200
    const resp = await request.get(`${API_BASE}/ws/test-room`, { timeout: 5000 });
    expect(resp.status()).not.toBe(200);
  });

  test('WS endpoint for nonexistent room accepts upgrade or returns defined error', async () => {
    const result = await tryWsUpgrade(wsUrl('/ws/nonexistent-room-fix099'));
    // Same valid set — server should not return an unexpected status (401 for missing token)
    const valid: Array<WsResult['statusOrUpgraded']> = ['upgraded', 400, 401, 404, 502, 503];
    expect(valid).toContain(result.statusOrUpgraded);
  });

  test('WS endpoint does not return 200 on upgrade request', async () => {
    const result = await tryWsUpgrade(wsUrl('/ws/test-room'));
    // 200 would mean the endpoint is ignoring the Upgrade header
    expect(result.statusOrUpgraded).not.toBe(200);
  });
});
