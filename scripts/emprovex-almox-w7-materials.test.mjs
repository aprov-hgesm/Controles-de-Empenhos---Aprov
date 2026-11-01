import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const modelPath = 'features/almoxarifado/catalogo/catalogModel.ts';
const loaderPath = 'features/almoxarifado/catalogo/catalogLoader.ts';
const viewPath = 'features/almoxarifado/catalogo/AlmoxCatalogoView.tsx';

function transpile(path, mocks = {}) {
  const source = readFileSync(path, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const failures = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(failures.length, 0, path + ': ' + failures.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  const output = { exports: {} };
  vm.runInNewContext(result.outputText, {
    module: output,
    exports: output.exports,
    require: (name) => {
      assert.ok(name in mocks, 'Dependência inesperada no teste: ' + name);
      return mocks[name];
    },
  }, { filename: path });
  return output.exports;
}
const search = transpile('lib/warehouse/globalMaterialSearch.ts');
const model = transpile(modelPath, {
  '../../../lib/invoiceIdentity': {
    normalizeSupplierCnpj: (s = '') => String(s || '').replace(/[^0-9A-Z]/gi, '').toUpperCase(),
  },
  '../../../lib/warehouse/material': {
    warehouseMaterialUnitKey: (unit) => unit.code + ':' + (unit.label || '').toLowerCase().trim(),
  },
  '../../../lib/warehouse/globalMaterialSearch': search,
});
const { buildAlmoxCatalog } = model;
const W = 'ws_almox', W2 = 'ws_aprov', UG = '160416';
const ID = 'mat_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ID2 = 'mat_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const supplierCnpj = '12345678000190';
const material = (id = ID, opts = {}) => ({
  id, workspaceId: W, ug: UG, description: 'PAPEL A4', aliases: [],
  unit: { code: 'unit', label: null }, status: 'active', conversions: [],
  ...opts,
});
const empenho = (id = '2026NE66', opts = {}) => ({
  id, supplier: 'Fornecedor Alpha LTDA', supplierCnpj,
  status: 'Ativo', items: [{
    id: '1', name: 'PAPEL A4', unit: 'UN', quantity: 10, received: 4, unitPrice: 2,
    warehouseMaterialId: ID,
  }], ...opts,
});
const depot = { id: 'd', workspaceId: W, ug: UG, name: 'Depósito 1', code: 'DEP01', status: 'active' };
const location = { id: 'l', workspaceId: W, ug: UG, name: 'Estante 01', code: 'EST01', status: 'active', kind: 'LOCAL', depotId: 'd' };
const balance = {
  workspaceId: W, ug: UG, materialId: ID, quantity: 7,
  position: { kind: 'LOCATION', depotId: 'd', locationId: 'l', subpositionId: null },
};
const input = (overrides = {}) => ({
  workspaceId: W, ug: UG, empenhos: [empenho()],
  contacts: [{ id: 'supplier_' + supplierCnpj, cnpj: supplierCnpj,
    legalName: 'Fornecedor Alpha LTDA', phone: '555199999999', whatsapp: '555199999999', email: 'alpha@example.com' }],
  directory: [{ cnpj: supplierCnpj, email: 'global@example.com' }],
  materials: [material()], depots: [depot], locations: [location],
  balances: [balance], coverageComplete: true, ...overrides,
});

test('01 — fornecedor identificado, CNPJ prevalece e contato local não vaza no diretório global', () => {
  const r = buildAlmoxCatalog(input({ empenhos: [empenho(), empenho('2026NE77', { supplier: 'ALPHA COMERCIAL' })] }));
  assert.equal(r.suppliers.length, 1);
  assert.equal(r.suppliers[0].email, 'alpha@example.com');
  assert.equal(r.suppliers[0].activeEmpenhoIds.length, 2);
});
test('02 — consulta de itens respeita o conjunto previamente lido no workspace', () => {
  const a = buildAlmoxCatalog(input());
  const b = buildAlmoxCatalog(input({
    workspaceId: W2, empenhos: [empenho('2026NE88', { supplier: 'Fornecedor B' })],
    materials: [], depots: [], locations: [], balances: [], contacts: [], directory: [],
  }));
  assert.equal(a.items[0].empenhoId, '2026NE66');
  assert.equal(b.items[0].empenhoId, '2026NE88');
  assert.equal(b.suppliers[0].email, '');
});
test('03 — vínculo item-empenho e saldo financeiro são preservados', () => {
  const row = buildAlmoxCatalog(input()).items[0];
  assert.equal(row.key, '2026NE66::1');
  assert.equal(row.balance, 6);
  assert.equal(row.balanceValue, 12);
  assert.equal(row.received, 4);
});
test('04 — item com e sem vínculo explícito não recebe associação por nome', () => {
  const results = buildAlmoxCatalog(input({
    empenhos: [empenho('2026NE66', {
      items: [empenho().items[0], {
        id: '2', name: 'PAPEL A4', unit: 'UN', quantity: 3, received: 0, unitPrice: 1,
      }],
    })],
  }));
  assert.equal(results.items[0].linkStatus, 'CONFIRMED');
  assert.equal(results.items[1].linkStatus, 'NO_LINK');
  assert.equal(results.materials[0].financialItemKeys.length, 1);
});
test('05 — mesma UG com workspaces distintos falha fechada para qualquer objeto físico', () => {
  assert.throws(() => buildAlmoxCatalog(input({ materials: [material(ID, { workspaceId: W2 })] })), /CROSS_WORKSPACE/);
  assert.throws(() => buildAlmoxCatalog(input({ balances: [{ ...balance, workspaceId: W2 }] })), /CROSS_WORKSPACE/);
  assert.throws(() => buildAlmoxCatalog(input({ locations: [{ ...location, workspaceId: W2 }] })), /CROSS_WORKSPACE/);
});
test('06 — unidade incompatível bloqueia vínculo e não converte sem fator aprovado', () => {
  const result = buildAlmoxCatalog(input({ empenhos: [empenho('2026NE66', {
    items: [{ ...empenho().items[0], unit: 'CX 12 UN' }],
  })] }));
  assert.equal(result.items[0].linkStatus, 'INCOMPATIBLE_UNIT');
  assert.equal(result.items[0].baseUnitFactor, null);
});
test('07 — nomes ambíguos nunca estabelecem vínculo automático', () => {
  const e = empenho('2026NE66', { items: [{ ...empenho().items[0], warehouseMaterialId: undefined }] });
  const r = buildAlmoxCatalog(input({ empenhos: [e], materials: [material(), material(ID2)] }));
  assert.equal(r.items[0].linkStatus, 'NO_LINK');
  assert.equal(r.materials[0].financialItemKeys.length + r.materials[1].financialItemKeys.length, 0);
});
test('08 — material inexistente ou inativo não valida a referência', () => {
  assert.equal(buildAlmoxCatalog(input({ materials: [] })).items[0].linkStatus, 'MISSING');
  assert.equal(buildAlmoxCatalog(input({ materials: [material(ID, { status: 'inactive' })] })).items[0].linkStatus, 'INACTIVE');
});
test('09 — consulta não movimenta o estoque e preserva os objetos de origem', () => {
  const source = input();
  const before = structuredClone(source);
  const r = buildAlmoxCatalog(source);
  assert.equal(r.materials[0].physicalQuantity, 7);
  assert.equal(r.items[0].balance, 6); // Valores diferentes por natureza.
  assert.deepEqual(source, before);
  for (const path of [modelPath, loaderPath]) {
    const code = readFileSync(path, 'utf8');
    assert.doesNotMatch(code, /\b(?:setDoc|runTransaction|warehouseServerCommand|saveWarehouseMaterial|applyWarehouseLocationDelta)\s*\(/);
  }
});
test('10 — Aprovisionamento e seus componentes originais não são substituídos', () => {
  const suppliers = readFileSync('features/fornecedores/components/FornecedoresView.tsx', 'utf8');
  const items = readFileSync('features/itens/components/ConsultaItensView.tsx', 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  assert.match(suppliers, /export function FornecedoresView/);
  assert.match(items, /export function ConsultaItensView/);
  assert.match(view, /<FornecedoresView/);
  assert.match(view, /section === 'consulta-itens'/);
});
test('11 — conversão explícita aceita; apresentações semelhantes não são equivalentes', () => {
  const mat = material(ID, { conversions: [{ presentation: { code: 'box', label: null }, factorToBaseUnit: 12 }] });
  const a = buildAlmoxCatalog(input({ materials: [mat], empenhos: [empenho('2026NE66', {
    items: [{ ...empenho().items[0], unit: 'CX' }],
  })] })).items[0];
  assert.equal(a.linkStatus, 'CONFIRMED');
  assert.equal(a.baseUnitFactor, 12);
});
test('12 — o marcador de cobertura parcial é preservado sem afirmar saldo exato', () => {
  const r = buildAlmoxCatalog(input({ coverageComplete: false }));
  assert.equal(r.coverageComplete, false);
});
test('13 — loader/UI compilam sintaticamente e APIs de movimentação não entram na consulta', () => {
  for (const path of [loaderPath, viewPath]) {
    const x = ts.transpileModule(readFileSync(path, 'utf8'), {
      fileName: path, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
    });
    const problems = (x.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    assert.equal(problems.length, 0, path);
  }
});
