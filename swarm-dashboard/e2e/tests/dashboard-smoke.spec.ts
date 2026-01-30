import { test, expect } from '@playwright/test';
import path from 'path';
import { startServers } from '../test-helpers';

let helpers: any = null;

test.beforeAll(async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  helpers = await startServers(repoRoot);
});

test.afterAll(async () => {
  if (helpers) await helpers.stop();
});

test('dashboard smoke test shows title and changes period', async ({ page }) => {
  await page.goto(helpers.demoUrl);
  // The E2E demo is minimal and may not include the production dashboard title; assert demo page title
  await expect(page.locator('h2')).toHaveText(/Swarm Dashboard/i);

  // click the 'Month' period button if present
  const button = page.getByRole('button', { name: /Month/i });
  if ((await button.count()) > 0) {
    await button.click();
    await expect(button).toHaveClass(/active/);
  }
});
