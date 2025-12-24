import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:3001'
  }
};

export default config;