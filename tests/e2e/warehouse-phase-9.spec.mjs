import { test, expect } from '@playwright/test';

const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';
const DEPOT_ID = 'dep_' + '6'.repeat(32);
const LOCATION_ID = 'loc_' + '6'.repeat(32);

test.describe.serial('ADM Depósito FASE 9 — Visão do Depósito', () => {
  test('fundador pesquisa posição, edita layout, salva versão, cancela draft e preserva estoque', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/visao-do-deposito');
    await expect(page.getByTestId('warehouse-depot-view-operational')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Selecionar depósito do croqui').selectOption(DEPOT_ID);

    const initialMaterialSearch = page.getByTestId('warehouse-layout-material-search');
    await initialMaterialSearch.fill('Arroz parboilizado');
    const materialResult = page.getByTestId('warehouse-layout-material-' + MATERIAL_ID);
    const depotSelect = page.getByLabel('Selecionar depósito do croqui');
    await expect(materialResult).toBeVisible();

    const materialBox = await materialResult.boundingBox();
    const depotBox = await depotSelect.boundingBox();
    expect(materialBox).toBeTruthy();
    expect(depotBox).toBeTruthy();
    const overlaps = !(
      materialBox.x + materialBox.width <= depotBox.x
      || depotBox.x + depotBox.width <= materialBox.x
      || materialBox.y + materialBox.height <= depotBox.y
      || depotBox.y + depotBox.height <= materialBox.y
    );
    expect(overlaps).toBe(false);

    await materialResult.click();
    await expect(page.getByTestId('warehouse-layout-highlight-summary')).toContainText('posição(ões) física(s) neste depósito');

    await page.getByTestId('warehouse-layout-toggle-edit').click();
    await expect(page.getByTestId('warehouse-layout-editor')).toBeVisible();
    await expect(page.getByTestId('warehouse-croqui-editor-toolbar')).toBeVisible();
    await expect(page.getByTestId('warehouse-croqui-properties-panel')).toBeVisible();

    await page.getByTestId('warehouse-structure-shelf').click();
    await page.getByTestId('warehouse-layout-object-label').fill('Estante E2E');
    await page.getByTestId('warehouse-layout-object-x').fill('96');
    await page.getByTestId('warehouse-layout-object-rotation').fill('12');

    const locationSelect = page.getByTestId('warehouse-layout-object-location');
    await locationSelect.selectOption(LOCATION_ID);
    await page.getByTestId('warehouse-layout-save').click();
    await expect(page.getByTestId('warehouse-layout-message')).toContainText('Layout salvo como versão');
    await expect(page.getByTestId('warehouse-layout-history')).toBeVisible();

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/meus-depositos?aba=croquis');
    await expect(page.getByTestId('warehouse-depot-view-operational')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Selecionar depósito do croqui').selectOption(DEPOT_ID);
    await page.getByTestId('warehouse-layout-material-search').fill('Arroz parboilizado');
    await page.getByTestId('warehouse-layout-material-' + MATERIAL_ID).click();
    await expect(page.getByTestId('warehouse-layout-highlight-summary')).toContainText('posição(ões) física(s) neste depósito');

    const highlightedObjects = page.locator('[data-location-id="' + LOCATION_ID + '"][data-highlighted="true"]');
    expect(await highlightedObjects.count()).toBeGreaterThan(0);
    await expect(highlightedObjects.first()).toBeVisible();

    await page.getByTestId('warehouse-layout-toggle-edit').click();
    await highlightedObjects.first().click();
    const savedLabel = await page.getByTestId('warehouse-layout-object-label').inputValue();
    expect(savedLabel).toBe('Estante E2E');

    await page.getByTestId('warehouse-layout-object-label').fill('ALTERAÇÃO NÃO SALVA');
    await page.getByTestId('warehouse-layout-object-x').fill('144');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('warehouse-croqui-view-mode')).toBeVisible();

    await page.getByTestId('warehouse-layout-toggle-edit').click();
    const linkedObjectAfterCancel = page.locator('[data-location-id="' + LOCATION_ID + '"]').first();
    await linkedObjectAfterCancel.click();
    await expect(page.getByTestId('warehouse-layout-object-label')).toHaveValue('Estante E2E');

    await page.getByRole('button', { name: 'Visualizar / Localizar' }).click();
    await page.getByTestId('warehouse-layout-material-search').fill('Arroz parboilizado');
    await page.getByTestId('warehouse-layout-material-' + MATERIAL_ID).click();
    await expect(page.locator('[data-location-id="' + LOCATION_ID + '"][data-highlighted="true"]').first()).toBeVisible();

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('warehouse-stock-search').fill('Arroz parboilizado');
    await expect(page.getByTestId('warehouse-stock-row-' + MATERIAL_ID)).toBeVisible();
  });

  test('croqui permanece operável em largura intermediária sem esconder controles críticos', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/meus-depositos?aba=croquis');
    await expect(page.getByTestId('warehouse-depot-view-operational')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Selecionar depósito do croqui').selectOption(DEPOT_ID);
    await page.getByTestId('warehouse-layout-toggle-edit').click();

    const toolbar = page.getByTestId('warehouse-croqui-editor-toolbar');
    const viewport = page.getByTestId('warehouse-croqui-editor-viewport');
    const properties = page.getByTestId('warehouse-croqui-properties-panel');

    await expect(toolbar).toBeVisible();
    await expect(viewport).toBeVisible();
    await expect(properties).toBeVisible();

    const toolbarBox = await toolbar.boundingBox();
    const viewportBox = await viewport.boundingBox();
    expect(toolbarBox).toBeTruthy();
    expect(viewportBox).toBeTruthy();
    expect(toolbarBox.x).toBeGreaterThanOrEqual(0);
    expect(viewportBox.x).toBeGreaterThanOrEqual(0);
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(1100);
    expect(viewportBox.x + viewportBox.width).toBeLessThanOrEqual(1100);
  });
});
