import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('lib/warehouse/palletCargoLayout.ts');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(output, { exports });
const { layoutWarehousePalletCargo } = exports;

test('palete vazio não possui caixas e volume visual tem limite', () => {
  assert.equal(layoutWarehousePalletCargo(0).length, 0);
  assert.equal(layoutWarehousePalletCargo(-1).length, 0);
  assert.equal(layoutWarehousePalletCargo(NaN).length, 0);
  assert.equal(layoutWarehousePalletCargo(99).length, 4);
});

test('volumes cabem no palete e tiers superiores têm suporte real', () => {
  for (const count of [1, 2, 3, 4]) {
    const boxes = layoutWarehousePalletCargo(count);
    assert.equal(boxes.length, count);
    for (const box of boxes) {
      assert.ok(box.x >= 0 && box.y >= 0);
      assert.ok(box.x + box.width <= 1 && box.y + box.depth <= 1);
      if (!box.tier) {
        assert.equal(box.bottomZ, 0);
      } else {
        const support = boxes.find((item) => item.tier === box.tier - 1 && item.column === box.column);
        assert.ok(support, 'Não pode haver caixa flutuante');
        assert.equal(box.bottomZ, support.topZ);
        assert.equal(box.x, support.x);
        assert.equal(box.y, support.y);
        assert.equal(box.width, support.width);
        assert.equal(box.depth, support.depth);
      }
    }
  }
});

test('renderização 3D apoiada na base e consulta fora do desenho', () => {
  const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const inspection = read('features/warehouse/components/WarehouseLocationInspection.tsx');
  const fixture = read('features/warehouse/components/WarehouseLocationInspectionLocalPreview.tsx');
  assert.match(preview, /layoutWarehousePalletCargo\(generalBoxCount\)/);
  assert.match(preview, /data-pallet-cargo-tier=\{slot\.tier\}/);
  assert.match(preview, /data-testid="warehouse-location-inspection-dock"/);
  assert.match(preview, /onPointerEnter=/);
  assert.doesNotMatch(preview, /centerTop\.x \+ \(index - \(generalBoxCount - 1\) \/ 2\) \* 26/);
  assert.doesNotMatch(inspection, /transform: 'translate\(-50%, 0\)'/);
  assert.match(fixture, /kind: 'FREEZER'/);
  for (const content of [source, preview, inspection, fixture]) {
    assert.doesNotMatch(content, /(?:setDoc|updateDoc|runTransaction)\(/);
  }
});


test('a inspeção está conectada na tela real Meus Depósitos, além da Prévia de Croquis', () => {
  const home = read('features/warehouse/components/WarehouseHomeOperational.tsx');
  const croquis = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  for (const screen of [home, croquis]) {
    assert.match(screen, /<WarehouseIsometricPreview/);
    assert.match(screen, /onInspectLocation=\{/);
    assert.match(screen, /onRefreshInspection=\{/);
    assert.match(screen, /inspectionAvailable=\{/);
    assert.match(screen, /inspectionLots=\{/);
    assert.match(screen, /depotId=\{/);
  }
  assert.match(home, /const loadInspectionLots = useCallback/);
  assert.match(home, /if \(!workspaceId \|\| \(!refresh && inspectionPhaseRef.current !== 'idle'\)\) return;/);
  assert.match(home, /inspectionRequestRef.current \+= 1/);
  assert.match(home, /inspectionAvailable=\{!data.loading && !data.error\}/);
  assert.doesNotMatch(home, /onMouseMove=.*listWarehouseLots/);
});

test('um local sem saldo continua inspecionável e mantém o painel aberto', () => {
  const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const inspection = read('features/warehouse/components/WarehouseLocationInspection.tsx');
  const contents = read('lib/warehouse/locationContents.ts');
  assert.match(preview, /location\?\.kind === 'LOCAL'/);
  assert.doesNotMatch(preview, /const interactive = [^;]*occupiedQuantity/);
  assert.match(preview, /setInspectedLocationId\(locationId\)/);
  assert.match(preview, /const \[inspectedLocationId, setInspectedLocationId\]/);
  assert.match(preview, /Local vazio · saldo físico 0/);
  assert.match(inspection, /Saldo físico: 0/);
  assert.match(contents, /materialCount: materialIds.size/);
  assert.match(contents, /rowCount/);
  const js = ts.transpileModule(contents, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: () => ({ warehouseStockPositionsEqual: () => true }) });
  const location = {
    id: 'local-empty', kind: 'LOCAL', status: 'active', depotId: 'depot-1',
    name: 'Freezer vazio', code: 'F01',
  };
  const result = exports.deriveWarehouseLocationContents(location.id, [location], [], [], []);
  assert.ok(result);
  assert.equal(result.materialCount, 0);
  assert.equal(result.rowCount, 0);
  assert.equal(result.groups.length, 0);
});
