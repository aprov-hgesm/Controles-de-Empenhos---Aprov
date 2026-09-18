#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const access = read('lib/platformAccess.ts');
const context = read('lib/workspaceContext.ts');
const operationalData = read('hooks/useOperationalData.ts');
const operationalPaths = read('lib/operationalPaths.ts');
const identity = read('lib/platformIdentity.ts');
const rules = read('firestore.rules');

requireText(access, "doc(db, PLATFORM_ACCOUNTS_COLLECTION, normalizedEmail)", 'Login externo não consulta platformAccounts pelo e-mail autenticado.');
requireText(access, "doc(db, WORKSPACES_COLLECTION, account.workspaceId)", 'Login externo não resolve o workspace cadastrado.');
requireText(access, "account.status === 'active'", 'Conta externa não exige status ativo.');
requireText(access, "workspace.status !== 'active'", 'Workspace externo não exige status ativo.');
requireText(access, 'rememberResolvedWorkspaceContext(user.uid, context)', 'Contexto validado não é associado à sessão Firebase.');
requireText(access, 'runTransaction', 'Resolução externa precisa permanecer atômica após o Bloco 16.');
requireText(access, 'firebaseUid', 'A resolução externa perdeu o vínculo persistente introduzido no Bloco 16.');
requireText(access, 'tokenResult.signInProvider', 'Login externo não valida o provider real da sessão Firebase.');
requireText(access, 'signInProvider !== SECTOR_AUTH_PROVIDER', 'Setor externo não está restrito ao provider password.');
requireText(access, 'signInProvider !== FOUNDER_AUTH_PROVIDER', 'Fundador não está restrito ao provider Google.');

requireText(context, "'platform-directory'", 'workspaceContext não reconhece resolução pelo diretório da plataforma.');
requireText(context, 'getResolvedWorkspaceContextForSession', 'Não existe cache de contexto vinculado ao UID da sessão.');
requireText(operationalData, 'resolveAuthenticatedWorkspaceContext', 'useOperationalData não valida o diretório antes das subscriptions.');
requireText(operationalData, 'signInWithEmailAndPassword', 'Login por senha dos setores externos não está implementado.');
requireText(operationalData, 'signInSectorUser', 'Hook operacional não expõe o login por senha do setor.');
requireText(platformAccess, 'ACCOUNT_NOT_FOUND', 'Diagnóstico não identifica ausência da conta.');
requireText(platformAccess, 'UID_MISMATCH', 'Diagnóstico não identifica divergência de UID.');
requireText(platformAccess, 'WORKSPACE_NOT_FOUND', 'Diagnóstico não identifica ausência do workspace.');
requireText(platformAccess, 'WORKSPACE_EMAIL_MISMATCH', 'Diagnóstico não identifica divergência de e-mail do workspace.');
requireText(operationalData, 'Falha de autorização do workspace [', 'Tela de login não expõe o código seguro de diagnóstico.');
forbidText(operationalData, 'useMemo(', 'Autorização operacional não pode ser derivada somente por useMemo do e-mail.');
requireText(operationalPaths, 'getResolvedWorkspaceContextForSession', 'Writes não reutilizam o contexto validado da sessão.');

forbidText(identity, "localPart.replace(/\\./g, '')", 'Normalização Gmail remove pontos e pode divergir do e-mail presente no token Firebase.');
requireText(rules, 'allow get: if isPlatformAdmin() || isSelfPlatformAccount();', 'Rules não permitem que o setor consulte o próprio platformAccount.');
requireText(rules, 'canReadWorkspaceMetadataFromResource(workspaceId)', 'Rules não protegem a leitura do metadata do próprio workspace.');
requireText(rules, 'allow read, write: if canAccessWorkspace(workspaceId);', 'Dados operacionais não estão protegidos por canAccessWorkspace.');

if (findings.length) {
  console.error('Bloco 15 — login de setores externos\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nEXTERNAL SECTOR LOGIN: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 15 — login de setores externos\n');
  console.log('Fundador: Google Auth exclusivo');
  console.log('Setores externos: provider password obrigatório e UI disponível');
  console.log('Diretório de contas: platformAccounts');
  console.log('Resolução de workspace: obrigatória');
  console.log('Conta/workspace desativados: bloqueados');
  console.log('Subscriptions antes da resolução: bloqueadas');
  console.log('Writes: vinculados ao contexto validado da sessão');
  console.log('Persistência de firebaseUid: SIM (Bloco 16)');
  console.log('\nEXTERNAL SECTOR LOGIN: READY');
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
