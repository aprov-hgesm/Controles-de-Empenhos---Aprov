#!/usr/bin/env node

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(content, needle, message) {
  if (!content.includes(needle)) throw new Error(message);
}

function forbidText(content, needle, message) {
  if (content.includes(needle)) throw new Error(message);
}

const packageJson = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const rules = read('firestore.rules');
const closure = read('docs/BLOCK_16_9_FINAL_AUDIT_CLOSURE.md');

const blockDocs = [
  'docs/BLOCK_16_0_CAPACITY_FOUNDATION.md',
  'docs/BLOCK_16_1_SESSION_ENFORCEMENT.md',
  'docs/BLOCK_16_2_ADMIN_SESSION_PANEL.md',
  'docs/BLOCK_16_3_WORKSPACE_TELEMETRY.md',
  'docs/BLOCK_16_4_GLOBAL_CLOUD_MONITORING.md',
  'docs/BLOCK_16_5_CONSOLIDATED_USAGE_DASHBOARD.md',
  'docs/BLOCK_16_6_USAGE_ALERTS.md',
  'docs/BLOCK_16_7_SECURITY_CONCURRENCY_HARDENING.md',
  'docs/BLOCK_16_8_INTEGRATED_E2E.md',
  'docs/BLOCK_16_9_FINAL_AUDIT_CLOSURE.md',
];

for (const path of blockDocs) {
  if (!fs.existsSync(path)) throw new Error(`Documento obrigatório do Bloco 16 ausente: ${path}`);
}

for (const script of [
  '"verify:block-16-0-capacity-foundation"',
  '"verify:block-16-1-session-enforcement"',
  '"verify:block-16-2-admin-session-panel"',
  '"verify:block-16-3-workspace-telemetry"',
  '"verify:block-16-4-global-monitoring"',
  '"verify:block-16-5-consolidated-usage"',
  '"verify:block-16-6-usage-alerts"',
  '"verify:block-16-7-security-concurrency"',
  '"test:block-16-8-integrated-domain"',
  '"verify:block-16-8-integrated-e2e"',
  '"verify:block-16-9-final-closure"',
  '"test:security:multitenant"',
  '"test:e2e:browser"',
  '"test:empenho-concurrency"',
  '"verify:workspace-drive"',
  '"verify:hybrid-auth-model"',
  '"verify:uid-binding"',
  '"verify:immutable-audit"',
]) {
  requireText(packageJson, script, `package.json perdeu gate obrigatório: ${script}`);
}

for (const ciStep of [
  'Block 16.0 capacity foundation guard',
  'Block 16.1 session enforcement guard',
  'Block 16.2 admin session panel guard',
  'Block 16.3 workspace telemetry guard',
  'Block 16.4 global Cloud Monitoring guard',
  'Block 16.5 consolidated usage dashboard guard',
  'Block 16.6 usage alerts guard',
  'Block 16.7 security and concurrency hardening guard',
  'Block 16.8 integrated domain tests',
  'Block 16.8 integrated E2E guard',
  'Block 16.9 final audit and closure guard',
  'Multi-tenant Firestore security tests',
  'Workspace Google Drive guard',
  'Hybrid authentication model guard',
  'Secure UID binding guard',
  'Immutable audit trail guard',
  'Empenho concurrency domain tests',
  'Production build',
  'Final TypeScript validation',
  'Diff hygiene',
  'Browser E2E with Firebase Emulator',
  'Block 16 Final Release Gate',
]) {
  requireText(workflow, ciStep, `Application CI perdeu gate de fechamento: ${ciStep}`);
}

for (const releaseInvariant of [
  'block-16-release-gate:',
  'needs:',
  '- validate-application',
  '- browser-e2e-emulator',
]) {
  requireText(workflow, releaseInvariant, `Release gate final incompleto: ${releaseInvariant}`);
}

forbidText(
  workflow,
  'Block 15 Final Release Gate',
  'Release gate legado do Bloco 15 não pode permanecer como gate final após o fechamento do Bloco 16.'
);
forbidText(
  workflow,
  'vercel deploy',
  'Application CI do Bloco 16 não pode realizar deploy Vercel.'
);

for (const invariant of [
  'isGoogleFounderSession()',
  "slotId in ['slot-1', 'slot-2']",
  'match /workspaces/{workspaceId}/sessionRevocations/{sessionId}',
  'allow update, delete: if false;',
  'match /workspaces/{workspaceId}/usageEstimates/{dayKey}',
]) {
  requireText(rules, invariant, `Invariante multi-tenant do fechamento ausente: ${invariant}`);
}

for (const invariant of [
  'Blocos 16.0 a 16.8 auditados como um único conjunto',
  'não altera `firestore.rules`',
  'Google Drive permanece o armazenamento exclusivo de PDFs e documentos',
  'não executa deploy manual ou de produção na Vercel',
  'métrica global real, estimativa interna por UG e cobrança oficial permanecem conceitos separados',
  'Bloco 16 Final Release Gate',
]) {
  requireText(closure, invariant, `Documento de fechamento perdeu requisito: ${invariant}`);
}

console.log('Bloco 16.9: auditoria final, fechamento e release gate do Bloco 16 verificados.');
