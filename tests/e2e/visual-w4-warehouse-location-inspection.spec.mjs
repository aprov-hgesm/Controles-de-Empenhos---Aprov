import { expect, test } from '@playwright/test';

// Cenário exclusivamente fictício no laboratório DEV: sem autenticação ou Firestore.
test.describe('EMPROVEX R3 — inspeção 3D de locais vazios', () => {
  test('hover apresenta saldo zero, preserva painel e clique abre detalhes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/inspecao-locais');

    const viewer = page.getByTestId('warehouse-isometric-preview');
    const local = viewer.locator('[data-testid="warehouse-location-interactive"][aria-label*="Geladeira vazia"]');
    const dock = viewer.getByTestId('warehouse-location-inspection-dock');
    const tooltip = viewer.getByTestId('warehouse-location-hover-tooltip');

    await expect(local).toHaveCount(1);
    await local.hover();
    await expect(viewer.getByTestId('warehouse-location-hover-status')).toContainText('saldo físico 0');
    await expect(tooltip).toContainText('GEL-02');
    await expect(tooltip).toContainText('Local sem itens com saldo positivo. Saldo físico: 0.');

    await page.mouse.move(4, 4);
    await expect(dock).toContainText('GEL-02');

    await local.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Não há materiais com saldo positivo neste local.');
    await page.getByRole('button', { name: 'Fechar detalhes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('foco de teclado também identifica local vazio', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/inspecao-locais');

    const viewer = page.getByTestId('warehouse-isometric-preview');
    const local = viewer.locator('[data-testid="warehouse-location-interactive"][aria-label*="Geladeira vazia"]');
    await local.focus();
    await expect(viewer.getByTestId('warehouse-location-hover-status')).toContainText('saldo físico 0');
    await expect(viewer.getByTestId('warehouse-location-inspection-dock')).toContainText('GEL-02');
  });
});
