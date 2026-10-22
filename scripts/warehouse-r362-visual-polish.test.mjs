#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// Contrato visual: não interpreta quantidades como medidas físicas, não altera dados
// e não substitui os motores oficiais de ocupação, validade e projeção.
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');
const landing = read('features/warehouse/components/WarehouseLandingOperational.tsx');
const style = read('features/warehouse/visualStyle.ts');

test('quatro perspectivas reutilizam a projeção física e o layout atuais', () => {
  for (const [id, name] of [['front', 'Frente'], ['right', 'Direita'], ['back', 'Trás'], ['left', 'Esquerda']]) {
    assert.ok(preview.includes(`{ id: '${id}', label: '${name}' }`), `vista ${id} deve permanecer acessível`);
  }
  assert.match(preview, /transformWarehouseIsoRectForView/);
  assert.match(preview, /warehouseIsoRoomDimensions/);
  assert.match(preview, /fitWarehouseIsometricScene/);
  assert.match(preview, /stockBoxesOnSurface\(/);
  assert.match(preview, /warehouseVisualStackSlots\(quantity, maximum\)/);
  assert.match(preview, /const topZ = supportZ \+ \(slot\.layer \+ 1\) \* boxHeight/);
  assert.match(preview, /const position = isoPoint\(/);
  assert.match(preview, /const shelfZ = z \* ratio/);
});

test('embalagens com faces, fita e sombras leves, preservando sinais de validade e seleção', () => {
  for (const id of ['r362BoxTop', 'r362BoxFront', 'r362BoxSide']) {
    assert.ok(preview.includes(`id="${id}"`));
    assert.ok(preview.includes(`url(#${id})`));
  }
  assert.match(preview, /data-visual-role="warehouse-stock-box"/);
  assert.match(preview, /data-expiry-state=\{expiry\}/);
  assert.match(preview, /expiry === 'near'/);
  assert.match(preview, /expiry === 'expired'/);
  assert.match(preview, /<ellipse cx="0" cy="22\.2" rx="13" ry="3\.2"/);
  assert.match(preview, /Fita e reflexos delicados/);
  assert.match(style, /WAREHOUSE_BOX_VISUAL/);
});

test('estantes, paletes, iluminação e rótulos usam acabamentos reutilizáveis, sem novos slots', () => {
  assert.match(preview, /id="r362RackBeam"/);
  assert.match(preview, /url\(#r362RackBeam\)/);
  assert.match(preview, /id="r362FloorBloom"/);
  assert.match(preview, /url\(#r362FloorBloom\)/);
  // Mantemos o realce de bordas sem um filtro de sombra que ampliaria o hover do SVG.
  assert.match(preview, /stroke=\{highlighted \? '#7db6ff' : '#d7e0e8'\}/);
  assert.doesNotMatch(preview, /r362LabelShadow/);
  assert.match(preview, /WAREHOUSE_PALLET_VISUAL\.highlight/);
  assert.match(preview, /WAREHOUSE_RACK_VISUAL\.postHighlight/);
  assert.match(preview, /data-location-id=\{object\.warehouseLocationId \|\| ''\}/);
  assert.match(preview, /onClick=\{handleOpen\}/);
  assert.match(preview, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('Landing mantém a mesma geometria e exibe acabamento consistente em paletes e NFs', () => {
  for (const id of ['r362WorldBoxTop', 'r362WorldBoxFront', 'r362WorldBoxSide', 'r362WorldWood', 'r362WorldLabelShadow']) {
    assert.ok(landing.includes(`id="${id}"`));
  }
  assert.match(landing, /data-visual-role=\{visualRole\}/);
  assert.match(landing, /isoPoint\(x \+ width \* 0\.44, y \+ depth \* 0\.06, z \+ height \+ 0\.3\)/);
  assert.match(landing, /data-visual-role="invoice-tooltip-overlay"/);
  assert.match(landing, /encodeURIComponent\(pendingGroup\.key\)/);
  assert.match(landing, /WarehouseIsometricPreview/);
  assert.doesNotMatch(landing, /LazyIntakeBulkActionPanel/);
});
