import { test, expect } from '@playwright/test';

test.describe.serial('Central de Depósitos — estrutura física R1', () => {
  test('fundador cria local na superfície atual e preserva após reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/localizacoes');

    await expect(
      page.getByTestId('warehouse-locations-r1-operational')
    ).toBeVisible({ timeout: 20_000 });

    await page.getByText('Depósito FASE 6 renomeado', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Novo local', exact: true }).click();

    await page.getByPlaceholder('Código · EST-01').fill('E2E-01');
    await page.getByPlaceholder('Nome do local').fill('Local E2E estrutura R1');
    await page.getByPlaceholder('Descrição opcional').fill('Criado pelo Browser E2E da Central');
    await page.getByRole('button', { name: 'Criar local', exact: true }).click();

    await expect(page.getByText('Local criado com sucesso.', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E-01', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('warehouse-locations-r1-operational')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('E2E-01', { exact: true }).first()).toBeVisible();

    await page.goto('/adm-deposito/controle-de-depositos?aba=croquis');
    await expect(page.getByTestId('warehouse-r1-croquis')).toBeVisible({
      timeout: 20_000,
    });
  });
});
