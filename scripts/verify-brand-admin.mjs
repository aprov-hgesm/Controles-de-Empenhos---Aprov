#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const createModal = read('components/admin/CreateSectorModal.tsx');
const editModal = read('components/admin/EditSectorModal.tsx');
const toast = read('components/layout/ToastNotification.tsx');
const contract = read('ops/brand-identity-contract.json');
const doc = read('docs/BRAND_ADMIN_BLOCK_3.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const required of [
  'usePlatformBranding',
  'customLogo={customLogo}',
  'Validando perfil administrativo...',
  'bg-[#020817]',
]) {
  requireText(adminPage, required, `Rota administrativa perdeu requisito visual/branding: ${required}`);
}

for (const required of [
  'customLogo: string | null',
  '<ToastNotification toast={toast}',
  'showAdminToast',
  'Central de Administração EMPROVEX',
  'EMPROVEX // CICLO DE VIDA',
  'role="alertdialog"',
  'Confirmar suspensão',
  'Confirmar reativação',
  'bg-[#020817]',
  'bg-[#071225]',
  'useReducedMotion()',
]) {
  requireText(adminView, required, `Administração integrada perdeu requisito: ${required}`);
}

for (const forbidden of [
  'window.confirm(',
  'successMessage',
  'useOperationalData',
  'useOperationalViewState',
  'useNotasFiscaisActions',
  'useEmpenhoActions',
]) {
  forbidText(adminView, forbidden, `Administração reintroduziu padrão proibido: ${forbidden}`);
}

for (const modal of [createModal, editModal]) {
  requireText(modal, 'bg-[#020817]/85', 'Modal administrativo não usa overlay da nova identidade.');
  requireText(modal, 'bg-[#071225]', 'Modal administrativo não usa painel da nova identidade.');
}

requireText(toast, 'export function ToastNotification', 'Toast compartilhado não está disponível para a Administração.');

for (const id of ['BRAND-001', 'BRAND-004', 'BRAND-005', 'BRAND-007', 'BRAND-009']) {
  requireText(contract, id, `Contrato congelado não contém ${id}.`);
  requireText(doc, id, `Documento do Bloco 3 não referencia ${id}.`);
}

requireText(pkg, '"verify:brand-admin"', 'package.json não registra o guard da Administração integrada.');
requireText(workflow, 'EMPROVEX brand admin guard', 'Application CI não executa o guard da Administração integrada.');

if (findings.length > 0) {
  console.error('EMPROVEX BRAND ADMIN: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX BRAND ADMIN: READY');
  console.log('Identidade: login + App Shell + Administração');
  console.log('Logo global: reutilizado');
  console.log('Feedback compartilhado: ToastNotification');
  console.log('window.confirm administrativo: removido');
  console.log('Subscriptions operacionais no Admin: NÃO');
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
