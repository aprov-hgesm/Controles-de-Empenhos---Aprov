#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const store = read('lib/platformAdminStore.ts');
const adminHook = read('hooks/usePlatformAdminDirectory.ts');
const adminView = read('components/admin/PlatformAdminView.tsx');
const editModal = read('components/admin/EditSectorModal.tsx');
const operational = read('hooks/useOperationalData.ts');
const sessionCoordinator = read('lib/platformSessionCoordinator.ts');
const rules = read('firestore.rules');

requireText(store, 'export async function updateSectorWorkspaceProfile', 'Edição institucional do setor não foi implementada.');
requireText(store, 'export async function setSectorWorkspaceStatus', 'Ciclo de vida do setor não foi implementado.');
requireText(store, 'transaction.update(workspaceRef', 'Alteração do workspace não usa transação.');
requireText(store, 'transaction.update(accountRef', 'Status da conta não é atualizado junto do workspace.');
requireText(store, "workspaceId === HGESM_WORKSPACE_ID", 'Workspace fundador não está protegido no cliente.');
requireText(store, "currentAccount.status !== currentWorkspace.status", 'Cliente não detecta inconsistência prévia de status.');

requireText(adminHook, 'updateSectorWorkspaceProfile', 'Hook administrativo não expõe edição.');
requireText(adminHook, 'setSectorWorkspaceStatus', 'Hook administrativo não expõe suspensão/reativação.');
requireText(adminView, 'Suspender setor', 'Painel não oferece suspensão.');
requireText(adminView, 'Reativar setor', 'Painel não oferece reativação.');
requireText(adminView, 'Editar cadastro', 'Painel não oferece edição institucional.');
requireText(editModal, 'Workspace ID', 'Modal de edição não exibe workspace protegido.');
requireText(editModal, 'Conta Google autorizada', 'Modal de edição não exibe conta protegida.');

requireText(operational, 'startWorkspaceSessionCoordinator', 'Sessão aberta não delega lifecycle ao coordenador multiaba.');
requireText(sessionCoordinator, "data.status !== 'active'", 'Coordenador não encerra setor suspenso.');
requireText(sessionCoordinator, 'data.firebaseUid !== uid', 'Coordenador não preserva vínculo de UID.');
requireText(operational, 'void signOut(auth)', 'Invalidação coordenada não encerra a sessão suspensa.');

requireText(rules, 'function boundIdentityMatchesAccount(account)', 'Acesso operacional não separa bootstrap do UID vinculado.');
requireText(rules, 'operationalIdentityMatchesAccount(', 'Acesso operacional não exige identidade vinculada.');
requireText(rules, 'function validWorkspaceAdminUpdate(workspaceId)', 'Rules não restringem edição administrativa do workspace.');
requireText(rules, 'function validSectorAccountAdminUpdate(accountId)', 'Rules não restringem alteração administrativa da conta.');
requireText(rules, ".data.status == request.resource.data.status", 'Rules não exigem status coerente entre workspace e conta.');
requireText(rules, "workspaceId != 'hgesm-aprov'", 'Rules não protegem o workspace fundador contra alteração.');
requireText(rules, "accountId != 'aprov1hgesm@gmail.com'", 'Rules não protegem a conta fundadora contra alteração.');
requireText(rules, "'name',\n          'status',\n          'ug',\n          'institutionalProfile',\n          'updatedAt'", 'Workspace pode alterar campos além dos permitidos.');
requireText(rules, "'status',\n          'ug',\n          'updatedAt'", 'Conta pode alterar campos além do ciclo de vida.');
requireText(rules, "request.resource.data.ug == resource.data.ug", 'UG já vinculada não está protegida contra substituição.');
requireText(sessionCoordinator, "(data.ug || null) !== context.ug", 'Coordenador não observa divergência da UG organizacional.');

forbidText(
  rules,
  'allow delete: if isPlatformAdmin()',
  'Ciclo de vida introduziu exclusão administrativa destrutiva.'
);

if (findings.length) {
  console.error('Bloco 19 — ciclo de vida administrativo dos setores\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nSECTOR LIFECYCLE: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 19 — ciclo de vida administrativo dos setores\n');
  console.log('Edição institucional: habilitada');
  console.log('Workspace ID / e-mail / UID / UG vinculada: protegidos');
  console.log('Suspensão e reativação: transação única');
  console.log('Status workspace/conta: coerente');
  console.log('Sessão suspensa: encerramento imediato');
  console.log('Workspace fundador: protegido');
  console.log('Exclusão destrutiva: bloqueada');
  console.log('Acesso operacional externo: UID vinculado obrigatório');
  console.log('\nSECTOR LIFECYCLE: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}

function forbidText(source, forbidden, failureMessage) {
  if (source.includes(forbidden)) findings.push(failureMessage);
}
