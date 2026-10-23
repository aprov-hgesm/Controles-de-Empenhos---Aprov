#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';

const root = process.cwd();
const out = mkdtempSync(resolve(tmpdir(), 'emprovex-isometric-clarity-'));
try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/isometricLabels.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'ES2020',
    '--moduleResolution', 'node', '--skipLibCheck',
  ], { cwd: root, stdio: 'pipe' });
} catch (error) {
  rmSync(out, { recursive: true, force: true });
  throw error;
}
test.after(() => rmSync(out, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { layoutWarehouseIsoLabels, warehouseIsoLabelSize, warehouseIsoLabelText } = require(resolve(out, 'isometricLabels.js'));

function overlap(a, b) {
  const r = a.bounds, s = b.bounds;
  return r.x < s.x + s.width + 5 && r.x + r.width + 5 > s.x
    && r.y < s.y + s.height + 4 && r.y + r.height + 4 > s.y;
}
function longDepotObjects() {
  // 18 m x 6 m, 26 locais, incluindo estantes e equipamentos de refrigeração.
  return Array.from({ length: 26 }, (_, index) => {
    const x = 90 + Math.floor(index / 2) * 125;
    const y = index % 2 ? 410 : 140;
    const max = 1800;
    return {
      id: 'EST-' + String(index + 1).padStart(2, '0'),
      x: 600 + ((x - y) / max) * 470,
      y: 160 + ((x + y) / max) * 245 - 145 * 470 / max,
      highlighted: false,
    };
  });
}
test('etiquetas do deposito de 18 x 6 m nao se sobrepoem', () => {
  const labels = longDepotObjects();
  const placements = layoutWarehouseIsoLabels(labels);
  assert.ok(placements.size > 5);
  for (const [id, a] of placements) {
    assert.ok(Number.isFinite(a.bounds.x) && Number.isFinite(a.bounds.y), id);
    for (const [otherId, b] of placements) {
      if (id !== otherId) assert.equal(overlap(a, b), false, id + '/' + otherId);
    }
  }
  assert.deepEqual([...layoutWarehouseIsoLabels(labels)], [...placements], 'o layout deve ser deterministico');
});

test('local selecionado aparece mesmo em layout denso', () => {
  const labels = longDepotObjects();
  const target = labels[25];
  const highlighted = labels.map((label) => label.id === target.id
    ? { ...label, highlighted: true, priority: 2 } : label);
  const placements = layoutWarehouseIsoLabels(highlighted);
  assert.ok(placements.has(target.id), 'local pesquisado não pode desaparecer');
  assert.equal(placements.get(target.id).bounds.width, 72);
  const unfocused = layoutWarehouseIsoLabels(labels);
  assert.deepEqual([...unfocused], [...layoutWarehouseIsoLabels(labels)]);
});

function overlapsCompact(a, b) {
  const r = a.bounds, s = b.bounds;
  return r.x < s.x + s.width + 3 && r.x + r.width + 3 > s.x
    && r.y < s.y + s.height + 3 && r.y + r.height + 3 > s.y;
}

test('etiqueta compacta preserva contraste e as dimensoes exatas prometidas', () => {
  assert.deepEqual(warehouseIsoLabelSize(false, 'compact'),
    { width: 42, height: 16, fontSize: 7.8 });
  assert.deepEqual(warehouseIsoLabelSize(true, 'compact'),
    { width: 52, height: 18, fontSize: 9 });
  assert.deepEqual(warehouseIsoLabelSize(false, 'standard'),
    { width: 58, height: 20, fontSize: 9.2 });
  assert.equal(warehouseIsoLabelText('EST-01', 'compact'), 'EST-01');
  assert.equal(warehouseIsoLabelText('EST-00001', 'compact'), 'EST-00…');
  assert.equal(warehouseIsoLabelText('EST-00001', 'standard'), 'EST-00001');
});

test('em 26 locais compactos as legendas nao colidem e nao cobrem as ancoras vizinhas', () => {
  const labels = longDepotObjects().map((entry, i) => ({ ...entry, code: 'EST-' + i }));
  const options = { variant: 'compact', avoidOtherAnchors: true };
  const placements = layoutWarehouseIsoLabels(labels, options);
  assert.ok(placements.size >= 4, 'exibir codigos suficientes para orientacao');
  for (const [id, placed] of placements) {
    assert.equal(placed.bounds.width, 42, id);
    assert.equal(placed.bounds.height, 16, id);
    for (const [otherId, other] of placements) {
      if (id !== otherId) assert.equal(overlapsCompact(placed, other), false, id + ' / ' + otherId);
    }
    for (const other of labels) {
      if (other.id === id) continue;
      assert.equal(other.x >= placed.bounds.x - 5 && other.x <= placed.bounds.x + placed.bounds.width + 5
        && other.y >= placed.bounds.y - 5 && other.y <= placed.bounds.y + placed.bounds.height + 5,
      false, id + ' cobriu ancora de ' + other.id);
    }
  }
  assert.deepEqual([...layoutWarehouseIsoLabels(labels, options)], [...placements],
    'sem aleatoriedade em qualquer vista');
});

test('foco recebe legenda compacta ampliada sem sobrepor outras etiquetas', () => {
  const original = longDepotObjects().map((entry, i) => ({ ...entry, code: 'EST-' + i }));
  const focused = original.map((entry, i) => i === 25
    ? { ...entry, highlighted: true, priority: 2 } : entry);
  const placed = layoutWarehouseIsoLabels(focused,
    { variant: 'compact', avoidOtherAnchors: true });
  assert.ok(placed.has(focused[25].id), 'codigo focado deve permanecer visivel');
  assert.equal(placed.get(focused[25].id).bounds.width, 52);
  assert.equal(placed.get(focused[25].id).bounds.height, 18);
  for (const [id, first] of placed) for (const [otherId, second] of placed) {
    if (id !== otherId) assert.equal(overlapsCompact(first, second), false);
  }
});

test('30 locais do laboratorio de 20 x 6m continuam legiveis nas quatro vistas', () => {
  const ts = require('typescript');
  const fixture = readFileSync(resolve(root, 'lib/warehouse/demoDepot20x6.ts'), 'utf8');
  const js = ts.transpileModule(fixture, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mockExports = {};
  runInNewContext(js, { exports: mockExports });
  const scenarios = mockExports.WAREHOUSE_20X6_SCENARIOS;
  for (const mode of ['dense', 'operational']) {
    const objects = scenarios[mode].objects;
    assert.equal(objects.length, 30);
    for (const view of ['front', 'back', 'left', 'right']) {
      const logicalWidth = (view === 'left' || view === 'right') ? 600 : 2000;
      const logicalHeight = (view === 'left' || view === 'right') ? 2000 : 600;
      const max = 2000;
      const labels = objects.map((object) => {
        let rotated = object;
        if (view === 'back') rotated = {
          ...object, x: 2000 - object.x - object.width,
          y: 600 - object.y - object.height,
        };
        if (view === 'right') rotated = {
          ...object, x: object.y, y: 2000 - object.x - object.width,
          width: object.height, height: object.width,
        };
        if (view === 'left') rotated = {
          ...object, x: 600 - object.y - object.height, y: object.x,
          width: object.height, height: object.width,
        };
        const z = object.kind === 'SHELF' ? 136
          : object.kind === 'REFRIGERATOR' ? 132
          : object.kind === 'FREEZER' ? 76
          : object.kind === 'PALLET' ? 13 : 62;
        const x = rotated.x + rotated.width / 2;
        const y = rotated.y + rotated.height / 2;
        return {
          id: object.id, code: object.label,
          x: 600 + ((x - y) / max) * 470,
          y: 160 + ((x + y) / max) * 245 - z * 470 / max,
          highlighted: false,
        };
      });
      const options = { variant: 'compact', avoidOtherAnchors: true };
      const placed = layoutWarehouseIsoLabels(labels, options);
      assert.ok(placed.size >= 3, mode + '/' + view + ': nenhuma legenda util');
      for (const [id, first] of placed) {
        assert.equal(first.bounds.width, 42);
        for (const [otherId, second] of placed) {
          if (id !== otherId) assert.equal(overlapsCompact(first, second), false,
            mode + '/' + view + ': choque de ' + id + '/' + otherId);
        }
      }
      assert.deepEqual([...placed], [...layoutWarehouseIsoLabels(labels, options)],
        mode + '/' + view + ': layout instavel');
      assert.ok(logicalWidth > 0 && logicalHeight > 0);
    }
  }
});

test('o renderer conserva a escala de centimetros e permite navegacao sem writes', () => {
  const source = readFileSync(resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8');
  assert.match(source, /const scaleBase = Math\.max\(1, logicalWidth, logicalHeight\)/);
  assert.match(source, /- z \* \(FLOOR_HALF_W \/ scaleBase\)/);
  assert.match(source, /layoutWarehouseIsoLabels\(/);
  assert.match(source, /data-testid="warehouse-isometric-label-overlay"/);
  assert.match(source, /data-testid="warehouse-isometric-label-controls"/);
  assert.match(source, /labelMode === 'codes'/);
  assert.match(source, /labelMode === 'compact'/);
  assert.match(source, /warehouse-label-mode-/);
  assert.match(source, /Legendas compactas/);
  assert.match(source, /avoidOtherAnchors: labelMode === 'compact'/);
  assert.match(source, /data-visual-role=\{variant === 'compact' \? 'warehouse-compact-label' : 'warehouse-label'\}/);
  assert.match(source, /warehouseIsoLabelText\(code, variant\)/);
  assert.match(source, /labelMode === 'clean'/);
  assert.match(source, /svg\.addEventListener\('wheel', handleWheel, \{ passive: false \}\)/);
  assert.match(source, /onPointerMove=/);
  assert.match(source, /data-testid="warehouse-isometric-context-panel"/);
  assert.doesNotMatch(source, /roomPoints\.push\(\{ x: x - 8, y: y - 8 \}/);
  assert.match(source, /data-testid="warehouse-isometric-camera-controls"/);
  assert.match(source, /activeCameraViewBox/);
  assert.doesNotMatch(source, /\b(?:setDoc|updateDoc|deleteDoc|runTransaction)\s*\(/);
  // Escala horizontal e vertical: um equipamento de 145 cm em 18 m ocupa
  // 145*(470/1800) na projeção, em vez de 145 px.
  const projectedHeight = 145 * 470 / 1800;
  assert.ok(projectedHeight > 37 && projectedHeight < 39);
});
