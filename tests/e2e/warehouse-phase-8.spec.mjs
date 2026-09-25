import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';
const BARCODE = 'E2E-PHASE8-001';
const UNKNOWN_BARCODE = 'E2E-PHASE8-UNKNOWN';

test.describe.serial('ADM Depósito FASE 8 — barcode / Saída de Material', () => {
  test('fundador associa barcode, prepara retirada no carrinho e preserva o rascunho após reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/saida-expressa');
    await expect(page.getByTestId('warehouse-material-withdrawal')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('warehouse-scanner-input')).toBeFocused();

    await page.getByTestId('warehouse-scanner-input').fill(BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');

    const associationPanel = page.locator('section').filter({
      hasText: 'Código não cadastrado: ' + BARCODE,
    });
    await expect(associationPanel).toBeVisible();
    await expect(associationPanel).toContainText(
      'O barcode nunca substitui materialId'
    );

    await associationPanel.locator('select').nth(0).selectOption(MATERIAL_ID);
    await associationPanel.locator('select').nth(1).selectOption({ index: 1 });
    await associationPanel.getByRole('button', { name: 'Associar código' }).click();

    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'Código associado ao material canônico'
    );
    await expect(page.getByTestId('warehouse-outbound-quantity')).toBeVisible();

    await page.getByTestId('warehouse-outbound-quantity').fill('1');
    await page.getByTestId('warehouse-outbound-quantity').press('Enter');

    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'adicionado ao carrinho'
    );
    await expect(page.getByText('Carrinho da saída', { exact: true })).toBeVisible();
    await expect(page.getByText('Arroz parboilizado', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('warehouse-material-withdrawal')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Carrinho da saída', { exact: true })).toBeVisible();
    await expect(page.getByText('Arroz parboilizado', { exact: true }).first()).toBeVisible();

    await page.getByTestId('warehouse-scanner-input').fill(UNKNOWN_BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await expect(
      page.getByText('Código não cadastrado: ' + UNKNOWN_BARCODE, { exact: true })
    ).toBeVisible();

    await page.goto('/adm-deposito/movimentacoes');
    await expect(page.getByTestId('warehouse-movements-operational')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Histórico de movimentações', { exact: true })
    ).toBeVisible();
  });
});
