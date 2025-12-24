import { test, expect } from '@playwright/test';

// Small accessibility smoke test using axe-core loaded from CDN to avoid adding deps
test('accessibility: demo passes basic axe checks', async ({ page }) => {
  await page.goto('/');

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
  }

  expect(result.violations.length).toBe(0);
});