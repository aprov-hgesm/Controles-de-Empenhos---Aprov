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

const coordinator = read('lib/platformSessionCoordinator.ts');
const operational = read('hooks/useOperationalData.ts');
const lease = read('lib/platformSessionLease.ts');
const capacity = read('lib/platformCapacity.ts');
const rules = read('firestore.rules');
const operatorE2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const integratedE2e = read('tests/e2e/block-16-integrated.spec.mjs');
const result = JSON.parse(read('ops/firestore-multitab-session-coordination.json'));
const docs = read('docs/BLOCK_17_2_MULTITAB_SESSION_COORDINATION.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  "SESSION_COORDINATOR_VERSION = 'emprovex_session_coordinator_v1'",
  'SESSION_COORDINATOR_RETRY_MS = 4 * 1000',
  'new BroadcastChannel(channelName(workspaceId, uid))',
  'navigator.locks.request(',
  '{ ifAvailable: true }',
  "setRole('leader')",
  "setRole('follower')",
  "setRole('fallback')",
  "message.type !== 'session-invalid'",
  "handleTerminalFailure('revoked')",
  "handleTerminalFailure('lease-lost')",
  "handleTerminalFailure('access-changed')",
]) {
  requireText(coordinator, marker, `Coordenador multiaba perdeu requisito: ${marker}`);
}

for (const marker of [
  "doc(db, 'workspaces', workspaceId)",
  "doc(db, 'platformAccounts', context.email)",
  'subscribeWorkspaceSessionRevocation(',
  'renewWorkspaceSessionLeaseIfDue(user, context)',
  'trackWorkspaceRealtimeListener(telemetryScope)',
]) {
  requireText(coordinator, marker, `Responsabilidade da aba líder ausente: ${marker}`);
}

requireText(
  coordinator,
  'if (!supportsSafeCoordination())',
  'Fallback para navegador sem coordenação segura foi removido.'
);
requireText(
  coordinator,
  'stopLeaderWork = startLeaderResponsibilities();',
  'Fallback precisa preservar responsabilidades de controle por aba.'
);

requireText(
  operational,
  'startWorkspaceSessionCoordinator(',
  'Hook operacional não inicia o coordenador multiaba.'
);
forbidText(
  operational,
  "doc(db, 'workspaces', workspaceContext.workspaceId)",
  'Hook voltou a abrir listener de workspace por aba.'
);
forbidText(
  operational,
  "doc(db, 'platformAccounts', workspaceContext.email)",
  'Hook voltou a abrir listener de conta por aba.'
);
forbidText(
  operational,
  'subscribeWorkspaceSessionRevocation(',
  'Hook voltou a abrir listener de tombstone por aba.'
);
forbidText(
  operational,
  'window.setInterval(\n      () => void renewLease()',
  'Hook voltou a manter heartbeat por aba.'
);

for (const invariant of [
  'SESSION_LEASE_DURATION_MS = 30 * 60 * 1000',
  'SESSION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000',
  'DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2',
]) {
  requireText(capacity, invariant, `Contrato 17.1/17.2 regrediu: ${invariant}`);
}

for (const invariant of [
  'acquireWorkspaceSessionLease',
  'renewKnownWorkspaceSessionLease',
  '{ documentWrites: 1 }',
]) {
  requireText(lease, invariant, `Lease perdeu invariante: ${invariant}`);
}

requireText(rules, "return slotId in ['slot-1', 'slot-2'];", 'Rules perderam limite físico de dois slots.');
requireText(rules, 'sameWorkspaceSessionLeaseOwner()', 'Rules perderam vínculo de identidade do lease.');

for (const scenario of [
  'coordenação multiaba elege um líder e promove seguidora após fechamento',
  "filter((role) => role === 'leader').length",
  "toBe('leader')",
  'expect(await logicalSessionId(follower)).toBe(sessionIdBefore)',
]) {
  requireText(operatorE2e, scenario, `E2E de liderança/failover ausente: ${scenario}`);
}

for (const scenario of [
  'aba líder propaga revogação administrativa para a aba seguidora',
  'await expect(pageA1.getByTestId',
  'await expect(pageA2.getByTestId',
]) {
  requireText(integratedE2e, scenario, `E2E de revogação multiaba ausente: ${scenario}`);
}

if (
  result.controlListenerModel.before.listenersPerTab !== 3
  || result.controlListenerModel.afterPreferredMode.listenersPerBrowserLogicalSession !== 3
  || result.controlListenerModel.afterPreferredMode.listenersPerFollowerTab !== 0
) {
  findings.push('Modelo quantitativo de listeners do 17.2 está inconsistente.');
}

for (const [tabs, expectedReduction] of [[2, 50], [5, 80]]) {
  const key = `${tabs}_tabs`;
  if (Math.abs(result.controlListenerModel.examples[key].reductionPercent - expectedReduction) > 0.001) {
    findings.push(`Redução de listeners para ${tabs} abas está incorreta.`);
  }
}

for (const marker of [
  'Web Locks API',
  'BroadcastChannel',
  'Fallback conservador',
  '3 × número de abas',
  '5 | 15 | 3 | 80%',
  'não é alterado neste bloco',
  'nenhum deploy Vercel',
]) {
  requireText(docs, marker, `Documentação 17.2 perdeu requisito: ${marker}`);
}

requireText(pkg, '"verify:block-17-2-multitab-coordination"', 'package.json não registra guard 17.2.');
requireText(workflow, 'Block 17.2 multi-tab session coordination guard', 'Application CI não executa guard 17.2.');

if (findings.length) {
  console.error('BLOCK 17.2 MULTITAB SESSION COORDINATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 17.2 MULTITAB SESSION COORDINATION: READY');
  console.log('Controle Firestore: 3 LISTENERS POR NAVEGADOR, não por aba');
  console.log('Liderança: WEB LOCKS');
  console.log('Invalidação: BROADCASTCHANNEL');
  console.log('Failover: AUTOMÁTICO');
  console.log('Fallback incompatível: SEGURO / POR ABA');
  console.log('Limite externo: 2 SESSÕES — PRESERVADO');
}
