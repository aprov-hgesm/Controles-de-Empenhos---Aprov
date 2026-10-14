import { test, expect } from '@playwright/test';

// Local/Preview design review only. The motion lab never uses real workspaces.
test.describe('VISUAL-R1/W3 — Relatórios and SAG motion review', () => {
  test('visual SAG steps change immediately without simulating an import', async ({ page }) => {
    await page.goto('/dev/visual-r1');
    const lab = page.getByRole('region', { name: 'Worker 3 — laboratório interativo de motion' });
    await expect(lab).toBeVisible();
    const progress = lab.getByRole('navigation', { name: 'Progresso da importação SAG' });
    await expect(progress).toBeVisible();
    await expect(progress.locator('[aria-current="step"]')).toContainText('Fornecedor');
    await lab.getByRole('button', { name: 'Validar JSON' }).click();
    await expect(progress.locator('[aria-current="step"]')).toContainText('Validar JSON');
    await lab.getByRole('button', { name: 'Mostrar conclusão visual' }).click();
    await expect(progress.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(lab.getByRole('button', { name: 'Reabrir amostra' })).toBeVisible();
  });

  test('supplier select and search stay responsive and keyboard accessible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/visual-r1');
    const lab = page.getByRole('region', { name: 'Worker 3 — laboratório interativo de motion' });
    const search = lab.getByPlaceholder('Razão social ou CNPJ...');
    await expect(search).toBeVisible();
    await search.fill('Fornecedor de demonstração B');
    const supplierB = lab.getByRole('button', { name: /Fornecedor de demonstração B/ });
    await expect(supplierB).toBeVisible();
    await supplierB.click();
    await expect(lab.getByText('Fornecedor de demonstração B', { exact: true })).toBeVisible();
    await lab.getByRole('button', { name: 'Trocar fornecedor' }).click();
    await expect(search).toBeVisible();
    // The lab must not introduce horizontal overflow on handheld screens.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
