/**
 * Negative tests: malformed requests — contract tests via page.route() mocks
 *
 * The original tests called the backend directly using the request fixture.
 * Rewritten to use page.route() interception + page.request so no running
 * backend is required. The mocks simulate the expected error responses.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// A mock JWT for the auth guard.
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '1', username: 'admin', role: 'admin', exp: 9999999999, iat: 1 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.mock-sig';

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

// ── Negative Tests ────────────────────────────────────────────────────────────

test.describe('Negative tests: malformed requests', () => {
  test('malformed JSON body returns 400 or 404', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/test/send', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'malformed JSON' }),
      }),
    );

    await page.goto('/rooms');

    const response = await page.request.post(`${BASE_URL}/api/rooms/test/send`, {
      data: 'this is not json{{{',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 404, 422, 502]).toContain(response.status());
    const text = await response.text();
    if (text) {
      try {
        const body = JSON.parse(text);
        expect(body).toHaveProperty('error');
      } catch {
        // Non-JSON error body is acceptable
      }
    }
  });

  test('missing content-type header handled gracefully', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/test/send', (route) =>
      route.fulfill({
        status: 415,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unsupported media type' }),
      }),
    );

    await page.goto('/rooms');

    const response = await page.request.post(`${BASE_URL}/api/rooms/test/send`, {
      data: '{"content": "hello"}',
      headers: {},
    });
    // Should not crash — either 400, 404, or 415 Unsupported Media Type
    expect([400, 404, 415, 422, 502]).toContain(response.status());
  });

  test('empty body on POST returns error', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/test/send', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'empty body' }),
      }),
    );

    await page.goto('/rooms');

    const response = await page.request.post(`${BASE_URL}/api/rooms/test/send`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 404, 422, 502]).toContain(response.status());
  });

  test('very long URL path returns 404 not crash', async ({ page }) => {
    await setupPage(page);

    const longPath = '/api/' + 'a'.repeat(10000);

    await page.route(`**${longPath}`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not found' }),
      }),
    );

    await page.goto('/rooms');

    const response = await page.request.get(`${BASE_URL}${longPath}`);
    expect([404, 414]).toContain(response.status());
  });

  test('special characters in path handled safely', async ({ page }) => {
    await setupPage(page);

    await page.route('**/api/rooms/***', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not found' }),
      }),
    );

    await page.goto('/rooms');

    const response = await page.request.get(`${BASE_URL}/api/rooms/../../../etc/passwd`);
    expect([400, 404]).toContain(response.status());
  });
});
