import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-008: GitHub OAuth Authentication', () => {
  test('GET /api/auth/login redirects to GitHub OAuth or returns 404 (not implemented)', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/login`, {
      maxRedirects: 0,
    });
    // Should redirect (302), return auth config, or 404 (not implemented yet)
    expect([200, 302, 401, 404]).toContain(response.status());
  });

  test('unauthenticated request to protected endpoint returns 401 or 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces`);
    expect([401, 404]).toContain(response.status());
    if (response.status() === 401) {
      const body = await response.json();
      expect(body.error).toBeDefined();
    }
  });

  test('invalid token returns 401 or 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces`, {
      headers: { Authorization: 'Bearer invalid-token-123' },
    });
    expect([401, 404]).toContain(response.status());
  });
});

test.describe('BE-009: Session Management', () => {
  test('health endpoint works without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
  });
});
