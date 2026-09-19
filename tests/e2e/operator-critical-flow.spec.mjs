import { test, expect } from '@playwright/test';

const PASSWORD = 'Emprovex-Teste!2026';
const OPERATOR_A = 'sector-lifecycle@example.test';
const OPERATOR_B = 'sector-b@example.test';
const RECORD_KEY = 'nf_11111111000191_1001';
const NS = '2026NS009999';
const UG = '160416';

async function loginSector(page, email) {
  await page.getByTestId('sector-login-email').fill(email);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
  await page.getByTestId('sector-login-submit').click();

  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByLabel('Operador conectado').getByText('Acesso autorizado', { exact: true })
  ).toBeVisible();
}

async function openSampleReport(page) {
  await page.getByTestId('nav-relatorios').click();
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await page.getByTestId('report-empenho-sample').click();
}

test.describe.serial('EMPROVEX browser E2E with Firebase Emulator', () => {
  test('login -> relatório -> NS automática por UG -> persistência após reload', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);
    await openSampleReport(page);

    await expect(page.getByText('Fornecedor E2E Lifecycle').first()).toBeVisible();
    await expect(page.getByText('1001')).toBeVisible();

    await page.locator(`#btn-edit-ns-${RECORD_KEY}`).click();
    await expect(
      page.locator('[title="UG vinculada automaticamente ao cadastro da unidade"]')
    ).toContainText(`UG ${UG}`);
    await page.locator(`#input-ns-${RECORD_KEY}`).fill(NS);
    await page.locator(`#btn-save-ns-${RECORD_KEY}`).click();

    await expect(page.getByText(`UG ${UG} · ${NS}`).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
      timeout: 20_000,
    });
    await openSampleReport(page);
    await expect(page.getByText(`UG ${UG} · ${NS}`)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId('logout').click();
    await expect(page.getByTestId('sector-login-email')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('segundo workspace não enxerga a NS nem o fornecedor do primeiro', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_B);
    await openSampleReport(page);

    await expect(page.getByText('Fornecedor E2E Isolado B').first()).toBeVisible();
    await expect(page.getByText('Fornecedor E2E Lifecycle')).toHaveCount(0);
    await expect(page.getByText(NS)).toHaveCount(0);
  });

  test('diagnóstico histórico -> reparo seguro -> persistência após reload', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);

    await page.getByTestId('nav-relatorios').click();
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await page.getByTestId('relatorios-tab-integridade').click();

    await expect(page.getByTestId('historical-consistency-view')).toBeVisible();
    await page.getByTestId('historical-consistency-scan').click();

    await page.waitForTimeout(1200);
    const scanError = page.getByTestId('historical-consistency-error');
    if (await scanError.isVisible()) {
      throw new Error(`Historical scan failed: ${await scanError.textContent()}`);
    }

    const issueCodes = await page
      .locator('[data-testid^="historical-issue-"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-testid'))
      );
    console.log('Historical consistency issues:', issueCodes);

    await expect(
      page.getByTestId('historical-issue-invoice_missing_supplier_cnpj')
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('repair-backfill_invoice_supplier_cnpj').click();
    await expect(
      page.getByText('CNPJ da NF preenchido a partir do empenho vinculado.')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('historical-consistency-clean')).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('nav-relatorios').click();
    await page.getByTestId('relatorios-tab-integridade').click();
    await page.getByTestId('historical-consistency-scan').click();
    await expect(page.getByTestId('historical-consistency-clean')).toBeVisible({
      timeout: 15_000,
    });
  });
});
