#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};

const capacity = read('lib/platformCapacity.ts');
const lease = read('lib/platformSessionLease.ts');
const adminSessions = read('lib/platformAdminSessions.ts');
const adminHook = read('hooks/usePlatformAdminSessions.ts');
const operational = read('hooks/useOperationalData.ts');
const access = read('lib/platformAccess.ts');
const panel = read('components/admin/AdminSessionsPanel.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const adminPage = read('app/admin/page.tsx');
const audit = read('lib/auditTrail.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const docs = read('docs/BLOCK_16_2_ADMIN_SESSION_PANEL.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  "SESSION_REVOCATION_VERSION = 'emprovex_session_revocation_v1'",
  'SESSION_REVOCATION_TTL_MS = 24 * 60 * 60 * 1000',
]) requireText(capacity, marker, `Contrato de revogação ausente: ${marker}`);

for (const marker of [
  'sessionRevocations',
  "'SESSION_REVOKED'",
  'subscribeWorkspaceSessionRevocation',
  'clearAllLocalWorkspaceSessionState',
  'transaction.get(revocationRef)',
]) requireText(lease, marker, `Runtime de revogação perdeu requisito: ${marker}`);

for (const marker of [
  "collectionGroup(db, 'sessionSlots')",
  'terminatePlatformWorkspaceSession',
  'transaction.set(revocationRef',
  'transaction.delete(slotRef)',
  "operation: 'session.terminate'",
  "entityType: 'session'",
]) requireText(adminSessions, marker, `Serviço administrativo perdeu requisito: ${marker}`);

for (const marker of [
  'subscribePlatformAdminSessions',
  'terminatingSessionId',
  'terminateSession',
]) requireText(adminHook, marker, `Hook administrativo perdeu requisito: ${marker}`);

for (const marker of [
  'subscribeWorkspaceSessionRevocation',
  "diagnosticCode === 'SESSION_REVOKED'",
  'error instanceof PlatformSessionLeaseError',
]) requireText(operational, marker, `Sessão operacional não trata revogação: ${marker}`);

requireText(
  access,
  'error instanceof PlatformSessionLeaseError',
  'platformAccess não preserva diagnóstico de revogação.'
);

for (const marker of [
  'admin-sessions-panel',
  'Sessões simultâneas por UG',
  'Conta fundadora',
  'Ilimitada',
  'Encerrar sessão',
  'admin-active-session-count',
]) requireText(panel, marker, `Painel perdeu requisito visual: ${marker}`);

requireText(adminView, '<AdminSessionsPanel', 'Administração não renderiza painel de sessões.');
requireText(adminPage, 'usePlatformAdminSessions', 'Página admin não conecta monitoramento de sessões.');

for (const marker of [
  "| 'session.terminate'",
  "| 'session'",
]) requireText(audit, marker, `Auditoria não conhece sessão: ${marker}`);

for (const marker of [
  'function validSessionRevocationCreate',
  'function validAdminSessionSlotDelete',
  'match /workspaces/{workspaceId}/sessionRevocations/{sessionId}',
  "request.resource.data.revocationVersion == 'emprovex_session_revocation_v1'",
  'allow update, delete: if false;',
  "'session.terminate'",
  "'session'",
]) requireText(rules, marker, `Rules perderam proteção 16.2: ${marker}`);

for (const marker of [
  'Administrador lista slots de sessão de toda a plataforma',
  'Administrador revoga e libera uma sessão na mesma transação',
  'Setor revogado lê somente o tombstone da própria sessão',
  'Outro workspace não lê revogação de sessão do Setor A',
  'Setor operacional não cria tombstone de revogação',
]) requireText(security, marker, `Emulator perdeu cenário 16.2: ${marker}`);

for (const marker of [
  'um único listener de collection group',
  'revogação correspondente na mesma transação',
  'session.terminate',
  '24 horas',
]) requireText(docs, marker, `Documentação 16.2 perdeu requisito: ${marker}`);

requireText(pkg, '"verify:block-16-2-admin-session-panel"', 'package.json não registra o guard 16.2.');
requireText(workflow, 'Block 16.2 admin session panel guard', 'Application CI não executa guard 16.2.');

if (findings.length) {
  console.error('BLOCK 16.2 ADMIN SESSION PANEL: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.2 ADMIN SESSION PANEL: READY');
  console.log('Visão por UG: ATIVA');
  console.log('Conta fundadora: ILIMITADA');
  console.log('Encerramento remoto: ATÔMICO');
  console.log('Revogação: 24H / ANTI-RECLAIM');
  console.log('Auditoria session.terminate: ATIVA');
}
