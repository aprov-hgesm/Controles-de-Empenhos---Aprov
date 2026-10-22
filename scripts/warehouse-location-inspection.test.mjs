import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('lib/warehouse/locationContents.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const equalPositions = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);
runInNewContext(compiled, {
  exports,
  require: (name) => {
    assert.equal(name, './location');
    return { warehouseStockPositionsEqual: equalPositions };
  },
});

const { deriveWarehouseLocationContents, warehouseLocationExpiry, warehouseLocationExpiryStatus } = exports;
const depot = 'dep_1';
const local = 'loc_1';
const posA = { kind: 'SUBPOSITION', depotId: depot, locationId: local, subpositionId: 'sub_a' };
const posB = { kind: 'SUBPOSITION', depotId: depot, locationId: local, subpositionId: 'sub_b' };
const posDirect = { kind: 'LOCATION', depotId: depot, locationId: local, subpositionId: null };
const material = (id, description) => ({ id, description, unit: { code: 'unit', label: null } });
const balance = (materialId, position, quantity) => ({ materialId, position, quantity });
const lot = (id, materialId, position, quantity, expiresOn) => ({
  id, materialId, position, quantity, expiresOn, code: 'L-' + id, status: 'active',
});
const locations = [
  { id: local, kind: 'LOCAL', depotId: depot, status: 'active', code: 'EST01', name: 'Estante 1' },
  { id: 'sub_b', kind: 'SUBPOSITION', parentLocationId: local, depotId: depot, status: 'active', code: 'P2', name: 'Prateleira 2' },
  { id: 'sub_a', kind: 'SUBPOSITION', parentLocationId: local, depotId: depot, status: 'active', code: 'P1', name: 'Prateleira 1' },
];

test('agrupa por prateleira, preserva saldo oficial e não mistura lotes de outras posições', () => {
  const result = deriveWarehouseLocationContents(
    local, locations,
    [balance('mat_a', posA, 10), balance('mat_b', posB, 5), balance('mat_a', posDirect, 2),
      balance('mat_a', { ...posA, depotId: 'dep_outro' }, 99)],
    [material('mat_a', 'Água'), material('mat_b', 'Arroz')],
    [lot('1', 'mat_a', posA, 4, '2027-01-20'), lot('2', 'mat_a', posB, 2, '2028-01-20')]
  );
  assert.ok(result);
  assert.equal(result.rowCount, 3);
  assert.equal(result.materialCount, 2);
  assert.deepEqual(Array.from(result.groups, (g) => g.code), ['P1', 'P2', 'LOCAL']);
  assert.equal(result.groups[0].rows[0].quantity, 10);
  assert.deepEqual(Array.from(result.groups[0].rows[0].lots, (l) => l.id), ['1']);
  assert.equal(result.groups[0].rows[0].quantityWithoutLot, 6);
  assert.equal(result.groups[1].rows[0].quantityWithoutLot, 5);
  assert.equal(result.hasLotDiscrepancy, false);
});

test('sinaliza lotes superiores ao saldo sem alterar quantidade', () => {
  const result = deriveWarehouseLocationContents(
    local, locations, [balance('mat_a', posA, 3)],
    [material('mat_a', 'Água')], [lot('1', 'mat_a', posA, 9, null)]
  );
  assert.equal(result.groups[0].rows[0].quantity, 3);
  assert.equal(result.groups[0].rows[0].lotQuantityExceedsBalance, true);
  assert.equal(result.hasLotDiscrepancy, true);
});

test('não exibe local inativo e mantém descrição de material ausente visível', () => {
  const empty = deriveWarehouseLocationContents(
    local, locations.map((x) => x.id === local ? { ...x, status: 'inactive' } : x), [], [], []
  );
  assert.equal(empty, null);
  const result = deriveWarehouseLocationContents(
    local, locations, [balance('mat_ausente', posDirect, 1)], [], []
  );
  assert.match(result.groups[0].rows[0].description, /Material não localizado/);
});

test('validades ISO são apresentadas no padrão brasileiro', () => {
  assert.equal(warehouseLocationExpiry('2027-04-05'), '05/04/2027');
  assert.equal(warehouseLocationExpiry(null), 'Não informada');
});

test('validade: vencido, até 14 dias inclusive e período normal', () => {
  const today = new Date(2026, 9, 21);
  assert.equal(warehouseLocationExpiryStatus('2026-10-20', today), 'expired');
  assert.equal(warehouseLocationExpiryStatus('2026-10-21', today), 'soon');
  assert.equal(warehouseLocationExpiryStatus('2026-11-04', today), 'soon');
  assert.equal(warehouseLocationExpiryStatus('2026-11-05', today), 'normal');
  assert.equal(warehouseLocationExpiryStatus(null, today), 'none');
});

test('interface possui interação e relatório somente leitura com carregamento tardio', () => {
  const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const croquis = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  const dialog = read('features/warehouse/components/WarehouseLocationInspection.tsx');
  const pdf = read('features/warehouse/pdf/WarehouseLocationContentsPdf.ts');
  const lab = read('app/visual-lab/inspecao-locais/page.tsx');
  const fixture = read('features/warehouse/components/WarehouseLocationInspectionLocalPreview.tsx');
  assert.match(lab, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(fixture, /WarehouseIsometricPreview/);
  assert.match(fixture, /warehouse-location-inspection-lab/);
  assert.doesNotMatch(lab + fixture, /from ['"][^'"]*firebase|setDoc\(|runTransaction\(/);
  assert.match(preview, /data-testid=\{interactive \? 'warehouse-location-interactive'/);
  assert.match(preview, /onPointerEnter=/);
  assert.match(preview, /onClick=\{handleOpen\}/);
  assert.match(croquis, /listWarehouseLots\(workspaceId, 500\)/);
  assert.match(croquis, /onInspectLocation=/);
  assert.match(dialog, /data-testid="warehouse-location-download-pdf"/);
  assert.match(dialog, /lotState === 'ready' && barcodeState === 'ready' && complete/);
  assert.match(dialog, /warehouse-location-material-editor/);
  assert.match(dialog, /saveWarehouseMaterial\(/);
  assert.match(dialog, /updateWarehouseLot\(/);
  assert.match(pdf, /Código de barras/);
  assert.match(pdf, /warehouseLocationExpiryStatus/);
  assert.match(pdf, /loadJsPdfWithAutoTable\(\)/);
  for (const content of [source, dialog, pdf]) {
    assert.doesNotMatch(content, /setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/);
  }
});
