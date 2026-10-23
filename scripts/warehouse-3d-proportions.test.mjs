#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const source = (path) => readFileSync(resolve(root, path), 'utf8');
function loadPureTypescript(path) {
  const exports = {};
  const js = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(js, { exports });
  return exports;
}
const { warehouseIsoCartonMetrics, warehouseIsoDetailScale } =
  loadPureTypescript('lib/warehouse/isometricVisualProportions.ts');
const scene = loadPureTypescript('lib/warehouse/demoDepot20x6.ts').WAREHOUSE_20X6_SCENARIOS.dense;

test('30 objetos preservam as plantas de 20 x 6 metros sem escalonar as medidas persistidas', () => {
  const render = source('features/warehouse/components/WarehouseIsometricPreview.tsx');
  assert.match(render, /warehouseIsoCartonMetrics\(object\.width, object\.height, scale\)/);
  assert.match(render, /object\.x \+ object\.width \* slot\.u/);
  assert.match(render, /object\.y \+ object\.height \* slot\.v/);
  assert.match(render, /warehouseIsoDetailScale\(object\.width, object\.height, logicalWidth, logicalHeight\)/);
  assert.doesNotMatch(render, /points="-14,0 0,-8 14,0 0,8"/);
  assert.doesNotMatch(render, /\b(?:setDoc|updateDoc|addDoc|runTransaction)\s*\(/);
  assert.equal(scene.objects.length, 30);
});

test('caixas em cm nunca saem da celula de estoque em estantes, paletes e bancadas', () => {
  for (const obj of scene.objects) {
    for (const scale of [0.68, 0.82, 0.83, 1]) {
      const box = warehouseIsoCartonMetrics(obj.width, obj.height, scale);
      assert.ok(box.width > 0 && box.depth > 0 && box.height > 0, obj.label);
      assert.ok(box.width <= obj.width * 0.24 + 1e-8, obj.label);
      assert.ok(box.depth <= obj.height * 0.24 + 1e-8, obj.label);
      assert.ok(box.width <= 30 && box.depth <= 26 && box.height <= 17, obj.label);
      for (const u of [0.32, 0.68]) for (const v of [0.32, 0.68]) {
        assert.ok(u * obj.width - box.width / 2 >= 0, obj.label);
        assert.ok(u * obj.width + box.width / 2 <= obj.width, obj.label);
        assert.ok(v * obj.height - box.depth / 2 >= 0, obj.label);
        assert.ok(v * obj.height + box.depth / 2 <= obj.height, obj.label);
      }
      const base = obj.kind === 'SHELF' ? 118 + 4 * 4.5 : obj.kind === 'PALLET' ? 13 : 62;
      if (obj.kind === 'SHELF') {
        const clearance = base / (4 + 0.35);
        assert.ok(box.height * 2 < clearance,
          obj.label + ': caixa empilhada ultrapassou a distancia entre niveis');
      }
    }
  }
});

test('detalhes de pilares e pes afinam em depositos longos e nao crescem sem limite', () => {
  const shelf = scene.objects.find(x => x.kind === 'SHELF');
  const base = warehouseIsoDetailScale(shelf.width, shelf.height, 2000, 600);
  assert.ok(base >= 0.42 && base < 1);
  assert.equal(warehouseIsoDetailScale(shelf.width, shelf.height, 2000, 600), base);
  const compact = warehouseIsoDetailScale(shelf.width, shelf.height, 600, 600);
  assert.ok(compact >= base && compact <= 1);
  assert.equal(warehouseIsoDetailScale(0, 0, 2000, 600), 0.42);
});

test('equipamentos frigorificados respeitam a planta e conservam detalhes por escala', () => {
  const appliance = source('features/warehouse/components/WarehouseColdAppliance3D.tsx');
  const renderer = source('features/warehouse/components/WarehouseIsometricPreview.tsx');
  assert.match(appliance, /detailScale\?: number/);
  assert.match(appliance, /strokeWidth=\{5\.3 \* detailScale\}/);
  assert.match(renderer, /detailScale=\{detailScale\}/);
  assert.match(renderer, /if \(kind === 'REFRIGERATOR'\) return 132;/);
  assert.match(renderer, /if \(kind === 'FREEZER'\) return 76;/);
});
