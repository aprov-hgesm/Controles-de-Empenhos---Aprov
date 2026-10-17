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
const {
  fitWarehouseIsometricScene,
  warehouseIsoRoomDimensions,
  transformWarehouseIsoRectForView,
} = require(resolve(out, 'isometricCamera.js'));

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


const VIEWS = ['front', 'right', 'back', 'left'];

function assertBoundsRect(rect, size) {
  assert.ok(rect.x >= -EPS && rect.y >= -EPS, 'local vazou do piso');
  assert.ok(rect.x + rect.width <= size.width + EPS, 'local vazou da largura');
  assert.ok(rect.y + rect.height <= size.height + EPS, 'local vazou da profundidade');
}

test('quatro vistas preservam medidas físicas e localização em depósitos retangulares, longos e quadrados', () => {
  const dimensions = [
    [12000, 2400], [2400, 12000], [15000, 1800],
    [1000, 620], [620, 1000], [500, 500], [50000, 240],
  ];
  for (const [width, height] of dimensions) {
    const local = {
      id: 'obj_PAL_A', warehouseLocationId: 'loc_5001',
      subpositionIds: ['sub_01','sub_02','sub_03'],
      kind: 'PALLET', rotation: 0, layer: 1,
      x: width * 0.21, y: height * 0.36,
      width: Math.min(120, width * 0.1), height: Math.min(100, height * 0.1),
    };
    const frozenBefore = { ...local, subpositionIds: [...local.subpositionIds] };
    for (const view of VIEWS) {
      const dimensionsInView = warehouseIsoRoomDimensions(width, height, view);
      const physical = transformWarehouseIsoRectForView(local, width, height, view);
      const side = view === 'right' || view === 'left';
      assert.deepEqual(dimensionsInView, side
        ? { width: height, height: width }
        : { width, height });
      assert.equal(physical.width, side ? local.height : local.width, 'palete foi esticado');
      assert.equal(physical.height, side ? local.width : local.height, 'palete foi achatado');
      assert.ok(Math.abs(physical.width * physical.height - local.width * local.height) < EPS);
      assert.equal(physical.id, local.id);
      assert.equal(physical.warehouseLocationId, 'loc_5001');
      assert.deepEqual(physical.subpositionIds, local.subpositionIds);
      assert.equal(physical.rotation, 0);
      assertBoundsRect(physical, dimensionsInView);
      assertCenteredAndFitted([
        ...room(dimensionsInView.width, dimensionsInView.height),
        projected(physical.x, physical.y, 0, dimensionsInView.width, dimensionsInView.height),
        projected(physical.x + physical.width, physical.y + physical.height,
          154, dimensionsInView.width, dimensionsInView.height),
      ], { width: 1090, height: 665, padding: 62, maxZoom: 1.28 });
    }
    assert.deepEqual(local, frozenBefore, 'a cena alterou o croqui físico em memória');
  }
});

test('vistas Direita/Esquerda giram 90 graus sem escalar independentemente os eixos', () => {
  const W = 12000, H = 2400;
  const rect = { id: 'pal_A', warehouseLocationId: 'loc_A', x: 3000, y: 850, width: 120, height: 100 };
  const right = transformWarehouseIsoRectForView(rect, W, H, 'right');
  const left = transformWarehouseIsoRectForView(rect, W, H, 'left');
  const back = transformWarehouseIsoRectForView(rect, W, H, 'back');
  assert.deepEqual(right, { ...rect, x: 850, y: 8880, width: 100, height: 120 });
  assert.deepEqual(left, { ...rect, x: 1450, y: 3000, width: 100, height: 120 });
  assert.deepEqual(back, { ...rect, x: 8880, y: 1450 });
  assert.deepEqual(transformWarehouseIsoRectForView(right, H, W, 'left'), rect);
  assert.deepEqual(transformWarehouseIsoRectForView(left, H, W, 'right'), rect);
  assert.deepEqual(transformWarehouseIsoRectForView(back, W, H, 'back'), rect);
  const twiceRight = transformWarehouseIsoRectForView(right, H, W, 'right');
  assert.deepEqual(twiceRight, back);
});

