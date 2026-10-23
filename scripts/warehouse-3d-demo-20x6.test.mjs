#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const fixture = read('lib/warehouse/demoDepot20x6.ts');
const compiled = ts.transpileModule(fixture, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports });
const {
  DEMO_20X6_WIDTH_CM: W,
  DEMO_20X6_DEPTH_CM: H,
  DEMO_20X6_DEPOT_ID,
  WAREHOUSE_20X6_SCENARIOS: scenes,
} = exports;

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('os dois cenários usam exatamente 20 × 6 metros', () => {
  assert.equal(W, 2000);
  assert.equal(H, 600);
  assert.match(DEMO_20X6_DEPOT_ID, /^dep_[a-f0-9]{32}$/);
  assert.equal(scenes.simple.objects.length, 9);
  assert.equal(scenes.dense.objects.length, 30);
});

test('todos os 30 locais possuem IDs, coordenadas e medidas válidas, sem colisões físicas', () => {
  const objects = scenes.dense.objects;
  const objectIds = new Set();
  const logicalLocationIds = new Set();
  for (const object of objects) {
    assert.match(object.id, /^obj_[a-f0-9]{32}$/);
    assert.match(object.warehouseLocationId, /^loc_[a-f0-9]{32}$/);
    assert.equal(objectIds.has(object.id), false);
    assert.equal(logicalLocationIds.has(object.warehouseLocationId), false);
    objectIds.add(object.id);
    logicalLocationIds.add(object.warehouseLocationId);
    assert.ok(object.width > 0 && object.height > 0);
    assert.ok(object.x >= 0 && object.y >= 0);
    assert.ok(object.x + object.width <= W);
    assert.ok(object.y + object.height <= H);
    assert.equal(object.rotation, 0);
    assert.ok(['SHELF', 'PALLET', 'FREEZER', 'REFRIGERATOR', 'BENCH'].includes(object.kind));
  }
  for (let i = 0; i < objects.length; i += 1) {
    for (let j = i + 1; j < objects.length; j += 1) {
      assert.equal(intersects(objects[i], objects[j]), false,
        'Colisão entre ' + objects[i].label + ' e ' + objects[j].label);
    }
  }
});

test('locais, subposições e saldos simulados se referem às mesmas identidades', () => {
  for (const scene of Object.values(scenes)) {
    const locations = new Map(scene.locations.map((location) => [location.id, location]));
    const materials = new Set(scene.materials.map((material) => material.id));
    for (const object of scene.objects) {
      const location = locations.get(object.warehouseLocationId);
      assert.ok(location, object.label);
      assert.equal(location.kind, 'LOCAL');
      assert.equal(location.code, object.label);
      assert.equal(location.depotId, DEMO_20X6_DEPOT_ID);
    }
    for (const location of scene.locations) {
      if (location.kind === 'SUBPOSITION') {
        assert.ok(locations.has(location.parentLocationId));
      }
    }
    for (const balance of scene.balances) {
      assert.ok(materials.has(balance.materialId));
      assert.ok(locations.has(balance.position.locationId));
      assert.equal(balance.position.depotId, DEMO_20X6_DEPOT_ID);
      if (balance.position.kind === 'SUBPOSITION') {
        const sub = locations.get(balance.position.subpositionId);
        assert.ok(sub);
        assert.equal(sub.parentLocationId, balance.position.locationId);
      }
      assert.ok(balance.quantity > 0);
    }
  }
});

test('o cenário simples é um subconjunto estável do denso', () => {
  const denseIds = new Set(scenes.dense.objects.map((object) => object.id));
  for (const object of scenes.simple.objects) assert.ok(denseIds.has(object.id));
  assert.equal(scenes.dense.objects.filter((x) => x.kind === 'SHELF').length, 18);
  assert.equal(scenes.dense.objects.filter((x) => x.kind === 'PALLET').length, 6);
  assert.equal(scenes.dense.objects.filter((x) => x.kind === 'FREEZER').length, 2);
  assert.equal(scenes.dense.objects.filter((x) => x.kind === 'REFRIGERATOR').length, 2);
  assert.equal(scenes.dense.objects.filter((x) => x.kind === 'BENCH').length, 2);
});

test('laboratório acessível apenas em dev e sem autenticação, consultas ou gravações', () => {
  const page = read('app/visual-lab/deposito-20x6/page.tsx');
  const preview = read('features/warehouse/components/WarehouseDepot20x6Demo.tsx');
  const combined = page + preview + fixture;
  assert.match(page, /process\.env\.NODE_ENV !== 'development'\) notFound\(\)/);
  assert.match(page, /<WarehouseDepot20x6Demo/);
  assert.match(preview, /<WarehouseIsometricPreview/);
  assert.match(preview, /data-testid="warehouse-demo-preview-2d"/);
  assert.match(preview, /data-testid="warehouse-demo-preview-3d"/);
  assert.match(preview, /data-testid=\{'warehouse-demo-scenario-' \+ key\}/);
  assert.match(preview, /focusedLocationId=\{focusedLocationId\}/);
  assert.doesNotMatch(combined, /from ['"][^'"]*(?:firebase|Repository|auth|operationalPaths)/i);
  assert.doesNotMatch(combined, /\b(?:fetch|onSnapshot|getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc|runTransaction)\s*\(/);
  assert.doesNotMatch(preview, /onInspectLocation=/);
  assert.doesNotMatch(preview, /workspaceId=/);
});
