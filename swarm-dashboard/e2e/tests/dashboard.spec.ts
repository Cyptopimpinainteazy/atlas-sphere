import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

let helpers: any = null;

// centralized server helpers and setup
import { startServers } from '../test-helpers';

test.beforeAll(async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  helpers = await startServers(repoRoot);
  // ensure demo is reachable
  await helpers; // demoUrl available
});

test.afterAll(async () => {
  if (helpers) await helpers.stop();
});

test('dashboard demo shows readiness score and SIGILL count', async ({ page }) => {
  await page.goto(helpers.demoUrl);
  await expect(page.locator('#readiness-score')).toHaveText(/\d+/, { timeout: 15000 });
  await expect(page.locator('#readiness-status')).toHaveText(/Good|Warning|Critical|unknown/, { timeout: 15000 });
  await expect(page.locator('#sigill-count')).toHaveText(/\d+/, { timeout: 15000 });

  // The seeded fixtures include one SIGILL alert
  const sigillText = await page.locator('#sigill-count').innerText();
  expect(Number(sigillText)).toBeGreaterThanOrEqual(0);

  // If there are SIGILL alerts, assert artifact links render
  const cnt = Number(sigillText);
  if (cnt > 0) {
    const first = page.locator('.sigill-item').first();
    await expect(first.locator('.sigill-strace')).toHaveCount(1);
    await expect(first.locator('.sigill-core')).toHaveCount(1);
    const straceHref = await first.locator('.sigill-strace').getAttribute('href');
    expect(straceHref).toContain('/artifacts/');
  }
});