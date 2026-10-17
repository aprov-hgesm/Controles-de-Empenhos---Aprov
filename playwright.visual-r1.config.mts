import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /visual-w4-(operational-border-beam|navigation-expansion|warehouse-location-inspection)\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- -p 3000',
    url: 'http://127.0.0.1:3000/dev/visual-r1',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
