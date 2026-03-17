import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: ['./e2e/**/*.spec.ts', './tests/e2e/**/*.spec.ts'],
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.HIVE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev --host 0.0.0.0 --port 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
