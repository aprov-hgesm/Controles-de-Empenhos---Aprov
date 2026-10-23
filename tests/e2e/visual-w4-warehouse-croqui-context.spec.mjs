import { expect, test } from '@playwright/test';

// Laboratorio DEV: dados ficticios e nenhuma escrita no Firestore.
test.describe('Croqui 2D — menu do botao direito', () => {
  test('mostra rotacao, tamanho e subposicao; 180 graus e reversivel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/deposito-20x6');
    const editor = page.getByTestId('warehouse-layout-professional-editor');
    const shelf = editor.locator('[data-testid^="warehouse-editor-object-"]').first();
    await expect(shelf).toBeVisible();

    await shelf.click({ button: 'right' });
    const menu = page.getByTestId('warehouse-croqui-context-menu');
    await expect(menu).toBeVisible();
    for (const text of ['Girar para esquerda','Girar para direita','Meia-volta (180°)',
      'Editar tamanho','Incluir subposição']) {
      await expect(menu.getByText(text, { exact: true })).toBeVisible();
    }
    const front = shelf.locator('[data-testid^="warehouse-editor-front-"]');
    const frontBefore = await front.getAttribute('title');
    await menu.getByText('Meia-volta (180°)', { exact: true }).click();
    await expect(front).not.toHaveAttribute('title', frontBefore);
    await shelf.click({ button: 'right' });
    await menu.getByText('Meia-volta (180°)', { exact: true }).click();
    await expect(front).toHaveAttribute('title', frontBefore);
  });

  test('janela de dimensoes aplica valor valido e rejeita valor fora do deposito', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/deposito-20x6');
    const shelf = page.locator('[data-testid^="warehouse-editor-object-"]').first();
    await shelf.click({ button: 'right' });
    await page.getByTestId('warehouse-context-edit-size').click();
    const dialog = page.getByTestId('warehouse-croqui-size-modal');
    await expect(dialog).toBeVisible();
    const width = dialog.getByTestId('warehouse-size-width');
    const original = await width.inputValue();
    await width.fill('99999');
    await dialog.getByTestId('warehouse-size-save').click();
    await expect(dialog.getByRole('alert')).toContainText('medidas');
    await width.fill(original);
    await dialog.getByTestId('warehouse-size-save').click();
    await expect(dialog).toHaveCount(0);
  });

  test('adicionar subposicao no laboratorio informa que e simulada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/deposito-20x6');
    const shelf = page.locator('[data-testid^="warehouse-editor-object-"]').first();
    await shelf.click({ button: 'right' });
    await page.getByTestId('warehouse-context-add-subposition').click();
    await expect(page.getByTestId('warehouse-demo-subposition-notice'))
      .toContainText('Subposição simulada adicionada');
  });
});
