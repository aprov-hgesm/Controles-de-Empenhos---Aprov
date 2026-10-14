import { expect, test } from '@playwright/test';

// Development-only sandbox, no authentication or operational account data.
test.describe('VISUAL-R1 W4 — navigation Border Beam expansion', () => {
  test('all ten destinations can be previewed with only one active beam', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dev/visual-r1');
    const preview = page.getByRole('region', { name: 'Worker 4 — Border Beam nas demais abas' });
    const tabs = preview.getByTestId('w4-navigation-demo-tab');
    await expect(tabs).toHaveCount(10);
    await expect(tabs.locator('[data-active="true"]')).toHaveCount(0); // Buttons themselves carry the attribute.
    await expect(preview.locator('button[data-active="true"]')).toHaveCount(1);
    await preview.getByRole('button', { name: 'Cronogramas' }).click();
    await expect(preview.getByRole('button', { name: 'Cronogramas' })).toHaveAttribute('data-active','true');
    await expect(preview.locator('button[data-active="true"]')).toHaveCount(1);
    await expect(preview.getByText('Nenhuma navegação nem operação foi executada.', { exact: false })).toBeVisible();
  });

  test('mobile and reduced-motion disable beam animation without hiding native buttons', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/visual-r1');
    const preview = page.getByRole('region', { name: 'Worker 4 — Border Beam nas demais abas' });
    const item = preview.getByRole('button', { name: 'Notas Fiscais' });
    await item.focus();
    await expect(item).toBeFocused();
    await item.click();
    await expect(item).toHaveAttribute('data-active','true');
    const animationName = await item.locator('[data-emprovex-nav-beam="true"]').evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animationName).toBe('none');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
