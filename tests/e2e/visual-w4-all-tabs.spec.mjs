import { test, expect } from '@playwright/test';

const tabs = [
  'inicio', 'painel', 'empenhos', 'fornecedores', 'itens',
  'nova_nf', 'relatorios', 'itens_empenho', 'cronogramas', 'avisos',
];

// Non-authenticated design lab only. Check real tabs separately with authorized login.
test.describe('VISUAL-R1/W4 — all ten surfaces design showcase', () => {
  test('every tab has a low-intensity white or dark monochrome preview', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dev/visual-r1');
    const section = page.getByRole('region', { name: 'Worker 4 — efeitos em todas as dez abas' });
    await expect(section).toBeVisible();
    for (const tab of tabs) {
      const sample = page.getByTestId(`w4-all-tabs-${tab}`);
      const border = page.getByTestId(`w4-all-tabs-beam-${tab}`);
      await expect(sample).toBeVisible();
      await expect(border).toHaveAttribute('data-beam-active', 'true');
      await expect(border).toHaveAttribute('data-beam-theme', /^(light|dark)$/);
    }
    await expect(section.locator('[data-emprovex-beam="true"]')).toHaveCount(10);
    const focusButton = page.getByTestId('w4-all-tabs-empenhos').getByRole('button', { name: 'Ver foco' });
    await focusButton.focus();
    await expect(focusButton).toBeFocused();
  });

  test('on reduced-motion handheld the border remains accessible without traveling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/visual-r1');
    const border = page.getByTestId('w4-all-tabs-beam-inicio');
    await expect(border).toBeVisible();
    const animationName = await border.evaluate((el) =>
      window.getComputedStyle(el, '::after').animationName
    );
    expect(animationName).toBe('none');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
