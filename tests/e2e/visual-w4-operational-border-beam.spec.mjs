import { expect, test } from '@playwright/test';

// W4 development/Preview demonstration. No login or operational data required.
test.describe('VISUAL-R1/W4 — restrained operational Border Beam', () => {
  test('one slow monochrome beam and one focus-only beam in the lab', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dev/visual-r1');
    const section = page.getByRole('region', { name: 'Worker 4 — Border Beam no Painel e Relatórios' });
    await expect(section).toBeVisible();

    const travel = page.getByTestId('w4-sample-travel');
    const focus = page.getByTestId('w4-sample-focus');
    await expect(travel).toHaveAttribute('data-beam-variant', 'travel');
    await expect(travel).toHaveAttribute('data-beam-theme', 'dark');
    await expect(focus).toHaveAttribute('data-beam-variant', 'focus');
    await expect(focus).toHaveAttribute('data-beam-theme', 'light');

    const button = section.getByRole('button', { name: 'Por Empenho' });
    await button.focus();
    await expect(button).toBeFocused();
    // The CSS fade is 180ms: poll rather than reading its initial 0-opacity frame.
    await expect.poll(async () => focus.evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element, '::after').opacity)
    )).toBeGreaterThan(0.1);
    await button.press('Tab');
    await expect(section.getByRole('button', { name: 'Por Fornecedor' })).toBeFocused();
  });

  test('no decorative motion on reduced-motion mobile and no horizontal overflow', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/visual-r1');
    const travel = page.getByTestId('w4-sample-travel');
    const focus = page.getByTestId('w4-sample-focus');

    await expect(travel).toBeVisible();
    await expect(focus).toBeVisible();
    const animationName = await travel.evaluate((element) =>
      window.getComputedStyle(element, '::after').animationName
    );
    expect(animationName).toBe('none');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
