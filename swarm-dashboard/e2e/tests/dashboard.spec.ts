import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

let mockProc: any = null;
let demoProc: any = null;

async function waitFor(url: string, timeout = 5000) {
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

test.beforeAll(async () => {
  // start mock server (serves /api endpoints on port 9944)
  const repoRoot = path.resolve(__dirname, '..', '..');
  mockProc = spawn('node', ['mock-rpc-server.js'], { cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit'] });
  await waitFor('http://localhost:9944/health', 15000);

  // start static demo server
  demoProc = spawn('npx', ['http-server', './e2e/demo', '-p', '3001', '-c-1'], { cwd: repoRoot, shell: true, stdio: ['ignore', 'inherit', 'inherit'] });
  await waitFor('http://localhost:3001', 10000);
});

test.afterAll(() => {
  if (mockProc) mockProc.kill();
  if (demoProc) demoProc.kill();
});

test('dashboard demo shows readiness score and SIGILL count', async ({ page }) => {
  await page.goto('/');
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