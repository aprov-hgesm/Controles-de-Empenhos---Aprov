#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const capacity = read('lib/platformCapacity.ts');
const lease = read('lib/platformSessionLease.ts');
const access = read('lib/platformAccess.ts');
const operational = read('hooks/useOperationalData.ts');
const sessionControl = read('lib/platformSessionControl.ts');
const provisioning = read('lib/server/sectorProvisioningAdmin.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/BLOCK_16_1_SESSION_ENFORCEMENT.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};

for (const marker of [
  "SESSION_LEASE_VERSION = 'emprovex_session_v1'",
  "LEGACY_SESSION_SLOT_IDS = ['slot-1', 'slot-2']",
  'export type WorkspaceSessionSlotId = string',
  'SESSION_LEASE_DURATION_MS = 30 * 60 * 1000',
  'SESSION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000',
]) {
  requireText(capacity, marker, `Contrato 16.1 ausente: ${marker}`);
}

for (const marker of [
  'runTransaction(db, async (transaction)',
  'const slotId: WorkspaceSessionSlotId = browserInstanceId',
  'getOrCreateBrowserInstanceId',
  'getOrCreateWorkspaceSessionId',
  'acquireWorkspaceSessionLease',
  'releaseWorkspaceSessionLease',
  'renewWorkspaceSessionLeaseIfDue',
  'isFounderCapacityExempt(user.email)',
  "'sessionSlots',\n    slotId",
  '{ documentReads: 2, documentWrites: 1 }',
]) {
  requireText(lease, marker, `Serviço de lease perdeu requisito: ${marker}`);
}

requireText(
  access,
  'await acquireWorkspaceSessionLease(user, context);',
  'Resolução externa deixou de exigir lease antes de liberar o workspace.'
);
requireText(
  access,
  "error.code",
  'Diagnóstico de capacidade deixou de ser preservado.'
);

for (const marker of [
  'explicitSignInRef',
  'releaseWorkspaceSessionLease',
  'clearLocalWorkspaceSessionLease',
  "diagnosticCode === 'SESSION_CAPACITY_EXCEEDED'",
  'startWorkspaceSessionControl',
]) {
  requireText(operational, marker, `Runtime de sessão perdeu requisito: ${marker}`);
}
for (const marker of [
  'renewWorkspaceSessionLeaseIfDue',
  'SESSION_HEARTBEAT_INTERVAL_MS',
  'subscribeWorkspaceSessionRevocation',
]) {
  requireText(sessionControl, marker, `Controle de sessão perdeu requisito histórico: ${marker}`);
}

for (const marker of [
  'function isLegacySessionSlotId(slotId)',
  'function isValidSessionSlotId(slotId)',
  'workspaceSessionSlotBindingMatches(slotId, request.resource.data)',
  'function validWorkspaceSessionLeaseCreate',
  'function validWorkspaceSessionLeaseUpdate',
  'function validWorkspaceSessionLeaseDelete',
  'match /workspaces/{workspaceId}/sessionSlots/{slotId}',
  'resource.data.expiresAt <= request.time',
  'Avalia o shape/tenant uma única vez',
  'request.resource.data.lastSeenAt == request.time',
]) {
  requireText(rules, marker, `Firestore Rules perderam proteção 16.1: ${marker}`);
}

for (const marker of [
  'Compatibilidade transitória preserva slot-1 legado',
  'Compatibilidade transitória preserva slot-2 legado',
  'Terceira sessão legítima usa lease dinâmico sem bloqueio de capacidade',
  'Quarta sessão legítima usa lease dinâmico sem bloqueio de capacidade',
  'Lease dinâmico exige documentId igual ao browserInstanceId',
  'Sessão diferente não sobrescreve lease dinâmico ainda ativo',
  'Conta fundadora não consome lease no workspace fundador',
]) {
  requireText(security, marker, `Suíte Firestore perdeu cenário 16.1: ${marker}`);
}

for (const marker of [
  'quatro sessões independentes coexistem e múltiplas abas compartilham a mesma sessão lógica',
  "page.getByText('Limite de acessos simultâneos atingido.', { exact: false })",
  'await logoutIfAuthenticated(pageD);',
]) {
  requireText(e2e, marker, `Browser E2E perdeu cenário 16.1: ${marker}`);
}

for (const marker of [
  'SESSION-CAP-01',
  'sem teto fixo',
  '30 minutos',
  '15 minutos',
  'compatibilidade transitória',
  'browserInstanceId',
]) {
  requireText(docs, marker, `Documentação 16.1 perdeu requisito: ${marker}`);
}

for (const marker of [
  'deleteFirestoreDocumentTree',
  'workspaces/${workspaceId}',
]) {
  requireText(provisioning, marker, `Rollback/provisionamento não limpa sessões dinâmicas: ${marker}`);
}

requireText(
  pkg,
  '"verify:block-16-1-session-enforcement"',
  'package.json não registra o guard do Bloco 16.1.'
);
requireText(
  workflow,
  'Block 16.1 session enforcement guard',
  'Application CI não executa o guard do Bloco 16.1.'
);

if (findings.length) {
  console.error('BLOCK 16.1 SESSION ENFORCEMENT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.1 SESSION ENFORCEMENT: READY');
  console.log('Setores externos: SESSÕES DINÂMICAS SEM TETO FIXO');
  console.log('Múltiplas abas: 1 VAGA POR NAVEGADOR');
  console.log('Conta fundadora: ILIMITADA');
  console.log('Identidade de lease: browserInstanceId / TRANSAÇÃO FIRESTORE');
  console.log('Lease atual: 30 MIN / HEARTBEAT: 15 MIN (otimizado no Bloco 17.1)');
  console.log('Terceira/quarta sessão: PERMITIDAS');
}
