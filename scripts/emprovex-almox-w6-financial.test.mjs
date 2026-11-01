import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALMOX_DEFAULT_CLASS, assertAlmoxFinanceScope, getAlmoxDefaultClass,
  getAlmoxFinanceClasses, summarizeAlmoxFinancial, validateAlmoxRemittances,
} from '../features/almoxarifado/financeiro/sectorFinancialPolicy.ts';

const workspace = {
  status: 'sector', accountType: 'sector', sectorType: 'almoxarifado',
  workspaceId: 'almox-om-x', canLoadOperationalData: true,
  legacyDataMode: false, legacySettingsMode: false,
};
const operational = { workspaceId: 'almox-om-x', legacyDataMode: false, legacySettingsMode: false };
const empenho = {
  id: '2026NE000066', supplier: 'Fornecedor sintético', supplierCnpj: '00000000000000',
  description: 'Material de expediente', date: '2026-10-31', status: 'Ativo',
  classification: 'FUNADOM',
  items: [
    { id: 'a', name: 'Papel', unit: 'resma', quantity: 10, received: 4, unitPrice: 10 },
    { id: 'b', name: 'Caneta', unit: 'unidade', quantity: 5, received: 0, unitPrice: 20 },
  ],
};
const invoice = {
  id: 'NF01', recordKey: 'nf-key-1', empenhoId: empenho.id, issueDate: '2026-10-30',
  items: [{ itemId: 'a', quantity: 4, unitPrice: 10, subtotal: 40 }],
  totalValue: 40, supplier: empenho.supplier,
};
const schedule = {
  id: 'crono_' + empenho.id, empenhoId: empenho.id,
  dataCriacao: '2026-11-01', colunasEntregas: [
    { id: 'r1', titulo: 'Primeira', dataPrevista: '2026-11-15' },
    { id: 'r2', titulo: 'Segunda', dataPrevista: '2026-12-01' },
  ],
  distribuicao: { a: { r1: 2, r2: 4 }, b: { r1: 3, r2: 2 } },
};

test('P0: não autoriza outro tenant, UG igual, UID trocado, modo legado ou modalidade errada', () => {
  assert.doesNotThrow(() => assertAlmoxFinanceScope(workspace, operational, 'uid-1', 'uid-1'));
  for (const altered of [
    { ...operational, workspaceId: 'outro-tenant' },
    { ...operational, legacyDataMode: true },
  ]) {
    assert.throws(() => assertAlmoxFinanceScope(workspace, altered, 'uid-1', 'uid-1'), /WORKSPACE_DENIED/);
  }
  for (const altered of [
    { ...workspace, sectorType: 'aprovisionamento' },
    { ...workspace, sectorType: undefined },
    { ...workspace, canLoadOperationalData: false },
    { ...workspace, workspaceId: 'outro-tenant' },
    { ...workspace, accountType: 'company' },
  ]) {
    assert.throws(() => assertAlmoxFinanceScope(altered, operational, 'uid-1', 'uid-1'), /WORKSPACE_DENIED/);
  }
  assert.throws(() => assertAlmoxFinanceScope(workspace, operational, 'uid-2', 'uid-1'), /WORKSPACE_DENIED/);
  assert.throws(() => assertAlmoxFinanceScope(workspace, operational, null, 'uid-1'), /WORKSPACE_DENIED/);
});

test('P0: classificação almox sem QR/CALI/PASA e legado intacto', () => {
  const original = [
    { code: 'QR', description: 'Rancho', requiresTermoRecebimento: true },
    { code: 'CALI', description: 'Alimentação', requiresTermoRecebimento: true },
    { code: 'PASA', description: 'Alimentação', requiresTermoRecebimento: false },
    { code: 'FUNADOM', description: 'Administração', requiresTermoRecebimento: false },
    { code: 'TECNICO', description: 'Técnicos', requiresTermoRecebimento: true },
  ];
  const filtered = getAlmoxFinanceClasses(original);
  assert.deepEqual(filtered.map(x => x.code), ['FUNADOM', 'TECNICO']);
  assert.ok(filtered.every(x => !x.requiresTermoRecebimento));
  assert.equal(original[0].requiresTermoRecebimento, true);
  assert.equal(original[4].requiresTermoRecebimento, true);
  assert.equal(getAlmoxDefaultClass('QR'), ALMOX_DEFAULT_CLASS);
  assert.equal(getAlmoxDefaultClass('TECNICO'), 'TECNICO');
});

test('P0: saldo e recebimento parcial vêm do mesmo empenho e NF não duplica baixa', () => {
  const result = summarizeAlmoxFinancial(empenho, [invoice, { ...invoice }], [schedule]);
  assert.equal(result.exerciseYear, 2026);
  assert.equal(result.totalCommitted, 200);
  assert.equal(result.totalReceived, 40);
  assert.equal(result.remainingValue, 160);
  assert.equal(result.invoiceCount, 1);
  assert.equal(result.invoiceTotal, 40);
  assert.equal(result.remittanceCount, 2);
  assert.equal(result.lines[0].remainingQuantity, 6);
  assert.equal(result.lines[0].scheduledQuantity, 6);
});

test('P0: planejamento parcial funciona; excesso, item externo e remessa inválida bloqueados', () => {
  assert.deepEqual(validateAlmoxRemittances(empenho, schedule), []);
  assert.deepEqual(
    validateAlmoxRemittances(empenho, { ...schedule, distribuicao: { a: { r1: 2 }, b: { r2: 1 } } }), []
  );
  assert.ok(validateAlmoxRemittances(empenho, {
    ...schedule, distribuicao: { a: { r1: 7 }, b: { r1: 1 } }
  }).includes('EXCEEDS_REMAINING_BALANCE'));
  assert.ok(validateAlmoxRemittances(empenho, {
    ...schedule, distribuicao: { a: { r1: -1 }, unknown: { r2: 1 } }
  }).includes('UNKNOWN_ITEM'));
  assert.ok(validateAlmoxRemittances(empenho, {
    ...schedule, colunasEntregas: [schedule.colunasEntregas[0], schedule.colunasEntregas[0]]
  }).includes('DUPLICATE_REMESSA'));
});

test('P0: adapter não cria coleção financeira paralela nem chama mutação no Warehouse', () => {
  const adapter = readFileSync(new URL('../features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx', import.meta.url), 'utf8');
  const policy = readFileSync(new URL('../features/almoxarifado/financeiro/sectorFinancialPolicy.ts', import.meta.url), 'utf8');
  assert.match(adapter, /getCurrentOperationalScope/);
  assert.match(adapter, /<EmpenhosView/);
  assert.match(adapter, /<NotasFiscaisView/);
  assert.match(adapter, /<CronogramasView/);
  assert.doesNotMatch(adapter + policy, /commitWarehouse|applyWarehouseMovement|warehouseFirestoreTransaction|setDoc\(|addDoc\(/);
  assert.match(adapter, /handleMarkComissao: unsupported/);
  assert.match(adapter, /handleTermoRecebimentoAction: unsupported/);
});
