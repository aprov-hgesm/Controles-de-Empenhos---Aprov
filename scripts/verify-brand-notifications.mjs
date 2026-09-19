#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const toast = read('components/layout/ToastNotification.tsx');
const login = read('components/auth/EmprovexLogin.tsx');
const page = read('app/page.tsx');
const contract = read('ops/brand-identity-contract.json');
const doc = read('docs/BRAND_NOTIFICATIONS_BLOCK_1.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const required of [
  "type: 'success' | 'error' | 'info'",
  "role={toast.type === 'error' ? 'alert' : 'status'}",
  "aria-live={toast.type === 'error' ? 'assertive' : 'polite'}",
  'aria-atomic="true"',
  'aria-label="Fechar notificação"',
  'useReducedMotion()',
  'data-toast-type={toast.type}',
  "bg-[#061126]/[0.96]",
  'Operação concluída',
  'Atenção necessária',
  'Informação do sistema',
  'EMPROVEX // CONFIRMAÇÃO',
  'EMPROVEX // ALERTA',
  'EMPROVEX // SISTEMA',
]) {
  requireText(toast, required, `Toast 2.0 perdeu requisito: ${required}`);
}

for (const forbidden of [
  'bg-emerald-50/95',
  'bg-rose-50/95',
  'bg-blue-50/95',
]) {
  forbidText(toast, forbidden, `Toast voltou a usar superfície clara legada: ${forbidden}`);
}

requireText(login, '<ToastNotification toast={toast}', 'Login deixou de reutilizar o ToastNotification compartilhado.');
requireText(page, '<ToastNotification toast={toast}', 'Aplicação operacional deixou de reutilizar o ToastNotification compartilhado.');

for (const id of ['BRAND-005', 'BRAND-006', 'BRAND-007', 'GAP-BRAND-001']) {
  requireText(contract, id, `Contrato congelado não contém ${id}.`);
  requireText(doc, id, `Documento do Bloco 1 não referencia ${id}.`);
}

requireText(doc, 'useReducedMotion()', 'Documentação deixou de registrar reduced-motion.');
requireText(pkg, '"verify:brand-notifications"', 'package.json não registra o guard do Bloco 1.');
requireText(workflow, 'EMPROVEX brand notifications guard', 'Application CI não executa o guard do Bloco 1.');

if (findings.length > 0) {
  console.error('EMPROVEX BRAND NOTIFICATIONS: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX BRAND NOTIFICATIONS: READY');
  console.log('Visual: dark cinematic');
  console.log('API preservada: success | error | info');
  console.log('Acessibilidade: ARIA + focus + reduced-motion');
  console.log('Superfícies compartilhadas: login + aplicação operacional');
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
