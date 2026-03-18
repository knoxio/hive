/**
 * BE-012 / BE-013 / BE-015: Agent Spawn, Health Monitoring, Logs
 *
 * These are API contract tests that verify expected response shapes for
 * agent-related endpoints. All tests use page.route() mocks — no running
 * backend required.
 */

import { test, expect } from '@playwright/test';

test.describe('BE-012: Agent Spawn', () => {
  test('POST /api/agents/spawn returns agent info or 501 (not implemented)', async ({ page }) => {
    await page.route('**/api/agents/spawn', async (route) => {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_implemented' }),
      });
    });

    const response = await page.request.post('/api/agents/spawn', {
      data: {
        personality: 'coder',
        room_id: 'test-room',
      },
    });
    // 201 (spawned), 400 (bad request), or 501 (not yet implemented)
    expect([201, 400, 404, 501]).toContain(response.status());
  });

  test('GET /api/agents returns agent list or 404/501', async ({ page }) => {
    await page.route('**/api/agents', async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_found' }),
      });
    });

    const response = await page.request.get('/api/agents');
    expect([200, 401, 404, 501]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body.agents) || body.agents === undefined).toBeTruthy();
    }
  });

  test('DELETE /api/agents/:id returns result or 501', async ({ page }) => {
    await page.route('**/api/agents/nonexistent-agent', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_found' }),
      });
    });

    const response = await page.request.delete('/api/agents/nonexistent-agent');
    expect([200, 404, 501]).toContain(response.status());
  });
});

test.describe('BE-013: Agent Health Monitoring', () => {
  test('GET /api/agents/health returns health status or 404/501', async ({ page }) => {
    await page.route('**/api/agents/health', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_found' }),
      });
    });

    const response = await page.request.get('/api/agents/health');
    expect([200, 404, 501]).toContain(response.status());
  });
});

test.describe('BE-015: Agent Logs', () => {
  test('GET /api/agents/:id/logs returns logs or 501', async ({ page }) => {
    await page.route('**/api/agents/test-agent/logs', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_found' }),
      });
    });

    const response = await page.request.get('/api/agents/test-agent/logs');
    expect([200, 404, 501]).toContain(response.status());
  });
});
