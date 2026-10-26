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
  test.setTimeout(210_000);
  // '/' exibe o institucional; o login autenticado fica em /login.
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar com Google — HGeSM' }).click();
  await acceptance(page);

  await page.goto('/central-depositos/cadastro-de-itens');
  const registration = page.getByTestId('warehouse-registration-operational');
  await expect(registration).toBeVisible({ timeout: 45_000 });
  // Aguarda hidratação real: um clique sobre HTML pré-hidratado pode ser descartado.
  await expect(registration).toHaveAttribute('data-client-hydrated', 'true', { timeout: 45_000 });
  await registration.getByRole('button', { name: 'Entrada avulsa', exact: true }).click();
  await expect(registration).toHaveAttribute('data-active-tab', 'manual', { timeout: 25_000 });
  const form = page.getByTestId('warehouse-manual-entry-operational');
  await expect(form).toBeVisible({ timeout: 45_000 });
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

  // Integração real sobre HTTP localhost; o token é o da sessão Firebase
  // autenticada pelo navegador. Nenhuma API externa e nenhum dado produtivo.
  const headers = await response.request().allHeaders();
  const authorization = headers.authorization;
  expect(authorization).toMatch(/^Bearer \S+$/);
  const api = '/api/central-depositos/operations';
  const command = async (operation, input, workspaceId = 'hgesm-aprov') => {
    const http = await request.post(api, {
      headers: { authorization },
      data: { workspaceId, operation, input },
    });
    return { http, body: await http.json() };
  };
  const approved = (call, label) => {
    expect(call.http.status(), label + ': ' + JSON.stringify(call.body)).toBe(200);
    expect(call.body.ok, label + ': ' + JSON.stringify(call.body)).toBe(true);
    return call.body.result;
  };
  const rejected = (call, label) => {
    expect(call.http.status(), label + ': ' + JSON.stringify(call.body)).toBeGreaterThanOrEqual(400);
    expect(call.http.status(), label + ': ' + JSON.stringify(call.body)).toBeLessThan(500);
    expect(call.body.ok, label).toBe(false);
    expect(call.body.error, label).toBeTruthy();
  };
  const numeric = (doc) => Number(doc.fields.quantity.integerValue
    ?? doc.fields.quantity.doubleValue);

  // A API não deve confiar no workspace indicado pelo navegador.
  const unauthenticated = await request.post(api, {
    data: { workspaceId: 'hgesm-aprov', operation: 'DESTINATION_CREATE',
      input: { name: 'Acesso indevido' } },
  });
  expect([401, 403]).toContain(unauthenticated.status());
  rejected(await command('DESTINATION_CREATE',
    { name: 'Operação de outro setor' }, 'workspace-e2e-foreign'),
  'workspace cruzado');
  rejected(await command('OPERATION_UNSUPPORTED',
    {}), 'operação não existente');
  // Nem o fundador pode fabricar estoque, saída ou ajustes por uma API genérica.
  for (const type of ['INITIAL_BALANCE','INVOICE_ENTRY','INVENTORY_ADJUSTMENT',
    'OUTBOUND','REVERSAL','MANUAL_ENTRY']) {
    const attempted = await command('LEDGER_MOVEMENT', {
      materialId: result.material.id, type, quantityDelta: 100000,
      idempotencyKey: 'e2e-denied-direct-ledger-' + type.toLowerCase(),
    });
    rejected(attempted, 'ledger genérico rejeitado: ' + type);
    expect(attempted.http.status()).toBe(403);
    expect(attempted.body.error).toBe('WAREHOUSE_LEDGER_DIRECT_COMMAND_DISABLED');
  }
  const unsignedHealth = await request.get('/api/central-depositos/health');
  expect(unsignedHealth.status()).toBe(401);
  const authorizedHealth = await request.get('/api/central-depositos/health', {
    headers: { authorization },
  });
  expect(authorizedHealth.status(), await authorizedHealth.text()).toBe(200);
  const healthBody = await authorizedHealth.json();
  expect(healthBody.ok).toBe(true);
  expect(healthBody.checks.authenticatedFounder).toBe(true);
  expect(healthBody.checks.warehouseTransaction).toBe(true);
  console.log('LOCALHOST HOSTING PREFLIGHT: PASS | founder-only, read transaction');

  console.log('LOCALHOST AUTH/SCOPE: PASS');

  const position = result.locationBalance.position;
  const materialId = result.material.id;
  const lotId = result.validity.id;
  const outboundInput = {
    materialId, requestedQuantity: 2,
    presentation: result.material.unit,
    position, lotId, barcodeAssociation: null,
    idempotencyKey: 'e2e-r2-express-outbound-001',
    note: 'Homologação local (Firestore Emulator)',
  };

  // Rejeição de estoque insuficiente deve preservar ledger, posição e lote.
  const overdraw = await command('EXPRESS_OUTBOUND', {
    ...outboundInput, requestedQuantity: 99,
    idempotencyKey: 'e2e-r2-express-excess-001',
  });
  rejected(overdraw, 'saída acima do saldo físico');
  expect(overdraw.http.status()).toBe(409);
  expect(overdraw.body.error).toBe('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
  expect(numeric(await getFirestoreDoc(request, 'balances', materialId))).toBe(5);
  expect(numeric(await getFirestoreDoc(request, 'lots', lotId))).toBe(5);

  const outbound = approved(await command('EXPRESS_OUTBOUND', outboundInput),
    'saída real pelo servidor');
  expect(outbound.applied).toBe(true);
  expect(outbound.movement.type).toBe('OUTBOUND');
  expect(outbound.balance.quantity).toBe(3);
  expect(outbound.locationBalance.quantity).toBe(3);
  expect(outbound.lot.quantity).toBe(3);
  const replay = approved(await command('EXPRESS_OUTBOUND', outboundInput),
    'replay de saída');
  expect(replay.applied).toBe(false);
  expect(replay.movement.id).toBe(outbound.movement.id);
  rejected(await command('EXPRESS_OUTBOUND', {
    ...outboundInput, requestedQuantity: 1,
  }), 'replay divergente');
  expect(numeric(await getFirestoreDoc(request, 'balances', materialId))).toBe(3);
  console.log('LOCALHOST OUTBOUND: PASS | saldo, lote, idempotência e rejeição');

  // Pré-condição explícita: consumo STOCK_OUTBOUND já registrado, inserido
  // APENAS pelo administrador do Emulator. Isso testa o motor de devolução,
  // não afirma cobertura de ponta a ponta de WITHDRAWAL_FINALIZE.
  const consumptionId = 'cons_' + 'e'.repeat(64);
  const seeded = await request.patch(WAREHOUSE + '/consumptions/' + consumptionId, {
    headers: { authorization: 'Bearer owner' },
    data: { fields: {
      schemaVersion: { stringValue: 'warehouse_consumption_record_v1' },
      id: { stringValue: consumptionId },
      workspaceId: { stringValue: 'hgesm-aprov' },
      ug: { stringValue: '160416' },
      origin: { stringValue: 'STOCK_OUTBOUND' },
      materialId: { stringValue: materialId },
      movementId: { stringValue: outbound.movement.id },
      quantity: { integerValue: '2' },
      returnedQuantity: { integerValue: '0' },
    } },
  });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  const returnInput = {
    consumptionId, quantity: 1, reason: 'Devolução parcial no teste E2E',
    operationId: 'e2e-r2-return-001',
  };
  const returned = approved(await command('STOCK_RETURN', returnInput),
    'devolução pelo motor');
  expect(returned.movement.type).toBe('OUTBOUND_RETURN');
  expect(returned.balance.quantity).toBe(4);
  expect(returned.locationBalance.quantity).toBe(4);
  expect(returned.lot.quantity).toBe(4);
  const returnedReplay = approved(await command('STOCK_RETURN', returnInput),
    'replay da devolução');
  expect(returnedReplay.movement.id).toBe(returned.movement.id);
  rejected(await command('STOCK_RETURN', {
    ...returnInput, quantity: 2, operationId: 'e2e-r2-return-excess',
  }), 'devolução acumulada acima da saída');
  expect(numeric(await getFirestoreDoc(request, 'balances', materialId))).toBe(4);
  const persistedConsumption = await getFirestoreDoc(request, 'consumptions', consumptionId);
  expect(Number(persistedConsumption.fields.returnedQuantity.integerValue)).toBe(1);
  console.log('LOCALHOST RETURN: PASS | precondição sintética, saldo, lote e replay');

  // A transferência não pode alterar saldo global; quando fraciona um lote,
  // a parcela transferida deve acompanhar a nova posição física.
  const destination = {
    kind: 'LOCATION', depotId: DEPOT_ID, locationId: LOCATION_ID,
    subpositionId: null,
  };
  const transferInput = {
    materialId, from: position, to: destination, quantity: 1,
    idempotencyKey: 'e2e-r2-transfer-001',
    note: 'Homologação localhost',
  };
  const transferred = approved(await command('TRANSFER', transferInput),
    'transferência física');
  expect(transferred.applied).toBe(true);
  expect(transferred.balance.quantity).toBe(4);
  expect(transferred.fromBalance.quantity).toBe(3);
  expect(transferred.toBalance.quantity).toBe(1);
  const transferReplay = approved(await command('TRANSFER', transferInput),
    'replay de transferência');
  expect(transferReplay.applied).toBe(false);
  rejected(await command('TRANSFER', {
    ...transferInput, quantity: 99, idempotencyKey: 'e2e-r2-transfer-excess',
  }), 'transferência acima do saldo');
  expect(numeric(await getFirestoreDoc(request, 'balances', materialId))).toBe(4);
  console.log('LOCALHOST TRANSFER: PASS | projeções e saldo global preservados');

  const inventory = approved(await command('INVENTORY_START', {
    scope: {
      kind: 'SUBPOSITION', depotId: DEPOT_ID, locationId: LOCATION_ID,
      subpositionId: SUBPOSITION_ID,
    },
  }), 'inventário em subposição');
  const invId = inventory.session.id;
  expect(inventory.session.status).toBe('COUNTING');
  expect(inventory.session.itemCount).toBe(1);
  const itemListResponse = await request.get(
    WAREHOUSE + '/inventories/' + invId + '/items', {
      headers: { authorization: 'Bearer owner' },
    });
  expect(itemListResponse.ok()).toBe(true);
  const inventoryItems = (await itemListResponse.json()).documents || [];
  expect(inventoryItems).toHaveLength(1);
  const inventoryItemId = inventoryItems[0].name.split('/').at(-1);
  const countInput = { inventoryId: invId, itemId: inventoryItemId, countedQuantity: 3 };
  rejected(await command('INVENTORY_REVIEW', { inventoryId: invId }),
    'inventário sem contagem não é revisado');
  const counted = approved(await command('INVENTORY_COUNT', countInput),
    'contagem física');
  expect(counted.status).toBe('MATCHED');
  expect(counted.difference).toBe(0);
  const reviewed = approved(await command('INVENTORY_REVIEW', { inventoryId: invId }),
    'revisão de inventário');
  expect(reviewed.matchedItems).toBe(1);
  approved(await command('INVENTORY_BEGIN_CONFIRM', { inventoryId: invId }),
    'início de confirmação');
  approved(await command('INVENTORY_FINISH_CONFIRM', { inventoryId: invId }),
    'fim de confirmação');
  const confirmed = await getFirestoreDoc(request, 'inventories', invId);
  expect(confirmed.fields.status.stringValue).toBe('CONFIRMED');
  expect(numeric(await getFirestoreDoc(request, 'balances', materialId))).toBe(4);
  rejected(await command('INVENTORY_CANCEL', { inventoryId: invId }),
    'inventário finalizado não pode ser cancelado');
  console.log('LOCALHOST INVENTORY: PASS | contagem, revisão, confirmação e saldo');

  console.log('WAREHOUSE LOCALHOST ACCEPTANCE: PASS | Auth + saída + devolução + transferência + inventário');
});
