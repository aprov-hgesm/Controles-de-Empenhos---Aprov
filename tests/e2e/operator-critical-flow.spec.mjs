import { test, expect } from '@playwright/test';

const PASSWORD = 'Emprovex-Teste!2026';
const OPERATOR_A = 'sector-lifecycle@example.test';
const OPERATOR_B = 'sector-b@example.test';
const RECORD_KEY = 'nf_11111111000191_1001';
const NS = '2026NS009999';
const UG = '160416';

async function loginSector(page, email) {
  await page.getByTestId('sector-login-email').fill(email);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
  await page.getByTestId('sector-login-submit').click();

  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByLabel('Operador conectado').getByText('Acesso autorizado', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Início', exact: true }).first()
  ).toHaveAttribute('aria-current', 'page');
}

async function logoutIfAuthenticated(page) {
  const logout = page.getByTestId('logout');
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await expect(page.getByTestId('sector-login-email')).toBeVisible({
      timeout: 15_000,
    });
  }
}

async function sessionCoordinatorRole(page) {
  return page.evaluate(() => {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('emprovex:session-coordinator-role:v1:')) {
        return sessionStorage.getItem(key);
      }
    }
    return null;
  });
}

async function logicalSessionId(page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('emprovex:workspace-session:v1:')) {
        return localStorage.getItem(key);
      }
    }
    return null;
  });
}

async function openSampleReport(page) {
  await page.getByTestId('nav-relatorios').click();
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await page.getByTestId('report-empenho-sample').click();
}

