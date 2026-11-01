/** W8: contrato determinístico de leitura. Usa motores financeiros reais com fixtures isoladas. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const exports = {};
  modules.set(path, exports);
  const result = ts.transpileModule(read(path), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length || 0, 0);
  runInNewContext(result.outputText, {
    exports,
    require(id) {
      const files = {
        '../../../lib/supplierReporting': 'lib/supplierReporting.ts',
        './invoiceIdentity': 'lib/invoiceIdentity.ts',
      };
      assert.ok(files[id], 'W8 unexpected runtime import ' + path + ' => ' + id);
      return load(files[id]);
    },
    console, Map, Set, Object, Array, Number, Math, Date, String, RegExp, Intl,
  }, { filename: path });
  return exports;
}
const financialLib = load('lib/supplierReporting.ts');
const w8 = load('features/almoxarifado/relatorios/reportModel.ts');
const ws = 'almox-om-1';
const otherWs = 'almox-om-2';
const cnpj = '11444777000161';
const empenho = (id, supplierCnpj = cnpj) => ({
  id, supplier: 'Fornecedor de Material', supplierCnpj,
  date: '2026-09-12', items: [
    { id: '1', name: 'PAPEL A4', quantity: 10, unitPrice: 15, received: 5, unit: 'UN' },
  ], status: 'Ativo', description: 'Expediente',
});
const invoice = (id, empenhoId) => ({
  id, empenhoId, issueDate: '2026-10-10', items: [
    { itemId: '1', quantity: 5, unitPrice: 15, subtotal: 75 },
  ], totalValue: 75, supplier: 'Fornecedor de Material', supplierCnpj: cnpj,
});
const finance = (extra = {}) => ({
  workspaceId: ws, empenhos: [empenho('2026NE00001')], invoices: [invoice('NF-1', '2026NE00001')],
  completeness: 'complete', ...extra,
});
const material = { workspaceId: ws, id: 'mat-1', status: 'active', description: 'Papel A4',
  unit: { code: 'unit', label: 'Resma' } };
const depot = { workspaceId: ws, id: 'dep-1', status: 'active', name: 'Depósito 01', code: 'DEP-01' };
const location = { workspaceId: ws, id: 'loc-1', status: 'active',
  code: 'EST-01', name: 'Estante 01', depotId: 'dep-1' };
const position = { kind: 'LOCATION', depotId: 'dep-1', locationId: 'loc-1', subpositionId: null };
const logistical = (extra = {}) => ({
  workspaceId: ws,
  materials: [material],
  depots: [{ depot }],
  locations: [{ location }],
  locationBalances: [{ balance: { workspaceId: ws, id: 'locbal-1', materialId: 'mat-1', position, quantity: 8 } }],
  lots: [{ lot: { id: 'lot-1', workspaceId: ws, materialId: 'mat-1',
    status: 'active', quantity: 8, expiresOn: '2026-10-30' } }],
  movements: [{ movement: { id: 'mov-1', workspaceId: ws, materialId: 'mat-1',
    quantityDelta: -2, type: 'OUTBOUND' }, createdAt: '2026-10-30T09:00:00Z' }],
  limits: { materials: 250, depots: 100, locations: 250, locationBalances: 500, lots: 150, movements: 100 },
  ...extra,
});

test('1: relatório por empenho utiliza valores reais do cadastro (NE/NF)', () => {
  const result = w8.buildAlmoxFinancialReport(ws, finance());
  assert.equal(result.byEmpenho.length, 1);
  assert.equal(result.byEmpenho[0].committedValue, 150);
  assert.equal(result.byEmpenho[0].invoiceValue, 75);
  assert.equal(result.byEmpenho[0].balanceValue, 75);
  assert.equal(result.byEmpenho[0].year, '2026');
});

test('2: fornecedor compartilha o agregador certificado do Aprovisionamento', () => {
  const source = finance();
  const legacy = financialLib.buildSupplierReports(source.empenhos, source.invoices);
  const result = w8.buildAlmoxFinancialReport(ws, source);
  assert.equal(result.suppliers.length, legacy.length);
  assert.equal(result.suppliers[0].totalCommitted, legacy[0].totalCommitted);
  assert.equal(result.suppliers[0].totalReceived, legacy[0].totalReceived);
});

test('3: materiais, depósitos, posições e validades têm fontes distintas', () => {
  const x = w8.buildAlmoxWarehouseReport(ws, logistical(), '2026-11-01');
  assert.equal(x.materialCount, 1);
  assert.equal(x.depotCount, 1);
  assert.equal(x.locationCount, 1);
  assert.equal(x.positionCount, 1);
  assert.equal(x.expiredLotCount, 1);
  assert.equal(x.movements.length, 1);
});

test('4: não confundir quantidades físicas e valores em R$', () => {
  const f = w8.buildAlmoxFinancialReport(ws, finance());
  const l = w8.buildAlmoxWarehouseReport(ws, logistical(), '2026-11-01');
  assert.equal(f.committedValue, 150);
  assert.equal(l.positions[0].quantity, 8);
  assert.equal(l.positions[0].unit, 'Resma');
  assert.equal(f.invoiceValue, 75);
});

test('5: workspace vazio é zero apenas quando realmente consultado', () => {
  const f = w8.buildAlmoxFinancialReport(ws, finance({ empenhos: [], invoices: [] }));
  const l = w8.buildAlmoxWarehouseReport(ws, logistical({
    materials: [], depots: [], locations: [], locationBalances: [], lots: [], movements: [],
  }), '2026-11-01');
  assert.equal(f.empenhoCount, 0);
  assert.equal(f.invoiceValue, 0);
  assert.equal(l.materialCount, 0);
  assert.equal(l.movementCount, 0);
});

test('6: recorte com registros exige reconhecer cobertura parcial', () => {
  const result = w8.buildAlmoxFinancialReport(ws, finance({ completeness: 'partial' }));
  assert.equal(result.complete, false);
  const limited = w8.buildAlmoxWarehouseReport(ws, logistical({
    limits: { ...logistical().limits, materials: 1 },
  }), '2026-11-01');
  assert.equal(limited.truncated.materials, true);
});

test('7: negação de acesso cruzado no contrato e em toda entidade logística', () => {
  assert.throws(() => w8.buildAlmoxFinancialReport(otherWs, finance()), /WORKSPACE_MISMATCH/);
  assert.throws(() => w8.buildAlmoxWarehouseReport(otherWs, logistical(), '2026-11-01'), /WORKSPACE_MISMATCH/);
  assert.throws(() => w8.buildAlmoxWarehouseReport(ws, logistical({
    materials: [{ ...material, workspaceId: otherWs }],
  }), '2026-11-01'), /WORKSPACE_MISMATCH/);
  assert.throws(() => w8.buildAlmoxWarehouseReport(ws, logistical({
    movements: [{ movement: { ...logistical().movements[0].movement, workspaceId: otherWs } }],
  }), '2026-11-01'), /WORKSPACE_MISMATCH/);
});

test('8: Aprovisionamento mantém o cálculo original sem mutações', () => {
  const source = finance();
  const original = JSON.stringify(source);
  const oldResult = financialLib.buildSupplierReports(source.empenhos, source.invoices);
  w8.buildAlmoxFinancialReport(ws, source);
  assert.equal(JSON.stringify(source), original);
  assert.equal(financialLib.buildSupplierReports(source.empenhos, source.invoices)[0].balance, oldResult[0].balance);
});

test('9: não cria pedidos ou saldos demonstrativos; NF órfã não entra na soma', () => {
  const result = w8.buildAlmoxFinancialReport(ws,
    finance({ invoices: [invoice('NF-2', 'NE-DE-OUTRO-WORKSPACE')] }));
  assert.equal(result.invoiceValue, 0);
  assert.equal(result.unmatchedInvoiceCount, 1);
  const empty = w8.buildAlmoxWarehouseReport(ws, logistical({
    materials: [], depots: [], locations: [], locationBalances: [], lots: [], movements: [],
  }), '2026-11-01');
  assert.equal(empty.positions.length, 0);
});

test('10: relatórios W8 não expõem APIs de escrita/baixa nem componente mutável legado', () => {
  const view = read('features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx');
  const model = read('features/almoxarifado/relatorios/reportModel.ts');
  assert.doesNotMatch(view + model, /\b(?:applyWarehouseMovement|transferWarehouseStock|saveWarehouseMaterial|returnWarehouseStockOutbound|setWarehouseConsumptionSiscofisStatus|warehouseServerCommand|runTransaction|writeBatch|setDoc|updateDoc)\b/);
  assert.doesNotMatch(view, /<WarehouseConsumptionReports|<WarehouseStockOperational|<HistoricalConsistencyView|<SagImportView/);
  assert.match(view, /getCurrentOperationalScope/);
  assert.match(view, /data-visual-mode/);
  assert.match(view, /WarehouseInventoryHistoryReport/);
  assert.match(view, /WarehouseSiscofisHistoryReport/);
});

test('isolamento adicional: não apresentar documento SISCOFIS sintético como pedido real', () => {
  const view = read('features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx');
  assert.doesNotMatch(view, /ImportedRequestV1|parseSiscofisRequest|previewAlmoxSyntheticRequest/);
});

test('não existe mutação do snapshot logístico durante apuração', () => {
  const source = logistical();
  const before = JSON.stringify(source);
  w8.buildAlmoxWarehouseReport(ws, source, '2026-11-01');
  assert.equal(JSON.stringify(source), before);
});
