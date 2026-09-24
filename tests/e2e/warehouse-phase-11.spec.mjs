import { test, expect } from '@playwright/test';

const EXTERNAL_EMAIL = 'sector-a@example.test';
const EXTERNAL_PASSWORD = 'Emprovex-Teste!2026';

test.describe.serial('ADM Depósito FASE 11 — Entregas, Dashboard e Alertas', () => {
  test('fundador acompanha entrega real, reutiliza Cronograma e recebe alerta na Central de Avisos', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito');
    await expect(page.getByTestId('warehouse-logistics-dashboard')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('warehouse-dashboard-deliveries-overdue')).not.toContainText(
      /^0$/,
      { timeout: 20_000 }
    );

    await page.goto('/adm-deposito/entregas');
    await expect(page.getByTestId('warehouse-deliveries-operational')).toBeVisible({
      timeout: 20_000,
    });

    const card = page.locator(
      '[data-testid="warehouse-delivery-card"][data-empenho-id="phase11-e2e"]'
    );
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('Fornecedor FASE 11 E2E');
    await expect(card).toContainText('Previsão vencida com saldo não recebido');
    await expect(card).toContainText('20%');
    await expect(card).toContainText('NF PHASE11');
    await expect(card).toContainText('sem retrointegração ao warehouse');

    await card.getByRole('link', { name: 'Abrir/Editar Cronograma' }).click();
    await expect(page).toHaveURL(/\?tab=cronogramas/, { timeout: 20_000 });

    await page.goto('/adm-deposito');
    await expect(page.getByTestId('warehouse-logistics-dashboard')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('warehouse-dashboard-alerts').click();
    await expect(page).toHaveURL(/\?tab=avisos/, { timeout: 20_000 });
    await expect(page.getByText('Previsão de entrega vencida').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/phase11-e2e/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('usuário externo continua bloqueado do Dashboard e de Entregas', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('sector-login-email').fill(EXTERNAL_EMAIL);
    await page.getByTestId('sector-login-password').fill(EXTERNAL_PASSWORD);
    await page.getByTestId('sector-login-submit').click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/adm-deposito');
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByTestId('warehouse-logistics-dashboard')).toHaveCount(0);

    await page.goto('/adm-deposito/entregas');
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByTestId('warehouse-deliveries-operational')).toHaveCount(0);
  });
});
