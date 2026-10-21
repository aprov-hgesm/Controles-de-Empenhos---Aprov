import { test, expect } from '@playwright/test';

// Este teste executa EXCLUSIVAMENTE no browser runner com dois Firebase Emulators.
// Nenhuma URL da produção nem credencial real participa da execução.
const PROJECT = 'demo-emprovex-security';
const WAREHOUSE = 'http://127.0.0.1:8081/v1/projects/' + PROJECT
  + '/databases/emprovex-warehouse/documents/warehouse/hgesm-aprov';
const DEPOT_ID = 'dep_' + '6'.repeat(32);
const LOCATION_ID = 'loc_' + '6'.repeat(32);
const SUBPOSITION_ID = 'sub_' + '6'.repeat(32);
const DESCRIPTION = 'ARROZ TESTE LOCAL E2E PR 347';
const BARCODE = '7896305701574';

async function acceptance(page) {
  const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
  const legal = page.getByRole('heading', { name: 'Termos e Privacidade' });
  await expect(navigation.or(legal)).toBeVisible({ timeout: 25_000 });
  if (await legal.isVisible().catch(() => false)) {
    await page.getByRole('checkbox', {
      name: 'Li e aceito os Termos de Serviço e a Política de Privacidade.',
    }).check();
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
  }
  await expect(navigation).toBeVisible({ timeout: 25_000 });
}

async function getFirestoreDoc(request, collection, id) {
  const url = WAREHOUSE + '/' + collection + '/' + id;
  const response = await request.get(url, { headers: { Authorization: 'Bearer owner' } });
  expect(response.ok(), 'Faltou documento ' + collection + '/' + id).toBe(true);
  return await response.json();
}

test('entrada avulsa desktop: formulário -> API server -> 6 gravações atômicas -> persistência', async ({
  page, request,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
  await acceptance(page);

  await page.goto('/central-depositos/cadastro-de-itens');
  await page.getByRole('button', { name: 'Entrada avulsa', exact: true }).click();
  const form = page.getByTestId('warehouse-manual-entry-operational');
  await expect(form).toBeVisible({ timeout: 25_000 });
  await expect(form.getByText('Cadastrar material de procedência diversa')).toBeVisible();

  await form.getByRole('button', { name: 'Novo material' }).click();
  await form.getByPlaceholder('Ex.: Açúcar cristal').fill(DESCRIPTION);
  await form.getByPlaceholder('UN, KG, CX...').fill('KG');
  await form.getByLabel('Quantidade').fill('5');
  await form.getByPlaceholder('Ex.: doação, transferência antiga, material localizado...')
    .fill('Teste de homologação');
  await form.getByPlaceholder('Ex.: termo, setor de origem, observação administrativa')
    .fill('QA PR 347');
  await form.locator('select').nth(0).selectOption(DEPOT_ID);
  await form.locator('select').nth(1).selectOption(LOCATION_ID);
  await form.locator('select').nth(2).selectOption(SUBPOSITION_ID);
  await form.locator('input[type=date]').fill('2027-04-20');
  await form.getByPlaceholder('Leitor ou digitação').fill(BARCODE);

  const apiResponse = page.waitForResponse(response =>
    response.url().includes('/api/central-depositos/manual-entry')
      && response.request().method() === 'POST',
    { timeout: 30_000 }
  );
  await form.getByRole('button', { name: 'Registrar entrada avulsa' }).click();
  const response = await apiResponse;
  const payload = await response.json();
  expect(response.status(), 'Erro HTTP: ' + JSON.stringify(payload)).toBe(200);
  expect(payload.ok, JSON.stringify(payload)).toBe(true);
  const result = payload.result;
  expect(result.material.description).toBe(DESCRIPTION);
  expect(result.entry.applied).toBe(true);
  expect(result.entry.balance.quantity).toBe(5);
  expect(result.locationBalance.quantity).toBe(5);
  expect(result.locationBalance.position.kind).toBe('SUBPOSITION');
  expect(result.barcodeLinked).toBe(true);
  expect(result.validity.expiresOn).toBe('2027-04-20');
  await expect(form.getByText(/Entrada avulsa registrada:/)).toBeVisible();

  // Verificação independente: documentos realmente persistidos em disco do Emulator.
  const [material, movement, balance, located, lot] = await Promise.all([
    getFirestoreDoc(request, 'materials', result.material.id),
    getFirestoreDoc(request, 'movements', result.entry.movement.id),
    getFirestoreDoc(request, 'balances', result.material.id),
    getFirestoreDoc(request, 'locationBalances', result.locationBalance.id),
    getFirestoreDoc(request, 'lots', result.validity.id),
  ]);
  expect(material.fields.description.stringValue).toBe(DESCRIPTION);
  expect(movement.fields.type.stringValue).toBe('MANUAL_ENTRY');
  expect(Number(balance.fields.quantity.integerValue ?? balance.fields.quantity.doubleValue)).toBe(5);
  expect(Number(located.fields.quantity.integerValue ?? located.fields.quantity.doubleValue)).toBe(5);
  expect(lot.fields.expiresOn.stringValue).toBe('2027-04-20');

  const barcodes = await request.get(WAREHOUSE + '/barcodes', {
    headers: { Authorization: 'Bearer owner' },
  });
  expect(barcodes.ok()).toBe(true);
  const barcodeRows = (await barcodes.json()).documents || [];
  const associated = barcodeRows.filter(doc =>
    doc.fields?.materialId?.stringValue === result.material.id
      && doc.fields?.barcode?.stringValue === BARCODE
  );
  expect(associated).toHaveLength(1);
  console.log('BROWSER MANUAL ENTRY: PASS | 5 KG, SUBPOSITION, LOT, BARCODE');

  // O formulário refaz sua leitura após a confirmação: pesquisar o novo
  // material sem depender de uma sessão simulada persistida pelo navegador.
  await form.getByRole('button', { name: 'Material existente' }).click();
  await form.getByPlaceholder('Descritivo ou código interno').fill(DESCRIPTION);
  await expect(form.getByText(DESCRIPTION, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  console.log('BROWSER MATERIAL SEARCH: PASS | material encontrado após cadastro');

});
