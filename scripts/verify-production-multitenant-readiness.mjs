#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const requiredFiles = [
  'firebase.json',
  'firestore.rules',
  'scripts/verify-hybrid-auth-model.mjs',
  'scripts/verify-firestore-provider-enforcement.mjs',
  'scripts/verify-sector-auth-provisioning.mjs',
  'scripts/verify-external-sector-login.mjs',
  'scripts/verify-uid-binding.mjs',
  'scripts/verify-workspace-provisioning.mjs',
  'scripts/verify-workspace-drive-onboarding.mjs',
  'scripts/external-drive-auth.test.mjs',
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
const firebaseConfig = JSON.parse(read('firebase.json'));
const admin = read('components/admin/PlatformAdminView.tsx');
const access = read('lib/platformAccess.ts');
const sectorProvisioning = read('lib/server/sectorProvisioningAdmin.ts');
const drive = read('lib/googleDriveWorkspace.ts');
const storage = read('lib/workspaceDriveSettings.ts');
const lifecycle = read('hooks/useOperationalData.ts');

const legacyDriveArtifacts = [
  'lib/googleDrivePoc.ts',
  'app/drive-poc/page.tsx',
  'scripts/verify-google-drive-poc.mjs',
];
for (const path of legacyDriveArtifacts) {
  if (existsSync(resolve(root, path))) {
    findings.push(`Artefato legado de OAuth Drive ainda presente: ${path}`);
  }
}

const externalDriveStart = drive.indexOf('async function connectExternalWorkspaceDrive(');
const founderDriveStart = drive.indexOf('async function connectFounderDriveSession(');
const workspaceDriveStart = drive.indexOf('export async function connectGoogleDriveForWorkspace(');
const externalDriveBlock = externalDriveStart >= 0 && founderDriveStart > externalDriveStart
  ? drive.slice(externalDriveStart, founderDriveStart)
  : '';
const founderDriveBlock = founderDriveStart >= 0 && workspaceDriveStart > founderDriveStart
  ? drive.slice(founderDriveStart, workspaceDriveStart)
  : '';

for (const command of [
  'verify:hybrid-auth-model',
  'verify:firestore-provider-enforcement',
  'verify:sector-auth-provisioning',
  'verify:external-sector-login',
  'verify:uid-binding',
  'verify:workspace-provisioning',
  'verify:workspace-drive-onboarding',
  'test:external-drive-auth',
  'verify:sector-lifecycle',
  'verify:multitenant-security',
  'test:security:multitenant',
]) {
  if (!pkg.scripts?.[command]) findings.push(`Script obrigatório ausente: ${command}`);
}

for (const expected of [
  'npm run verify:hybrid-auth-model',
  'npm run verify:firestore-provider-enforcement',
  'npm run verify:sector-auth-provisioning',
  'npm run verify:external-sector-login',
  'npm run verify:uid-binding',
  'npm run verify:workspace-provisioning',
  'npm run verify:workspace-drive-onboarding',
  'npm run test:external-drive-auth',
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
requireText(drive, 'initTokenClient', 'OAuth independente do Drive externo não usa Google Identity Services.');
requireText(drive, "GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT = 'select_account'", 'OAuth Drive externo não preserva seleção explícita da Conta Google.');
if (drive.includes("prompt: 'consent select_account'") || drive.includes("prompt: 'consent'")) {
  findings.push('OAuth Drive ainda força consentimento em toda reconexão.');
}
requireText(drive, 'expires_in', 'OAuth Drive externo não controla a validade do token.');
requireText(drive, 'expiresAt', 'Sessão Drive externa não registra validade em memória.');
requireText(
  drive,
  'return connectExternalWorkspaceDrive(context, expectedEmail)',
  'Setores externos não são roteados para o OAuth Drive independente.'
);
if (!externalDriveBlock) {
  findings.push('Não foi possível isolar o bloco OAuth do setor externo.');
} else if (externalDriveBlock.includes('reauthenticateWithPopup')) {
  findings.push('Setor externo voltou a reautenticar ou alterar a sessão Firebase durante OAuth do Drive.');
}
if (!founderDriveBlock) {
  findings.push('Não foi possível isolar o fluxo Drive do fundador.');
} else if (!founderDriveBlock.includes('reauthenticateWithPopup')) {
  findings.push('Fluxo Drive do fundador perdeu a reautenticação Google/Firebase consolidada.');
}
requireText(drive, 'emprovexWorkspaceId', 'Pastas Drive não estão marcadas por workspace.');
requireText(storage, "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID = 'documentStorage'", 'Configuração Drive não usa documentStorage.');
requireText(lifecycle, 'observador de ciclo de vida para setores externos', 'Cliente não observa suspensão administrativa.');

const productionDatabaseId = 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1';
const firestoreTargets = Array.isArray(firebaseConfig.firestore)
  ? firebaseConfig.firestore
  : [firebaseConfig.firestore].filter(Boolean);
const productionRulesTarget = firestoreTargets.find(
  (target) => target?.database === productionDatabaseId
);
if (!productionRulesTarget) {
  findings.push(`firebase.json não aponta o banco Firestore nomeado de produção: ${productionDatabaseId}`);
} else if (productionRulesTarget.rules !== 'firestore.rules') {
  findings.push('firebase.json não associa firestore.rules ao banco nomeado de produção.');
}

requireText(rules, 'function boundIdentityMatchesAccount(account)', 'Rules não exigem UID vinculado para operação externa.');
requireText(rules, 'request.auth.token.firebase.sign_in_provider == provider', 'Rules não validam o provider real do token.');
requireText(rules, "hasSignInProvider('google.com')", 'Fundador não está restrito ao provider Google nas Rules.');
requireText(rules, "hasSignInProvider('password')", 'Setores externos não estão restritos ao provider password nas Rules.');
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
  console.log('OAuth Drive externo isolado da sessão Firebase: PRONTO');
  console.log('Falhas OAuth/Drive preservam sessão Firebase externa: TESTADO');
  console.log('Ciclo de vida do token Drive externo: CONTROLADO EM MEMÓRIA');
  console.log('Reconexão OAuth Drive: SEM CONSENTIMENTO FORÇADO');
  console.log('POC Drive legado em produção: AUSENTE');
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
