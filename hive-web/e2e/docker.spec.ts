import { test, expect } from '@playwright/test';

/**
 * MH-002: Docker dev environment smoke tests.
 *
 * These tests validate that the Hive stack responds correctly when running —
 * whether started via `just dev` (Docker) or `just dev-local`. They do not
 * spin up Docker themselves; they assume the stack is already running.
 */

const API_BASE = process.env.HIVE_API_URL || 'http://localhost:3000';
const FRONTEND_BASE = process.env.HIVE_URL || 'http://localhost:5173';

test.describe('MH-002: Docker dev environment — backend reachable', () => {
  test('hive-server health endpoint responds', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`);
    expect(resp.status()).toBe(200);
  });

  test('health response confirms server is running', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`);
    const body = await resp.json();
    // status is "ok" when daemon is reachable, "degraded" when it is not
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('CORS headers allow frontend origin', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/health`, {
      headers: { Origin: FRONTEND_BASE },
    });
    expect(resp.status()).toBe(200);
    // Server must echo back an Access-Control-Allow-Origin header
    const acao = resp.headers()['access-control-allow-origin'];
    expect(acao).toBeTruthy();
  });

  test('CORS preflight on /api/settings returns 200', async ({ request }) => {
    const resp = await request.fetch(`${API_BASE}/api/settings`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_BASE,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    // axum CorsLayer returns 200 for valid preflights
    expect([200, 204]).toContain(resp.status());
  });

  test('unknown API routes return 404', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/nonexistent-route-mh002`);
    expect(resp.status()).toBe(404);
  });
});

test.describe('MH-002: Docker dev environment — frontend reachable', () => {
  test('frontend dev server serves HTML', async ({ page }) => {
    const resp = await page.goto(FRONTEND_BASE);
    expect(resp?.status()).toBe(200);
    const ct = resp?.headers()['content-type'] ?? '';
    expect(ct).toContain('text/html');
  });

  test('frontend page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(FRONTEND_BASE);
    // Allow React HMR noise but no hard crashes
    const fatal = errors.filter(
      (e) => !e.includes('HMR') && !e.includes('hot-update')
    );
    expect(fatal).toHaveLength(0);
  });
});
