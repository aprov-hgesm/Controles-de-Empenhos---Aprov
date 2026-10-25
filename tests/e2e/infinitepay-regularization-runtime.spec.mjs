import { expect, test } from '@playwright/test';

const legacyConfig = {
  planName: 'Plano Completo EMPROVEX',
  monthlyPriceCents: 7000,
  currency: 'BRL',
  dueBusinessDay: 5,
  gracePeriodDays: 10,
  paymentLinkUrl: '',
  pixKey: '',
  pixKeyType: '',
  pixRecipientName: '',
  supportContact: 'Atendimento EMPROVEX',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/regularization', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(legacyConfig),
    });
  });
});

test('overview has its own content and switches to payment view without reload', async ({ page }) => {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'overview');
  await expect(page.getByRole('heading', { name: 'Minha assinatura e pagamentos' })).toBeVisible();
  await expect(page.getByTestId('billing-payment-journey')).toHaveCount(0);
  await expect(page.getByTestId('manual-payment-options-toggle')).toHaveCount(0);
  await page.getByTestId('billing-nav-payments').click();
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'payments');
  await expect(page.getByTestId('billing-payment-journey')).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  await expect(page.getByTestId('manual-payment-options-toggle')).toBeVisible();
  await page.getByTestId('manual-payment-options-toggle').click();
  await expect(page.getByText('Preço de referência legado')).toBeVisible();
  await page.getByTestId('billing-nav-overview').click();
  await expect(page.getByTestId('manual-payment-options-toggle')).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'overview');
  expect(crashes).toEqual([]);
});

test('InfinitePay return selects payments tab but never grants subscription', async ({ page }) => {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.goto('/regularizacao?order_nsu=fake-order&transaction_nsu=fake-transaction&slug=fake-slug', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'payments');
  await expect(page.getByTestId('infinitepay-unverified-return')).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  expect(crashes).toEqual([]);
});

test('history has an isolated panel and rejects unauthenticated cross-tenant access', async ({ page }) => {
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  await page.getByTestId('billing-nav-history').click();
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'history');
  await expect(page.getByTestId('billing-history-unauthorized')).toBeVisible();
  await expect(page.getByTestId('billing-payment-journey')).toHaveCount(0);
  await expect(page.getByTestId('manual-payment-options-toggle')).toHaveCount(0);
  await page.getByTestId('billing-nav-help').click();
  await expect(page.getByTestId('billing-help-content')).toBeVisible();
  await expect(page.getByTestId('billing-history-unauthorized')).toHaveCount(0);
});

test('manual payment API failure is isolated to payment tab and loaded only on request', async ({ page }) => {
  const crashes = [];
  let queries = 0;
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.route('**/api/billing/regularization', async (route) => {
    queries += 1;
    await route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({
        code: 'REGULARIZATION_CONFIG_UNAVAILABLE',
        message: 'As instruções de regularização estão temporariamente indisponíveis.',
      }),
    });
  });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  expect(queries).toBe(0);
  await page.getByTestId('billing-nav-payments').click();
  expect(queries).toBe(0);
  await page.getByTestId('manual-payment-options-toggle').click();
  await expect(page.getByTestId('manual-payment-config-unavailable')).toBeVisible();
  expect(queries).toBe(1);
  expect(crashes).toEqual([]);
});

test('desktop fixed sidebar shows one selected tab at a time', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('billing-fixed-sidebar')).toHaveCSS('position', 'fixed');
  await expect(page.getByTestId('billing-fixed-sidebar')).toBeInViewport();
  await expect(page.getByTestId('billing-platform-shell')).toHaveCSS('background-color', 'rgb(246, 248, 252)');
  await expect(page.getByTestId('billing-nav-overview')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('billing-nav-history').click();
  await expect(page.getByTestId('billing-nav-history')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('billing-nav-overview')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'history');
});

test('mobile navigation drawer switches tabs, closes and avoids horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  const menu = page.getByTestId('billing-mobile-menu');
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(menu).toBeEnabled();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId('billing-nav-help').click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('billing-help-content')).toBeVisible();
  await menu.click();
  await page.getByTestId('billing-nav-payments').click();
  await expect(page.getByTestId('billing-active-panel')).toHaveAttribute('data-tab', 'payments');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test('keyboard arrows and Home/End navigate real sidebar tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  const overview = page.getByTestId('billing-nav-overview');
  await overview.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('billing-nav-history')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByTestId('billing-nav-help')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
});

test('unreleased price escalation and visual simulator never appear on any tab', async ({ page }) => {
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
  for (const tab of ['overview', 'history', 'payments', 'help']) {
    await page.getByTestId('billing-nav-' + tab).click();
    await expect(page.getByText('Escalonamento previsto para novos clientes')).toHaveCount(0);
    await expect(page.getByText('Simular novo assinante')).toHaveCount(0);
    await expect(page.getByTestId('billing-local-demo')).toHaveCount(0);
  }
});