test('dois locais distintos e subposições não trocam de identidade nem se sobrepõem após rotação', () => {
  const W = 12000, H = 2400;
  const locals = [
    { warehouseLocationId: 'loc_01', subpositions: ['SUB-A', 'SUB-B'], x: 550, y: 340, width: 120, height: 100 },
    { warehouseLocationId: 'loc_02', subpositions: ['SUB-C'], x: 3000, y: 340, width: 120, height: 100 },
    { warehouseLocationId: 'loc_03', subpositions: [], x: 9400, y: 1240, width: 180, height: 70 },
  ];
  for (const view of VIEWS) {
    const rotated = locals.map((rect) => transformWarehouseIsoRectForView(rect, W, H, view));
    const dimensions = warehouseIsoRoomDimensions(W, H, view);
    for (let i = 0; i < rotated.length; i++) {
      assert.equal(rotated[i].warehouseLocationId, locals[i].warehouseLocationId);
      assert.deepEqual(rotated[i].subpositions, locals[i].subpositions);
      assertBoundsRect(rotated[i], dimensions);
      for (let j = i + 1; j < rotated.length; j++) {
        const a = rotated[i], b = rotated[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert.ok(overlapX <= EPS || overlapY <= EPS,
          'a vista ' + view + ' sobrepôs locais originalmente separados');
      }
    }
  }
});

test('renderer usa largura e profundidade rotacionadas em piso, paredes, iluminação e estruturas', () => {
  const preview = readFileSync(resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8');
  assert.match(preview, /transformWarehouseIsoRectForView\(/);
  assert.match(preview, /warehouseIsoRoomDimensions\(/);
  assert.match(preview, /width: viewLogicalWidth, height: viewLogicalHeight/);
  assert.match(preview, /isoPoint\(viewLogicalWidth, viewLogicalHeight, 0, viewLogicalWidth, viewLogicalHeight\)/);
  assert.match(preview, /logicalWidth=\{viewLogicalWidth\}/);
  assert.match(preview, /logicalHeight=\{viewLogicalHeight\}/);
  assert.doesNotMatch(preview, /function transformObjectForView\(/);
  assert.match(preview, /subpositionsByParent\.get\(location\.id\)/);
  assert.match(preview, /highlightedSubpositionIds\.has\(candidate\.id\)/);
});


test('geladeira inox e freezer têm faces físicas coerentes nas quatro perspectivas', () => {
  const visual = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseColdStorageVisual.tsx'), 'utf8'
  );
  const preview = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'), 'utf8'
  );
  const landing = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseLandingOperational.tsx'), 'utf8'
  );

  // Só duas vistas podem exibir portas; na traseira/esquerda elas ficam ocultas.
  assert.match(visual, /front: \{ front: 'doors', side: 'side' \}/);
  assert.match(visual, /right: \{ front: 'side', side: 'doors' \}/);
  assert.match(visual, /back: \{ front: 'rear', side: 'side' \}/);
  assert.match(visual, /left: \{ front: 'side', side: 'rear' \}/);
  assert.match(visual, /data-cold-face="rear"/);
  assert.match(visual, /data-cold-face="doors"/);
  assert.match(visual, /data-cold-part="hinged-lids"/);
  assert.match(visual, /view === 'right' \? \{ u: originalY, v: 1 - originalX \}/);
  assert.match(visual, /view === 'back' \? \{ u: 1 - originalX, v: 1 - originalY \}/);
  assert.match(visual, /\{ u: 1 - originalY, v: originalX \}/);
  assert.match(preview, /view=\{previewView\}/);
  assert.match(landing, /<WarehouseColdStorageVisual/);
  assert.match(landing, /compact/);
  assert.doesNotMatch(visual, /getDocs\(|setDoc\(|updateDoc\(|runTransaction\(/);
});
