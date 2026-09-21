#!/usr/bin/env node

import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const backup = read('lib/workspaceBackup.ts');
const drive = read('lib/workspaceBackupDrive.ts');
const driveWorkspace = read('lib/googleDriveWorkspace.ts');
const auth = read('lib/server/firebaseAuthBackup.ts');
const authRoute = read('app/api/admin/auth-backup/route.ts');
const security = read('lib/server/requestSecurity.ts');
const rules = read('firestore.rules');
const adminPage = read('app/admin/backups/page.tsx');
const tenantUi = read('components/layout/WorkspaceBackupSection.tsx');
const disaster = read('scripts/workspace-backup-disaster.test.mjs');
const docs = read('docs/BACKUP_RECOVERY.md');
const baseline = JSON.parse(read('ops/backup-recovery-baseline.json'));

const expectedCollections = ['empenhos', 'alerts', 'invoices', 'comissoes', 'cronogramas'];
for (const collectionName of expectedCollections) {
  assert(
    backup.includes(`'${collectionName}'`),
    `Coleção crítica ausente do contrato de backup: ${collectionName}`
  );
}
assert(
  JSON.stringify(baseline.workspaceBackup.collections) === JSON.stringify(expectedCollections),
  'Baseline e exportador precisam declarar o mesmo conjunto de coleções críticas.'
);
assert(backup.includes("WORKSPACE_BACKUP_SCHEMA_VERSION = 1"), 'Schema de backup precisa permanecer versionado.');
assert(backup.includes('WORKSPACE_BACKUP_RETENTION_COUNT = 30'), 'Retenção inicial precisa permanecer em 30 backups.');
assert(backup.includes('WORKSPACE_BACKUP_AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000'), 'Backup automático precisa ser diário.');
assert(backup.includes("pdfBytesIncluded: false"), 'O contrato precisa declarar que bytes de PDF não entram no backup.');
assert(backup.includes("restoreWorkspaceBackupMissingOnly"), 'Restauração missing-only é obrigatória na v1.');
assert(backup.includes("revision: 1"), 'Empenhos restaurados precisam reiniciar metadado técnico de concorrência.');
assert(backup.includes("buildNsLockDocument"), 'Restauração de NF com NS precisa reconstruir lock canônico.');
assert(backup.includes("currentNumber: 0"), 'Contador de TR precisa respeitar criação monotônica das Rules.');
assert(!backup.includes("passwordHash"), 'Backup operacional não pode manipular password hash.');

assert(drive.includes("GOOGLE_DRIVE_BACKUPS_FOLDER_NAME = 'Backups'"), 'Pasta Backups precisa existir.');
assert(drive.includes("emprovexFileType: 'workspace-backup'") || drive.includes("emprovexFileType"), 'Arquivos de backup precisam ser identificáveis no Drive.');
assert(driveWorkspace.includes("GOOGLE_DRIVE_WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/drive.file'"), 'Escopo Drive não pode ser ampliado.');
assert(!drive.includes('localStorage') && !driveWorkspace.includes('localStorage.setItem'), 'Token Drive não pode ser persistido no localStorage.');

assert(auth.includes("mode: 'metadata-only'"), 'Backup de Auth precisa declarar modo metadata-only.');
assert(auth.includes('passwordHashIncluded: false'), 'Password hashes precisam continuar excluídos.');
assert(auth.includes('passwordSaltIncluded: false'), 'Password salts precisam continuar excluídos.');
assert(!auth.includes('passwordHash: user.passwordHash'), 'Hash de senha não pode ser copiado para o backup.');
assert(auth.includes("listPlatformCollection(accessToken, 'workspaces')"), 'Pacote fundador precisa conter o diretório de workspaces.');
assert(auth.includes("listPlatformCollection(accessToken, 'platformAccounts')"), 'Pacote fundador precisa conter platformAccounts.');
assert(authRoute.includes('verifyFounderFirebaseRequest'), 'Endpoint de Auth backup precisa ser founder-only.');
assert(authRoute.includes('assertFirebaseAuthBackupEnabled'), 'Endpoint de Auth backup precisa respeitar kill switch.');
assert(security.includes('EMPROVEX_DISABLE_AUTH_BACKUP'), 'Kill switch de Auth backup precisa existir.');

assert(rules.includes('match /workspaceBackupStatus/{workspaceId}'), 'Rules precisam proteger metadados de backup.');
assert(rules.includes('allow list: if isPlatformAdmin();'), 'Fundador precisa poder listar saúde dos backups.');
assert(
  rules.includes('a platform administrator cannot read another sector\'s operational records'),
  'Isolamento operacional sem admin bypass precisa permanecer explícito.'
);
assert(!rules.includes('allow read: if canAccessWorkspace(workspaceId) || isPlatformAdmin();\n      allow create: if canAccessWorkspace(workspaceId)\n        && validWorkspaceAuditEvent'), 'Não introduza bypass administrativo em dados operacionais.');

assert(adminPage.includes('Saúde dos backups por UG'), 'Painel administrativo de backups precisa existir.');
assert(adminPage.includes('somente metadados de saúde'), 'Painel precisa deixar o boundary de privacidade explícito.');
assert(tenantUi.includes('Restaurar registros ausentes'), 'UI do workspace precisa expor restauração não destrutiva.');
assert(tenantUi.includes('PDFs não são duplicados'), 'UI precisa deixar exclusão de PDFs clara.');

assert(disaster.includes("Firebase Auth + Firestore") || docs.includes('Firebase Auth + Firestore Emulator'), 'Teste de desastre isolado precisa estar documentado.');
assert(disaster.includes('comissaoDate'), 'Teste de desastre precisa validar data de comissão.');
assert(disaster.includes('tesourariaDate'), 'Teste de desastre precisa validar data de tesouraria.');
assert(disaster.includes('sagNsLock_'), 'Teste de desastre precisa validar lock de NS.');

assert(docs.includes('BR-0') && docs.includes('BR-14'), 'Documentação precisa cobrir o ciclo BR-0 a BR-14.');
assert(baseline.admin.operationalTenantBypass === false, 'Baseline proíbe bypass operacional do admin.');
assert(baseline.workspaceBackup.pdfBytesIncluded === false, 'Baseline proíbe bytes de PDF.');
assert(baseline.authBackup.passwordHashIncluded === false, 'Baseline proíbe password hash.');

console.log('Backup and recovery guard: OK');
