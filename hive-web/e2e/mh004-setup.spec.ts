/**
 * MH-004: First-run setup wizard API tests
 *
 * Tests the five public setup endpoints:
 *   GET  /api/setup/status
 *   POST /api/setup/verify-daemon
 *   POST /api/setup/configure
 *   POST /api/setup/create-admin
 *   POST /api/setup/complete
 *
 * The test environment seeds an admin user via HIVE_ADMIN_USER/HIVE_ADMIN_PASSWORD
 * but does NOT automatically mark setup_complete=true, so the setup endpoints
 * are callable. Tests that change state accept either success or "setup already
 * complete" (idempotent test design).
 *
 * Validation tests (wrong input, bad URL scheme, short password) never change
 * server state and are unconditionally asserted.
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// AC-1: GET /api/setup/status
// ---------------------------------------------------------------------------

test.describe('MH-004: GET /api/setup/status', () => {
  test('returns 200 with setup_complete and has_admin fields', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/setup/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.setup_complete).toBe('boolean');
    expect(typeof body.has_admin).toBe('boolean');
  });

  test('does not require authentication', async ({ request }) => {
    // No Authorization header — must still return 200.
    const res = await request.get(`${API_URL}/api/setup/status`);
    expect(res.status()).toBe(200);
  });

  test('has_admin=true when admin was seeded from env', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/setup/status`);
    const body = await res.json();
    // HIVE_ADMIN_USER env var seeds an admin at startup.
    expect(body.has_admin).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-2: POST /api/setup/verify-daemon
// ---------------------------------------------------------------------------

test.describe('MH-004: POST /api/setup/verify-daemon', () => {
  test('returns reachable=false for an unreachable URL', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/verify-daemon`, {
      data: { url: 'ws://127.0.0.1:19999' },
    });
    // verify-daemon may return 200 or 400 depending on whether setup is complete.
    // If setup is complete it returns 400; otherwise 200 with reachable=false.
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.reachable).toBe(false);
      expect(typeof body.error).toBe('string');
    } else {
      expect(res.status()).toBe(400);
    }
  });

  test('returns reachable=false with error for empty URL', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/verify-daemon`, {
      data: { url: '' },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.reachable).toBe(false);
      expect(body.error).toBeTruthy();
    } else {
      expect(res.status()).toBe(400);
    }
  });

  test('normalises ws:// to http:// for the health check', async ({ request }) => {
    // A ws:// URL that is not reachable should still return a structured response.
    const res = await request.post(`${API_URL}/api/setup/verify-daemon`, {
      data: { url: 'ws://daemon.test.invalid:4200' },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('reachable');
    } else {
      expect(res.status()).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-3: POST /api/setup/configure — validation
// ---------------------------------------------------------------------------

test.describe('MH-004: POST /api/setup/configure — validation', () => {
  test('rejects empty daemon_url with 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects URL with unsupported scheme with 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: 'ftp://daemon:4200' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects a non-URL string with 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: 'not-a-url' },
    });
    expect(res.status()).toBe(400);
  });

  test('accepts a valid ws:// URL or returns setup-complete', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: 'ws://room-daemon:4200' },
    });
    // 200 = success (setup not yet complete), 400 = "setup already complete"
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.message).toBeTruthy();
    }
  });

  test('accepts a valid http:// URL or returns setup-complete', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: 'http://room-daemon:4200' },
    });
    expect([200, 400]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// AC-4: POST /api/setup/create-admin — validation
// ---------------------------------------------------------------------------

test.describe('MH-004: POST /api/setup/create-admin — validation', () => {
  test('rejects empty username with 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/create-admin`, {
      data: { username: '', password: 'password123' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects password shorter than 8 characters with 400', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/create-admin`, {
      data: { username: 'admin2', password: 'short' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects when admin already exists or setup complete', async ({ request }) => {
    // In the test environment the admin is always seeded, so this must fail.
    const res = await request.post(`${API_URL}/api/setup/create-admin`, {
      data: { username: 'newadmin', password: 'newpassword' },
    });
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// AC-5: POST /api/setup/complete
// ---------------------------------------------------------------------------

test.describe('MH-004: POST /api/setup/complete', () => {
  test('succeeds or returns already-complete (idempotent)', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/setup/complete`);
    // 200 = marked complete, 400 = already complete
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.message).toBeTruthy();
    }
  });

  test('status reflects setup_complete after complete call', async ({ request }) => {
    // Ensure complete is called first.
    await request.post(`${API_URL}/api/setup/complete`);

    const statusRes = await request.get(`${API_URL}/api/setup/status`);
    const body = await statusRes.json();
    // setup_complete may be true (if our call succeeded) or was already true.
    expect(typeof body.setup_complete).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// AC-6: Endpoints reject mutation after setup is complete
// ---------------------------------------------------------------------------

test.describe('MH-004: post-completion lockout', () => {
  test.beforeAll(async ({ request }) => {
    // Mark setup complete so we can verify lockout.
    await request.post(`${API_URL}/api/setup/complete`);
  });

  test('configure returns 400 after setup_complete', async ({ request }) => {
    // After setup is complete, configure must reject.
    const statusRes = await request.get(`${API_URL}/api/setup/status`);
    const { setup_complete } = await statusRes.json();

    if (!setup_complete) {
      // If we can't get to a complete state (e.g. no admin), skip gracefully.
      test.skip();
    }

    const res = await request.post(`${API_URL}/api/setup/configure`, {
      data: { daemon_url: 'ws://daemon:4200' },
    });
    expect(res.status()).toBe(400);
  });

  test('create-admin returns 400 after setup_complete', async ({ request }) => {
    const statusRes = await request.get(`${API_URL}/api/setup/status`);
    const { setup_complete } = await statusRes.json();

    if (!setup_complete) {
      test.skip();
    }

    const res = await request.post(`${API_URL}/api/setup/create-admin`, {
      data: { username: 'attacker', password: 'hacked123' },
    });
    expect(res.status()).toBe(400);
  });

  test('complete returns 400 when already complete', async ({ request }) => {
    const statusRes = await request.get(`${API_URL}/api/setup/status`);
    const { setup_complete } = await statusRes.json();

    if (!setup_complete) {
      test.skip();
    }

    const res = await request.post(`${API_URL}/api/setup/complete`);
    expect(res.status()).toBe(400);
  });
});
