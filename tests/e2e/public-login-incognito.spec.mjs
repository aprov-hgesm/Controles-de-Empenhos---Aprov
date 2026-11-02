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


test('login anonimo tolera bloqueio de localStorage (modo privado restritivo)', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e).slice(0, 700)));
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === 'local_user_session') {
        throw new DOMException('Storage access is denied by a restrictive privacy setting', 'SecurityError');
      }
      return remove.call(this, key);
    };
  });
  const response = await page.goto('https://emprovex.com.br/central-empenhos', {
    waitUntil: 'domcontentloaded', timeout: 45_000,
  });
  await page.waitForTimeout(5_000);
  const failure = await page.locator('main[role="alert"]').count();
  console.log('[LOGIN_PRIVATE_STORAGE_DIAGNOSTIC]', JSON.stringify({ status: response?.status(), failure, errors }));
  expect(failure, 'Bloqueio de storage causou tela de erro global').toBe(0);
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta.' })).toBeVisible();
  await context.close();
});
