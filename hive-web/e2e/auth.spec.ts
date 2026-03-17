import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';

test.describe('BE-009: Session Management', () => {
  test('health endpoint works without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
  });
});
