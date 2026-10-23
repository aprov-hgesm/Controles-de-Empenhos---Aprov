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

  test('menu fica junto ao cursor, inclusive no pallet inferior e perto das bordas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-lab/deposito-20x6');
    const editor = page.getByTestId('warehouse-layout-professional-editor');
    const menu = page.getByTestId('warehouse-croqui-context-menu');
    for (const name of ['EST-01', 'PAL-06']) {
      const local = editor.locator('[data-testid^="warehouse-editor-object-"]')
        .filter({ hasText: name }).first();
      await expect(local).toBeVisible();
      // Playwright pode rolar a pagina automaticamente ANTES do clique,
      // alterando a boundingBox anterior. Capturar as coordenadas REAIS
      // recebidas no evento contextmenu, em vez de usar um retangulo obsoleto.
      await page.evaluate(() => {
        window.__croquiRightClick = null;
        document.addEventListener('contextmenu', event => {
          window.__croquiRightClick = {x:event.clientX,y:event.clientY};
        }, {capture:true,once:true});
      });
      await local.click({ button: 'right' });
      await expect(menu).toBeVisible();
      const pointer = await page.evaluate(() => window.__croquiRightClick);
      expect(pointer).not.toBeNull();
      const cursorX = pointer.x;
      const cursorY = pointer.y;
      const position = await menu.boundingBox();
      const bounds = await editor.boundingBox();
      expect(position).not.toBeNull();
      expect(bounds).not.toBeNull();
      const horizontalGap = Math.max(0, position.x - cursorX,
        cursorX - position.x - position.width);
      const verticalGap = Math.max(0, position.y - cursorY,
        cursorY - position.y - position.height);
      expect(horizontalGap).toBeLessThanOrEqual(18);
      expect(verticalGap).toBeLessThanOrEqual(18);
      expect(position.x).toBeGreaterThanOrEqual(bounds.x);
      expect(position.x + position.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(position.y).toBeGreaterThanOrEqual(bounds.y);
      expect(position.y + position.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    }
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
