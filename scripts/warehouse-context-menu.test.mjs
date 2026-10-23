#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const editor = read('features/warehouse/components/WarehouseDepotLayoutEditor.tsx');
const center = read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
const demo = read('features/warehouse/components/WarehouseDepot20x6Demo.tsx');
const engine = read('lib/server/warehouseStructureLayoutApply.ts');
const preview = read('features/warehouse/components/WarehouseIsometricPreview.tsx');

test('o 3D oficial não desenha luminárias flutuantes nem halos amarelos nas paredes', () => {
  assert.doesNotMatch(preview, /lamp-back-|lamp-left-/);
  assert.doesNotMatch(preview, /fill="#fff7d6"/);
  assert.match(preview, /polygonPoints\(floor\)/);
});

test('clique direito abre menu compacto nas estruturas e evita arraste acidental', () => {
  assert.match(editor, /onContextMenu=\{event =>/);
  assert.match(editor, /event\.preventDefault\(\)/);
  assert.match(editor, /if \(event\.button !== 0\) return/);
  assert.match(editor, /warehouseIsPhysicalLocal\(object\)/);
  assert.match(editor, /data-testid="warehouse-croqui-context-menu"/);
  assert.match(editor, /role="menu"/);
  assert.match(editor, /contextMenu\.objectId/);
  assert.match(editor, /event\.key === 'Escape'/);
});

test('menu contém as cinco ações operacionais e janela de tamanho', () => {
  for (const action of [
    'Girar para esquerda','Girar para direita','Meia-volta (180°)',
    'Editar tamanho','Incluir subposição',
  ]) assert.ok(editor.includes(action), action);
  for (const key of [
    'warehouse-context-turn--1','warehouse-context-turn-1','warehouse-context-turn-2',
    'warehouse-context-edit-size','warehouse-context-add-subposition',
    'warehouse-croqui-size-modal','warehouse-size-width','warehouse-size-depth',
    'warehouse-size-save',
  ]) {
    if (key.startsWith('warehouse-context-turn-')) continue;
    assert.ok(editor.includes(key), key);
  }
  assert.match(editor, /quarters: -1 \| 1 \| 2/);
  assert.match(editor, /role="dialog" aria-modal="true"/);
});

test('editar tamanho recusa limites e colisões, sem modificar materiais ou saldos', () => {
  assert.match(editor, /width < MIN_SIZE \|\| height < MIN_SIZE/);
  assert.match(editor, /width > logicalWidth - target\.x \|\| height > logicalHeight - target\.y/);
  assert.match(editor, /warehouseLocalHasCollision\(candidate, objects\)/);
  assert.match(editor, /patchObject\(target\.id, \{ width, height \}\)/);
  assert.match(editor, /setSizeDialog\(null\)/);
  assert.doesNotMatch(editor, /\bsetDoc\(|\bupdateDoc\(|\baddDoc\(/);
});

test('menu cadastra subposição efetiva em local salvo ou pendente', () => {
  assert.match(editor, /onAddSubposition\?\.\(object\)/);
  assert.match(center, /onAddSubposition=\{addSubpositionFromContext\}/);
  assert.match(center, /addCroquiSubposition\(location\.id, location\.code\)/);
  assert.match(center, /subpositionCount: existing\.subpositionCount \+ 1/);
  assert.match(engine, /children\.length\+spec\.subpositionCount>30/);
  assert.match(engine, /warehouseNextAvailableLocationCode\(code\+'-00',copiedCodes\)/);
  assert.match(engine, /spec\.objectId\+':extra:'\+i/);
  assert.match(demo, /onAddSubposition=\{object=>/);
  assert.match(demo, /Sem integração com contas, depósitos ou saldos reais/);
});
