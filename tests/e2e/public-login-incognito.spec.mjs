import { test, expect } from '@playwright/test';

// Somente GET sem autenticação, contas ou mutações. Reproduz sessão privada nova.
test('login publico carrega em contexto sem cookies nem armazenamento', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const errors = [];
  const rejects = [];
  page.on('pageerror', error => errors.push(String(error?.stack || error?.message || error).slice(0, 1800)));
  page.on('console', msg => {
    if (msg.type() === 'error') rejects.push(msg.text().slice(0, 900));
  });
  const response = await page.goto('https://emprovex.com.br/central-empenhos', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(8_000);
  const status = response?.status() ?? null;
  const details = await page.evaluate(() => ({
    title: document.title,
    mode: document.documentElement.dataset.visualMode || null,
    hasFailureBoundary: Boolean(document.querySelector('main[role="alert"]')),
    loginHeading: document.body.innerText.includes('Bem-vindo de volta'),
    loadingText: document.body.innerText.slice(0, 280),
    brandImages: [...document.querySelectorAll('img')].filter(i => /emprovex|branding|logo/i.test(i.currentSrc || i.src)).slice(0, 8).map(i => ({
      src: i.currentSrc || i.src, loaded: i.complete && i.naturalWidth > 0, width: i.naturalWidth
    })),
  }));
  console.log('[LOGIN_GUEST_DIAGNOSTIC]', JSON.stringify({ status, details, errors, rejects }));
  await page.screenshot({ path: 'test-results/public-login-guest.png', fullPage: true });
  expect(status).toBe(200);
  expect(details.hasFailureBoundary, 'UI caiu no VisualModeSafetyBoundary').toBe(false);
  expect(details.loginHeading, 'Formulario publico nao apareceu').toBe(true);
  expect(errors, 'Erros React ao abrir login anonimo').toEqual([]);
  await context.close();
});
