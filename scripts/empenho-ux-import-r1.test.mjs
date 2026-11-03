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
const parser = read('lib/server/empenhoPdfParser.ts');
const compiled = ts.transpileModule(parser, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const api = {};
runInNewContext(compiled, {exports: api, require, Buffer});
const extract = api.extractPregaoNumberFromText;

test('6ª Bda Inf Bld: identifica PE NR mesmo no meio da observação', () => {
  assert.equal(extract('APROV_CMDO6BDA/CMDO 6ª BDA, PE NR 90049/2025 UASG 160413 UGG, FINALIDADE AQUISICAO DE GENEROS ALIMENTICIOS'), '90049/2025');
  assert.equal(extract('PE   NR 90049 / 2025 - processo 2026.0001'), '90049/2025');
});
test('HGeSM: mantém leitura de PREGÃO ELETRÔNICO, SRP e números do padrão anterior', () => {
  assert.equal(extract('PREGÃO ELETRÔNICO Nº 90013/2025'), '90013/2025');
  assert.equal(extract('Pregao Eletronico 90049/2025'), '90049/2025');
  assert.equal(extract('SRP 90049/2025'), '90049/2025');
  assert.equal(extract('PE Nº 90049/2025 UASG 160413'), '90049/2025');
});
test('não atribui pregão a processo, UASG, NC, contrato ou dispensa sem vínculo', () => {
  assert.equal(extract('PROCESSO 90049/2025 UASG 160413 2026NC412337'), null);
  assert.equal(extract('DISPENSA ELETRONICA NR 90049/2025 CONTRATO 09/2025'), null);
  assert.equal(extract('CONTRATO Nº 90049/2025'), null);
});

test('seletor da NF: busca textual, opções compactas, suporte a teclado e limite visível', () => {
  const picker=read('features/notas-fiscais/components/NfEmpenhoPicker.tsx');
  const view=read('features/notas-fiscais/components/NotasFiscaisView.tsx');
  assert.match(view, /<NfEmpenhoPicker/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /ArrowDown|ArrowUp/);
  assert.match(picker, /event.key === 'Escape'/);
  assert.match(picker, /event.key === 'Enter'/);
  assert.match(picker, /matches\.slice\(0, 35\)/);
  assert.match(picker, /emp\.supplierCnpj/);
  assert.match(picker, /emp\.pregao/);
  assert.doesNotMatch(picker, /emp\.description/);
  assert.doesNotMatch(view, /\{emp\.id\} - \{emp\.supplier\} \(\{emp\.description\}\)/);
});

test('observação: editável durante importação PDF e após o registro; persistência pela mesma transação do empenho', () => {
  const view=read('features/empenhos/components/EmpenhosView.tsx');
  const actions=read('features/empenhos/hooks/useEmpenhoActions.ts');
  const host=read('features/operational/components/OperationalWorkspace.tsx');
  assert.match(view, /Editar observação da NE/);
  assert.match(view, /Salvar observação/);
  assert.match(view, /Observação \/ descrição da Nota de Empenho/);
  assert.match(actions, /const handleUpdateEmpenhoDescription = async/);
  assert.match(actions, /await saveEmpenho\(user\.uid, \{ \.\.\.currentEmpenho, description \}\)/);
  assert.match(host, /handleUpdateEmpenhoDescription/);
});
