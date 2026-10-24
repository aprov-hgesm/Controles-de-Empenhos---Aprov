import { test, expect } from '@playwright/test';

// Navegação da Central sob autenticação/Firestore emuladores, sem produção.
// Valida clique no menu, render real, URL, histórico e recarga de rota direta.
test('Central de Depósitos: seis abas via React com conteúdo e histórico', async ({ page }) => {
  test.setTimeout(240_000);
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

  console.log('WAREHOUSE REACT NAVIGATION: PASS (6 abas, voltar, F5, acesso direto)');
});
