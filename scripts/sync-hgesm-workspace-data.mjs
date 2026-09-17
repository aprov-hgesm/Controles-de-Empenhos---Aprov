#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const command = process.argv[2] || 'verify';
const flags = parseFlags(process.argv.slice(3));
const expectedConfirmation = `SYNC_DATA:${recoveryPolicy.projectId}:${recoveryPolicy.databaseId}:${migrationPolicy.workspaceId}`;
const apiBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}/databases/${encodeURIComponent(recoveryPolicy.databaseId)}`;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  if (!['plan', 'status', 'verify', 'sync'].includes(command)) {
    throw new Error('Comando desconhecido. Use plan, status, verify ou sync.');
  }

  if (command === 'plan') {
    printPlan();
    return;
  }

  ensureGcloud();
  await assertTargetMetadata();

  if (command === 'sync') {
    ensureSyncConfirmation();
    ensureSafetyReady();
    await syncCollectionsOnly();
    return;
  }

  const report = await inspectCollections();
  printReport(report);
  if (command === 'verify' && !report.ready) process.exitCode = 2;
}

function parseFlags(args) {
  return Object.fromEntries(args.map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }));
}

function printPlan() {
  console.log('Sincronização HGeSM -> workspace — SOMENTE coleções operacionais\n');
  console.log(`Projeto:   ${recoveryPolicy.projectId}`);
  console.log(`Banco:     ${recoveryPolicy.databaseId}`);
  console.log(`Workspace: ${migrationPolicy.workspaceId}`);
  console.log('\nColeções:');
  for (const name of migrationPolicy.collections) {
    console.log(`  /${name} -> /workspaces/${migrationPolicy.workspaceId}/${name}`);
  }
  console.log('\nNÃO toca em:');
  for (const id of migrationPolicy.settingsDocuments) {
    console.log(`  /workspaces/${migrationPolicy.workspaceId}/settings/${id}`);
  }
  console.log('\nGarantias:');
  console.log('  - nenhuma coleção legada é apagada;');
  console.log('  - settings do workspace não são lidos para cópia nem sobrescritos;');
  console.log('  - documentos extras no destino bloqueiam a sincronização;');
  console.log('  - exige recovery READY ou snapshot local revalidado ao vivo;');
  console.log('  - legacyDataMode não é alterado por este script.');
  console.log('\nConfirmação exigida para sync:');
  console.log(`  --project=${recoveryPolicy.projectId}`);
  console.log(`  --database=${recoveryPolicy.databaseId}`);
  console.log(`  --workspace=${migrationPolicy.workspaceId}`);
  console.log(`  --confirm=${expectedConfirmation}`);
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') throw new Error('Google Cloud CLI não encontrado. Use o Cloud Shell.');
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function ensureSafetyReady() {
  console.log('Verificando proteção de recuperação antes da sincronização...');
  const recoveryResult = spawnSync(
    process.execPath,
    [resolve(root, 'scripts/firestore-recovery.mjs'), 'verify'],
    { cwd: root, encoding: 'utf8' },
  );

  if (recoveryResult.status === 0) {
    console.log('Recuperação nativa: READY');
    return;
  }

  console.log('Recuperação nativa não está READY. Verificando fallback local...');
  if (!flags.snapshot) {
    throw new Error('Sincronização bloqueada: informe --snapshot=/caminho/manifest.json após criar/validar um snapshot atual.');
  }

  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'scripts/firestore-local-snapshot.mjs'),
      'verify',
      `--snapshot=${flags.snapshot}`,
      `--project=${recoveryPolicy.projectId}`,
      `--database=${recoveryPolicy.databaseId}`,
      `--workspace=${migrationPolicy.workspaceId}`,
      '--live=true',
    ],
    { cwd: root, stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error('Sincronização bloqueada: o snapshot local não corresponde à origem legada atual.');
  }
  console.log('Fallback local: READY');
}

function ensureSyncConfirmation() {
  if (
    flags.project !== recoveryPolicy.projectId ||
    flags.database !== recoveryPolicy.databaseId ||
    flags.workspace !== migrationPolicy.workspaceId ||
    flags.confirm !== expectedConfirmation
  ) {
    throw new Error([
      'Sincronização bloqueada. Confirme explicitamente o alvo:',
      `--project=${recoveryPolicy.projectId}`,
      `--database=${recoveryPolicy.databaseId}`,
      `--workspace=${migrationPolicy.workspaceId}`,
      `--confirm=${expectedConfirmation}`,
    ].join('\n'));
  }
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Falha ao obter token do gcloud: ${result.stderr.trim() || result.stdout.trim()}`);
  const token = result.stdout.trim();
  if (!token) throw new Error('gcloud retornou token vazio.');
  return token;
}

async function firestoreRequest(relativeUrl, options = {}, allow404 = false, retryAuth = true) {
  if (!accessToken) accessToken = getAccessToken();
  const response = await fetch(`${apiBase}${relativeUrl}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (response.status === 401 && retryAuth) {
    accessToken = getAccessToken();
    return firestoreRequest(relativeUrl, options, allow404, false);
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${detail || relativeUrl}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function encodeFirestorePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function getDocument(path) {
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}`, {}, true);
}

