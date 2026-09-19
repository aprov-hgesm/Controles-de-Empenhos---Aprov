#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const contract = JSON.parse(read('ops/brand-identity-contract.json'));
const doc = read('docs/BRAND_IDENTITY_CONTRACT.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const page = read('app/page.tsx');
const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const toast = read('components/layout/ToastNotification.tsx');
const branding = read('hooks/usePlatformBranding.ts');
const logo = read('components/layout/chrome/AppShellLogo.tsx');
const rules = read('firestore.rules');

if (contract.contractVersion !== 'emprovex_brand_identity_v1') {
  findings.push('Versão congelada do contrato de identidade visual foi alterada sem migração explícita.');
}
if (contract.status !== 'frozen') {
  findings.push('Contrato de identidade visual deixou de estar congelado.');
}
if (contract.block !== 0 || contract.runtimeBehaviorChange !== false) {
  findings.push('Bloco 0 deve continuar declarando ausência de mudança de runtime.');
}

const requiredInvariantIds = Array.from(
  { length: 10 },
  (_, index) => `BRAND-${String(index + 1).padStart(3, '0')}`
);
const declaredInvariantIds = new Set(contract.invariants?.map((item) => item.id) || []);

for (const id of requiredInvariantIds) {
  if (!declaredInvariantIds.has(id)) findings.push(`Invariante obrigatório ausente: ${id}`);
  if (!doc.includes(id)) findings.push(`Documentação não apresenta o invariante ${id}`);
}

for (const text of [
  'Bloco 1 — Notificações EMPROVEX 2.0',
  'Bloco 2 — Administração integrada',
  'Bloco 3 — Logo institucional permanente',
  'Bloco 4 — Validação final',
  'Não objetivos do Bloco 0',
]) {
  if (!doc.includes(text)) findings.push(`Documento perdeu seção obrigatória: ${text}`);
}

requireText(page, '<ToastNotification toast={toast}', 'Aplicação deixou de montar o componente compartilhado de notificação.');
requireText(adminPage, '<PlatformAdminView', 'Rota administrativa deixou de montar PlatformAdminView.');
requireText(toast, 'export function ToastNotification', 'Componente global de notificação não foi encontrado.');
requireText(branding, "doc(db, 'settings', 'global')", 'Branding deixou de resolver o documento global settings/global.');
requireText(logo, 'export function AppShellLogo', 'Componente oficial de logo do App Shell não foi encontrado.');
requireText(rules, 'match /settings/global', 'Firestore Rules perderam a declaração do setting global de branding.');
requireText(adminView, 'Central de Administração EMPROVEX', 'Superfície administrativa principal não foi encontrada.');

if (!pkg.includes('"verify:brand-identity-foundation"')) {
  findings.push('Guard da identidade visual não está registrado no package.json.');
}
if (!workflow.includes('EMPROVEX brand identity foundation guard')) {
  findings.push('Application CI não executa o guard da identidade visual.');
}

if (findings.length > 0) {
  console.error('EMPROVEX BRAND IDENTITY FOUNDATION: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX BRAND IDENTITY FOUNDATION: FROZEN');
  console.log('Contrato: emprovex_brand_identity_v1');
  console.log('Runtime alterado pelo Bloco 0: NÃO');
  console.log('Invariantes protegidos: 10');
  console.log('Superfícies auditadas: notificações + Administração + branding global');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
