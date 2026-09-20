#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
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

const control = read('lib/platformSessionControl.ts');
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

if (existsSync(resolve(root, 'lib/platformSessionCoordinator.ts'))) {
  findings.push('Coordenador persistente antigo ainda existe no runtime.');
}

for (const marker of [
  "SESSION_CONTROL_VERSION = 'emprovex_session_control_v2'",
  "doc(db, 'workspaces', workspaceId)",
  "doc(db, 'platformAccounts', context.email)",
  'subscribeWorkspaceSessionRevocation(',
  'renewWorkspaceSessionLeaseIfDue(user, context)',
  'trackWorkspaceRealtimeListener(telemetryScope)',
  'SESSION_HEARTBEAT_INTERVAL_MS',
]) {
  requireText(control, marker, `Controle autônomo por aba perdeu requisito: ${marker}`);
}

for (const forbidden of [
  'new BroadcastChannel',
  "setRole('leader')",
  "setRole('follower')",
  'leadershipAbortController',
  'session-coordinator-role',
]) {
  forbidText(control, forbidden, `Controle por aba reintroduziu coordenação persistente: ${forbidden}`);
}

for (const marker of [
  'startWorkspaceSessionControl(',
  'sessionControlIdentityKey',
  'sessionControl.stop()',
]) {
  requireText(operational, marker, `Hook operacional perdeu requisito: ${marker}`);
}
forbidText(
  operational,
  'startWorkspaceSessionCoordinator(',
  'Hook operacional voltou ao coordenador persistente.'
);

for (const marker of [
  'shouldRenewWorkspaceSessionLease(context.workspaceId, user.uid)',
  'const renewIfStillDue = async () =>',
  'navigator.locks.request(',
  'emprovex-session-renew:',
  'return renewIfStillDue();',
]) {
  requireText(lease, marker, `Heartbeat curto perdeu requisito: ${marker}`);
}
forbidText(
  lease,
  'emprovex-session-leader:',
  'Lease não pode manter lock persistente de liderança.'
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
  'abas da mesma sessão compartilham identidade e permanecem autônomas ao fechar uma delas',
  'expect(sessionsBeforeClose).toHaveLength(1)',
  'await pageA.close()',
  'expect(await logicalSessionId(pageB)).toBe(sessionIdBefore)',
  'revogação administrativa derruba todas as abas da mesma sessão lógica',
  'await expect(pageA1.getByTestId',
  'await expect(pageA2.getByTestId',
]) {
  requireText(integratedE2e, scenario, `E2E integrado simplificado ausente: ${scenario}`);
}

for (const scenario of [
  'duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada',
  'Limite de acessos simultâneos atingido.',
]) {
  requireText(operatorE2e, scenario, `E2E operacional perdeu cenário: ${scenario}`);
}

if (
  result.strategy?.mode !== 'autonomous-control-per-tab'
  || result.strategy?.persistentLeaderElection !== false
  || result.strategy?.broadcastChannel !== false
  || result.strategy?.controlListenersPerActiveTab !== 3
) {
  findings.push('Modelo quantitativo/arquitetural do 17.2 simplificado está inconsistente.');
}

if (
  result.heartbeatModel?.shortMutex !== 'emprovex-session-renew:{workspaceId}:{uid}'
  || result.heartbeatModel?.doubleCheckInsideMutex !== true
  || result.heartbeatModel?.persistentLock !== false
) {
  findings.push('Contrato do mutex curto de heartbeat está inconsistente.');
}

for (const marker of [
  'Cada aba operacional é autônoma',
  'Não existe:',
  'BroadcastChannel',
  'mutex curto',
  '3 × número de abas ativas',
  'O teste não depende de papéis internos de aba',
  'nenhum deploy Vercel',
]) {
  requireText(docs, marker, `Documentação 17.2 perdeu requisito: ${marker}`);
}

requireText(pkg, '"verify:block-17-2-multitab-coordination"', 'package.json não registra guard 17.2.');
requireText(workflow, 'Block 17.2 multi-tab session coordination guard', 'Application CI não executa guard 17.2.');

if (findings.length) {
  console.error('BLOCK 17.2 AUTONOMOUS MULTITAB CONTROL: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 17.2 AUTONOMOUS MULTITAB CONTROL: READY');
  console.log('Controle: 3 LISTENERS POR ABA ATIVA');
  console.log('Sessão lógica: COMPARTILHADA ENTRE ABAS');
  console.log('Heartbeat: MUTEX CURTO QUANDO NECESSÁRIO');
  console.log('Liderança persistente: REMOVIDA');
  console.log('BroadcastChannel: REMOVIDO');
  console.log('Limite externo: 2 SESSÕES — PRESERVADO');
}
