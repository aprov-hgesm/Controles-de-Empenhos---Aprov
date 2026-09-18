#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const route = read('app/api/admin/provision-sector/route.ts');
const server = read('lib/server/sectorProvisioningAdmin.ts');
const shared = read('lib/sectorProvisioning.ts');
const store = read('lib/platformAdminStore.ts');
const hook = read('hooks/usePlatformAdminDirectory.ts');
const modal = read('components/admin/CreateSectorModal.tsx');
const access = read('lib/platformAccess.ts');
const env = read('.env.example');

requireText(route, 'verifyFounderSession(bearerToken(request))', 'Rota não valida a sessão do fundador antes de provisionar.');
requireText(route, 'provisionSectorWorkspaceWithAuth(input, founder)', 'Rota não delega o provisionamento ao serviço privilegiado.');
requireText(server, "firebaseClaim?.sign_in_provider !== FOUNDER_AUTH_PROVIDER", 'Sessão administrativa não exige provider Google.');
requireText(server, "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON", 'Servidor não usa credencial administrativa protegida.');
requireText(server, 'lookupAuthUserByEmail', 'Provisionamento não detecta usuário Firebase já existente.');
requireText(server, 'createAuthUser', 'Provisionamento não cria usuário Firebase no servidor.');
requireText(server, 'updateExistingAuthUserForPassword', 'Usuário Firebase existente não pode receber o provider password.');
requireText(server, 'deleteAuthUser', 'Rollback não remove usuário Firebase recém-criado.');
requireText(server, 'platformProvisioningLocks', 'Provisionamento não mantém locks/estado de recuperação.');
requireText(server, 'currentDocument: { exists: false }', 'Criação Firestore não protege contra duplicidade concorrente.');
requireText(server, 'createSectorDirectory', 'Workspace, platformAccount e contador não são criados pelo servidor.');
requireText(server, 'deleteSectorDirectory', 'Rollback do diretório Firestore está ausente.');
requireText(shared, 'authProvider: SECTOR_AUTH_PROVIDER', 'Novo platformAccount não nasce explicitamente com provider password.');
requireText(shared, 'firebaseUid: firebaseUid.trim()', 'Novo platformAccount não nasce pré-vinculado ao UID Firebase.');
forbidText(shared, 'password:', 'Senha não pode fazer parte dos registros persistidos do workspace/platformAccount.');

forbidText(store, 'export async function createSectorWorkspace(', 'O navegador ainda possui caminho direto para criar workspace/conta.');
requireText(hook, "fetch('/api/admin/provision-sector'", 'Painel administrativo não usa a rota server-side.');
requireText(hook, 'adminUser.getIdToken()', 'Painel não envia prova da sessão Firebase do fundador.');
requireText(modal, 'initialPassword', 'Formulário não solicita senha inicial.');
requireText(modal, 'confirmPassword', 'Formulário não confirma a senha inicial.');
requireText(access, 'if (account.firebaseUid)', 'Runtime não diferencia conta pré-vinculada do bootstrap legado.');
requireText(env, 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON', 'Exemplo de ambiente não documenta a credencial administrativa server-only.');

if (findings.length) {
  console.error('Nova autenticação — Bloco 2: provisionamento seguro pelo administrador\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nSECTOR AUTH PROVISIONING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Nova autenticação — Bloco 2: provisionamento seguro pelo administrador\n');
  console.log('Fundador: sessão Google validada no servidor');
  console.log('Firebase Auth: criação/reatribuição de senha server-side');
  console.log('Senha: nunca persistida no Firestore');
  console.log('platformAccount: provider=password + firebaseUid no provisionamento');
  console.log('Duplicidade: protegida por locks e precondições Firestore');
  console.log('Rollback: Auth + diretório com marcador de recuperação');
  console.log('Usuário Firebase existente: reutilizado quando autorizado pelo fundador');
  console.log('\nSECTOR AUTH PROVISIONING: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
