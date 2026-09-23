import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';

test.describe.serial('ADM Depósito FASE 6 — jornada operacional', () => {
  test('fundador cria local, transfere estoque e confirma a distribuição física', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/localizacoes');

    await expect(
      page.getByTestId('warehouse-locations-operational')
    ).toBeVisible({ timeout: 20_000 });

    await page.getByText('Depósito FASE 6 renomeado', { exact: true }).click();

    await page.getByLabel('Código da localização').fill('E2E-01');
    await page.getByLabel('Nome da localização').fill('Local E2E transferência');
    await page.getByLabel('Descrição da localização').fill('Criado pelo Browser E2E da FASE 6');
    await page.getByTestId('warehouse-location-create').click();

    await expect(page.getByTestId('warehouse-phase6-message')).toContainText(
      'Local criado no depósito selecionado.'
    );
    await expect(page.getByText('E2E-01', { exact: true })).toBeVisible();

    await page.getByTestId('warehouse-transfer-material').selectOption(MATERIAL_ID);
    await page.getByTestId('warehouse-transfer-from').selectOption('UNASSIGNED');

    const destination = page.getByTestId('warehouse-transfer-to');
    const e2eOption = destination.locator('option').filter({ hasText: 'E2E-01' });
    await expect(e2eOption).toHaveCount(1);
    const destinationValue = await e2eOption.getAttribute('value');
    expect(destinationValue).toBeTruthy();
    await destination.selectOption(destinationValue);

    await page.getByTestId('warehouse-transfer-quantity').fill('1');
    await page.getByTestId('warehouse-transfer-start').click();

    await expect(page.getByTestId('warehouse-transfer-review')).toContainText(
      'Sem localização'
    );
    await expect(page.getByTestId('warehouse-transfer-review')).toContainText(
      'E2E-01'
    );

    await page.getByTestId('warehouse-transfer-confirm').click();

    await expect(page.getByTestId('warehouse-phase6-message')).toContainText(
      'Transferência concluída. O saldo total da OM foi preservado.'
    );

    const distribution = page.getByTestId('warehouse-distribution-' + MATERIAL_ID);
    await expect(distribution).toContainText('Arroz parboilizado');
    await expect(distribution).toContainText('DEP-06 → E2E-01');
    await expect(distribution).toContainText('Distribuição coerente');

    await page.reload();
    await expect(page.getByTestId('warehouse-locations-operational')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId('warehouse-distribution-' + MATERIAL_ID)
    ).toContainText('DEP-06 → E2E-01');

    await page.goto('/adm-deposito/movimentacoes');
    await expect(page.getByText('transferência interna', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('1 unidade(s) redistribuída(s)', { exact: false }).first()).toBeVisible();
  });
});
