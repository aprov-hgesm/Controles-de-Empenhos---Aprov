#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const apiBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}/databases/${encodeURIComponent(recoveryPolicy.databaseId)}`;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  ensureGcloud();

  console.log('Gate de settings por workspace — HGeSM');
  console.log(`Projeto:   ${recoveryPolicy.projectId}`);
  console.log(`Banco:     ${recoveryPolicy.databaseId}`);
  console.log(`Workspace: ${migrationPolicy.workspaceId}\n`);

  await assertTargetMetadata();

  const legacyCounterDoc = await getDocument('settings/termoRecebimentoCounter');
  const workspaceCounterDoc = await getDocument(`workspaces/${migrationPolicy.workspaceId}/settings/termoRecebimentoCounter`);

  if (!legacyCounterDoc) throw new Error('Contador legado settings/termoRecebimentoCounter não existe.');
  if (!workspaceCounterDoc) throw new Error('Contador do workspace não existe. Execute/revise a migração antes do cutover.');

  const legacyCounter = integerField(legacyCounterDoc, 'currentNumber');
  const workspaceCounter = integerField(workspaceCounterDoc, 'currentNumber');

  if (!Number.isInteger(legacyCounter) || legacyCounter < 0) {
    throw new Error(`Contador legado inválido: ${String(legacyCounter)}`);
  }
  if (!Number.isInteger(workspaceCounter) || workspaceCounter < 0) {
    throw new Error(`Contador do workspace inválido: ${String(workspaceCounter)}`);
  }

  const legacyInvoices = await listDocuments('invoices');
  const workspaceInvoices = await listDocuments(`workspaces/${migrationPolicy.workspaceId}/invoices`);
  const legacyMaxTermo = maxTermoNumero(legacyInvoices);
  const workspaceMaxTermo = maxTermoNumero(workspaceInvoices);

  console.log('Contadores');
  console.log(`  legado:                   ${legacyCounter}`);
  console.log(`  workspace:                ${workspaceCounter}`);
  console.log(`  maior TR nas NFs legado:  ${legacyMaxTermo}`);
  console.log(`  maior TR nas NFs workspace:${workspaceMaxTermo}`);
  console.log(`  NFs legado/workspace:      ${legacyInvoices.length}/${workspaceInvoices.length}\n`);

  const problems = [];
  if (legacyCounter !== workspaceCounter) {
    problems.push(`contador divergente (legado=${legacyCounter}, workspace=${workspaceCounter})`);
  }
  if (legacyMaxTermo !== workspaceMaxTermo) {
    problems.push(`maior termo divergente (legado=${legacyMaxTermo}, workspace=${workspaceMaxTermo})`);
  }
  if (legacyInvoices.length !== workspaceInvoices.length) {
    problems.push(`quantidade de NFs divergente (legado=${legacyInvoices.length}, workspace=${workspaceInvoices.length})`);
  }
  if (legacyCounter < legacyMaxTermo) {
    problems.push(`contador legado ${legacyCounter} está abaixo do maior termo ${legacyMaxTermo}`);
  }
  if (workspaceCounter < workspaceMaxTermo) {
    problems.push(`contador workspace ${workspaceCounter} está abaixo do maior termo ${workspaceMaxTermo}`);
  }

  if (problems.length > 0) {
    console.log('SETTINGS CUTOVER: BLOQUEADO');
    problems.forEach((problem) => console.log(`  - ${problem}`));
    process.exitCode = 2;
    return;
  }

  console.log('Metadados workspace/conta: OK');
  console.log('Paridade do contador:       OK');
  console.log('Piso pelo maior TR:          OK');
  console.log('Paridade de NFs:             OK');
  console.log('\nSETTINGS CUTOVER: READY');
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') throw new Error('Google Cloud CLI não encontrado. Use o Cloud Shell.');
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Não foi possível obter token do gcloud: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  const token = result.stdout.trim();
  if (!token) throw new Error('gcloud retornou token vazio.');
  return token;
}

async function firestoreRequest(relativeUrl, allow404 = false, retryAuth = true) {
  if (!accessToken) accessToken = getAccessToken();
  const response = await fetch(`${apiBase}${relativeUrl}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 && retryAuth) {
    accessToken = getAccessToken();
    return firestoreRequest(relativeUrl, allow404, false);
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${detail || relativeUrl}`);
  }
  return response.json();
}

function encodeFirestorePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function getDocument(path) {
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}`, true);
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await firestoreRequest(`/documents/${encodeFirestorePath(collectionPath)}?${query.toString()}`);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function stringField(document, key) {
  return document?.fields?.[key]?.stringValue || '';
}

function numberFromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return NaN;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  return NaN;
}

function integerField(document, key) {
  return numberFromFirestoreValue(document?.fields?.[key]);
}

function maxTermoNumero(documents) {
  let max = 0;
  for (const document of documents) {
    const value = numberFromFirestoreValue(document?.fields?.termoNumero);
    if (Number.isInteger(value) && value > max) max = value;
  }
  return max;
}

async function assertTargetMetadata() {
  const workspace = await getDocument(`workspaces/${migrationPolicy.workspaceId}`);
  if (!workspace) throw new Error(`Workspace ${migrationPolicy.workspaceId} não existe.`);
  if (
    stringField(workspace, 'id') !== migrationPolicy.workspaceId ||
    stringField(workspace, 'authorizedEmail') !== migrationPolicy.authorizedEmail ||
    stringField(workspace, 'status') !== 'active'
  ) {
    throw new Error('Metadados do workspace HGeSM não correspondem ao alvo esperado.');
  }

  const account = await getDocument(`platformAccounts/${migrationPolicy.authorizedEmail}`);
  if (!account) throw new Error(`Conta ${migrationPolicy.authorizedEmail} não existe em platformAccounts.`);
  if (
    stringField(account, 'email') !== migrationPolicy.authorizedEmail ||
    stringField(account, 'workspaceId') !== migrationPolicy.workspaceId ||
    stringField(account, 'accountType') !== 'sector' ||
    stringField(account, 'status') !== 'active'
  ) {
    throw new Error('Metadados da conta operacional HGeSM não correspondem ao alvo esperado.');
  }
}
