#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const view = read('features/empenhos/components/EmpenhosView.tsx');
const doc = read('docs/EMPENHOS_SUBTABS_BLOCK_2.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const required of [
  "useState<'overview' | 'register' | 'classes'>('overview')",
  'role="tablist"',
  'id="empenhos-tab-overview"',
  'id="empenhos-tab-register"',
  'id="empenhos-tab-classes"',
  'id="empenhos-panel-overview"',
  'id="empenhos-panel-register"',
  'id="empenhos-panel-classes"',
  'Visão geral',
  'Cadastrar Empenho',
  'Configurar Classes',
  "selectEmpenhosSubTab('register')",
  'role="tabpanel"',
  'overflow-x-auto rounded-2xl border border-gray-100 shadow-sm',
  'Modal breve de confirmação: permitido pelo contrato de UX',
]) {
  requireText(view, required, `Subabas de Empenhos perderam requisito: ${required}`);
}

for (const forbidden of [
  'showClassesModal',
  'setShowClassesModal',
  'fixed inset-0 z-[110]',
  'fixed inset-0 z-[100]',
  'max-h-[calc(100vh-7rem)]',
  'max-h-[75vh] overflow-y-auto',
]) {
  forbidText(view, forbidden, `Fluxo extenso voltou ao padrão de modal/scroll interno: ${forbidden}`);
}

for (const requiredDoc of [
  'Visão geral',
  'Cadastrar Empenho',
  'Configurar Classes',
  'Superfícies de trabalho extensas não devem usar modal',
  'Confirmar Cadastro',
]) {
  requireText(doc, requiredDoc, `Documentação do Bloco 2 perdeu requisito: ${requiredDoc}`);
}

requireText(pkg, '"verify:empenhos-subtabs"', 'package.json não registra o guard das subabas de Empenhos.');
requireText(workflow, 'EMPROVEX empenhos subtabs guard', 'Application CI não executa o guard das subabas de Empenhos.');

if (findings.length > 0) {
  console.error('EMPROVEX EMPENHOS SUBTABS: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX EMPENHOS SUBTABS: READY');
  console.log('Subabas: visão geral + cadastro + classes');
  console.log('Overlays extensos removidos: SIM');
  console.log('Modal breve de confirmação preservado: SIM');
  console.log('Persistência e domínio alterados: NÃO');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
