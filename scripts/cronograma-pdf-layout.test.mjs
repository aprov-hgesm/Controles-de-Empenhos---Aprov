#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(resolve(process.cwd(), 'features/cronogramas/domain/cronogramaPdfLayout.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
runInNewContext(transpiled, { module: mod, exports: mod.exports, RangeError });
const { getCronogramaPdfLayout, splitCronogramaRemessas } = mod.exports;

test('até 3 remessas preserva A4 vertical; a partir de 4 muda para horizontal', () => {
  for (const count of [0, 1, 2, 3]) assert.equal(getCronogramaPdfLayout(count).orientation, 'portrait');
  for (const count of [4, 7, 8, 9, 16]) assert.equal(getCronogramaPdfLayout(count).orientation, 'landscape');
});

test('descrição mantém largura legível, inclusive com 7 e 8 remessas', () => {
  for (const count of [3, 7, 8]) {
    const layout = getCronogramaPdfLayout(count);
    const visibleColumns = Math.min(count, layout.maxRemessasPerTable);
    const descriptionWidth = layout.pageContentWidth - 97 - visibleColumns * layout.remessaWidth;
    assert.ok(descriptionWidth >= 38, `descrição estreita para ${count} remessas: ${descriptionWidth} mm`);
  }
});

test('mais de 8 remessas são divididas sem perda, repetição ou reordenação', () => {
  const remessas = Array.from({ length: 19 }, (_, i) => `r${i + 1}`);
  const groups = splitCronogramaRemessas(remessas, 8);
  assert.deepEqual(Array.from(groups, (g) => g.length), [8, 8, 3]);
  assert.deepEqual(Array.from(groups.flat()), remessas);
  assert.equal(splitCronogramaRemessas([], 8).length, 1);
});

test('campos longos preservam o conteúdo e respeitam cada quebra de linha', () => {
  const { wrapCronogramaPdfLines } = mod.exports;
  const splitter = (line, width) => {
    const max = Math.max(1, Math.floor(width));
    const chunks = [];
    for (let i = 0; i < line.length; i += max) chunks.push(line.slice(i, i + max));
    return chunks;
  };
  const original = 'AMC COMERCIO DE ALIMENTOS LTDA COM NOME EMPRESARIAL EXTENSO';
  const lines = wrapCronogramaPdfLines(original, 15, splitter);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => line.length <= 15));
  assert.equal(lines.join(''), original);
  const paragraphs = wrapCronogramaPdfLines('Primeira instrução\nSegunda instrução', 30, splitter);
  assert.deepEqual(Array.from(paragraphs), ['Primeira instrução', 'Segunda instrução']);
});
