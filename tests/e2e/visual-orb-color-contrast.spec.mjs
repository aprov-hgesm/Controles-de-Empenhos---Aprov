import { test, expect } from '@playwright/test';

// Run against the development server or a reachable, isolated Vercel Preview.
// This laboratory never authenticates, queries Firebase or mutates workspaces.
test.describe('VISUAL-R1 — colored orbit and light/dark contrast', () => {
  test('shows the same yellow/red/white particles on a light card and dark panel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/visual-r1');
    const comparison = page.getByRole('region', { name: /Contraste real em superfícies escuras e claras/ });
    await expect(comparison).toBeVisible();

    const orbs = comparison.locator('[data-testid="emprovex-thinking-orb"]');
    await expect(orbs).toHaveCount(2);
    await expect(orbs.nth(0)).toHaveAttribute('data-contrast-surface', 'matte');
    await expect(orbs.nth(1)).toHaveAttribute('data-contrast-surface', 'transparent');

    for (const canvas of await orbs.locator('canvas').all()) {
      await expect(canvas).toBeVisible();
      const pixels = await canvas.evaluate((node) => {
        const context = node.getContext('2d');
        if (!context) return { opaque: 0, yellow: 0, red: 0, pale: 0 };
        const { data } = context.getImageData(0, 0, node.width, node.height);
        const out = { opaque: 0, yellow: 0, red: 0, pale: 0 };
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 96) continue;
          out.opaque++;
          if (r > 190 && g > 140 && b < 145 && r > g) out.yellow++;
          if (r > 170 && g < 150 && b < 150 && r > g * 1.4) out.red++;
          if (r > 180 && g > 180 && b > 180) out.pale++;
        }
        return out;
      });
      expect(pixels.opaque, 'Visible particles must be painted').toBeGreaterThan(0);
      expect(pixels.yellow, 'Fast yellow particles must exist').toBeGreaterThan(0);
      expect(pixels.red, 'Fast red particles must exist').toBeGreaterThan(0);
      expect(pixels.pale, 'Slow white and neutral particles must exist').toBeGreaterThan(0);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('preserves mobile layout and real demo state transitions', async ({ page }) => {
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
