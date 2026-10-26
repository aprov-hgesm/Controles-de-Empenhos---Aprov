import { test, expect } from '@playwright/test';

// Navegação da Central sob autenticação/Firestore emuladores, sem produção.
// Valida clique no menu, render real, URL, histórico e recarga de rota direta.
test('Central de Depósitos: seis abas via React com conteúdo e histórico', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();

  const principal = page.getByRole('navigation', { name: 'Navegação principal' });
  const legal = page.getByRole('heading', { name: 'Termos e Privacidade' });
  await expect(principal.or(legal)).toBeVisible({ timeout: 30_000 });
  if (await legal.isVisible().catch(() => false)) {
    await page.getByRole('checkbox', {
      name: 'Li e aceito os Termos de Serviço e a Política de Privacidade.',
    }).check();
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
  }
  await expect(principal).toBeVisible({ timeout: 30_000 });

  // P0: trocar de perfil não pode deixar a URL em /admin com a tela de /login.
  const adminButton = page.getByRole('button', { name: 'Abrir Administração EMPROVEX' });
  await expect(adminButton).toBeVisible({ timeout: 30_000 });
  await adminButton.click();
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  await expect(page.getByTestId('admin-visual-shell')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Voltar ao HGeSM' }).click();
  await expect(page).toHaveURL(/\/login\/?$/, { timeout: 30_000 });
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }))
    .toBeVisible({ timeout: 45_000 });

  // Entrada na Central também deve abrir conteúdo real no primeiro clique.
  await page.getByTestId('nav-central-depositos').click();
  await expect(page).toHaveURL(/\/central-depositos\/?$/, { timeout: 30_000 });
  await expect(page.getByTestId('warehouse-landing-operational')).toBeVisible({ timeout: 45_000 });

  await page.goto('/central-depositos');
  const shell = page.getByTestId('warehouse-module-shell');
  await expect(shell).toHaveAttribute('data-warehouse-section', 'home', { timeout: 45_000 });
  await expect(page.getByTestId('warehouse-landing-operational')).toBeVisible({ timeout: 45_000 });

  const cases = [
    ['overview', '/central-depositos/meus-depositos', 'warehouse-home-operational'],
    ['registration', '/central-depositos/cadastro-de-itens', 'warehouse-registration-operational'],
    ['outbound', '/central-depositos/saida-de-material', 'warehouse-material-withdrawal'],
    ['depots', '/central-depositos/controle-de-depositos', 'warehouse-depots-operational'],
    ['control', '/central-depositos/controle-de-itens', 'warehouse-item-control-operational'],
    ['home', '/central-depositos', 'warehouse-landing-operational'],
  ];
  for (const [id, url, surface] of cases) {
    await page.getByTestId('warehouse-nav-' + id).click();
    await expect(shell).toHaveAttribute('data-warehouse-section', id, { timeout: 45_000 });
    await expect(page).toHaveURL(new RegExp(url.replaceAll('/', '\\/') + '$'));
    await expect(page.getByTestId(surface).first()).toBeVisible({ timeout: 45_000 });
    console.log('WAREHOUSE REACT NAVIGATION: PASS ' + id);
  }

  await page.goBack();
  await expect(shell).toHaveAttribute('data-warehouse-section', 'control');
  await expect(page.getByTestId('warehouse-item-control-operational')).toBeVisible({ timeout: 45_000 });

  await page.reload();
  await expect(shell).toHaveAttribute('data-warehouse-section', 'control', { timeout: 45_000 });
  await expect(page.getByTestId('warehouse-item-control-operational')).toBeVisible({ timeout: 45_000 });

  // Mesmo motor de estado React com a sidebar aberta no telefone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menu principal' }).click();
  await page.getByTestId('warehouse-nav-overview').click();
  await expect(shell).toHaveAttribute('data-warehouse-section', 'overview', { timeout: 45_000 });
  await expect(page.getByTestId('warehouse-home-operational').first()).toBeVisible({ timeout: 45_000 });
  console.log('WAREHOUSE REACT NAVIGATION: PASS (6 abas, voltar, F5, acesso direto e celular)');
});
