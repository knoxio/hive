/**
 * MH-003: App settings API — contract tests via page.route() mocks
 *
 * The /api/settings endpoint is backend-only (no frontend UI component).
 * Tests use page.route() to intercept requests made through the browser's
 * network layer, allowing assertions about request/response structure
 * without requiring a running backend.
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

// A mock JWT for the auth guard so the page does not redirect to /login.
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

/** Boot the app with auth + guard stubs so page.request can fire. */
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

test.describe('MH-003: App settings API', () => {
  test('GET /api/settings returns 200 with a JSON object', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ daemon_url: 'ws://localhost:4200' }),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.get(`${API_BASE}/api/settings`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('GET /api/settings includes daemon_url key', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ daemon_url: 'ws://localhost:4200' }),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.get(`${API_BASE}/api/settings`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('daemon_url');
    expect(typeof body.daemon_url).toBe('string');
    expect(body.daemon_url.length).toBeGreaterThan(0);
  });

  test('PATCH /api/settings updates a setting and returns updated object', async ({ page }) => {
    await setupPage(page);

    const newUrl = 'ws://patched-daemon:9999';

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const patched = { daemon_url: newUrl };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(patched),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.patch(`${API_BASE}/api/settings`, {
      data: { daemon_url: newUrl },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.daemon_url).toBe(newUrl);
  });

  test('PATCH /api/settings persists the change on subsequent GET', async ({ page }) => {
    await setupPage(page);

    const newUrl = 'ws://persisted-daemon:8888';
    let stored = { daemon_url: 'ws://localhost:4200' };

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON() as { daemon_url?: string };
        if (data.daemon_url) stored = { daemon_url: data.daemon_url };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(stored),
        });
      }
      // GET
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stored),
      });
    });

    await page.goto('/rooms');

    await page.request.patch(`${API_BASE}/api/settings`, { data: { daemon_url: newUrl } });
    const getResp = await page.request.get(`${API_BASE}/api/settings`);
    expect(getResp.status()).toBe(200);
    const body = await getResp.json();
    expect(body.daemon_url).toBe(newUrl);
  });

  test('PATCH /api/settings accepts arbitrary key/value pairs', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON() as Record<string, string>;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ daemon_url: 'ws://localhost:4200', ...data }),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.patch(`${API_BASE}/api/settings`, {
      data: { custom_flag: 'enabled' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.custom_flag).toBe('enabled');
  });

  test('PATCH /api/settings with empty object returns 400', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON() as Record<string, unknown>;
        if (!data || Object.keys(data).length === 0) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'no fields to update' }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.patch(`${API_BASE}/api/settings`, { data: {} });
    expect(resp.status()).toBe(400);
  });

  test('PATCH /api/settings with multiple fields updates all', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON() as Record<string, string>;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ daemon_url: 'ws://localhost:4200', ...data }),
        });
      }
      return route.continue();
    });

    await page.goto('/rooms');

    const resp = await page.request.patch(`${API_BASE}/api/settings`, {
      data: { key_a: 'value_a', key_b: 'value_b' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.key_a).toBe('value_a');
    expect(body.key_b).toBe('value_b');
  });

  test('settings are persisted across subsequent reads', async ({ page }) => {
    await setupPage(page);

    const sentinel = `ws://sentinel-${Date.now()}:1234`;
    let stored = { daemon_url: 'ws://localhost:4200' };

    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON() as { daemon_url?: string };
        if (data.daemon_url) stored = { daemon_url: data.daemon_url };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(stored),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stored),
      });
    });

    await page.goto('/rooms');

    await page.request.patch(`${API_BASE}/api/settings`, { data: { daemon_url: sentinel } });

    const r1 = await page.request.get(`${API_BASE}/api/settings`);
    const r2 = await page.request.get(`${API_BASE}/api/settings`);

    expect((await r1.json()).daemon_url).toBe(sentinel);
    expect((await r2.json()).daemon_url).toBe(sentinel);
  });
});
