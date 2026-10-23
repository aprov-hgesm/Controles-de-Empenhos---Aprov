#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('lib/warehouse/croquiCardLabel.ts');
const exports = {};
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: () => { throw new Error('Unexpected import'); } });
const { warehouseCroquiCardCode: code } = exports;

test('o card exibe apenas EST-15 independentemente do formato do nome', () => {
  assert.equal(code('EST-15 - Estante 15'), 'EST-15');
  assert.equal(code('EST-15 · Estante 15'), 'EST-15');
  assert.equal(code('EST-15'), 'EST-15');
  assert.equal(code(' EST-15 · Estante 15 '), 'EST-15');
});

test('outros locais mantêm somente o próprio código operacional', () => {
  assert.equal(code('EST-02 · Estante 02'), 'EST-02');
  assert.equal(code('PAL-06 · Palete 06'), 'PAL-06');
  assert.equal(code('GEL-01 · Geladeira 01'), 'GEL-01');
  assert.equal(code('BAN-02'), 'BAN-02');
  assert.equal(code('MES-01 · Mesa'), 'MES-01');
});

test('ID técnico ou rótulo sem código jamais é exposto como código de local', () => {
  assert.equal(code('loc_'+'a'.repeat(32)), 'LOCAL');
  assert.equal(code('sub_'+'b'.repeat(32)), 'LOCAL');
  assert.equal(code('Cópia visual · Estante 03'), 'LOCAL');
  assert.equal(code('Estante 15'), 'LOCAL');
});

test('o editor não imprime ID de localização, mantém orientação e dados internos', () => {
  const editor = read('features/warehouse/components/WarehouseDepotLayoutEditor.tsx');
  assert.match(editor, /warehouseCroquiCardCode\(object\.label\)/);
  assert.match(editor, /warehouseIsPhysicalLocal\(object\)/);
  assert.match(editor, /data-testid=\{'warehouse-croqui-card-code-'\+object\.id\}/);
  assert.match(editor, /\{cardLabel\}/);
  assert.doesNotMatch(editor, /\{object\.warehouseLocationId\}<\/div>/);
  assert.match(editor, /warehouseObjectFaceLabels\(object\)/);
  assert.match(editor, /data-testid=\{'warehouse-editor-front-'\+object\.id\}/);
  assert.match(editor, /data-testid=\{'warehouse-editor-back-'\+object\.id\}/);
  // O ID continua necessário apenas ao relacionamento de estoque/seleção.
  assert.match(editor, /warehouseLocationId: null/);
});
