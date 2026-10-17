import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('lib/warehouse/globalMaterialSearch.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports });
const { findWarehouseMaterialsAcrossDepots } = exports;

const depotA = { id: 'dep_a', code: 'D01', name: 'Depósito Central', status: 'active' };
const depotB = { id: 'dep_b', code: 'D02', name: 'Depósito Reserva', status: 'active' };
const depotC = { id: 'dep_c', code: 'D03', name: 'Depósito Inativo', status: 'inactive' };
const localA = { id: 'loc_a', depotId: 'dep_a', kind: 'LOCAL', code: 'EST01', name: 'Estante A', status: 'active' };
const localB = { id: 'loc_b', depotId: 'dep_b', kind: 'LOCAL', code: 'GEL01', name: 'Geladeira', status: 'active' };
const localC = { id: 'loc_c', depotId: 'dep_c', kind: 'LOCAL', code: 'PLT01', name: 'Palete', status: 'active' };
const subA = {
  id: 'sub_a', depotId: 'dep_a', kind: 'SUBPOSITION',
  code: 'P02', name: 'Prateleira 2', parentLocationId: 'loc_a', status: 'active',
};
const matA = {
  id: 'mat_a', description: 'Leite integral UHT', aliases: ['Leite caixa'],
  status: 'active', unit: { label: 'CX', code: 'unit' },
};
const matB = {
  id: 'mat_b', description: 'Arroz Branco', aliases: [],
  status: 'active', unit: { label: null, code: 'kg' },
};

const pos = (depotId, locationId, subpositionId) => subpositionId
  ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
  : { kind: 'LOCATION', depotId, locationId, subpositionId: null };

const balances = [
  { materialId: 'mat_a', position: pos('dep_a', 'loc_a', 'sub_a'), quantity: 8 },
  { materialId: 'mat_a', position: pos('dep_b', 'loc_b'), quantity: 3 },
  { materialId: 'mat_a', position: pos('dep_c', 'loc_c'), quantity: 100 },
  { materialId: 'mat_a', position: pos('dep_b', 'loc_b'), quantity: 0 },
  { materialId: 'mat_b', position: pos('dep_a', 'loc_a'), quantity: 9 },
  { materialId: 'mat_a', position: { kind: 'UNASSIGNED' }, quantity: 15 },
];

const data = {
  depots: [depotA, depotB, depotC],
  locations: [localA, localB, localC, subA],
  materials: [matA, matB],
  balances,
};

test('busca mesmo material em todos os depósitos e apresenta posição e subposição', () => {
  const results = findWarehouseMaterialsAcrossDepots({ ...data, query: 'leiTE' });
  assert.equal(results.length, 1);
  assert.equal(results[0].depotCount, 2);
  assert.deepEqual(Array.from(results[0].positions, (p) => [
    p.depotCode, p.locationCode, p.subpositionCode, p.quantity, p.unit,
  ]), [
    ['D01', 'EST01', 'P02', 8, 'CX'],
    ['D02', 'GEL01', null, 3, 'CX'],
  ]);
});

test('busca por alias e material id com distinção de saldos físicos', () => {
  assert.equal(findWarehouseMaterialsAcrossDepots({ ...data, query: 'leite caixa' })[0].materialId, 'mat_a');
  const result = findWarehouseMaterialsAcrossDepots({ ...data, query: 'mat_b' })[0];
  assert.equal(result.positions[0].quantity, 9);
  assert.equal(result.positions[0].unit, 'KG');
});

test('exclui localização inativa e não confunde subposições de outros locais', () => {
  const current = findWarehouseMaterialsAcrossDepots({
    ...data,
    locations: data.locations.map((location) =>
      location.id === 'loc_b' ? { ...location, status: 'inactive' } : location
    ),
    query: 'Leite',
  });
  assert.equal(current[0].depotCount, 1);

  const wrongParent = findWarehouseMaterialsAcrossDepots({
    ...data,
    locations: data.locations.map((location) =>
      location.id === 'sub_a' ? { ...location, parentLocationId: 'loc_b' } : location
    ),
    query: 'Leite',
  });
  assert.equal(wrongParent[0].positions.length, 1);
  assert.equal(wrongParent[0].positions[0].depotId, 'dep_b');
});

test('termos não encontrados e consulta vazia não geram registros fictícios', () => {
  assert.equal(findWarehouseMaterialsAcrossDepots({ ...data, query: '' }).length, 0);
  assert.equal(findWarehouseMaterialsAcrossDepots({ ...data, query: 'feijao' }).length, 0);
});

test('UI permite navegar entre depósitos e preserva destaque após escolha', () => {
  const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const croquis = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  const search = read('features/warehouse/components/WarehouseGlobalMaterialSearch.tsx');
  assert.match(preview, /WarehouseGlobalMaterialSearch/);
  assert.match(preview, /focusedLocationId === locationId/);
  assert.match(croquis, /navigationRef\.current = depotId/);
  assert.match(croquis, /setCroquiMode\('preview'\)/);
  assert.match(croquis, /globalBalances=\{previewBalances\}/);
  assert.match(search, /data-testid="warehouse-global-material-position"/);
  assert.match(search, /position\.depotCode/);
  assert.match(search, /position\.subpositionCode/);
  for (const file of [source, search]) {
    assert.doesNotMatch(file, /setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/);
  }
});
