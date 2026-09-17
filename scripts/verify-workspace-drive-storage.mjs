#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const driveClient = read('lib/googleDriveWorkspace.ts');
const driveSettings = read('lib/workspaceDriveSettings.ts');
const driveHook = read('hooks/useWorkspaceDriveStorage.ts');
const driveControl = read('components/layout/WorkspaceDriveControl.tsx');
const appHeader = read('components/layout/AppHeader.tsx');
const empenhoDocuments = read('lib/empenhoDocuments.ts');
const invoiceDocuments = read('lib/invoiceDocuments.ts');

requireText(
  driveClient,
  "https://www.googleapis.com/auth/drive.file",
  'O cliente Drive por workspace não usa o escopo restrito drive.file.'
);
requireText(
  driveClient,
  'reauthenticateWithPopup',
  'O Drive por workspace não exige reautenticação explícita da conta Google.'
);
requireText(
  driveClient,
  'normalizePlatformEmail(context.email)',
  'A validação da conta Google autorizada do workspace não foi encontrada.'
);
requireText(
  driveClient,
  'emprovexWorkspaceId',
  'As pastas Drive não estão marcadas com o workspaceId.'
);
requireText(
  driveSettings,
  "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID = 'documentStorage'",
  'A configuração não usa o settings/documentStorage do workspace.'
);
requireText(
  driveSettings,
  'operationalSettingsDocRef',
  'A configuração Drive não usa o resolver de settings por workspace.'
);
requireText(
  appHeader,
  '<WorkspaceDriveControl',
  'O controle do Drive por workspace não está montado no cabeçalho operacional.'
);
requireText(
  driveControl,
  'O token do Google Drive não é persistido',
  'O controle perdeu a indicação explícita de token temporário.'
);
requireText(
  empenhoDocuments,
  "@vercel/blob/client",
  'O upload oficial de NE deixou o Vercel Blob durante o Bloco 14C.'
);
requireText(
  invoiceDocuments,
  "@vercel/blob/client",
  'O upload oficial de NF deixou o Vercel Blob durante o Bloco 14C.'
);

const persistedCredentialPatterns = [
  /accessToken\s*:/,
  /refreshToken\s*:/,
  /refresh_token\s*:/,
  /localStorage\.(?:setItem|getItem)\s*\(/,
  /sessionStorage\.(?:setItem|getItem)\s*\(/,
];
for (const pattern of persistedCredentialPatterns) {
  if (pattern.test(driveSettings)) {
    findings.push(`Credencial/token persistente detectado em workspaceDriveSettings: ${pattern}.`);
  }
}

if (/https:\/\/www\.googleapis\.com\/auth\/drive(?:['"`]|\s)/.test(driveClient)) {
  findings.push('Escopo amplo Google Drive detectado no cliente por workspace.');
}
if (/drive\.readonly/.test(driveClient)) {
  findings.push('Escopo drive.readonly detectado; o Bloco 14C deve usar apenas drive.file.');
}

if (findings.length) {
  console.error('Workspace Google Drive — gate do Bloco 14C\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nWORKSPACE DRIVE STORAGE: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Workspace Google Drive — gate do Bloco 14C\n');
  console.log('Escopo OAuth: drive.file');
  console.log('Conta Drive: vinculada ao e-mail do workspace');
  console.log('Pastas: marcadas por workspaceId');
  console.log('Metadados persistidos: settings/documentStorage');
  console.log('Access/refresh token persistente: NÃO');
  console.log('Uploads oficiais NE/NF: Vercel Blob preservado');
  console.log('\nWORKSPACE DRIVE STORAGE: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}
