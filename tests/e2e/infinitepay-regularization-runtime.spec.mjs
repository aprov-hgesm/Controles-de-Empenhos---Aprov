import { expect, test } from '@playwright/test';

const config = {
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
  // Only mock the read-only public settings endpoint; no financial API calls.
  await page.route('**/api/billing/regularization', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config),
    });
  });
});

test('desktop: opens regularization without React DOM removal crashes', async ({ page }) => {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('infinitepay-regularization-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Minha assinatura e pagamentos' })).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  await expect(page.getByTestId('manual-payment-options-toggle')).toBeVisible();
  await expect(page.getByText('Preço de referência legado')).toHaveCount(0);
  await page.getByTestId('manual-payment-options-toggle').click();
  await expect(page.getByText('Preço de referência legado')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('infinitepay-regularization-panel')).toBeVisible();
  expect(crashes, 'uncaught errors in page').toEqual([]);
});

test('return URL never confirms payment and strips private query data', async ({ page }) => {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.goto('/regularizacao?order_nsu=fake-order&transaction_nsu=fake-transaction&slug=fake-slug', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('infinitepay-unverified-return')).toBeVisible();
  await expect(page.getByText('Retorno do checkout identificado')).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  expect(crashes).toEqual([]);
});

test('mobile: payment preview is usable and read-only', async ({ page }) => {
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('infinitepay-regularization-panel')).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  expect(crashes).toEqual([]);
});

test('unavailable legacy API does not block My Subscription and is only checked on demand', async ({ page }) => {
  const crashes = [];
  let legacyQueries = 0;
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.route('**/api/billing/regularization', async (route) => {
    legacyQueries += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'REGULARIZATION_CONFIG_UNAVAILABLE',
        message: 'As instruções de regularização estão temporariamente indisponíveis.',
      }),
    });
  });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('infinitepay-regularization-panel')).toBeVisible();
  await expect(page.getByTestId('manual-payment-options-toggle')).toBeVisible();
  expect(legacyQueries, 'legacy API must not be called on page entry').toBe(0);
  await page.getByTestId('manual-payment-options-toggle').click();
  await expect(page.getByTestId('manual-payment-config-unavailable')).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  expect(legacyQueries, 'legacy API is called only on user request').toBe(1);
  expect(crashes).toEqual([]);
});

test('desktop: light EMPROVEX platform shell keeps navigation fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  const sidebar = page.getByTestId('billing-fixed-sidebar');
  await expect(sidebar).toHaveCSS('position', 'fixed');
  await expect(sidebar).toBeInViewport();
  await expect(page.getByTestId('billing-platform-shell')).toHaveCSS('background-color', 'rgb(246, 248, 252)');
  await expect(page.getByRole('heading', { name: 'Minha assinatura', exact: true })).toBeVisible();
  await expect(page.getByTestId('infinitepay-checkout-disabled')).toBeDisabled();
  await page.getByRole('link', { name: 'Plano e valores' }).click();
  await expect(page).toHaveURL(/#precos$/);
  await expect(page.locator('#precos')).toBeInViewport();
});

test('mobile: sidebar drawer opens, navigates and closes without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/regularizacao', { waitUntil: 'domcontentloaded' });
  const menu = page.getByTestId('billing-mobile-menu');
  await expect(page.getByTestId('billing-platform-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(menu).toBeVisible();
  await expect(menu).toBeEnabled();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Plano e valores' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#precos$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});
