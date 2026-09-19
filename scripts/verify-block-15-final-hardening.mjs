#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const requireRegex = (source, expected, message) => {
  if (!expected.test(source)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const rules = read('firestore.rules');
const audit = read('lib/auditTrail.ts');
const deletion = read('lib/empenhoDeletionService.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const plan = read('lib/operationalSubscriptionPlan.ts');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const docs = read('docs/BLOCK_15_FINAL_HARDENING.md');

for (const expected of [
  'match /workspaces/{workspaceId}/auditEvents/{eventId}',
  'match /platformAuditEvents/{eventId}',
  'allow update, delete: if false;',
  'request.resource.data.actorUid == request.auth.uid',
  'request.resource.data.createdAt == request.time',
]) {
  requireText(rules, expected, `Firestore Rules perderam garantia final: ${expected}`);
}
requireText(rules, 'canAccessWorkspace(workspaceId)', 'Rules perderam a primitiva de isolamento por workspace.');
requireRegex(
  rules,
  /match \/workspaces\/\{workspaceId\}\/empenhos\/\{id\} \{[\s\S]*?allow read: if canAccessWorkspace\(workspaceId\);/,
  'Empenhos deixaram de preservar leitura exclusivamente pelo tenant.'
);
requireRegex(
  rules,
  /match \/workspaces\/\{workspaceId\}\/settings\/documentStorage \{[\s\S]*?allow read: if canAccessWorkspace\(workspaceId\);/,
  'Configuração Google Drive deixou de permanecer privada ao próprio workspace.'
);
requireRegex(
  rules,
  /match \/platformUgIndex\/\{ug\} \{[\s\S]*?allow update, delete: if false;/,
  'Índice global de UG deixou de ser imutável.'
);
requireRegex(
  rules,
  /match \/empenhos\/\{id\} \{[\s\S]*?allow write: if false;/,
  'Coleção legada raiz de empenhos voltou a aceitar escrita.'
);

requireText(audit, "AUDIT_EVENT_VERSION = 'emprovex_audit_v1'", 'Versão da trilha de auditoria não está congelada.');
requireText(deletion, 'runTransaction(db, async (transaction)', 'Exclusão crítica de empenho deixou de ser transacional.');
requireText(realtime, 'useRealtimeCollectionSubscription', 'Subscriptions realtime deixaram de ser isoladas por coleção.');
requireText(plan, 'countRealtimeOperationalCollections', 'Plano realtime perdeu a métrica de listeners.');
requireText(e2e, 'perfil realtime acompanha a seção ativa sem manter coleções ociosas', 'E2E perdeu cobertura de escalabilidade realtime.');
requireText(e2e, 'exclusão protegida remove empenho, NF e NS lock sem estado parcial', 'E2E perdeu cobertura do fluxo destrutivo protegido.');

for (const marker of [
  'Administrador lista somente o diretório de workspaces',
  'Setor externo não lista o diretório global de workspaces',
  'Administrador não lista dados operacionais de setor externo',
  'Administrador não lê configuração Drive operacional de setor externo',
  'Administrador lê o índice global de UG',
  'Setor externo não lê o índice global de UG',
  'Índice global de UG não pode ser alterado depois de criado',
  'Índice global de UG não pode ser excluído',
  'Fundador não pode voltar a gravar no legado raiz',
  'Fundador autenticado por senha não acessa o legado raiz',
  'Administrador pode listar a auditoria administrativa',
  'Setor externo não lista a auditoria administrativa',
]) {
  requireText(security, marker, `Suíte multi-tenant perdeu o caso crítico: ${marker}`);
}

for (const scriptName of [
  '"verify:immutable-audit"',
  '"verify:block-10-consistency"',
  '"verify:block-12-empenho-deletion"',
  '"verify:block-13-empenho-concurrency"',
  '"verify:block-14-scalability"',
  '"test:e2e:browser"',
  '"verify:block-15-final-hardening"',
]) {
  requireText(pkg, scriptName, `package.json perdeu gate obrigatório: ${scriptName}`);
}

for (const step of [
  'Workspace Drive onboarding guard',
  'External Drive OAuth Firebase Auth emulator tests',
  'Multi-tenant Firestore security tests',
  'Immutable audit trail guard',
  'Block 10 historical consistency guard',
  'Block 12 empenho deletion integrity guard',
  'Block 13 empenho concurrency guard',
  'Block 14 operational scalability guard',
  'Block 15 final hardening guard',
  'Browser E2E with Firebase Emulator',
  'Production build',
  'Final TypeScript validation',
]) {
  requireText(workflow, step, `Application CI perdeu etapa obrigatória: ${step}`);
}

requireText(workflow, 'pull_request:', 'Application CI deixou de validar pull requests.');
requireText(workflow, 'push:\n    branches:\n      - main', 'Application CI deixou de validar push na main.');
requireText(workflow, 'workflow_dispatch:', 'Application CI perdeu execução manual.');
requireText(workflow, 'concurrency:', 'Application CI perdeu controle de concorrência.');
requireText(workflow, 'cancel-in-progress: true', 'Application CI deixou de cancelar execução obsoleta da mesma referência.');
requireText(workflow, 'block-15-release-gate:', 'Application CI perdeu o gate consolidado do Bloco 15.');
requireText(workflow, 'needs.validate-application.result', 'Gate final não verifica validate-application.');
requireText(workflow, 'needs.browser-e2e-emulator.result', 'Gate final não verifica Browser E2E.');
forbidText(workflow, 'continue-on-error: true', 'CI contém continue-on-error em etapa de validação.');

for (const expected of [
  'não altera regras de negócio',
  'não amplia permissões',
  'não migra dados',
  'Google Drive',
  'GitHub Actions',
  'release gate',
]) {
  requireText(docs, expected, `Contrato do Bloco 15 perdeu requisito: ${expected}`);
}
forbidText(docs, 'desabilitar auditoria', 'Contrato contém instrução incompatível com hardening.');

if (findings.length) {
  console.error('BLOCK 15 FINAL HARDENING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 15 FINAL HARDENING: READY');
  console.log('Isolamento multi-tenant: PRESERVADO E TESTADO');
  console.log('Admin sem bypass operacional: PROTEGIDO');
  console.log('Auditoria e índice UG: IMUTÁVEIS');
  console.log('Google Drive por tenant: PROTEGIDO');
  console.log('Legado raiz: SOMENTE LEITURA');
  console.log('Subscriptions realtime: VIEW-AWARE');
  console.log('Browser E2E + Emulator: PRESERVADOS');
  console.log('CI em PR + main + release gate: ENCADEADA');
}
