#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const requiredFiles = [
  'firestore.rules',
  'scripts/verify-hybrid-auth-model.mjs',
  'scripts/verify-sector-auth-provisioning.mjs',
  'scripts/verify-external-sector-login.mjs',
  'scripts/verify-uid-binding.mjs',
  'scripts/verify-workspace-provisioning.mjs',
  'scripts/verify-workspace-drive-onboarding.mjs',
  'scripts/verify-sector-lifecycle.mjs',
  'scripts/verify-multitenant-security-suite.mjs',
  'scripts/firestore-multitenancy-security.test.mjs',
  'components/admin/PlatformAdminView.tsx',
  'components/admin/EditSectorModal.tsx',
  'app/api/admin/provision-sector/route.ts',
  'lib/server/sectorProvisioningAdmin.ts',
  'lib/sectorProvisioning.ts',
  'hooks/useOperationalData.ts',
  'lib/platformAdminStore.ts',
  'lib/platformAccess.ts',
  'lib/googleDriveWorkspace.ts',
  'lib/workspaceDriveSettings.ts',
];

for (const path of requiredFiles) {
  if (!existsSync(resolve(root, path))) {
    findings.push(`Arquivo obrigatório ausente: ${path}`);
  }
}

const pkg = JSON.parse(read('package.json'));
const ci = read('.github/workflows/application-ci.yml');
const rules = read('firestore.rules');
const admin = read('components/admin/PlatformAdminView.tsx');
const access = read('lib/platformAccess.ts');
const sectorProvisioning = read('lib/server/sectorProvisioningAdmin.ts');
const drive = read('lib/googleDriveWorkspace.ts');
const storage = read('lib/workspaceDriveSettings.ts');
const lifecycle = read('hooks/useOperationalData.ts');

for (const command of [
  'verify:hybrid-auth-model',
  'verify:sector-auth-provisioning',
  'verify:external-sector-login',
  'verify:uid-binding',
  'verify:workspace-provisioning',
  'verify:workspace-drive-onboarding',
  'verify:sector-lifecycle',
  'verify:multitenant-security',
  'test:security:multitenant',
]) {
  if (!pkg.scripts?.[command]) findings.push(`Script obrigatório ausente: ${command}`);
}

for (const expected of [
  'npm run verify:hybrid-auth-model',
  'npm run verify:sector-auth-provisioning',
  'npm run verify:external-sector-login',
  'npm run verify:uid-binding',
  'npm run verify:workspace-provisioning',
  'npm run verify:workspace-drive-onboarding',
  'npm run verify:sector-lifecycle',
  'npm run verify:multitenant-security',
  'npm run test:security:multitenant',
]) {
  requireText(ci, expected, `CI não executa: ${expected}`);
}

requireText(admin, 'Cadastrar novo setor', 'Painel administrativo perdeu o cadastro de setor.');
requireText(admin, 'Suspender setor', 'Painel administrativo perdeu suspensão.');
requireText(admin, 'Reativar setor', 'Painel administrativo perdeu reativação.');
requireText(sectorProvisioning, 'provisionSectorWorkspaceWithAuth', 'Provisionamento server-side de setor está ausente.');
requireText(sectorProvisioning, 'createAuthUser', 'Provisionamento não cria a identidade Firebase no servidor.');
requireText(sectorProvisioning, 'deleteAuthUser', 'Provisionamento não possui rollback da identidade Firebase.');
requireText(access, 'resolveAndBindExternalIdentity', 'Login externo não mantém resolução/vínculo de identidade.');
requireText(access, 'firebaseUid', 'Login externo perdeu vínculo de UID.');
requireText(access, 'tokenResult.signInProvider', 'Modelo híbrido não valida o provider real da sessão.');
requireText(access, 'signInProvider !== FOUNDER_AUTH_PROVIDER', 'Fundador não está restrito ao Google.');
requireText(access, 'signInProvider !== SECTOR_AUTH_PROVIDER', 'Setor externo não está restrito a password.');
requireText(drive, 'reauthenticateWithPopup', 'Onboarding Drive não exige reautenticação.');
requireText(drive, 'emprovexWorkspaceId', 'Pastas Drive não estão marcadas por workspace.');
requireText(storage, "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID = 'documentStorage'", 'Configuração Drive não usa documentStorage.');
requireText(lifecycle, 'observador de ciclo de vida para setores externos', 'Cliente não observa suspensão administrativa.');

requireText(rules, 'function boundIdentityMatchesAccount(account)', 'Rules não exigem UID vinculado para operação externa.');
requireText(rules, "workspaceId != 'hgesm-aprov'", 'Workspace fundador não está protegido.');
requireText(rules, "match /workspaces/{workspaceId}/settings/documentStorage", 'documentStorage não possui regra dedicada.');
requireText(rules, "allow delete: if false;", 'Exclusões protegidas deixaram de estar bloqueadas.');

if (findings.length) {
  console.error('Bloco 21 — prontidão para homologação do segundo setor\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nPRODUCTION MULTI-TENANT READINESS: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 21 — prontidão para homologação do segundo setor\n');
  console.log('Cadastro administrativo: PRONTO');
  console.log('Modelo híbrido de provider: PRONTO');
  console.log('Provisionamento Auth server-side: PRONTO');
  console.log('Login externo + UID binding: PRONTO');
  console.log('Provisionamento inicial: PRONTO');
  console.log('Google Drive por workspace: PRONTO');
  console.log('Lifecycle administrativo: PRONTO');
  console.log('Isolamento automatizado A ↔ B: PRONTO');
  console.log('Proteção HGeSM fundador: PRONTA');
  console.log('CI de segurança: ATIVO');
  console.log('\nPRODUCTION MULTI-TENANT READINESS: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
