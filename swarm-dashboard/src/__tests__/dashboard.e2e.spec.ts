import { test, expect } from '@playwright/test';

test('dashboard smoke test shows title and changes period', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('📺 Media Production Dashboard')).toBeVisible();

  // click the 'Month' period button if present
  const button = page.getByRole('button', { name: /Month/i });
  if (await button.count() > 0) {
    await button.click();
    // ensure active class toggles (example check - page may change UI)
    await expect(button).toHaveClass(/active/);
  }
});
