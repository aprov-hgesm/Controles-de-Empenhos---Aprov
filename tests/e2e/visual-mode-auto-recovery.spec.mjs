import { test, expect } from '@playwright/test';

test.describe('Fallback Essencial → Normal (somente preferência local)', () => {
  test('erro de chunk recupera modo Normal sem recarregar ou modificar dados', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('emprovex:visual-mode:v1', 'essencial');
    });
    await page.reload();
    await expect.poll(() => page.locator('html').getAttribute('data-visual-mode')).toBe('essencial');

    const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'ChunkLoadError: Loading chunk 512 failed',
        error: new Error('ChunkLoadError: Loading chunk 512 failed'),
      }));
    });
    await expect.poll(() => page.locator('html').getAttribute('data-visual-mode')).toBe('premium');
    await expect(page.getByTestId('visual-mode-recovery-notice')).toBeVisible();
    const after = await page.evaluate(() => ({
      mode: sessionStorage.getItem('emprovex:visual-mode:v1'),
      quarantine: sessionStorage.getItem('emprovex:visual-mode:recovery:v1'),
      navigationCount: performance.getEntriesByType('navigation').length,
    }));
    expect(after).toEqual({ mode: 'premium', quarantine: '1', navigationCount });
    await page.reload();
    await expect.poll(() => page.locator('html').getAttribute('data-visual-mode')).toBe('premium');
    await expect(page.getByTestId('visual-mode-recovery-notice')).toBeVisible();
  });

  test('erro de autorização/rede não dispara fallback nem enfraquece o gate', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('emprovex:visual-mode:v1', 'essencial'));
    await page.reload();
    await expect.poll(() => page.locator('html').getAttribute('data-visual-mode')).toBe('essencial');
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'BILLING_ACCESS_CHECK_UNAVAILABLE 403',
        error: new Error('BILLING_ACCESS_CHECK_UNAVAILABLE 403'),
      }));
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Firebase: permission-denied',
        error: new Error('Firebase: permission-denied'),
      }));
    });
    await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'essencial');
    await expect(page.getByTestId('visual-mode-recovery-notice')).toHaveCount(0);
  });
});
