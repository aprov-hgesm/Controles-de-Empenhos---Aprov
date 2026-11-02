import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /public-login-incognito\.spec\.mjs/,
  workers: 1,
  retries: 0,
  timeout: 65_000,
  reporter: 'list',
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- -p 3000',
    url: 'http://127.0.0.1:3000/central-empenhos',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
