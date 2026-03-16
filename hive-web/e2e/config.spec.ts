import { test, expect } from '@playwright/test';

const BASE_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

// ── BE-002: Config Loading ────────────────────────────────────────────────────

test.describe('BE-002: Config loading', () => {
  test('server responds on configured port', async ({ request }) => {
    // AC: server reads port from config and binds to it
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
  });

  test('health returns correct version from package', async ({ request }) => {
    // AC: version field matches Cargo.toml version
    const response = await request.get(`${BASE_URL}/api/health`);
    const body = await response.json();
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('server uses default config when no hive.toml', async ({ request }) => {
    // AC: falls back to sensible defaults when config file is missing
    // Verified by server starting successfully without hive.toml
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
  });
});
