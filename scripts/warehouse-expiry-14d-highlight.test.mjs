import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const src = read('lib/warehouse/expiryLocationHighlight.ts');
const compiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compiled, {
  exports,
  require: (name) => {
    assert.equal(name, './location');
    return { warehouseStockPositionsEqual: (left, right) =>
      JSON.stringify(left) === JSON.stringify(right) };
  },
});
const { warehouseExpiryDayWithin, warehouseLocationsExpiringSoon } = exports;

const today = new Date(2026, 9, 16, 12, 0, 0);
const depotId = 'dep_a';
const pos = (locationId, subpositionId = null) => subpositionId
  ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
  : { kind: 'LOCATION', depotId, locationId, subpositionId: null };
const balance = (id, locationId, quantity, subpositionId = null) => ({
  materialId: id, quantity, position: pos(locationId, subpositionId),
});
const lot = (id, locationId, expiresOn, quantity = 1, subpositionId = null) => ({
  materialId: id, position: pos(locationId, subpositionId),
  expiresOn, quantity, status: 'active',
});

test('prazo inclusivo: hoje e 14 dias destacam, ontem e 15 dias não', () => {
  assert.equal(warehouseExpiryDayWithin('2026-10-16', today), true);
  assert.equal(warehouseExpiryDayWithin('2026-10-30', today), true);
  assert.equal(warehouseExpiryDayWithin('2026-10-31', today), false);
  assert.equal(warehouseExpiryDayWithin('2026-10-15', today), false);
  assert.equal(warehouseExpiryDayWithin(null, today), false);
});

test('considera virada de ano e valida datas civis', () => {
  const dec = new Date(2026, 11, 29, 8);
  assert.equal(warehouseExpiryDayWithin('2027-01-12', dec), true);
  assert.equal(warehouseExpiryDayWithin('2027-01-13', dec), false);
  assert.equal(warehouseExpiryDayWithin('2026-02-30', today), false);
});

test('destaca apenas lote ativo com saldo positivo na mesma subposição', () => {
  const balances = [
    balance('leite', 'loc_1', 12, 'sub_1'),
    balance('leite', 'loc_2', 4),
    balance('arroz', 'loc_3', 10),
  ];
  const lots = [
    lot('leite', 'loc_1', '2026-10-25', 3, 'sub_1'),
    lot('leite', 'loc_2', '2026-11-03', 4),
    lot('arroz', 'loc_3', '2026-10-15', 2),
    lot('leite', 'loc_1', '2026-10-27', 5, 'sub_99'),
    { ...lot('leite', 'loc_2', '2026-10-18'), status: 'inactive' },
  ];
  const result = warehouseLocationsExpiringSoon(balances, lots, today);
  assert.deepEqual(Array.from(result), ['loc_1']);
});

test('sem saldo positivo, sem lote, vencido ou com posição não atribuída não alerta', () => {
  const balances = [
    balance('a', 'loc_1', 0),
    balance('b', 'loc_2', 2),
    balance('c', 'loc_3', 2),
  ];
  const lots = [
    lot('a', 'loc_1', '2026-10-16'),
    lot('b', 'loc_2', '2026-10-15'),
    lot('c', 'loc_3', null),
    { ...lot('c', 'loc_3', '2026-10-20'), position: { kind: 'UNASSIGNED' } },
  ];
  assert.equal(warehouseLocationsExpiringSoon(balances, lots, today).size, 0);
});

test('croqui mantém cores de pesquisa e inspeção e busca de lotes somente ao abrir', () => {
  const scene = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const croquis = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  const lab = read('app/visual-lab/alerta-vencimento-14d/page.tsx');
  const fixture = read('features/warehouse/components/WarehouseLocationInspectionLocalPreview.tsx');
  assert.match(lab, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(lab, /showExpiryWarnings/);
  assert.match(fixture, /dateAfter\(7\)/);
  assert.match(fixture, /dateAfter\(14\)/);
  assert.doesNotMatch(lab + fixture, /from ['"][^'"]*firebase|setDoc\(|runTransaction\(/);
  assert.match(scene, /warehouseExpirySoftGlow/);
  assert.match(scene, /data-expiry-soon=\{nearExpiry/);
  assert.match(scene, /nearExpiry=\{nearExpiry\}/);
  assert.match(scene, /highlighted\s*\? 'url\(#warehouseGlowStrong\)'/);
  assert.match(scene, /warehouse-expiry-14d-legend/);
  assert.match(croquis, /listWarehouseLots\(workspaceId, 500\)/);
  assert.match(croquis, /setPreviewLotState\('ready'\)/);
  for (const text of [src, scene]) {
    assert.doesNotMatch(text, /setDoc\(|deleteDoc\(|runTransaction\(/);
  }
});
