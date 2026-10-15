#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(resolve(tmpdir(), 'emprovex-isometric-camera-'));
try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/isometricCamera.ts'),
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'ES2020',
    '--moduleResolution', 'node',
    '--skipLibCheck',
  ], { cwd: root, stdio: 'pipe' });
} catch (error) {
  rmSync(out, { recursive: true, force: true });
  throw error;
}

test.after(() => rmSync(out, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { fitWarehouseIsometricScene } = require(resolve(out, 'isometricCamera.js'));

const EPS = 0.00001;

function assertCenteredAndFitted(points, frame) {
  const box = fitWarehouseIsometricScene(points, frame);
  const bounds = {
    minX: Math.min(...points.map(({ x }) => x)),
    maxX: Math.max(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
  assert.ok(Number.isFinite(box.x) && Number.isFinite(box.y));
  assert.ok(box.width > 0 && box.height > 0);
  assert.ok(Math.abs((box.width / box.height) - frame.width / frame.height) < EPS);
  assert.ok(Math.abs(box.x + box.width / 2 - (bounds.minX + bounds.maxX) / 2) < EPS);
  assert.ok(Math.abs(box.y + box.height / 2 - (bounds.minY + bounds.maxY) / 2) < EPS);
  const sx = frame.width / box.width;
  const sy = frame.height / box.height;
  assert.ok((bounds.minX - box.x) * sx >= frame.padding - EPS, 'margem esquerda cortada');
  assert.ok((box.x + box.width - bounds.maxX) * sx >= frame.padding - EPS, 'margem direita cortada');
  assert.ok((bounds.minY - box.y) * sy >= frame.padding - EPS, 'margem superior cortada');
  assert.ok((box.y + box.height - bounds.maxY) * sy >= frame.padding - EPS, 'margem inferior cortada');
  assert.ok(sx <= frame.maxZoom + EPS);
  return box;
}

function projected(x, y, z, logicalWidth, logicalHeight) {
  const scaleBase = Math.max(1, logicalWidth, logicalHeight);
  return { x: 600 + (x / scaleBase - y / scaleBase) * 470,
    y: 160 + (x / scaleBase + y / scaleBase) * 245 - z };
}
function room(logicalWidth, logicalHeight) {
  return [
    projected(0, 0, 0, logicalWidth, logicalHeight),
    projected(logicalWidth, 0, 0, logicalWidth, logicalHeight),
    projected(logicalWidth, logicalHeight, 0, logicalWidth, logicalHeight),
    projected(0, logicalHeight, 0, logicalWidth, logicalHeight),
    projected(0, 0, 154, logicalWidth, logicalHeight),
    projected(logicalWidth, 0, 154, logicalWidth, logicalHeight),
    projected(0, logicalHeight, 154, logicalWidth, logicalHeight),
  ];
}

test('sala retangular deslocada é enquadrada no centro com margens em todas as faces', () => {
  const frame = { width: 1090, height: 665, padding: 62, maxZoom: 1.28 };
  const base = room(12000, 2400);
  const views = [
    [{ x: 940, y: 305 }, { x: 1080, y: 435 }],
    [{ x: 490, y: 170 }, { x: 640, y: 400 }],
    [{ x: 635, y: 280 }, { x: 800, y: 490 }],
    [{ x: 370, y: 260 }, { x: 555, y: 480 }],
  ];
  for (const positions of views) {
    const box = assertCenteredAndFitted([...base, ...positions], frame);
    assert.notEqual(box.x, 55);
    assert.notEqual(box.y, 35);
  }
});

test('etiquetas altas e seleção com destaque continuam integralmente dentro do quadro', () => {
  const frame = { width: 1200, height: 760, padding: 72, maxZoom: 1.28 };
  const pts = [...room(1000, 620),
    { x: 1080, y: -112 }, { x: 1162, y: 156 },
    { x: 230, y: 210 }, { x: 280, y: 530 }];
  assertCenteredAndFitted(pts, frame);
});

test('depósitos extremos e quadrados respeitam proporção e limite de zoom', () => {
  const frame = { width: 1090, height: 665, padding: 62, maxZoom: 1.28 };
  for (const [w, h] of [[12000, 2400], [2400, 12000], [500, 500], [1000, 620], [50000, 240]]) {
    assertCenteredAndFitted(room(w, h), frame);
  }
});

test('bounds inválidos são ignorados, cena vazia permanece segura e sem mutação', () => {
  const frame = { width: 1200, height: 760, padding: 72, maxZoom: 1.28 };
  assert.deepEqual(fitWarehouseIsometricScene([], frame), { x: 0, y: 0, width: 1200, height: 760 });
  const pts = [{ x: 10, y: 30 }, { x: 100, y: 240 }, { x: NaN, y: 10 }];
  const before = pts.map(x => ({ ...x }));
  assertCenteredAndFitted(pts.slice(0, 2), frame);
  const clean = fitWarehouseIsometricScene(pts.slice(0, 2), frame);
  const dirty = fitWarehouseIsometricScene(pts, frame);
  assert.deepEqual(clean, dirty);
  assert.deepEqual(pts, before);
});

test('renderer refaz fit por vista e não muda geometria, domínio nem Firestore', () => {
  const preview = readFileSync(resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8');
  assert.match(preview, /fitWarehouseIsometricScene\(roomPoints/);
  assert.match(preview, /const cameraViewBox = useMemo\(\(\) =>/);
  assert.match(preview, /visibleObjects,/);
  assert.match(preview, /previewView/);
  assert.match(preview, /viewBox=\{\[cameraViewBox\.x, cameraViewBox\.y, cameraViewBox\.width, cameraViewBox\.height\]\.join\(' '\)\}/);
  assert.match(preview, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(preview, /data-camera-fit="bounds"/);
  assert.match(preview, /const scaleBase = Math\.max\(1, logicalWidth, logicalHeight\)/);
  assert.doesNotMatch(preview, /viewBox=\{\s*embedded\s*\?/);
  assert.doesNotMatch(preview, /setDoc\(|updateDoc\(|runTransaction\(/);
});
