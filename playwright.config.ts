import { defineConfig, devices } from '@playwright/test';

const TEST_TOKEN = 'test-token-12345';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:3333/?t=${TEST_TOKEN}`,
    trace: 'on-first-retry',
    actionTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run cli:start -- --no-open --port 3333 --token ${TEST_TOKEN}`,
    url: `http://127.0.0.1:3333/?t=${TEST_TOKEN}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
