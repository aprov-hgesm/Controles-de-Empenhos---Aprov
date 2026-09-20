#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const findings = [];
const requireText = (source, needle, message) => {
  if (!source.includes(needle)) findings.push(message);
};
const forbidText = (source, needle, message) => {
  if (source.includes(needle)) findings.push(message);
};

const coordinator = read('lib/sessionTabCoordinator.ts');
const operational = read('hooks/useOperationalData.ts');
const lease = read('lib/platformSessionLease.ts');
const rules = read('firestore.rules');
const operatorE2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const manifest = JSON.parse(read('ops/session-tab-coordination.json'));
const docs = read('docs/BLOCK_17_2_SESSION_TAB_COORDINATION.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  'navigator.locks.request',
  "mode: 'exclusive'",
  'BroadcastChannel',
  "type: 'session-invalidated'",
  'FALLBACK_LEADER_TTL_MS = 12_000',
  'FALLBACK_RENEW_INTERVAL_MS = 4_000',
  "setRole('leader')",
  "setRole('follower')",
  'releaseHeldLock?.()',
  "window.addEventListener('storage'",
]) {
  requireText(coordinator, marker, `Coordenador multiaba perdeu requisito: ${marker}`);
}

for (const marker of [
  'startWorkspaceSessionTabCoordinator',
  "if (role === 'leader')",
  'startLeaderResources()',
  'stopLeaderResources?.()',
  "invalidateLogicalSession('session-revoked')",
  "invalidateLogicalSession('lease-terminal')",
  'coordinator?.broadcastSessionInvalidated(reason)',
]) {
  requireText(operational, marker, `Runtime multiaba perdeu requisito: ${marker}`);
}

const leaderStart = operational.indexOf('const startLeaderResources = () =>');
const coordinatorStart = operational.indexOf('coordinator = startWorkspaceSessionTabCoordinator', leaderStart);
const leaderBlock = leaderStart >= 0 && coordinatorStart > leaderStart
  ? operational.slice(leaderStart, coordinatorStart)
  : '';
requireText(leaderBlock, 'subscribeWorkspaceSessionRevocation(', 'Listener de revogação deve pertencer à aba líder.');
requireText(leaderBlock, 'renewWorkspaceSessionLeaseIfDue(', 'Heartbeat deve pertencer à aba líder.');
requireText(leaderBlock, 'window.setInterval(', 'Timer de heartbeat deve pertencer à aba líder.');

forbidText(
  coordinator,
  "from 'firebase/",
  'Coordenador local não pode criar dependência Firestore/Auth.'
);

for (const scenario of [
  'coordenação multiaba mantém uma líder e transfere liderança ao fechar a aba',
  "toBe('follower,leader')",
  "toBe('leader')",
]) {
  requireText(operatorE2e, scenario, `E2E de failover perdeu cenário: ${scenario}`);
}

for (const scenario of [
  'coordenação multiaba propaga invalidação local para a follower',
  'emprovex:session-tab-last-invalidation:v1:',
  'e2e-probe',
  "toBe('e2e-probe')",
]) {
  requireText(operatorE2e, scenario, `E2E de invalidação multiaba perdeu cenário: ${scenario}`);
}

requireText(
  coordinator,
  "LAST_INVALIDATION_KEY_PREFIX = 'emprovex:session-tab-last-invalidation:v1'",
  'Coordenador perdeu marcador diagnóstico de invalidação recebida.'
);

if (manifest.primaryElection !== 'Web Locks API exclusive lock per workspace+uid') {
  findings.push('Manifesto 17.2 perdeu eleição Web Locks.');
}
if (!manifest.leaderResponsibilities.includes('workspace session lease heartbeat')) {
  findings.push('Manifesto 17.2 perdeu responsabilidade do heartbeat.');
}
if (!manifest.intentionallyNotCentralized.includes('operational collection listeners')) {
  findings.push('Manifesto 17.2 deve manter coleções operacionais fora do escopo.');
}

for (const marker of [
  'somente uma aba mantenha heartbeat e listener de revogação',
  'Web Locks API',
  'BroadcastChannel',
  'não centraliza os listeners das coleções operacionais',
  'não altera `firestore.rules`',
  'nenhum deploy de produção',
]) {
  requireText(docs, marker, `Documentação 17.2 perdeu requisito: ${marker}`);
}

requireText(lease, 'SESSION_LEASE_DURATION_MS', 'Serviço de lease foi removido.');
requireText(rules, "match /workspaces/{workspaceId}/sessionSlots/{slotId}", 'Rules de sessão foram removidas.');
requireText(pkg, '"verify:block-17-2-session-tab-coordination"', 'package.json não registra guard 17.2.');
requireText(workflow, 'Block 17.2 session tab coordination guard', 'Application CI não executa guard 17.2.');

if (findings.length) {
  console.error('BLOCK 17.2 SESSION TAB COORDINATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 17.2 SESSION TAB COORDINATION: READY');
  console.log('Presença Firestore: 1 ABA LÍDER POR SESSÃO LÓGICA');
  console.log('Followers: SEM HEARTBEAT E SEM LISTENER DE TOMBSTONE');
  console.log('Failover: WEB LOCKS + FALLBACK LOCALSTORAGE');
  console.log('Revogação: PROPAGADA ENTRE ABAS');
  console.log('Coleções operacionais: INALTERADAS');
}
