import { test, expect } from '@playwright/test';

test.describe.serial('Central de Depósitos — disposição visual do Início', () => {
  test('fundador move, cancela, salva, recarrega e restaura a disposição', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/central-depositos');
    await expect(page.getByTestId('warehouse-landing-operational')).toBeVisible({
      timeout: 20_000,
    });

    const depot = page.locator('[data-testid^="warehouse-landing-depot-"]').first();
    await expect(depot).toBeVisible();

    // Cada depósito com croqui ativo deve usar a cena oficial de "Meus Depósitos".
    // Um depósito ainda sem croqui continua exibindo o estado vazio previsto.
    const canonicalScenes = page.getByTestId('warehouse-landing-canonical-scene');
    for (let index = 0; index < await canonicalScenes.count(); index += 1) {
      const scene = canonicalScenes.nth(index);
      await expect(scene).toHaveAttribute('data-layout-id', /.+/);
      await expect(scene).toHaveAttribute('data-layout-version', /\d+/);
      await expect(scene.getByTestId('warehouse-isometric-scene-only'))
        .toHaveAttribute('data-scene-only', 'true');
      await expect(scene).toHaveAttribute('data-camera-pose', 'aligned-floor');
      await expect(scene.locator('svg[data-camera-fit="aligned-floor"]')).toHaveCount(1);
      await expect(scene.locator('svg')).toHaveAttribute('preserveAspectRatio', 'none');
      await expect(scene.locator('[data-visual-role="door"] text')).toHaveCount(0);
    }

    const floor = depot.locator('polygon').first();
    const initialPoints = await floor.getAttribute('points');

    await page.getByTestId('warehouse-landing-edit-layout').click();
    await expect(page.getByTestId('warehouse-landing-layout-editor')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Girar depósito à direita' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aumentar depósito' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Diminuir depósito' })).toHaveCount(0);

    const box = await depot.boundingBox();
    expect(box).toBeTruthy();
    if (!box) throw new Error('Depósito sem área visual para arraste.');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 70,
      box.y + box.height / 2 + 34,
      { steps: 5 }
    );
    await page.mouse.up();

    const movedPoints = await floor.getAttribute('points');
    expect(movedPoints).not.toBe(initialPoints);

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByTestId('warehouse-landing-layout-editor')).toHaveCount(0);
    expect(await floor.getAttribute('points')).toBe(initialPoints);

    await page.getByTestId('warehouse-landing-edit-layout').click();

    const saveBox = await depot.boundingBox();
    expect(saveBox).toBeTruthy();
    if (!saveBox) throw new Error('Depósito sem área visual para segundo arraste.');

    await page.mouse.move(
      saveBox.x + saveBox.width / 2,
      saveBox.y + saveBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      saveBox.x + saveBox.width / 2 + 52,
      saveBox.y + saveBox.height / 2 + 22,
      { steps: 4 }
    );
    await page.mouse.up();

    await page.getByRole('button', { name: 'Salvar disposição' }).click();
    await expect(page.getByText('Disposição visual salva.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const savedPoints = await floor.getAttribute('points');
    expect(savedPoints).not.toBe(initialPoints);

    await page.reload();
    await expect(page.getByTestId('warehouse-landing-operational')).toBeVisible({
      timeout: 20_000,
    });

    const persistedDepot = page.locator('[data-testid^="warehouse-landing-depot-"]').first();
    const persistedFloor = persistedDepot.locator('polygon').first();
    expect(await persistedFloor.getAttribute('points')).toBe(savedPoints);

    await page.getByTestId('warehouse-landing-edit-layout').click();
    await page.getByRole('button', { name: 'Restaurar posição do depósito' }).click();
    await page.getByRole('button', { name: 'Salvar disposição' }).click();
    await expect(page.getByText('Disposição visual salva.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.reload();
    await expect(page.getByTestId('warehouse-landing-operational')).toBeVisible({
      timeout: 20_000,
    });

    const restoredDepot = page.locator('[data-testid^="warehouse-landing-depot-"]').first();
    const restoredFloor = restoredDepot.locator('polygon').first();
    expect(await restoredFloor.getAttribute('points')).toBe(initialPoints);
  });
});
