import { test, expect } from '@playwright/test';
import { registerEmulatedBillingPortal } from './emulatedBillingPortal.mjs';
import { registerEmulatedLegalAcceptance } from './emulatedLegalAcceptance.mjs';

// Never connects to production: Firebase emulators with a synthetic founder.
test('P0 founder: /admin opens independently of sector session preference', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.stack || error)));
  await registerEmulatedBillingPortal(page.context());
  await registerEmulatedLegalAcceptance(page.context());
  await page.goto('/central-empenhos');
  await expect(page.getByTestId('sector-login-email')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('sector-login-email').fill('aprov1hgesm@gmail.com');
  await page.getByTestId('sector-login-password').fill('Emprovex-Teste!2026');
  await page.getByTestId('sector-login-submit').click();
  await page.waitForTimeout(2500);
  // Simulate direct address, stale sector preference, or protected storage.
  await page.evaluate(() => sessionStorage.setItem('emprovex_profile_mode_v1', 'sector'));
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admin-overview-tab')).toBeVisible({ timeout: 20000 });
  const state = await page.evaluate(() => ({
    pathname: location.pathname,
    cssSheets: document.styleSheets.length,
    text: document.body.innerText.slice(0, 450),
  }));
  expect(state.pathname).toBe('/admin');
  expect(state.cssSheets).toBeGreaterThan(0);
  expect(state.text).not.toContain('Validando perfil administrativo...');
  expect(state.text).not.toContain('Não foi possível abrir esta tela');
  expect(errors).toEqual([]);
});
