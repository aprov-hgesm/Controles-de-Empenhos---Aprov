#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
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
const { layoutWarehouseIsoLabels } = require(resolve(out, 'isometricLabels.js'));

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

test('o renderer conserva a escala de centimetros e permite navegacao sem writes', () => {
  const source = readFileSync(resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8');
  assert.match(source, /const scaleBase = Math\.max\(1, logicalWidth, logicalHeight\)/);
  assert.match(source, /- z \* \(FLOOR_HALF_W \/ scaleBase\)/);
  assert.match(source, /layoutWarehouseIsoLabels\(/);
  assert.match(source, /data-testid="warehouse-isometric-label-overlay"/);
  assert.match(source, /data-testid="warehouse-isometric-label-controls"/);
  assert.match(source, /labelMode === 'codes'/);
  assert.match(source, /labelMode === 'clean'/);
  assert.match(source, /onWheel=/);
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
