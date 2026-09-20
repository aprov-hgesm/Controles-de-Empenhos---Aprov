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

const capacity = read('lib/platformCapacity.ts');
const lease = read('lib/platformSessionLease.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const browser = read('tests/e2e/block-16-integrated.spec.mjs');
const baseline = JSON.parse(read('ops/firestore-consumption-baseline.json'));
const result = JSON.parse(read('ops/firestore-session-lease-efficiency.json'));
const docs = read('docs/BLOCK_17_1_SESSION_LEASE_HEARTBEAT_EFFICIENCY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  'SESSION_LEASE_DURATION_MS = 30 * 60 * 1000',
  'SESSION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000',
  "SESSION_SLOT_IDS = ['slot-1', 'slot-2']",
  'DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2',
]) {
  requireText(capacity, marker, `Contrato de capacidade 17.1 ausente: ${marker}`);
}

requireText(lease, 'async function renewKnownWorkspaceSessionLease', 'Renovação direta do slot conhecido ausente.');
requireText(lease, 'await updateDoc(ref, {', 'Renovação conhecida deve usar updateDoc.');
requireText(lease, "status: 'renewed'", 'Resultado explícito de renovação ausente.');
requireText(lease, "'SESSION_LEASE_LOST'", 'Perda do slot deve ser fail-closed.');
requireText(lease, 'return acquireWorkspaceSessionLease(user, context);', 'Fallback transacional raro foi removido.');

const renewalStart = lease.indexOf('async function renewKnownWorkspaceSessionLease');
const renewalEnd = lease.indexOf('export async function renewWorkspaceSessionLeaseIfDue', renewalStart);
const renewal = renewalStart >= 0 && renewalEnd > renewalStart
  ? lease.slice(renewalStart, renewalEnd)
  : '';

forbidText(renewal, 'runTransaction(', 'Renovação conhecida não pode iniciar transação.');
forbidText(renewal, 'transaction.get(', 'Renovação conhecida não pode executar read transacional.');
forbidText(renewal, 'documentReads:', 'Telemetria de renovação não pode inventar read explícita.');
requireText(renewal, '{ documentWrites: 1 }', 'Telemetria da renovação deve registrar exatamente um write explícito.');

for (const identity of [
  'leaseVersion: SESSION_LEASE_VERSION',
  'slotId: local.slotId',
  'sessionId: local.sessionId',
  'workspaceId: context.workspaceId',
  'uid: user.uid',
  'accountEmail',
  'browserInstanceId: local.browserInstanceId',
]) {
  requireText(renewal, identity, `Renovação direta perdeu identidade obrigatória: ${identity}`);
}

for (const marker of [
  "request.resource.data.expiresAt >= request.time + duration.value(25, 'm')",
  "request.resource.data.expiresAt <= request.time + duration.value(35, 'm')",
  'sameWorkspaceSessionLeaseOwner()',
  "request.resource.data.diff(resource.data).affectedKeys().hasOnly([",
  "'lastSeenAt'",
  "'expiresAt'",
  'return validWorkspaceSessionLeaseShape(workspaceId, slotId)',
]) {
  requireText(rules, marker, `Rules perderam proteção 17.1: ${marker}`);
}

for (const scenario of [
  'Mesma sessão renova diretamente o slot conhecido com identidade confirmada',
  'Slot expirado pode ser retomado por uma nova sessão',
  'Sessão antiga não renova slot retomado por outra identidade lógica',
  'Sessão vencedora renova diretamente o slot retomado',
  'Administrador revoga e libera uma sessão na mesma transação',
]) {
  requireText(security, scenario, `Emulator perdeu cenário 17.1: ${scenario}`);
}

requireText(
  browser,
  'heartbeat eficiente renova lease de 30 minutos sem redescobrir capacidade',
  'Browser E2E não cobre a nova janela 30/15.'
);
requireText(browser, 'Date.now() - (16 * 60 * 1000)', 'Browser E2E não força renovação após o novo intervalo.');

if (
  baseline.sessionLease.leaseDurationMs !== 600000
  || baseline.sessionLease.heartbeatIntervalMs !== 300000
  || baseline.sessionLease.explicitReadsPerSessionHour !== 36
  || baseline.sessionLease.explicitWritesPerSessionHour !== 12
) {
  findings.push('Baseline histórico 17.0 foi alterado; ele deve permanecer congelado para comparação.');
}

if (
  result.renewal.leaseDurationMs !== 1800000
  || result.renewal.intervalMs !== 900000
  || result.renewal.explicitDocumentReadsPerSessionHour !== 0
  || result.renewal.explicitDocumentWritesPerSessionHour !== 4
) {
  findings.push('Resultado quantitativo 17.1 está inconsistente.');
}

if (
  result.baselineComparison.explicitReadReductionPercent !== 100
  || Math.abs(result.baselineComparison.explicitWriteReductionPercent - 66.6667) > 0.001
  || Math.abs(result.baselineComparison.explicitPeriodicOperationReductionPercent - 91.6667) > 0.001
) {
  findings.push('Percentuais de redução do 17.1 estão incorretos.');
}

for (const marker of [
  '0 reads explícitas de renovação',
  '91,67%',
  'não remove `canAccessWorkspace()`',
  'não consegue renovar o slot retomado',
  'nenhum deploy Vercel',
]) {
  requireText(docs, marker, `Documentação 17.1 perdeu requisito: ${marker}`);
}

requireText(pkg, '"verify:block-17-1-session-lease-efficiency"', 'package.json não registra guard 17.1.');
requireText(workflow, 'Block 17.1 session lease efficiency guard', 'Application CI não executa guard 17.1.');

if (findings.length) {
  console.error('BLOCK 17.1 SESSION LEASE EFFICIENCY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 17.1 SESSION LEASE EFFICIENCY: READY');
  console.log('Aquisição inicial: 3 READS + 1 WRITE (transacional)');
  console.log('Renovação normal: 0 READS explícitas + 1 WRITE');
  console.log('Lease / renovação: 30 MIN / 15 MIN');
  console.log('Redução de operações periódicas explícitas: 91,67%');
  console.log('Limite externo: 2 SESSÕES — PRESERVADO');
}
