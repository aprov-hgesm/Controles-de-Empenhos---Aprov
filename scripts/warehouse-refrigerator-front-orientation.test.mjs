import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';


const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('lib/warehouse/refrigeratorOrientation.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports });
const { warehouseRefrigeratorFrontOnOriginalSide } = exports;
const camera = ts.transpileModule(read('lib/warehouse/isometricCamera.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cameraExports = {};
runInNewContext(camera, { exports: cameraExports });
const { transformWarehouseIsoRectForView } = cameraExports;
const VIEWS = ['front', 'right', 'back', 'left'];

test('largura original maior: as portas permanecem na face +Y nas quatro vistas', () => {
  const original = { x: 38, y: 60, width: 205, height: 92 };
  for (const view of VIEWS) {
    const projected = transformWarehouseIsoRectForView(original, 700, 440, view);
    assert.equal(warehouseRefrigeratorFrontOnOriginalSide(
      projected.width, projected.height, view
    ), false, 'vista ' + view);
  }
});

test('profundidade original maior: portas ficam na face +X nas quatro vistas', () => {
  const original = { x: 50, y: 68, width: 92, height: 205 };
  for (const view of VIEWS) {
    const projected = transformWarehouseIsoRectForView(original, 700, 440, view);
    assert.equal(warehouseRefrigeratorFrontOnOriginalSide(
      projected.width, projected.height, view
    ), true, 'vista ' + view);
    assert.equal(projected.width * projected.height, original.width * original.height,
      'vista ' + view + ' não preservou área');
  }
});

test('geladeira quadrada mantém convenção anterior para evitar oscilação', () => {
  for (const view of VIEWS) {
    assert.equal(warehouseRefrigeratorFrontOnOriginalSide(100, 100, view), false);
  }
});

test('portas aparecem só nas duas vistas da mesma face física', () => {
  const visual = read('features/warehouse/components/WarehouseColdStorageVisual.tsx');
  // Geometria original: face +Y (convencional) abre na câmera Frente e Direita.
  assert.match(visual, /front: \{ front: 'doors', side: 'side' \}/);
  assert.match(visual, /right: \{ front: 'side', side: 'doors' \}/);
  assert.match(visual, /back: \{ front: 'rear', side: 'side' \}/);
  assert.match(visual, /left: \{ front: 'side', side: 'rear' \}/);
  // Geometria original: face +X (lado maior) abre na câmera Frente e Esquerda.
  assert.match(visual, /front: \{ front: 'side', side: 'doors' \}/);
  assert.match(visual, /right: \{ front: 'rear', side: 'side' \}/);
  assert.match(visual, /back: \{ front: 'side', side: 'rear' \}/);
  assert.match(visual, /left: \{ front: 'doors', side: 'side' \}/);
  assert.match(visual, /const doorsOnOriginalSide = refrigerator/);
  assert.match(visual, /const roles = doorsOnOriginalSide \? longSideFaceRoles\[view\] : faceRoles\[view\]/);
  assert.match(visual, /data-refrigerator-front=\{/);
});

test('cadastro e visualização não alteram dimensões, posição nem banco', () => {
  const registration = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  const visual = read('features/warehouse/components/WarehouseColdStorageVisual.tsx');
  const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
  const demo = read('features/warehouse/components/WarehouseColdStorageLocalPreview.tsx');
  const devRoute = read('app/visual-lab/frigorificos/page.tsx');

  assert.match(registration, /Frente padronizada: as portas da geladeira/);
  assert.match(preview, /<WarehouseColdStorageVisual/);
  assert.match(preview, /view=\{view\}/);
  assert.match(demo, /obj_local_fridge_long_depth_demo/);
  assert.match(demo, /width: 92,\s*height: 190,/);
  assert.match(devRoute, /process\.env\.NODE_ENV !== 'development'/);
  assert.doesNotMatch(source + visual + demo, /getDocs\(|setDoc\(|updateDoc\(|runTransaction\(/);
});
