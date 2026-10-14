import { test, expect } from '@playwright/test';

// Run against `npm run dev` and the usual Playwright baseURL.
// Production-mode deployments intentionally return HTTP 404 on this lab route.
test.describe('VISUAL-W4 / Border Beam development laboratory', () => {
  test('three strengths, mobile layout and non-intercepted click', async ({ page }) => {
    await page.goto('/visual-lab/border-beam');
    await expect(page.getByTestId('border-beam-lab')).toBeVisible();
    for (const strength of ['low', 'medium', 'high']) {
      await expect(page.getByTestId(`border-beam-${strength}`)).toBeVisible();
    }
    const button = page.getByTestId('border-beam-action');
    await button.click();
    await expect(button).toContainText('(1)');
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('respects theme, pause and OS reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/visual-lab/border-beam');
    await page.getByRole('button', { name: 'Fundo claro' }).click();
    await expect(page.getByTestId('border-beam-low')).toHaveAttribute('data-beam-theme', 'light');
    const motion = await page.getByTestId('border-beam-low').evaluate((element) =>
      getComputedStyle(element, '::after').animationDuration
    );
    expect(['0s', '0.000001s', '0.00001s']).toContain(motion);
    await page.getByRole('button', { name: 'Pausar destaque' }).click();
    await expect(page.getByTestId('border-beam-low')).toHaveAttribute('data-beam-active', 'false');
  });
});