async function listDocuments(path) {
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await firestoreRequest(`/documents/${encodeFirestorePath(path)}?${query.toString()}`);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function documentId(document) {
  const id = String(document?.name || '').split('/').pop();
  if (!id) throw new Error('Documento Firestore sem ID válido.');
  return id;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameFields(left, right) {
  return JSON.stringify(canonical(left?.fields || {})) === JSON.stringify(canonical(right?.fields || {}));
}

function fieldString(document, key) {
  return document?.fields?.[key]?.stringValue || '';
}

async function assertTargetMetadata() {
  const workspace = await getDocument(`workspaces/${migrationPolicy.workspaceId}`);
  if (!workspace) throw new Error(`Workspace ${migrationPolicy.workspaceId} não existe.`);
  if (
    fieldString(workspace, 'id') !== migrationPolicy.workspaceId ||
    fieldString(workspace, 'authorizedEmail') !== migrationPolicy.authorizedEmail ||
    fieldString(workspace, 'status') !== 'active'
  ) throw new Error('Metadados do workspace HGeSM não correspondem ao alvo esperado.');

  const account = await getDocument(`platformAccounts/${migrationPolicy.authorizedEmail}`);
  if (!account) throw new Error(`Conta ${migrationPolicy.authorizedEmail} não existe.`);
  if (
    fieldString(account, 'email') !== migrationPolicy.authorizedEmail ||
    fieldString(account, 'workspaceId') !== migrationPolicy.workspaceId ||
    fieldString(account, 'accountType') !== 'sector' ||
    fieldString(account, 'status') !== 'active'
  ) throw new Error('Metadados da conta operacional HGeSM não correspondem ao alvo esperado.');
}

function pairs() {
  return migrationPolicy.collections.map((name) => ({
    name,
    sourcePath: name,
    destinationPath: `workspaces/${migrationPolicy.workspaceId}/${name}`,
  }));
}

async function inspectCollections() {
  const sections = [];
  let ready = true;
  for (const pair of pairs()) {
    const sourceDocuments = await listDocuments(pair.sourcePath);
    const destinationDocuments = await listDocuments(pair.destinationPath);
    const sourceById = new Map(sourceDocuments.map((item) => [documentId(item), item]));
    const destinationById = new Map(destinationDocuments.map((item) => [documentId(item), item]));
    const missing = [];
    const different = [];
    const extra = [];

    for (const [id, source] of sourceById) {
      const destination = destinationById.get(id);
      if (!destination) missing.push(id);
      else if (!sameFields(source, destination)) different.push(id);
    }
    for (const id of destinationById.keys()) {
      if (!sourceById.has(id)) extra.push(id);
    }

    const sectionReady = missing.length === 0 && different.length === 0 && extra.length === 0;
    ready = ready && sectionReady;
    sections.push({ name: pair.name, sourceCount: sourceDocuments.length, destinationCount: destinationDocuments.length, missing, different, extra, ready: sectionReady });
  }
  return { ready, sections };
}

function printReport(report) {
  console.log(`\nParidade das coleções — HGeSM -> ${migrationPolicy.workspaceId}`);
  for (const section of report.sections) {
    console.log([
      `${section.ready ? 'OK' : 'PENDENTE'} ${section.name}`,
      `origem=${section.sourceCount}`,
      `destino=${section.destinationCount}`,
      `faltando=${section.missing.length}`,
      `diferentes=${section.different.length}`,
      `extras=${section.extra.length}`,
    ].join(' | '));
    if (section.missing.length) console.log(`  faltando: ${section.missing.slice(0, 10).join(', ')}`);
    if (section.different.length) console.log(`  diferentes: ${section.different.slice(0, 10).join(', ')}`);
    if (section.extra.length) console.log(`  extras: ${section.extra.slice(0, 10).join(', ')}`);
  }
  console.log(`\nPARIDADE DE DADOS: ${report.ready ? 'READY' : 'NÃO VALIDADA'}`);
  console.log('Settings do workspace: NÃO TOCADOS por este script.');
}

async function writeDocument(path, sourceDocument, existingDocument) {
  const query = new URLSearchParams();
  if (existingDocument?.updateTime) query.set('currentDocument.updateTime', existingDocument.updateTime);
  else query.set('currentDocument.exists', 'false');
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: sourceDocument.fields || {} }),
  });
}

async function syncCollectionsOnly() {
  console.log('\nSincronizando somente coleções operacionais. Settings do workspace permanecerão intocados.');
  for (const pair of pairs()) {
    const sourceDocuments = await listDocuments(pair.sourcePath);
    const destinationDocuments = await listDocuments(pair.destinationPath);
    const sourceIds = new Set(sourceDocuments.map(documentId));
    const destinationById = new Map(destinationDocuments.map((item) => [documentId(item), item]));
    const extras = [...destinationById.keys()].filter((id) => !sourceIds.has(id));
    if (extras.length) {
      throw new Error(`Destino ${pair.destinationPath} contém documentos extras (${extras.slice(0, 10).join(', ')}). Nada será apagado; revisão manual obrigatória.`);
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const source of sourceDocuments) {
      const id = documentId(source);
      const destination = destinationById.get(id);
      if (destination && sameFields(source, destination)) {
        unchanged += 1;
        continue;
      }
      await writeDocument(`${pair.destinationPath}/${id}`, source, destination);
      if (destination) updated += 1;
      else created += 1;
    }
    console.log(`${pair.name}: criados=${created}, atualizados=${updated}, já iguais=${unchanged}`);
  }

  const report = await inspectCollections();
  printReport(report);
  if (!report.ready) throw new Error('A sincronização terminou com divergências. Mantenha legacyDataMode=true.');
  console.log('\nSincronização de dados concluída. legacyDataMode continua true até o gate final.');
}
