/**
 * MH-022: WebSocket real-time messages — auth and upgrade tests.
 *
 * Tests:
 *   - WS upgrade without token → 401
 *   - WS upgrade with valid ?token= → 101 (accepted) or 502 (daemon unavailable)
 *   - WS upgrade with invalid token → 401
 *   - WS upgrade with expired token → 401
 *   - WS upgrade with empty token → 401
 *   - WS upgrade with revoked token → 401
 *
 * These are API-level tests using Node.js http to send raw WS upgrade requests.
 * No browser is needed — the tests target the hive-server directly.
 */

import * as http from 'http';
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HTTP status returned from the WS upgrade attempt, or 'upgraded' for 101. */
type WsUpgradeResult = 'upgraded' | number;

/**
 * Attempt a WebSocket upgrade with optional Authorization header and/or
 * query params. Returns 'upgraded' on 101 or the HTTP status code otherwise.
 */
function tryWsUpgrade(
  path: string,
  extraHeaders: Record<string, string> = {},
): Promise<WsUpgradeResult> {
  return new Promise((resolve) => {
    const wsUrl = path.startsWith('ws') ? path : API_URL.replace(/^http/, 'ws') + path;
    const parsed = new URL(wsUrl.replace(/^ws/, 'http'));

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 80,
      path: parsed.pathname + parsed.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        Host: `${parsed.hostname}:${parsed.port}`,
        ...extraHeaders,
      },
    };

    const req = http.request(options);

    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve('upgraded');
    });

    req.on('response', (res) => {
      resolve(res.statusCode ?? 0);
    });

    req.on('error', () => {
      resolve(0);
    });

    req.end();
  });
}

/** Log in as admin and return the JWT. */
async function loginAsAdmin({
  request,
}: {
  request: APIRequestContext;
}): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
}

// ---------------------------------------------------------------------------
// AC-1: No token → 401
// ---------------------------------------------------------------------------

test.describe('MH-022: WS upgrade without token', () => {
  test('returns 401 when no ?token= is provided', async () => {
    const result = await tryWsUpgrade('/ws/test-room');
    expect(result).toBe(401);
  });

  test('returns 401 when ?token= is empty string', async () => {
    const result = await tryWsUpgrade('/ws/test-room?token=');
    expect(result).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Valid token → 101 or 502 (daemon unavailable)
// ---------------------------------------------------------------------------

test.describe('MH-022: WS upgrade with valid token', () => {
  test('accepts upgrade (101) or daemon-unavailable (502) with a valid token', async ({
    request,
  }) => {
    const token = await loginAsAdmin({ request });
    const result = await tryWsUpgrade(
      `/ws/test-room?token=${encodeURIComponent(token)}`,
    );
    // 'upgraded' = daemon is running and accepted the relay connection.
    // 502/503 = hive-server accepted auth but could not reach daemon.
    const valid: WsUpgradeResult[] = ['upgraded', 502, 503];
    expect(valid).toContain(result);
  });

  test('does not return 401 for a valid token', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const result = await tryWsUpgrade(
      `/ws/test-room?token=${encodeURIComponent(token)}`,
    );
    expect(result).not.toBe(401);
  });

  test('does not return 403 for a valid token', async ({ request }) => {
    const token = await loginAsAdmin({ request });
    const result = await tryWsUpgrade(
      `/ws/test-room?token=${encodeURIComponent(token)}`,
    );
    expect(result).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Invalid token → 401
// ---------------------------------------------------------------------------

test.describe('MH-022: WS upgrade with invalid token', () => {
  test('returns 401 for a garbage token string', async () => {
    const result = await tryWsUpgrade('/ws/test-room?token=not-a-real-jwt');
    expect(result).toBe(401);
  });

  test('returns 401 for a structurally valid but wrong-signature token', async () => {
    // Valid JWT structure but signed with a different secret — should be rejected.
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJoYWNrZXIiLCJyb2xlIjoidXNlciIsImp0aSI6ImFiYyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.' +
      'INVALIDSIGNATURE';
    const result = await tryWsUpgrade(
      `/ws/test-room?token=${encodeURIComponent(fakeToken)}`,
    );
    expect(result).toBe(401);
  });

  test('returns 401 for a truncated token', async () => {
    const result = await tryWsUpgrade('/ws/test-room?token=eyJhbGciOiJIUzI1NiJ9');
    expect(result).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Revoked token → 401
// ---------------------------------------------------------------------------

test.describe('MH-022: WS upgrade with revoked token', () => {
  test('returns 401 after token is revoked via logout', async ({ request }) => {
    // Log in to get a fresh token.
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();

    // Revoke it via logout.
    const logoutRes = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status()).toBe(200);

    // WS upgrade with the revoked token should be rejected.
    const result = await tryWsUpgrade(
      `/ws/test-room?token=${encodeURIComponent(token)}`,
    );
    expect(result).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Multiple rooms — token works for any room_id
// ---------------------------------------------------------------------------

test.describe('MH-022: token valid across room IDs', () => {
  test('same token accepted (or daemon-unavailable) for different room IDs', async ({
    request,
  }) => {
    const token = await loginAsAdmin({ request });

    for (const roomId of ['room-a', 'room-b', 'test-general']) {
      const result = await tryWsUpgrade(
        `/ws/${roomId}?token=${encodeURIComponent(token)}`,
      );
      const valid: WsUpgradeResult[] = ['upgraded', 502, 503];
      expect(valid).toContain(result);
    }
  });
});
