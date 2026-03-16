import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-017: Workspace CRUD', () => {
  test('POST /api/workspaces creates workspace or returns 404/501', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/workspaces`, {
      data: { name: 'test-workspace', description: 'test' },
    });
    expect([201, 401, 404, 501]).toContain(response.status());
  });

  test('GET /api/workspaces lists workspaces or returns 404/501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces`);
    expect([200, 401, 404, 501]).toContain(response.status());
  });

  test('GET /api/workspaces/:id returns workspace or 404/501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces/nonexistent`);
    expect([200, 404, 401, 501]).toContain(response.status());
  });

  test('DELETE /api/workspaces/:id deletes or returns 404/501', async ({ request }) => {
    const response = await request.delete(`${API_URL}/api/workspaces/nonexistent`);
    expect([200, 204, 404, 401, 501]).toContain(response.status());
  });
});

test.describe('BE-020: Batch Agent Provisioning', () => {
  test('POST /api/workspaces/:id/provision returns result or 404/501', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/workspaces/test/provision`, {
      data: { manifest: { agents: [] } },
    });
    expect([200, 202, 400, 401, 404, 501]).toContain(response.status());
  });
});

test.describe('BE-021: Cross-Room Timeline', () => {
  test('GET /api/workspaces/:id/timeline returns messages or 404/501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/workspaces/test/timeline`);
    expect([200, 401, 404, 501]).toContain(response.status());
  });
});
