import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

let mockProc: any = null;
let startedMock = false;
let demoServer: any = null;
let demoUrl = '';

async function waitFor(url: string, timeout = 10000) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    (function check() {
      http.get(url, res => {
        if (res.statusCode === 200) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(check, 200);
      }).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(check, 200);
      });
    })();
  });
}

// This smoke test covers the main pipeline pieces the dashboard relies on:
// - readiness/testnet endpoint
// - SIGILL alerts rendering and artifact links
// It prefers a public RPC if env is set; for local runs it falls back to mock server.

let helpers: any = null;

// centralized server helpers and setup
import { startServers } from '../test-helpers';

test.beforeAll(async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  helpers = await startServers(repoRoot);
});

test.afterAll(async () => {
  if (helpers) await helpers.stop();
});
test('pipeline smoke: readiness, SIGILL alerts and artifacts', async ({ page }) => {
  await page.goto(helpers.demoUrl);

  // Readiness score
  await expect(page.locator('#readiness-score')).toHaveText(/\d+/, { timeout: 15000 });
  await expect(page.locator('#readiness-status')).toHaveText(/Good|Warning|Critical|unknown/, { timeout: 15000 });

  // SIGILL count and items
  await expect(page.locator('#sigill-count')).toHaveText(/\d+/, { timeout: 15000 });
  const sigillText = await page.locator('#sigill-count').innerText();
  const cnt = Number(sigillText);

  // If there are SIGILL alerts, assert artifact links render
  if (cnt > 0) {
    const first = page.locator('.sigill-item').first();
    await expect(first.locator('.sigill-strace')).toHaveCount(1);
    await expect(first.locator('.sigill-core')).toHaveCount(1);
    const straceHref = await first.locator('.sigill-strace').getAttribute('href');
    expect(straceHref).toContain('/artifacts/');
  }

  // Quick smoke: CI status tile and test health counts
  await expect(page.locator('#ci-status')).toHaveText(/Pass|Fail|Unknown|unknown/, { timeout: 15000 });
  await expect(page.locator('#test-health-counts')).toHaveText(/\d+/, { timeout: 15000 });
});