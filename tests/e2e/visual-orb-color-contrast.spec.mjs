import { test, expect } from '@playwright/test';

// Development or isolated Preview only; no login, Firebase or operational data.
// Policy: colored particles belong exclusively to the central Início hero.
// All loader variants use surface-aware monochrome ink.
async function canvasInk(canvas) {
  return canvas.evaluate((node) => {
    const ctx = node.getContext('2d');
    if (!ctx) return { visible: 0, yellow: 0, red: 0, pale: 0, dark: 0, colored: 0 };
    const rgba = ctx.getImageData(0, 0, node.width, node.height).data;
    const counts = { visible: 0, yellow: 0, red: 0, pale: 0, dark: 0, colored: 0 };
    for (let i = 0; i < rgba.length; i += 4) {
      const [r, g, b, a] = rgba.slice(i, i + 4);
      if (a < 96) continue;
      counts.visible++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 24) counts.colored++;
      if (r > 180 && g > 130 && b < 160 && r > b + 55) counts.yellow++;
      if (r > 165 && g < 140 && b < 145 && r > g + 60) counts.red++;
      if (r > 190 && g > 190 && b > 190) counts.pale++;
      if (r < 155 && g < 155 && b < 155) counts.dark++;
    }
    return counts;
  });
}

test.describe('VISUAL-R1 — color restricted to Início', () => {
  test('colors appear only in the Início hero, not in loading indicators', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/visual-r1');

    const inicio = page.getByRole('region', { name: 'Comparação do núcleo colorido Classic e R2' });
    const heroes = inicio.locator('[data-testid="emprovex-thinking-orb"]');
    await expect(heroes).toHaveCount(2);
    for (const [index, refinement] of ['classic', 'r2'].entries()) {
      const hero = heroes.nth(index);
      await expect(hero).toHaveAttribute('data-orb-palette', 'colored');
      await expect(hero).toHaveAttribute('data-orb-refinement', refinement);
      await expect(hero).toHaveAttribute('data-orb-surface', 'dark');
      const colored = await canvasInk(hero.locator('canvas'));
      expect(colored.visible).toBeGreaterThan(0);
      expect(colored.yellow).toBeGreaterThan(0);
      expect(colored.red).toBeGreaterThan(0);
      expect(colored.pale).toBeGreaterThan(0);
    }

    const contrast = page.getByRole('region', { name: 'Contraste monocromático em superfícies claras e escuras' });
    const orbs = contrast.locator('[data-testid="emprovex-thinking-orb"]');
    await expect(orbs).toHaveCount(2);
    for (const [index, surface] of ['light', 'dark'].entries()) {
      await expect(orbs.nth(index)).toHaveAttribute('data-orb-palette', 'monochrome');
      await expect(orbs.nth(index)).toHaveAttribute('data-orb-surface', surface);
      const ink = await canvasInk(orbs.nth(index).locator('canvas'));
      expect(ink.visible).toBeGreaterThan(0);
      expect(ink.colored, 'No colored particles in loaders').toBe(0);
      if (surface === 'light') expect(ink.dark).toBeGreaterThan(0);
      else expect(ink.pale).toBeGreaterThan(0);
    }

    const presets = page.getByRole('region', { name: 'Cinco tamanhos de Thinking Orbs integrados' });
    const galleryOrbs = presets.locator('[data-testid="emprovex-thinking-orb"]');
    await expect(galleryOrbs).toHaveCount(5);
    for (const orb of await galleryOrbs.all()) {
      await expect(orb).toHaveAttribute('data-orb-palette', 'monochrome');
      await expect(orb).toHaveAttribute('data-orb-surface', 'light');
    }
  });

  test('mobile layout and real demo state changes remain usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/visual-r1');
    await expect(page.getByRole('heading', { name: /Laboratório de integração visual/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'ready', exact: true }).click();
    await expect(page.getByText('Amostra de conteúdo pronto.')).toBeVisible();
    await page.getByRole('button', { name: 'error', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Amostra de mensagem de erro preservada.');
  });
});
