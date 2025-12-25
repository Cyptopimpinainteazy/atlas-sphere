import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    // Allow overriding the demo URL via environment for CI or dynamic-port tests
    baseURL: process.env.DEMO_URL || 'http://localhost:3001',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  }
};

export default config;