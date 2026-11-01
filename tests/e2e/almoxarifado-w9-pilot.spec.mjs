import { test, expect } from '@playwright/test';
import { registerEmulatedLegalAcceptance } from './emulatedLegalAcceptance.mjs';

const email = 'w1-almox@example.test';
const password = 'Almox-W1-R01-Demo!2026';

test('W9 - usuário Almoxarifado no Firebase Emulator: login, módulos e logout', async ({page,context}) => {
  test.setTimeout(240_000);
  await registerEmulatedLegalAcceptance(context);
  await page.goto('/login');
  await page.getByTestId('sector-login-email').fill(email);
  await page.getByTestId('sector-login-password').fill(password);
  await page.getByTestId('sector-login-submit').click();
  await expect(page).toHaveURL(/\/almoxarifado\/?$/, {timeout:45000});
  const legal = page.getByRole('heading',{name:'Termos e Privacidade'});
  if (await legal.isVisible({timeout:7000}).catch(()=>false)) {
    await page.getByRole('checkbox',{name:'Li e aceito os Termos de Serviço e a Política de Privacidade.'}).check();
    await page.getByRole('button',{name:'Aceitar e continuar'}).click();
  }
  const shell = page.getByTestId('almoxarifado-portal');
  await expect(shell).toBeVisible({timeout:60000});
  await expect(shell).toContainText('EMPROVEX · ALMOXARIFADO');

  const nav = page.getByRole('navigation',{name:'Navegação Almoxarifado'});
  for(const label of ['Empenhos','Notas Fiscais','Cronogramas','Fornecedores','Consulta de Itens','Materiais','Relatórios']){
    await nav.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible({timeout:45000});
    await expect(page.getByText('em preparação',{exact:false})).toHaveCount(0);
    if (['Fornecedores','Consulta de Itens','Materiais'].includes(label)){
      await expect(page.locator('[data-testid^="almox-w7-"]')).toBeVisible({timeout:60000});
    }
    if(label==='Relatórios') {
      await expect(page.getByText('Empenhos e fornecedores',{exact:false}).first()).toBeVisible({timeout:60000});
    }
  }
  await nav.getByRole('button',{name:'Pedidos SISCOFIS (experimental)'}).click();
  await expect(page.getByText('Somente dados sintéticos.',{exact:false})).toBeVisible();
  await page.getByLabel('Visual').selectOption('essencial');
  await expect(page.getByLabel('Visual')).toHaveValue('essencial');
  await page.reload();
  await expect(shell).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await expect(page).toHaveURL(/\/login\/?$/, {timeout:45000});
  await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:45000});
});
