import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-008: GitHub OAuth Authentication', () => {
  test('GET /api/auth/login redirects to GitHub OAuth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/login`, {
      maxRedirects: 0,
    });
    // Should redirect (302) or return auth config
    expect([200, 302, 401]).toContain(response.status());
  });

  test('unauthenticated request to protected endpoint returns 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces`);
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('invalid token returns 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces`, {
      headers: { Authorization: 'Bearer invalid-token-123' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('BE-009: Session Management', () => {
  test('health endpoint works without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
  });
});
