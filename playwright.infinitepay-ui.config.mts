import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /infinitepay-regularization-runtime\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- -p 3000',
    url: 'http://127.0.0.1:3000/regularizacao',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
