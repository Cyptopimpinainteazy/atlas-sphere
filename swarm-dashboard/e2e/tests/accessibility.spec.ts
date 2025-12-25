import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

let demoServer: any = null;
let demoUrl = '';
let helpers: any = null;
import { startServers } from '../test-helpers';

async function waitFor(url: string, timeout = 5000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    (function check() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const http = require('http');
        http.get(url, res => {
          if (res.statusCode === 200) return resolve();
          if (Date.now() - start > timeout) return reject(new Error('timeout'));
          setTimeout(check, 200);
        }).on('error', () => {
          if (Date.now() - start > timeout) return reject(new Error('timeout'));
          setTimeout(check, 200);
        });
      } catch (err) {
        return reject(err);
      }
    })();
  });
}

let mockProc: any = null;

test.beforeAll(async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  helpers = await startServers(repoRoot);
  demoUrl = helpers.demoUrl;
});

test.afterAll(() => {
  if (demoServer) demoServer.close();
  if (mockProc) mockProc.kill();
});

// Small accessibility smoke test using axe-core loaded from CDN to avoid adding deps
test('accessibility: demo passes basic axe checks', async ({ page }) => {
  await page.goto(demoUrl);

  // load axe from CDN
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.6.3/axe.min.js' });

  const result = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
    });
  });

  // Fail the test if there are any violations, printing a concise summary
  if (result.violations && result.violations.length > 0) {
    const summary = result.violations.map(v => `${v.id}: ${v.impact} - ${v.nodes.length} nodes`).join('\n');
    console.error('Axe violations:\n' + summary);

    // Write a JSON artifact so CI can consume and post a PR comment
    try {
      const outPath = path.join(path.resolve(__dirname, '..', '..'), 'e2e', 'axe-violations.json');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(result.violations, null, 2));
    } catch (err) {
      console.error('Failed to write axe violations artifact:', err);
    }
  }

  expect(result.violations.length).toBe(0);
});