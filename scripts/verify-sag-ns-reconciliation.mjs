#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const engine = read('lib/sagNsReconciliation.ts');
const view = read('features/relatorios/components/SagImportView.tsx');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(engine, 'reconcileSagNsPayload', 'Motor de conciliação SAG ausente.');
requireText(engine, 'normalizeInvoiceNumber', 'Motor não usa a identidade normalizada da NF.');
requireText(engine, 'selectedEmpenhoIds', 'Motor não delimita o universo pelos empenhos do CNPJ.');
requireText(engine, "'matched'", 'Status de correspondência segura ausente.');
requireText(engine, "'already_registered'", 'Status de NS já cadastrada ausente.');
requireText(engine, "'ambiguous_invoice'", 'Status de ambiguidade ausente.');
requireText(engine, "'not_found'", 'Status de NF não encontrada ausente.');
requireText(engine, "'missing_nf_reference'", 'Status de NS sem referência de NF ausente.');
requireText(engine, "'conflict_existing_ns'", 'Bloqueio de NF com NS divergente ausente.');
requireText(engine, "'conflict_ns_reused'", 'Bloqueio de reutilização da NS ausente.');
requireText(engine, "'data_conflict'", 'Bloqueio de inconsistência de CNPJ ausente.');
requireText(
  engine,
  'A data da NF nunca decide o vínculo',
  'Garantia de que datas não decidem a conciliação foi removida.'
);
requireText(view, 'reconcileSagNsPayload', 'Assistente SAG não executa o motor de conciliação.');
requireText(view, 'Conciliação CNPJ → NF → NE', 'Diagnóstico da conciliação não aparece na interface.');
requireText(view, 'Somente leitura', 'Interface não sinaliza que a conciliação é somente leitura.');
requireText(view, 'Correspondência segura', 'Interface não diferencia correspondências seguras.');
requireText(
  view,
  'Nenhuma NS será gravada automaticamente',
  'Garantia de confirmação humana foi removida.'
);
forbidText(engine, 'updateDoc(', 'Motor de conciliação não pode gravar no Firestore.');
forbidText(engine, 'setDoc(', 'Motor de conciliação não pode gravar no Firestore.');
forbidText(engine, 'addDoc(', 'Motor de conciliação não pode gravar no Firestore.');
forbidText(view, 'updateDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 9.');
forbidText(view, 'setDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 9.');
forbidText(view, 'addDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 9.');
requireText(pkg, '"test:sag-ns-reconciliation"', 'Testes do motor SAG não estão registrados.');
requireText(pkg, '"verify:sag-ns-reconciliation"', 'Guard do motor SAG não está registrado.');
requireText(workflow, 'SAG NS reconciliation tests', 'CI não executa testes de conciliação SAG.');
requireText(workflow, 'SAG NS reconciliation guard', 'CI não executa o guard de conciliação SAG.');

if (findings.length) {
  console.error('SAG NS RECONCILIATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG NS RECONCILIATION: READY');
  console.log('Escopo por CNPJ: ATIVO');
  console.log('NF normalizada exata: ATIVO');
  console.log('Ambiguidades e conflitos: BLOQUEADOS');
  console.log('Persistência de NS: BLOQUEADA NESTE BLOCO');
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
