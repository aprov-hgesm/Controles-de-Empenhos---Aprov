#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = process.cwd();
const out = mkdtempSync(resolve(tmpdir(), 'emprovex-3d-stock-'));
try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/stockVisual.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'ES2020',
    '--moduleResolution', 'node', '--skipLibCheck',
  ], { cwd: root, stdio: 'pipe' });
} catch (error) {
  rmSync(out, { recursive: true, force: true });
  throw error;
}
test.after(() => rmSync(out, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { warehouseVisualExpiryMap, warehouseVisualStackSlots, warehouseVisualExpiryCutoffDate, WAREHOUSE_VISUAL_EXPIRY_DAYS } =
  require(resolve(out, 'stockVisual.js'));

const depot = 'dep_01', location = 'loc_01', sub1 = 'sub_1', sub2 = 'sub_2';
const base = { kind: 'LOCATION', depotId: depot, locationId: location, subpositionId: null };
const child = (subpositionId) => ({ kind: 'SUBPOSITION', depotId: depot, locationId: location, subpositionId });
const balance = (materialId, position, quantity = 10) => ({ materialId, quantity, position });
const lot = (position, expiresOn, other = {}) => ({
  materialId: 'A', quantity: 4, position, status: 'active', expiresOn, ...other,
});
const today = new Date('2026-10-19T23:45:00.000Z');

test('14 dias inclusive acende amarelo; 15 dias não acende; vencido é vermelho', () => {
  assert.equal(WAREHOUSE_VISUAL_EXPIRY_DAYS, 14);
  assert.equal(warehouseVisualExpiryCutoffDate(today), '2026-11-02');
  const balances = [balance('A', base), balance('A', child(sub1)), balance('A', child(sub2))];
  const state = warehouseVisualExpiryMap(balances, [
    lot(base, '2026-11-02'),
    lot(child(sub1), '2026-11-03'),
    lot(child(sub2), '2026-10-18'),
  ], today);
  assert.equal(state.byBaseLocation.get(location), 'near');
  assert.equal(state.bySubposition.has(sub1), false, '15 dias deve ser normal');
  assert.equal(state.bySubposition.get(sub2), 'expired');
  assert.equal(state.byLocation.get(location), 'expired', 'local agrega a maior gravidade');
});

test('aviso permanece no local correto; mesmo material em outra posição não colore local vazio', () => {
  const balances = [balance('A', base), balance('A', child(sub1)), balance('B', child(sub2))];
  const state = warehouseVisualExpiryMap(balances, [
    lot(child(sub1), '2026-10-21', { materialId: 'B' }),
    lot(child(sub2), '2026-10-21', { materialId: 'A' }),
    lot({ ...base, locationId: 'loc_02' }, '2026-10-21'),
    lot({ ...base, depotId: 'dep_02' }, '2026-10-21'),
    lot({ kind: 'UNASSIGNED' }, '2026-10-21'),
  ], today);
  assert.equal(state.byLocation.size, 0, 'lotes sem saldo positivo na mesma posição não devem alertar');
});

test('inativo, zerado, sem validade, malformado e saldo zero não colorem caixa', () => {
  const balances = [balance('A', base), balance('B', child(sub1), 0)];
  const state = warehouseVisualExpiryMap(balances, [
    lot(base, '2026-10-25', { status: 'inactive' }),
    lot(base, '2026-10-25', { quantity: 0 }),
    lot(base, null),
    lot(base, '2026-02-30'),
    lot(child(sub1), '2026-10-25', { materialId: 'B' }),
  ], today);
  assert.equal(state.byLocation.size, 0);
});

test('datas UTC e ordem dos lotes determinam sempre a maior gravidade', () => {
  const balances = [balance('A', child(sub1))];
  const first = [lot(child(sub1), '2026-11-02'), lot(child(sub1), '2026-10-17')];
  const front = warehouseVisualExpiryMap(balances, first, today);
  const back = warehouseVisualExpiryMap(balances, first.slice().reverse(), today);
  assert.equal(front.bySubposition.get(sub1), 'expired');
  assert.deepEqual([...front.bySubposition], [...back.bySubposition]);
  assert.equal(warehouseVisualExpiryMap(balances, [
    lot(child(sub1), '2026-10-19'),
  ], new Date('2026-10-19T00:02:00.000Z')).bySubposition.get(sub1), 'near');
});

test('slots ficam dentro da superfície, são limitados e empilham segunda camada na mesma base', () => {
  for (const qty of [0, 1, 5, 20, 60, 120, 10000]) {
    const slots = warehouseVisualStackSlots(qty);
    assert.ok(slots.length <= 8);
    for (const slot of slots) {
      assert.ok(slot.u > 0 && slot.u < 1);
      assert.ok(slot.v > 0 && slot.v < 1);
      assert.ok(slot.layer === 0 || slot.layer === 1);
    }
  }
  assert.equal(warehouseVisualStackSlots(0).length, 0);
  assert.equal(warehouseVisualStackSlots(120).length, 8);
  assert.equal(warehouseVisualStackSlots(120, 6).length, 6);
  const slots = warehouseVisualStackSlots(120);
  for (let i = 0; i < 4; i++) {
    assert.equal(slots[i].u, slots[i + 4].u);
    assert.equal(slots[i].v, slots[i + 4].v);
    assert.equal(slots[i + 4].layer, 1);
  }
});

test('UI conecta lotes, boxes e brilho branco, sem writes, listeners ou nova regra Firestore', () => {
  const render = readFileSync(resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8');
  const appliance = readFileSync(resolve(root, 'features/warehouse/components/WarehouseColdAppliance3D.tsx'), 'utf8');
  const croquis = readFileSync(resolve(root, 'features/warehouse/components/WarehouseCroquisR1Operational.tsx'), 'utf8');
  const home = readFileSync(resolve(root, 'features/warehouse/components/WarehouseHomeOperational.tsx'), 'utf8');
  const repository = readFileSync(resolve(root, 'lib/warehouse/lotRepository.ts'), 'utf8');
  assert.match(croquis, /listWarehouseVisualExpiryLots\(workspaceId, 500\)/);
  assert.match(croquis, /croquiMode !== 'preview' \|\| previewLoaded/);
  assert.match(croquis, /lots=\{previewLots\}/);
  assert.match(croquis, /previewLotsLimited/);
  assert.match(home, /listWarehouseVisualExpiryLots\(workspaceId, 500\)/);
  assert.match(home, /lots=\{previewLotsLoadedForDepot === selectedDepotId \? previewLots : \[\]\}/);
  assert.match(home, /listWarehouseLots\(workspaceId, 500, selectedMaterialId\)/);
  assert.match(render, /warehouseVisualExpiryMap\(balances, lots\)/);
  assert.match(render, /stockBoxesOnSurface\(/);
  assert.match(render, /data-expiry-state=\{expiry\}/);
  assert.match(render, /expiryBySubposition/);
  assert.match(render, /warehouse-stock-expiry-legend/);
  assert.match(appliance, /data-contains-items=\{occupied \? 'true' : 'false'\}/);
  assert.match(appliance, /occupied-white-sheen/);
  assert.match(appliance, /lot-expiry-signal/);
  assert.match(repository, /where\('expiresOn', '>=', '0000-01-01'\)/);
  assert.match(repository, /where\('expiresOn', '<=', warehouseVisualExpiryCutoffDate\(today\)\)/);
  assert.match(repository, /recordWarehouseDocumentReads\(workspaceId, snapshot.size\)/);
  assert.doesNotMatch(render, /\b(onSnapshot|setDoc|updateDoc|addDoc|runTransaction)\s*\(/);
});
