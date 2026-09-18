#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const driveClient = read('lib/googleDriveWorkspace.ts');
const driveFiles = read('lib/googleDriveFiles.ts');
const driveRuntime = read('lib/workspaceDriveRuntime.ts');
const driveSettings = read('lib/workspaceDriveSettings.ts');
const driveHook = read('hooks/useWorkspaceDriveStorage.ts');
const driveControl = read('components/layout/WorkspaceDriveControl.tsx');
const appHeader = read('components/layout/AppHeader.tsx');
const empenhoDocuments = read('lib/empenhoDocuments.ts');
const invoiceDocuments = read('lib/invoiceDocuments.ts');

requireText(driveClient, "https://www.googleapis.com/auth/drive.file", 'O cliente Drive por workspace não usa o escopo restrito drive.file.');
requireText(driveClient, "context.resolutionSource === 'platform-directory'", 'Setores externos não usam um fluxo Drive isolado da sessão Firebase.');
requireText(driveClient, 'connectExternalWorkspaceDrive', 'O fluxo Drive externo independente não foi encontrado.');
requireText(driveClient, 'initTokenClient', 'O Drive externo não usa Google Identity Services para autorização independente.');
requireText(driveClient, "GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT = 'select_account'", 'O OAuth Drive não força seleção explícita da conta correta.');
forbidText(driveClient, "prompt: 'consent select_account'", 'O OAuth Drive ainda força consentimento em toda conexão.');
forbidText(driveClient, "prompt: 'consent'", 'O OAuth Drive ainda usa prompt de consentimento forçado.');
requireText(driveClient, 'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID', 'O cliente OAuth independente do Drive não possui configuração explícita.');
requireText(driveClient, 'about?fields=user(emailAddress)', 'A conta Google autorizadora não é validada pela Drive API.');
requireText(driveClient, 'connectFounderDriveSession', 'O fluxo fundador consolidado não foi preservado.');
requireText(driveClient, 'expires_in', 'O OAuth Drive externo não captura a validade informada pelo Google.');
requireText(driveClient, 'expiresAt', 'A sessão Drive não registra expiração apenas em memória.');
requireText(driveClient, 'GOOGLE_DRIVE_TOKEN_EXPIRY_SAFETY_MS', 'A sessão Drive não possui margem preventiva contra expiração durante operações.');
requireText(driveClient, 'assertWorkspaceGoogleDriveSessionActive', 'Operações Drive não possuem verificação preventiva da validade do token.');
requireText(driveClient, 'normalizePlatformEmail(context.email)', 'A validação da conta Google autorizada do workspace não foi encontrada.');
requireText(driveClient, 'emprovexWorkspaceId', 'As pastas Drive não estão marcadas com o workspaceId.');
requireText(driveSettings, "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID = 'documentStorage'", 'A configuração não usa settings/documentStorage do workspace.');
requireText(driveSettings, 'operationalSettingsDocRef', 'A configuração Drive não usa o resolver de settings por workspace.');
requireText(appHeader, '<WorkspaceDriveControl', 'O controle do Drive por workspace não está montado no cabeçalho operacional.');
requireText(driveControl, 'O token do Google Drive não é persistido', 'O controle perdeu a indicação explícita de token temporário.');
requireText(driveControl, 'Armazenamento documental ativo: Google Drive', 'O painel não declara o Drive como armazenamento documental ativo.');
requireText(driveRuntime, 'let activeRuntime', 'A sessão Drive não está limitada ao runtime em memória.');
requireText(driveRuntime, 'clearWorkspaceDriveRuntime', 'A sessão Drive não possui descarte explícito.');
requireText(driveRuntime, 'isWorkspaceGoogleDriveSessionExpired', 'O runtime Drive não invalida sessões expiradas.');
requireText(driveRuntime, "clearWorkspaceDriveRuntime('expired')", 'O runtime Drive não diferencia descarte por expiração.');
requireText(driveRuntime, 'subscribeWorkspaceDriveRuntime', 'A UI não pode observar expiração do runtime Drive.');
requireText(driveHook, 'setWorkspaceDriveRuntime', 'A conexão Drive não alimenta o runtime documental.');
requireText(driveHook, 'getWorkspaceGoogleDriveSessionRemainingMs', 'O hook Drive não agenda expiração preventiva da sessão.');
requireText(driveHook, "reason !== 'expired'", 'O hook Drive não reage ao descarte por expiração.');
requireText(driveHook, "clearWorkspaceDriveRuntime('expired')", 'O hook Drive não encerra o runtime ao atingir a validade do token.');
requireText(driveFiles, 'uploadAndVerifyWorkspacePdf', 'Upload Drive com verificação de integridade ausente.');
requireText(driveFiles, 'assertWorkspaceGoogleDriveSessionActive', 'Operações de arquivo não verificam token Drive antes da chamada remota.');
requireText(driveFiles, "clearWorkspaceDriveRuntime('expired')", 'Resposta 401 do Drive não invalida o runtime temporário.');
requireText(driveFiles, "crypto.subtle.digest('SHA-256'", 'Verificação SHA-256 não foi encontrada.');
requireText(empenhoDocuments, "provider: 'google-drive'", 'Novos PDFs de NE não usam Google Drive como provider oficial.');
requireText(invoiceDocuments, "provider: 'google-drive'", 'Novos PDFs de NF não usam Google Drive como provider oficial.');
requireText(empenhoDocuments, 'fetchWorkspaceDrivePdf', 'Leitura de NE não usa o Google Drive.');
requireText(invoiceDocuments, 'fetchWorkspaceDrivePdf', 'Leitura de NF não usa o Google Drive.');

for (const source of [driveControl, empenhoDocuments, invoiceDocuments]) {
  for (const forbidden of ['vercel-blob', '@vercel/blob', 'fetchLegacy', 'Blob pendente', 'Migração Blob']) {
    if (source.includes(forbidden)) findings.push(`Resíduo legado detectado no runtime Drive: ${forbidden}.`);
  }
}

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

if (driveSettings.includes('expiresAt')) {
  findings.push('A validade do token Drive não pode ser persistida em workspaceDriveSettings.');
}

if (/https:\/\/www\.googleapis\.com\/auth\/drive(?:['"`]|\s)/.test(driveClient)) {
  findings.push('Escopo amplo Google Drive detectado no cliente por workspace.');
}
if (/drive\.readonly/.test(driveClient)) {
  findings.push('Escopo drive.readonly detectado; o EMPROVEX deve usar apenas drive.file.');
}

if (findings.length) {
  console.error('Workspace Google Drive — gate documental final\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nWORKSPACE DRIVE STORAGE: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Workspace Google Drive — gate documental final\n');
  console.log('Escopo OAuth: drive.file');
  console.log('Seleção de conta: EXPLÍCITA');
  console.log('Consentimento forçado em reconexões: NÃO');
  console.log('Conta Drive: vinculada ao e-mail do workspace');
  console.log('Pastas: marcadas por workspaceId');
  console.log('Metadados persistidos: settings/documentStorage');
  console.log('Access/refresh token persistente: NÃO');
  console.log('Expiração do token externo: CONTROLADA EM MEMÓRIA');
  console.log('Reconexão preventiva: ATIVA');
  console.log('Uploads e leitura NE/NF: GOOGLE DRIVE');
  console.log('Integridade: SHA-256');
  console.log('Fallback legado: AUSENTE');
  console.log('\nWORKSPACE DRIVE STORAGE: READY');
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
