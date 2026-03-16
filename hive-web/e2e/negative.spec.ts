import { test, expect } from '@playwright/test';

const BASE_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

// ── Negative Tests ────────────────────────────────────────────────────────────

test.describe('Negative tests: malformed requests', () => {
  test('malformed JSON body returns 400 or 404', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/rooms/test/send`, {
      data: 'this is not json{{{',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 404, 422]).toContain(response.status());
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

  test('missing content-type header handled gracefully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/rooms/test/send`, {
      data: '{"content": "hello"}',
      headers: {},
    });
    // Should not crash — either 400, 404, or 415 Unsupported Media Type
    expect([400, 404, 415, 422]).toContain(response.status());
  });

  test('empty body on POST returns error', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/rooms/test/send`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 404, 422]).toContain(response.status());
  });

  test('very long URL path returns 404 not crash', async ({ request }) => {
    const longPath = '/api/' + 'a'.repeat(10000);
    const response = await request.get(`${BASE_URL}${longPath}`);
    expect([404, 414]).toContain(response.status());
  });

  test('special characters in path handled safely', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/rooms/../../../etc/passwd`);
    expect([400, 404]).toContain(response.status());
  });
});
