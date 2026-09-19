#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const source = readFileSync(resolve(root, 'lib/empenhoConcurrency.ts'), 'utf8');

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'empenhoConcurrency.ts',
}).outputText;

const context = vm.createContext({ console, Date });
const module = new vm.SourceTextModule(transpiled, {
  context,
  identifier: 'file:///lib/empenhoConcurrency.js',
});

await module.link(() => {
  throw new Error('empenhoConcurrency.ts não deve possuir import runtime.');
});
await module.evaluate();

const {
  assertEmpenhoRevision,
  buildNextEmpenho,
  buildNextEmpenhoRevisionMetadata,
  getEmpenhoRevision,
} = module.namespace;

const empenho = (revision) => ({
  id: '2026NE000001',
  supplier: 'Fornecedor',
  supplierCnpj: '11111111000191',
  description: 'Objeto',
  date: '2026-09-19',
  status: 'Ativo',
  items: [],
  ...(revision === undefined ? {} : { revision }),
});

test('documento legado sem revision é tratado como revisão lógica 0', () => {
  assert.equal(getEmpenhoRevision(empenho()), 0);
});

test('novo empenho recebe revision 1', () => {
  const next = buildNextEmpenho(
    empenho(),
    null,
    'uid-a',
    '2026-09-19T12:00:00.000Z'
  );
  assert.equal(next.revision, 1);
  assert.equal(next.updatedBy, 'uid-a');
  assert.equal(next.updatedAt, '2026-09-19T12:00:00.000Z');
});

test('atualização válida avança exatamente uma revisão', () => {
  const next = buildNextEmpenho(
    { ...empenho(4), pregao: '90001/2026' },
    empenho(4),
    'uid-a',
    '2026-09-19T12:01:00.000Z'
  );
  assert.equal(next.revision, 5);
  assert.equal(next.pregao, '90001/2026');
});

test('metadata parcial também avança uma revisão', () => {
  const metadata = buildNextEmpenhoRevisionMetadata(
    empenho(9),
    'uid-b',
    '2026-09-19T12:02:00.000Z'
  );
  assert.equal(metadata.revision, 10);
  assert.equal(metadata.updatedAt, '2026-09-19T12:02:00.000Z');
  assert.equal(metadata.updatedBy, 'uid-b');
});

test('mesma revisão observada pode ser validada', () => {
  assert.doesNotThrow(() => assertEmpenhoRevision(empenho(3), 3));
});

test('revisão obsoleta é bloqueada como stale_revision', () => {
  assert.throws(
    () => assertEmpenhoRevision(empenho(4), 3),
    (error) => error?.code === 'stale_revision'
      && String(error.message).includes('alterado por outra sessão')
  );
});

test('documento legado aceita expectativa 0', () => {
  assert.doesNotThrow(() => assertEmpenhoRevision(empenho(), undefined));
});

test('revision inválida é fail-closed', () => {
  assert.throws(
    () => getEmpenhoRevision(empenho(-1)),
    (error) => error?.code === 'invalid_revision'
  );
});
