import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('lib/warehouse/structureLocationDraft.ts');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(js, { exports });
const { suggestWarehouseLocalCode, suggestWarehouseSubpositionCode } = exports;

const depotId = 'dep_one';
const local = (depotId, code, status = 'active') => ({
  kind: 'LOCAL', depotId, parentLocationId: null, code, status,
});
const subposition = (parentLocationId, code) => ({
  kind: 'SUBPOSITION', depotId, parentLocationId, code, status: 'active',
});

test('sugere novo código apenas no depósito existente selecionado', () => {
  const items = [
    local(depotId, 'EST-01'),
    local(depotId, 'est-02', 'inactive'),
    local('dep_two', 'EST-03'),
    local(depotId, 'PAL-01'),
  ];
  assert.equal(suggestWarehouseLocalCode(items, depotId, 'EST'), 'EST-03');
  assert.equal(suggestWarehouseLocalCode(items, 'dep_two', 'EST'), 'EST-01');
  assert.equal(suggestWarehouseLocalCode(items, depotId, 'PAL'), 'PAL-02');
  assert.equal(suggestWarehouseLocalCode(items, depotId, 'GEL'), 'GEL-01');
});

test('considera também códigos inativos e não sugere sem depósito selecionado', () => {
  assert.equal(suggestWarehouseLocalCode([local(depotId, 'LOC-01', 'inactive')], depotId, 'LOC'), 'LOC-02');
  assert.equal(suggestWarehouseLocalCode([], '', 'EST'), '');
});

test('sugestão de prateleira não mistura locais pais diferentes', () => {
  const items = [
    subposition('loc_1', 'EST-01-01'),
    subposition('loc_1', 'EST-01-02'),
    subposition('loc_2', 'EST-01-03'),
  ];
  assert.equal(suggestWarehouseSubpositionCode(items, 'loc_1', 'EST-01'), 'EST-01-03');
  assert.equal(suggestWarehouseSubpositionCode(items, 'loc_2', 'EST-01'), 'EST-01-01');
  assert.equal(suggestWarehouseSubpositionCode(items, '', 'EST-01'), '');
});

test('controles da aba Estrutura reutilizam o cadastro existente por workspace', () => {
  const ui = read('features/warehouse/components/WarehouseLocationsR1Operational.tsx');
  const repository = read('lib/warehouse/locationRepository.ts');

  assert.match(ui, /data-testid="warehouse-add-location-existing-depot"/);
  assert.match(ui, /onClick=\{\(\) => openPanel\('location'\)\}/);
  assert.match(ui, /Adicionar primeiro local/);
  assert.match(ui, /data-testid="warehouse-add-subposition-existing-local"/);
  assert.match(ui, /onClick=\{\(\) => openPanel\('subposition'\)\}/);
  assert.match(ui, /suggestWarehouseLocalCode\(/);
  assert.match(ui, /suggestWarehouseSubpositionCode\(/);
  assert.match(ui, /locationCodeEdited/);
  assert.match(ui, /selectedDepot\.status !== 'active'/);
  assert.match(ui, /createWarehouseLocation\(workspaceId, \{/);
  assert.match(ui, /depotId: selectedDepotId/);
  assert.match(ui, /parentLocationId: kind === 'SUBPOSITION' \? selectedLocationId : null/);
  assert.match(ui, /setCreatePanel\(null\)/);
  assert.match(ui, /Local criado, mas a inclusão de todas as subposições não foi concluída/);
  assert.match(repository, /await assertLocationCodeAvailable/);
  assert.match(repository, /invalidateWarehouseLocationReadCache\(scope\.workspaceId\)/);
  assert.doesNotMatch(ui, /listWarehouseLocationBalances|updateDoc\(|runTransaction\(/);
  assert.doesNotMatch(source, /getDoc\(|getDocs\(|setDoc\(|updateDoc\(/);
});

test('a visualização do croqui continua vinculada à mesma localização cadastrada', () => {
  const croqui = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  assert.match(croqui, /warehouseLocationId: item\.location\.id/);
});
