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
