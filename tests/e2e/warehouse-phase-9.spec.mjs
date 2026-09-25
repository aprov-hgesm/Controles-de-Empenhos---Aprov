import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';
const LOCATION_ID = 'loc_' + '6'.repeat(32);

test.describe.serial('ADM Depósito FASE 9 — Visão do Depósito', () => {
  test('fundador pesquisa posição, edita layout, salva versão e preserva estoque', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/visao-do-deposito');
    await expect(page.getByTestId('warehouse-depot-view-operational')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('warehouse-layout-toggle-edit').click();
    await expect(page.getByTestId('warehouse-layout-editor')).toBeVisible();
    await page.getByTestId('warehouse-structure-shelf').click();
    await page.getByTestId('warehouse-layout-object-label').fill('Estante E2E');
    const locationSelect = page.getByTestId('warehouse-layout-object-location');
    await locationSelect.selectOption(LOCATION_ID);
    await page.getByTestId('warehouse-layout-save').click();
    await expect(page.getByTestId('warehouse-layout-message')).toContainText('Layout salvo como versão');

    await page.getByTestId('warehouse-layout-material-search').fill('Arroz parboilizado');
    await page.getByTestId('warehouse-layout-material-' + MATERIAL_ID).click();
    await expect(page.getByTestId('warehouse-layout-highlight-summary')).toContainText('posição(ões) real(is)');
    const highlightedObjects = page.locator('[data-location-id="' + LOCATION_ID + '"][data-highlighted="true"]');
    expect(await highlightedObjects.count()).toBeGreaterThan(0);
    await expect(highlightedObjects.first()).toBeVisible();

    const summaryBefore = await page.getByTestId('warehouse-layout-highlight-summary').textContent();
    await page.reload();
    await expect(page.getByTestId('warehouse-depot-view-operational')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('warehouse-layout-material-search').fill('Arroz parboilizado');
    await page.getByTestId('warehouse-layout-material-' + MATERIAL_ID).click();
    const summaryAfter = await page.getByTestId('warehouse-layout-highlight-summary').textContent();
    expect(summaryAfter).toBeTruthy();
    expect(summaryBefore).toBeTruthy();

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('warehouse-stock-search').fill('Arroz parboilizado');
    await expect(page.getByTestId('warehouse-stock-row-' + MATERIAL_ID)).toBeVisible();
  });
});
