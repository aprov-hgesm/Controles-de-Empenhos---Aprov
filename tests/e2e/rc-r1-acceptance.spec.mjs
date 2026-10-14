import { test, expect } from '@playwright/test';
const PASSWORD='Emprovex-Teste!2026';
async function signIn(page,email) {
  await page.goto('/');
  await page.getByTestId('sector-login-email').fill(email);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
  await page.getByTestId('sector-login-submit').click();
  const navigation=page.getByRole('navigation',{name:'Navegação principal'});
  const legal=page.getByRole('heading',{name:'Termos e Privacidade'});
  await expect(navigation.or(legal)).toBeVisible({timeout:20000});
  if (await legal.isVisible().catch(()=>false)) {
    await expect(page.getByRole('button',{name:'Aceitar e continuar'})).toBeDisabled();
    await page.getByRole('checkbox',{name:'Li e aceito os Termos de Serviço e a Política de Privacidade.'}).check();
    await page.getByRole('button',{name:'Aceitar e continuar'}).click();
  }
  await expect(navigation).toBeVisible({timeout:20000});
}
test('P01: local health without cache and operational data',async ({request})=>{
  const response=await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const json=await response.json();
  expect(json.status).toBe('ok');
  expect(Number.isNaN(Date.parse(json.timestamp))).toBe(false);
  expect(Object.keys(json).sort()).toEqual(['status','timestamp']);
});
test('P02: public terms/privacy locally',async ({page})=>{
  await page.goto('/terms');
  await expect(page.getByRole('heading',{name:'Termos de Serviço',exact:true})).toBeVisible();
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'Política de Privacidade',exact:true})).toBeVisible();
});
test('P03: home without auth does not expose operational state',async ({page})=>{
  await page.goto('/');
  await expect(page.getByTestId('sector-login-email')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toHaveCount(0);
  await expect(page.getByText('Fornecedor E2E Lifecycle')).toHaveCount(0);
});
test('P05/P07: sector login, legal gate when required, logout remains logged out',async ({page})=>{
  await signIn(page,'sector-lifecycle@example.test');
  await expect(page.getByLabel('Operador conectado').getByText('Acesso autorizado',{exact:true})).toBeVisible();
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('sector-login-email')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toHaveCount(0);
});
test('P06: two synthetic workspaces show segregated report suppliers',async ({page})=>{
  await signIn(page,'sector-lifecycle@example.test');
  await page.getByTestId('nav-relatorios').click();
  await page.getByTestId('report-empenho-sample').click();
  await expect(page.getByText('Fornecedor E2E Lifecycle').first()).toBeVisible();
  await page.getByTestId('logout').click();
  await signIn(page,'sector-b@example.test');
  await page.getByTestId('nav-relatorios').click();
  await page.getByTestId('report-empenho-sample').click();
  await expect(page.getByText('Fornecedor E2E Isolado B').first()).toBeVisible();
  await expect(page.getByText('Fornecedor E2E Lifecycle')).toHaveCount(0);
});
test('P08: synthetic warehouse search and physical location highlight',async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Entrar com Google — HGeSM'}).click();
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible({timeout:20000});
  await page.goto('/adm-deposito/estoque');
  await expect(page.getByTestId('warehouse-stock-operational')).toBeVisible({timeout:20000});
  await page.getByTestId('warehouse-stock-search').fill('Arroz parboilizado');
  const row=page.getByTestId('warehouse-stock-row-mat_123e4567e89b12d3a456426614174000');
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId('warehouse-material-sheet')).toContainText('Distribuição física');
  await page.getByTestId('warehouse-locate-in-depot').click();
  await expect(page.getByTestId('warehouse-location-highlight')).toContainText('DEP-06');
  await expect(page.getByTestId('warehouse-location-highlight')).toContainText('LOC-06');
});
test('P15/P21: Android-size mobile portal routes without horizontal overflow',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/central-mobile');
  await expect(page.getByRole('heading',{name:'Central Móvel',exact:true})).toBeVisible();
  for (const name of ['Alocar recebimento','Transferir material','Consultar localização','Inventário','Saída de material','Conferir posição']) {
    await expect(page.getByRole('link',{name:new RegExp(name)})).toBeVisible();
  }
  const metrics=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth}));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport+1);
});


test('P03: protected warehouse route redirects without session', async ({page}) => {
  await page.goto('/adm-deposito/estoque');
  await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:20000});
  await expect(page.getByTestId('warehouse-stock-operational')).toHaveCount(0);
});
test('P05: invalid synthetic password cannot establish access', async ({page}) => {
  await page.goto('/');
  await page.getByTestId('sector-login-email').fill('sector-lifecycle@example.test');
  await page.getByTestId('sector-login-password').fill('senha-incorreta-ficticia');
  await page.getByTestId('sector-login-submit').click();
  await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:20000});
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toHaveCount(0);
});
test('P08: authoritative synthetic fixture balances are read from local Warehouse Emulator',async ({request})=>{
  const root='http://127.0.0.1:8081/v1/projects/demo-emprovex-security/databases/emprovex-warehouse/documents/warehouse/hgesm-aprov/';
  const id='mat_123e4567e89b12d3a456426614174000';
  const global=await request.get(root+'balances/'+id,{headers:{Authorization:'Bearer owner'}});
  expect(global.ok()).toBe(true);
  const value=await global.json();
  expect(Number(value.fields.quantity.integerValue)).toBe(8);
  // Metadata historical UNASSIGNED (5) is NOT accepted as an operational position.
  const physical=await request.get(root+'locationBalances/locbal_44d9ac45e4e3ccec26b4bd88bb4d76964dbeb04f4716483f486329c99e96d722',{headers:{Authorization:'Bearer owner'}});
  expect(physical.ok()).toBe(true);
  const document=await physical.json();
  expect(Number(document.fields.quantity.integerValue)).toBe(3);
  expect(document.fields.position.mapValue.fields.kind.stringValue).toBe('LOCATION');
});
