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
  "SESSION_SLOT_IDS = ['slot-1', 'slot-2']",
  'SESSION_LEASE_DURATION_MS = 30 * 60 * 1000',
  'SESSION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000',
]) {
  requireText(capacity, marker, `Contrato 16.1 ausente: ${marker}`);
}

for (const marker of [
  'runTransaction(db, async (transaction)',
  'SESSION_CAPACITY_EXCEEDED_MESSAGE',
  'getOrCreateBrowserInstanceId',
  'getOrCreateWorkspaceSessionId',
  'acquireWorkspaceSessionLease',
  'releaseWorkspaceSessionLease',
  'renewWorkspaceSessionLeaseIfDue',
  'isFounderCapacityExempt(user.email)',
  'SESSION_SLOT_IDS.map',
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
  'renewWorkspaceSessionLeaseIfDue',
  'SESSION_HEARTBEAT_INTERVAL_MS',
  'releaseWorkspaceSessionLease',
  'clearLocalWorkspaceSessionLease',
  "diagnosticCode === 'SESSION_CAPACITY_EXCEEDED'",
]) {
  requireText(operational, marker, `Runtime de sessão perdeu requisito: ${marker}`);
}

for (const marker of [
  'function isValidSessionSlotId(slotId)',
  "return slotId in ['slot-1', 'slot-2'];",
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
  'Setor externo ocupa o primeiro slot de sessão',
  'Setor externo ocupa o segundo slot de sessão',
  'Terceiro slot não existe no contrato de capacidade',
  'Sessão diferente não sobrescreve slot ainda ativo',
  'Slot expirado pode ser retomado por uma nova sessão',
  'Conta fundadora não consome slot no workspace fundador',
]) {
  requireText(security, marker, `Suíte Firestore perdeu cenário 16.1: ${marker}`);
}

for (const marker of [
  'duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada',
  'Limite de acessos simultâneos atingido.',
  'await logoutIfAuthenticated(pageB);',
]) {
  requireText(e2e, marker, `Browser E2E perdeu cenário 16.1: ${marker}`);
}

for (const marker of [
  '2 sessões lógicas simultâneas por workspace/UG',
  'duração do lease: **10 minutos**',
  'heartbeat nominal: **5 minutos**',
  'identidade fundadora',
  'não ocupa slot',
]) {
  requireText(docs, marker, `Documentação 16.1 perdeu requisito: ${marker}`);
}

for (const marker of [
  'workspaces/${workspaceId}/sessionSlots/slot-1',
  'workspaces/${workspaceId}/sessionSlots/slot-2',
]) {
  requireText(provisioning, marker, `Exclusão administrativa não limpa slot: ${marker}`);
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
  console.log('Setores externos: 2 SESSÕES LÓGICAS');
  console.log('Múltiplas abas: 1 VAGA POR NAVEGADOR');
  console.log('Conta fundadora: ILIMITADA');
  console.log('Reserva de vaga: TRANSAÇÃO FIRESTORE');
  console.log('Lease atual: 30 MIN / HEARTBEAT: 15 MIN (otimizado no Bloco 17.1)');
  console.log('Terceira sessão: BLOQUEADA');
}
