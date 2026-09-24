import { test, expect } from '@playwright/test';

const DEPOT_ID = 'dep_' + '6'.repeat(32);
const LOCATION_ID = 'loc_' + '6'.repeat(32);
const EXTERNAL_EMAIL = 'sector-a@example.test';
const EXTERNAL_PASSWORD = 'Emprovex-Teste!2026';

test.describe.serial('ADM Depósito FASE 10 — Inventário Físico', () => {
  test('fundador conta, revisa, confirma ajuste e consulta histórico', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/inventario');
    await expect(page.getByTestId('warehouse-inventory-operational')).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId('warehouse-inventory-scope-kind').selectOption('LOCATION');
    await page.getByTestId('warehouse-inventory-depot').selectOption(DEPOT_ID);
    await page.getByTestId('warehouse-inventory-location').selectOption(LOCATION_ID);
    await page.getByTestId('warehouse-inventory-start').click();

    await expect(page.getByTestId('warehouse-inventory-active')).toBeVisible();
    const countInputs = page.getByTestId('warehouse-inventory-count');
    const count = await countInputs.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const input = countInputs.nth(index);
      const expectedRaw = await input.getAttribute('data-expected');
      expect(expectedRaw).not.toBeNull();
      const expectedQuantity = Number(expectedRaw);
      expect(Number.isFinite(expectedQuantity)).toBe(true);
      const countedQuantity = index === 0 ? expectedQuantity + 1 : expectedQuantity;
      await input.fill(String(countedQuantity));
      await input.press('Enter');
      await expect(page.getByTestId('warehouse-inventory-message')).toContainText(
        'Contagem salva'
      );
    }

    await page.getByTestId('warehouse-inventory-review').click();
    await expect(page.getByTestId('warehouse-inventory-review-summary')).toBeVisible();
    await expect(page.getByTestId('warehouse-inventory-review-summary')).toContainText(
      '1 divergência'
    );

    await page.getByTestId('warehouse-inventory-confirm-ack').check();
    await page.getByTestId('warehouse-inventory-confirm').click();
    await expect(page.getByTestId('warehouse-inventory-message')).toContainText(
      'Inventário finalizado',
      { timeout: 20_000 }
    );
    await expect(page.getByTestId('warehouse-inventory-history')).toContainText(
      'Finalizado'
    );

    await page.reload();
    await expect(page.getByTestId('warehouse-inventory-operational')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('warehouse-inventory-history')).toContainText(
      'Finalizado'
    );

    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({
      timeout: 20_000,
    });
  });

  test('usuário externo continua bloqueado da superfície de inventário', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('sector-login-email').fill(EXTERNAL_EMAIL);
    await page.getByTestId('sector-login-password').fill(EXTERNAL_PASSWORD);
    await page.getByTestId('sector-login-submit').click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito/inventario');
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByTestId('warehouse-inventory-operational')).toHaveCount(0);
  });
});
