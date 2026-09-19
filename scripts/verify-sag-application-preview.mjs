#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const model = read('lib/sagNsApplicationPreview.ts');
const view = [
  read('features/relatorios/components/SagImportView.tsx'),
  read('features/relatorios/components/SagApplicationPreviewSection.tsx'),
].join('\n');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(model, 'buildSagNsApplicationPreview', 'Modelo de prévia de aplicação SAG ausente.');
requireText(model, "'change'", 'Decisão ALTERAR ausente.');
requireText(model, "'unchanged'", 'Decisão SEM ALTERAÇÃO ausente.');
requireText(model, "'ignored'", 'Decisão IGNORAR ausente.');
requireText(model, "'blocked'", 'Decisão BLOQUEAR ausente.');
requireText(model, 'canAdvanceToPersistenceReview', 'Prévia não informa se o lote pode avançar para revisão de persistência.');
requireText(model, "decision === 'change' ? item.record.ns : null", 'NS proposta não está restrita a correspondências seguras.');
requireText(view, 'buildSagNsApplicationPreview', 'Assistente SAG não monta a prévia de aplicação.');
requireText(view, 'O que aconteceria com este lote', 'Cabeçalho da prévia visual ausente.');
requireText(view, 'ALTERAR', 'Interface não distingue alterações propostas.');
requireText(view, 'SEM ALTERAÇÃO', 'Interface não distingue registros inalterados.');
requireText(view, 'IGNORAR', 'Interface não distingue registros ignorados.');
requireText(view, 'BLOQUEAR', 'Interface não distingue registros bloqueados.');
requireText(view, 'NS atual', 'Prévia não mostra o valor atual.');
requireText(view, 'NS proposta', 'Prévia não mostra o valor proposto.');
requireText(view, 'O que aconteceria com este lote', 'Prévia não preserva a camada visual antes da persistência.');
requireText(view, 'Revisar gravação de', 'Prévia não encaminha alterações seguras para a revisão humana do Bloco 11.');
requireText(view, 'Nenhuma NS será gravada automaticamente', 'Garantia de confirmação humana foi removida.');

forbidText(model, 'updateDoc(', 'Modelo de prévia não pode gravar no Firestore.');
forbidText(model, 'setDoc(', 'Modelo de prévia não pode gravar no Firestore.');
forbidText(model, 'addDoc(', 'Modelo de prévia não pode gravar no Firestore.');
forbidText(view, 'updateDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 10.');
forbidText(view, 'setDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 10.');
forbidText(view, 'addDoc(', 'Assistente SAG não pode gravar no Firestore no Bloco 10.');
forbidText(view, 'updateDoc(', 'A prévia não deve escrever diretamente no Firestore.');
forbidText(view, 'setDoc(', 'A prévia não deve escrever diretamente no Firestore.');
forbidText(view, 'addDoc(', 'A prévia não deve escrever diretamente no Firestore.');

requireText(pkg, '"test:sag-application-preview"', 'Testes da prévia SAG não estão registrados.');
requireText(pkg, '"verify:sag-application-preview"', 'Guard da prévia SAG não está registrado.');
requireText(workflow, 'SAG application preview tests', 'CI não executa testes da prévia SAG.');
requireText(workflow, 'SAG application preview guard', 'CI não executa o guard da prévia SAG.');

if (findings.length) {
  console.error('SAG APPLICATION PREVIEW: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG APPLICATION PREVIEW: READY');
  console.log('Alterações propostas: VISÍVEIS');
  console.log('Ignorados e bloqueios: VISÍVEIS');
  console.log('Antes/depois de numeroNS: VISÍVEL');
  console.log('Persistência: MEDIADA PELO BLOCO 11');
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