async function expectRealtimeProfile(page, expectedCount) {
  const shell = page.locator('[data-active-realtime-collections]');
  await expect(shell).toHaveAttribute(
    'data-active-realtime-collections',
    String(expectedCount)
  );
  await expect(page.getByTestId('operational-section-loading')).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function expectResponsiveInicio(page, label) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(
    overflow.documentWidth,
    `${label}: documentElement não deve criar overflow horizontal`
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);

  expect(
    overflow.bodyWidth,
    `${label}: body não deve criar overflow horizontal`
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);

  const scene = page.getByTestId('inicio-scene');
  const chrome = page.getByTestId('inicio-scene-chrome');
  const identity = page.getByTestId('inicio-identity');
  await expect(scene).toBeVisible();
  await expect(chrome).toBeVisible();
  await expect(identity).toBeVisible();
  await expect(page.getByTestId('inicio-quick-actions')).toHaveCount(0);
  await expect(page.getByText('Continuar de onde parei', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ações rápidas', { exact: true })).toHaveCount(0);

  const [sceneBox, identityBox] = await Promise.all([
    scene.boundingBox(),
    identity.boundingBox(),
  ]);

  expect(sceneBox, `${label}: scene sem bounding box`).not.toBeNull();
  expect(identityBox, `${label}: identidade sem bounding box`).not.toBeNull();

  if (!sceneBox || !identityBox) return;

  const tolerance = 2;
  expect(identityBox.x).toBeGreaterThanOrEqual(sceneBox.x - tolerance);
  expect(identityBox.x + identityBox.width).toBeLessThanOrEqual(
    sceneBox.x + sceneBox.width + tolerance
  );
}

test.describe.serial('EMPROVEX browser E2E with Firebase Emulator', () => {
  test.afterEach(async ({ page }) => {
    await logoutIfAuthenticated(page);
  });

  test('login -> relatório -> NS automática por UG -> persistência após reload', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);
    await openSampleReport(page);

    await expect(page.getByText('Fornecedor E2E Lifecycle').first()).toBeVisible();
    await expect(page.getByText('1001')).toBeVisible();

    await page.locator(`#btn-edit-ns-${RECORD_KEY}`).click();
    await expect(
      page.locator('[title="UG vinculada automaticamente ao cadastro da unidade"]')
    ).toContainText(`UG ${UG}`);
    await page.locator(`#input-ns-${RECORD_KEY}`).fill(NS);
    await page.locator(`#btn-save-ns-${RECORD_KEY}`).click();

    await expect(page.getByText(`UG ${UG} · ${NS}`).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
      timeout: 20_000,
    });
    await openSampleReport(page);
    await expect(page.getByText(`UG ${UG} · ${NS}`)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId('logout').click();
    await expect(page.getByTestId('sector-login-email')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('segundo workspace não enxerga a NS nem o fornecedor do primeiro', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_B);
    await openSampleReport(page);

    await expect(page.getByText('Fornecedor E2E Isolado B').first()).toBeVisible();
    await expect(page.getByText('Fornecedor E2E Lifecycle')).toHaveCount(0);
    await expect(page.getByText(NS)).toHaveCount(0);
  });

  test('diagnóstico histórico -> reparo seguro -> persistência após reload', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);

    await page.getByTestId('nav-relatorios').click();
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await page.getByTestId('relatorios-tab-integridade').click();

    await expect(page.getByTestId('historical-consistency-view')).toBeVisible();
    await page.getByTestId('historical-consistency-scan').click();

    await page.waitForTimeout(1200);
    const scanError = page.getByTestId('historical-consistency-error');
    if (await scanError.isVisible()) {
      throw new Error(`Historical scan failed: ${await scanError.textContent()}`);
    }

    const issueCodes = await page
      .locator('[data-testid^="historical-issue-"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-testid'))
      );
    console.log('Historical consistency issues:', issueCodes);

    await expect(
      page.getByTestId('historical-issue-invoice_missing_supplier_cnpj')
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('repair-backfill_invoice_supplier_cnpj').click();
    await expect(
      page.getByText('CNPJ da NF preenchido a partir do empenho vinculado.')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('historical-consistency-clean')).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('nav-relatorios').click();
    await page.getByTestId('relatorios-tab-integridade').click();
    await page.getByTestId('historical-consistency-scan').click();
    await expect(page.getByTestId('historical-consistency-clean')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('assistente SAG refatorado preserva progresso, fornecedor, prompt e UG', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);

    await page.getByTestId('nav-relatorios').click();
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await page.getByTestId('relatorios-tab-sag').click();

    await expect(page.getByRole('heading', { name: 'Importar NS — SAG' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Progresso da importação SAG' })).toBeVisible();

    const supplierButton = page
      .getByRole('button')
      .filter({ hasText: 'Fornecedor E2E Lifecycle' })
      .first();
    await expect(supplierButton).toBeVisible();
    await supplierButton.click();

    await expect(page.getByText('Obter relatório no SAG', { exact: true })).toBeVisible();
    await expect(page.getByText('Prompt oficial do EMPROVEX', { exact: true })).toBeVisible();
    await expect(page.getByText(UG, { exact: true })).toBeVisible();
  });
  test('exclusão protegida remove empenho, NF e NS lock sem estado parcial', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);

    await page.getByRole('button', { name: 'Empenhos', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Empenhos' })).toBeVisible();
    await expect(page.getByText('Fornecedor E2E Delete').first()).toBeVisible();

    await page.getByTitle('Excluir empenho delete-e2e').click();
    await expect(page.getByRole('heading', { name: 'Confirmar Exclusão de Empenho' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar Exclusão' }).click();

    await expect(page.getByText('Fornecedor E2E Delete')).toHaveCount(0, { timeout: 15000 });

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole('button', { name: 'Empenhos', exact: true }).first().click();
    await expect(page.getByText('Fornecedor E2E Delete')).toHaveCount(0);

    await page.getByTestId('nav-relatorios').click();
    await page.getByTestId('relatorios-tab-integridade').click();
    await page.getByTestId('historical-consistency-scan').click();
    await expect(page.getByTestId('historical-consistency-clean')).toBeVisible({
      timeout: 15000,
    });
  });

  test('perfil realtime acompanha a seção ativa sem manter coleções ociosas', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);
    await expectRealtimeProfile(page, 1);

    await page.getByRole('button', { name: 'Empenhos', exact: true }).first().click();
    await expectRealtimeProfile(page, 3);

    // O snapshot econômico é publicado somente a partir de dados que esta tela
    // já precisou carregar. A Home seguinte deve usar um único documento realtime.
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Início', exact: true }).first().click();
    await expectRealtimeProfile(page, 1);
    await expect(page.locator('[data-snapshot="ready"]')).toBeVisible();

    await page.getByRole('button', { name: 'Notas Fiscais', exact: true }).first().click();
    await expectRealtimeProfile(page, 4);

    await page.getByTestId('nav-relatorios').click();
    await expectRealtimeProfile(page, 2);

    await page.getByRole('button', { name: 'Cronogramas', exact: true }).first().click();
    await expectRealtimeProfile(page, 2);

    await page.getByTestId('nav-avisos').click();
    await expectRealtimeProfile(page, 2);
    await expect(page.getByRole('heading', { name: 'Central de Avisos' })).toBeVisible();

    await page.getByRole('button', { name: 'Consulta de Itens', exact: true }).first().click();
    await expectRealtimeProfile(page, 1);

    await page.getByRole('button', { name: 'Painel', exact: true }).first().click();
    await expectRealtimeProfile(page, 1);
  });

  test('Início permanece responsivo em celular, tablet e landscape sem overflow horizontal', async ({ page }) => {
    await page.goto('/');
    await loginSector(page, OPERATOR_A);

    await page.getByRole('button', { name: 'Empenhos', exact: true }).first().click();
    await expectRealtimeProfile(page, 3);
    await page.waitForTimeout(1200);

    await page.getByRole('button', { name: 'Início', exact: true }).first().click();
    await expectRealtimeProfile(page, 1);
    await expect(page.locator('[data-snapshot="ready"]')).toBeVisible();

    const viewports = [
      { label: 'phone-small', width: 360, height: 800 },
      { label: 'phone-standard', width: 390, height: 844 },
      { label: 'tablet-portrait', width: 768, height: 1024 },
      { label: 'phone-landscape', width: 844, height: 390 },
    ];

    try {
      for (const viewport of viewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.waitForTimeout(120);
        await expectResponsiveInicio(page, viewport.label);
      }
    } finally {
      // Restaura o viewport padrão antes do afterEach para que o logout da
      // sidebar continue clicável mesmo quando o último caso testado é landscape.
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });

  test('duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();

    const pageA1 = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    try {
      await pageA1.goto('/');
      await loginSector(pageA1, OPERATOR_A);

      // Mesma instância de navegador: a segunda aba reutiliza browserInstanceId +
      // sessionId e não consome o segundo slot.
      const pageA2 = await contextA.newPage();
      await pageA2.goto('/');
      await expect(pageA2.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
        timeout: 20_000,
      });

      // Segundo navegador/contexto consome a segunda vaga.
      await pageB.goto('/');
      await loginSector(pageB, OPERATOR_A);

      // Terceiro navegador autentica no Firebase, mas é recusado pelo lease.
      await pageC.goto('/');
      await pageC.getByTestId('sector-login-email').fill(OPERATOR_A);
      await pageC.getByTestId('sector-login-password').fill(PASSWORD);
      await pageC.getByTestId('sector-login-submit').click();

      await expect(
        pageC.getByText('Limite de acessos simultâneos atingido.', { exact: false })
      ).toBeVisible({ timeout: 20_000 });
      await expect(pageC.getByTestId('sector-login-email')).toBeVisible();
      await expect(
        pageC.getByRole('navigation', { name: 'Navegação principal' })
      ).toHaveCount(0);

      // Liberar a segunda sessão devolve a vaga imediatamente.
      await logoutIfAuthenticated(pageB);

      await pageC.getByTestId('sector-login-submit').click();
      await expect(
        pageC.getByRole('navigation', { name: 'Navegação principal' })
      ).toBeVisible({ timeout: 20_000 });

      await logoutIfAuthenticated(pageC);
      await logoutIfAuthenticated(pageA1);
    } finally {
      await contextC.close();
      await contextB.close();
      await contextA.close();
    }
  });

  test('coordenação multiaba mantém um único líder e promove a seguidora sem trocar a sessão lógica', async ({ browser }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    let pageB = null;

    try {
      await pageA.goto('/');
      await loginSector(pageA, OPERATOR_A);

      await expect.poll(
        () => sessionCoordinatorRole(pageA),
        {
          timeout: 15_000,
          intervals: [250, 500, 1000],
        }
      ).toBe('leader');

      pageB = await context.newPage();
      await pageB.goto('/');
      await expect(pageB.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible({
        timeout: 20_000,
      });

      await expect.poll(async () => {
        const roles = [await sessionCoordinatorRole(pageA), await sessionCoordinatorRole(pageB)]
          .filter(Boolean)
          .sort();
        return roles.join(',');
      }, {
        timeout: 30_000,
        intervals: [250, 500, 1000],
      }).toBe('follower,leader');

      const roleA = await sessionCoordinatorRole(pageA);
      const leaderPage = roleA === 'leader' ? pageA : pageB;
      const followerPage = roleA === 'leader' ? pageB : pageA;
      const sessionIdBefore = await logicalSessionId(followerPage);
      expect(sessionIdBefore).toBeTruthy();

      await leaderPage.close();

      await expect.poll(
        () => sessionCoordinatorRole(followerPage),
        {
          timeout: 15_000,
          intervals: [250, 500, 1000],
        }
      ).toBe('leader');

      await expect(
        followerPage.getByRole('navigation', { name: 'Navegação principal' })
      ).toBeVisible();
      expect(await logicalSessionId(followerPage)).toBe(sessionIdBefore);

      await logoutIfAuthenticated(followerPage);
    } finally {
      await context.close();
    }
  });

});
