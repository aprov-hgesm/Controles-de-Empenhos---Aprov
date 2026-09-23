import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';

test.describe.serial('ADM Depósito FASE 7 — estoque operável', () => {
  test('fundador pesquisa material, consulta ficha, FEFO, pendências e persiste lote', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId('warehouse-stock-search').fill('Arroz parboilizado');
    const row = page.getByTestId('warehouse-stock-row-' + MATERIAL_ID);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Arroz parboilizado');
    await expect(row).toContainText('LOTE-FEFO-PRIMEIRO');
    await row.click();

    const sheet = page.getByTestId('warehouse-material-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(MATERIAL_ID);
    await expect(sheet).toContainText('Saldo agregado');
    await expect(sheet).toContainText('Distribuição física');
    await expect(page.getByTestId('warehouse-fefo-recommendation')).toContainText(
      'LOTE-FEFO-PRIMEIRO'
    );
    await expect(page.getByTestId('warehouse-lot-list')).toContainText(
      'LOTE-FEFO-DEPOIS'
    );
    await expect(page.getByTestId('warehouse-logistics-pendencies')).toBeVisible();

    await page.getByTestId('warehouse-locate-in-depot').click();
    await expect(page.getByTestId('warehouse-location-highlight')).toContainText(
      'DEP-06'
    );
    await expect(page.getByTestId('warehouse-location-highlight')).toContainText(
      'LOC-06'
    );

    await page.getByTestId('warehouse-lot-create-code').fill('E2E-FASE7');
    await page.getByTestId('warehouse-lot-create-expiry').fill('2026-10-30');
    await page.getByTestId('warehouse-lot-create-quantity').fill('1');
    await page.getByTestId('warehouse-lot-create-position').selectOption('UNASSIGNED');
    await page.getByTestId('warehouse-lot-save').click();

    await expect(page.getByTestId('warehouse-phase7-message')).toContainText(
      'Lote registrado como enriquecimento logístico'
    );
    await expect(page.getByTestId('warehouse-lot-list')).toContainText('E2E-FASE7');
    await expect(page.getByTestId('warehouse-fefo-recommendation')).toContainText(
      'E2E-FASE7'
    );

    await page.reload();
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('warehouse-stock-search').fill('E2E-FASE7');
    await page.getByTestId('warehouse-stock-row-' + MATERIAL_ID).click();
    await expect(page.getByTestId('warehouse-lot-list')).toContainText('E2E-FASE7');
    await expect(page.getByTestId('warehouse-fefo-recommendation')).toContainText(
      'E2E-FASE7'
    );

    await page.goto('/adm-deposito/movimentacoes');
    await expect(page.getByText('Ledger oficial · histórico append-only')).toBeVisible();
  });
});
