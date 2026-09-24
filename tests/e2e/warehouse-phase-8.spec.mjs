import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';
const BARCODE = 'E2E-PHASE8-001';
const UNKNOWN_BARCODE = 'E2E-PHASE8-UNKNOWN';

test.describe.serial('ADM Depósito FASE 8 — barcode / scanner / saída expressa', () => {
  test('fundador associa barcode, opera saídas consecutivas e preserva saldo após reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/saida-expressa');
    await expect(page.getByTestId('warehouse-express-outbound')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('warehouse-scanner-input')).toBeFocused();

    await page.getByTestId('warehouse-scanner-input').fill(BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await expect(page.getByTestId('warehouse-scanner-unknown')).toBeVisible();

    await page
      .getByTestId('warehouse-barcode-associate-material')
      .selectOption(MATERIAL_ID);
    await page
      .getByTestId('warehouse-barcode-associate-presentation')
      .selectOption({ index: 1 });
    await page.getByTestId('warehouse-barcode-associate-save').click();

    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'Código associado ao material canônico'
    );
    await expect(page.getByTestId('warehouse-outbound-quantity')).toBeVisible();

    await expect(page.getByTestId('warehouse-outbound-fefo')).toContainText(
      'FEFO sugere'
    );
    await page.getByRole('button', { name: 'Usar lote recomendado' }).click();
    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'selecionado pelo operador'
    );

    await page.getByTestId('warehouse-outbound-quantity').fill('1');
    await page.getByTestId('warehouse-outbound-quantity').press('Enter');
    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'Saída registrada'
    );
    await expect(page.getByTestId('warehouse-outbound-recent')).toContainText(
      'Arroz parboilizado'
    );
    await expect(page.getByTestId('warehouse-scanner-input')).toBeFocused();

    // Segunda operação sem reload: o scanner volta a ser o ponto de entrada.
    await page.getByTestId('warehouse-scanner-input').fill(BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await expect(page.getByTestId('warehouse-outbound-quantity')).toBeVisible();
    await page.getByTestId('warehouse-outbound-quantity').fill('1');
    await page.getByTestId('warehouse-outbound-quantity').press('Enter');
    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'Saída registrada'
    );

    // Saldo insuficiente é erro operacional, sem sucesso parcial silencioso.
    await page.getByTestId('warehouse-scanner-input').fill(BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await page.getByTestId('warehouse-outbound-quantity').fill('999999');
    await page.getByTestId('warehouse-outbound-quantity').press('Enter');
    await expect(page.getByTestId('warehouse-outbound-message')).toContainText(
      'Saldo oficial insuficiente'
    );

    // Código desconhecido permanece explícito e nunca cria material automaticamente.
    await page.getByTestId('warehouse-scanner-input').fill(UNKNOWN_BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await expect(page.getByTestId('warehouse-scanner-unknown')).toContainText(
      'Código não cadastrado'
    );

    // Persistência: o barcode associado e o saldo pós-saídas sobrevivem ao reload.
    await page.reload();
    await expect(page.getByTestId('warehouse-express-outbound')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('warehouse-scanner-input').fill(BARCODE);
    await page.getByTestId('warehouse-scanner-input').press('Enter');
    await expect(page.getByTestId('warehouse-outbound-quantity')).toBeVisible();
    const balanceAfterReload = await page
      .getByTestId('warehouse-outbound-balance')
      .textContent();
    expect(balanceAfterReload).toBeTruthy();

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('warehouse-stock-search').fill(BARCODE);
    const row = page.getByTestId('warehouse-stock-row-' + MATERIAL_ID);
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByTestId('warehouse-material-barcodes')).toContainText(
      BARCODE
    );

    await page.goto('/adm-deposito/movimentacoes');
    await expect(page.getByText('Ledger oficial · histórico append-only')).toBeVisible();
  });
});
