#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
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
requireText(audit, "AUDIT_EVENT_VERSION = 'emprovex_audit_v1'", 'Versão da trilha de auditoria não está congelada.');
requireText(deletion, 'runTransaction(db, async (transaction)', 'Exclusão crítica de empenho deixou de ser transacional.');
requireText(realtime, 'useRealtimeCollectionSubscription', 'Subscriptions realtime deixaram de ser isoladas por coleção.');
requireText(plan, 'countRealtimeOperationalCollections', 'Plano realtime perdeu a métrica de listeners.');
requireText(e2e, 'perfil realtime acompanha a seção ativa sem manter coleções ociosas', 'E2E perdeu cobertura de escalabilidade realtime.');

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

requireText(docs, 'não amplia permissões', 'Contrato do Bloco 15 não limita expansão de permissões.');
requireText(docs, 'não migra dados', 'Contrato do Bloco 15 não protege a baseline contra migração acidental.');
forbidText(docs, 'desabilitar auditoria', 'Contrato contém instrução incompatível com hardening.');

if (findings.length) {
  console.error('BLOCK 15 FINAL HARDENING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 15 FINAL HARDENING: READY');
  console.log('Isolamento multi-tenant: PRESERVADO');
  console.log('Auditoria imutável: PRESERVADA');
  console.log('Concorrência crítica: TRANSACIONAL');
  console.log('Subscriptions realtime: VIEW-AWARE');
  console.log('Browser E2E + Emulator: PRESERVADO');
  console.log('CI final: ENCADEADA');
}
