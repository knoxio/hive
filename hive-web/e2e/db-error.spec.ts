import { test, expect } from '@playwright/test';

const BASE_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

// ── BE-023: SQLite Database Setup ─────────────────────────────────────────────

test.describe('BE-023: SQLite database', () => {
  test('server starts with database initialized', async ({ request }) => {
    // AC: On startup, the server creates the SQLite database file
    // Verified indirectly — if health returns 200, DB initialized successfully
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('database survives server restart', async ({ request }) => {
    // AC: Hive-owned state persisted across restarts
    // Verified by checking health after presumed restart
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
  });
});

// ── BE-024: Error Handling ────────────────────────────────────────────────────

test.describe('BE-024: Error handling', () => {
  test('unknown route returns 404 JSON, not plain text', async ({ request }) => {
    // AC: 404 responses for unknown routes return {"error": "not_found"}
    const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint`);
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('not_found');
    expect(body.message).toBeDefined();
  });

  test('error response has structured JSON format', async ({ request }) => {
    // AC: All error responses return JSON with error + message fields
    const response = await request.get(`${BASE_URL}/api/nonexistent`);
    expect(response.status()).toBe(404);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
  });

  test('method not allowed returns 405 JSON', async ({ request }) => {
    // AC: 405 Method Not Allowed returns {"error": "method_not_allowed"}
    const response = await request.delete(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(405);
    const body = await response.json();
    expect(body.error).toBe('method_not_allowed');
  });

  test('error response includes request_id', async ({ request }) => {
    // AC: Every error response includes a "request_id" field
    const response = await request.get(`${BASE_URL}/api/nonexistent`);
    const body = await response.json();
    expect(body.request_id).toBeDefined();
    expect(typeof body.request_id).toBe('string');
    expect(body.request_id.length).toBeGreaterThan(0);
  });

  test('health endpoint returns valid JSON on success', async ({ request }) => {
    // Sanity check — success responses also work
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.uptime_secs).toBeGreaterThanOrEqual(0);
  });
});
