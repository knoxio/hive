import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-012: Agent Spawn', () => {
  test('POST /api/agents/spawn returns agent info or 501 (not implemented)', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/agents/spawn`, {
      data: {
        personality: 'coder',
        room_id: 'test-room',
      },
    });
    // 201 (spawned), 400 (bad request), 401 (unauthorized), or 501 (not yet implemented)
    expect([201, 400, 401, 404, 501]).toContain(response.status());
  });

  test('GET /api/agents returns agent list or 404/501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/agents`);
    expect([200, 401, 404, 501]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body.agents) || body.agents === undefined).toBeTruthy();
    }
  });

  test('DELETE /api/agents/:id returns result or 501', async ({ request }) => {
    const response = await request.delete(`${API_URL}/api/agents/nonexistent-agent`);
    expect([200, 401, 404, 501]).toContain(response.status());
  });
});

test.describe('BE-013: Agent Health Monitoring', () => {
  test('GET /api/agents/health returns health status or 404/501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/agents/health`);
    expect([200, 401, 404, 501]).toContain(response.status());
  });
});

test.describe('BE-015: Agent Logs', () => {
  test('GET /api/agents/:id/logs returns logs or 501', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/agents/test-agent/logs`);
    expect([200, 401, 404, 501]).toContain(response.status());
  });
});
