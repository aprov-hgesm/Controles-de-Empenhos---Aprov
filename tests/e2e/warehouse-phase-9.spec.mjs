import { test, expect } from '@playwright/test';

test.describe.serial('Central de Depósitos — Croqui R1', () => {
  test('fundador abre croqui atual, salva nova versão e preserva estoque', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/visao-do-deposito');
    await expect(page.getByTestId('warehouse-r1-croquis')).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByRole('button', { name: 'Edição 2D', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prévia 3D', exact: true }).first()).toBeVisible();

    const nameInput = page.getByLabel('Nome do croqui');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Croqui E2E atualizado');
    await page.getByRole('button', { name: 'Salvar versão', exact: true }).click();

    await expect(
      page.getByText(/Croqui salvo com sucesso. Versão d+ ativa./)
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Prévia 3D', exact: true }).first().click();
    await expect(page.getByTestId('warehouse-r1-croquis')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('warehouse-r1-croquis')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel('Nome do croqui')).toHaveValue('Croqui E2E atualizado');

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('warehouse-stock-search').fill('Arroz parboilizado');
    await expect(
      page.getByTestId('warehouse-stock-row-mat_123e4567e89b12d3a456426614174000')
    ).toBeVisible();
  });

  test('croqui atual permanece operável em largura intermediária', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/controle-de-depositos?aba=croquis');
    const croqui = page.getByTestId('warehouse-r1-croquis');
    await expect(croqui).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('warehouse-r1-edit-dimensions').click();
    await expect(page.getByTestId('warehouse-r1-dimension-editor')).toBeVisible();

    const box = await croqui.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1100);
  });
});
