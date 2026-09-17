#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));

const SNAPSHOT_KIND = 'emprovex-hgesm-firestore-snapshot';
const MANIFEST_KIND = 'emprovex-hgesm-snapshot-manifest';
const SCHEMA_VERSION = 1;
const command = process.argv[2] || 'plan';
const flags = parseFlags(process.argv.slice(3));
const apiBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}/databases/${encodeURIComponent(recoveryPolicy.databaseId)}`;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case 'plan':
      printPlan();
      return;
    case 'create':
      ensureTargetFlags();
      ensureGcloud();
      await createSnapshot();
      return;
    case 'verify':
      ensureGcloud();
      await verifyCommand();
      return;
    case 'rollback-plan':
      ensureGcloud();
      await rollbackPlanCommand();
      return;
    case 'rollback':
      ensureGcloud();
      await rollbackCommand();
      return;
    default:
      throw new Error('Comando desconhecido. Use plan, create, verify, rollback-plan ou rollback.');
  }
}

function parseFlags(args) {
  return Object.fromEntries(args.map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }));
}

function printPlan() {
  console.log('Fallback gratuito de snapshot do Firestore (nenhuma alteração executada)\n');
  console.log(`Projeto:    ${recoveryPolicy.projectId}`);
  console.log(`Banco:      ${recoveryPolicy.databaseId}`);
  console.log(`Workspace:  ${migrationPolicy.workspaceId}`);
  console.log(`Diretório:  ${join(homedir(), 'emprovex-snapshots')}`);
  console.log('\nO snapshot inclui:');
  for (const collectionName of migrationPolicy.collections) {
    console.log(`  /${collectionName}`);
  }
  for (const documentId of migrationPolicy.settingsDocuments) {
    console.log(`  /settings/${documentId}`);
  }
  console.log('\nGarantias:');
  console.log('  - snapshot JSON preserva os tipos nativos da API Firestore;');
  console.log('  - manifesto contém SHA-256 do arquivo e do conjunto lógico de dados;');
  console.log('  - verify --live prova que o snapshot ainda corresponde à origem atual;');
  console.log('  - rollback usa precondições de concorrência e nunca apaga documentos extras;');
  console.log('  - arquivos são criados fora do Git com permissões restritas.');
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') throw new Error('Google Cloud CLI não encontrado. Use o Cloud Shell.');
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function ensureTargetFlags() {
  if (
    flags.project !== recoveryPolicy.projectId ||
    flags.database !== recoveryPolicy.databaseId ||
    flags.workspace !== migrationPolicy.workspaceId
  ) {
    throw new Error([
      'Alvo não confirmado. Informe explicitamente:',
      `--project=${recoveryPolicy.projectId}`,
      `--database=${recoveryPolicy.databaseId}`,
      `--workspace=${migrationPolicy.workspaceId}`,
    ].join('\n'));
  }
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

function documentId(document) {
  const name = String(document?.name || '');
  const id = name.split('/').pop();
  if (!id) throw new Error(`Documento Firestore sem ID válido: ${name}`);
  return id;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonical(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function snapshotDataView(snapshot) {
  return {
    collections: snapshot.collections,
    settingsDocuments: snapshot.settingsDocuments,
  };
}

function computeDataSha(snapshot) {
  return sha256(stableJson(snapshotDataView(snapshot)));
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
  ) {
    throw new Error('Metadados do workspace HGeSM não correspondem ao alvo esperado.');
  }

  const account = await getDocument(`platformAccounts/${migrationPolicy.authorizedEmail}`);
  if (!account) throw new Error(`Conta ${migrationPolicy.authorizedEmail} não existe em platformAccounts.`);
  if (
    fieldString(account, 'email') !== migrationPolicy.authorizedEmail ||
    fieldString(account, 'workspaceId') !== migrationPolicy.workspaceId ||
    fieldString(account, 'accountType') !== 'sector' ||
    fieldString(account, 'status') !== 'active'
  ) {
    throw new Error('Metadados da conta operacional HGeSM não correspondem ao alvo esperado.');
  }
}

async function captureLiveSnapshot() {
  const collections = {};
  for (const collectionName of migrationPolicy.collections) {
    const documents = await listDocuments(collectionName);
    collections[collectionName] = documents
      .map((document) => ({ id: documentId(document), fields: document.fields || {} }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  const settingsDocuments = [];
  for (const id of migrationPolicy.settingsDocuments) {
    const document = await getDocument(`settings/${id}`);
    if (document) settingsDocuments.push({ id, fields: document.fields || {} });
  }
  settingsDocuments.sort((a, b) => a.id.localeCompare(b.id));

  return {
    kind: SNAPSHOT_KIND,
    schemaVersion: SCHEMA_VERSION,
    projectId: recoveryPolicy.projectId,
    databaseId: recoveryPolicy.databaseId,
    workspaceId: migrationPolicy.workspaceId,
    authorizedEmail: migrationPolicy.authorizedEmail,
    capturedAt: new Date().toISOString(),
    collections,
    settingsDocuments,
  };
}

function buildCounts(snapshot) {
  const collections = Object.fromEntries(
    Object.entries(snapshot.collections).map(([name, documents]) => [name, documents.length]),
  );
  const settings = snapshot.settingsDocuments.length;
  const totalDocuments = Object.values(collections).reduce((sum, count) => sum + count, 0) + settings;
  return { collections, settings, totalDocuments };
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function snapshotRoot() {
  if (flags.out) return resolveUserPath(flags.out);
  return join(homedir(), 'emprovex-snapshots', `hgesm-${timestampForPath()}`);
}

function resolveUserPath(value) {
  if (!value) return '';
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

async function createSnapshot() {
  await assertTargetMetadata();
  const directory = snapshotRoot();
  if (existsSync(directory)) {
    throw new Error(`Diretório de snapshot já existe: ${directory}`);
  }

  console.log('Capturando dados legados do HGeSM...');
  const snapshot = await captureLiveSnapshot();
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotSha256 = sha256(snapshotText);
  const dataSha256 = computeDataSha(snapshot);
  const counts = buildCounts(snapshot);
  const manifest = {
    kind: MANIFEST_KIND,
    schemaVersion: SCHEMA_VERSION,
    projectId: snapshot.projectId,
    databaseId: snapshot.databaseId,
    workspaceId: snapshot.workspaceId,
    authorizedEmail: snapshot.authorizedEmail,
    createdAt: snapshot.capturedAt,
    snapshotFile: 'snapshot.json',
    snapshotSha256,
    dataSha256,
    counts,
  };

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const snapshotPath = join(directory, 'snapshot.json');
  const manifestPath = join(directory, 'manifest.json');
  writeFileSync(snapshotPath, snapshotText, { encoding: 'utf8', mode: 0o600 });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(snapshotPath, 0o600);
  chmodSync(manifestPath, 0o600);

  const loaded = loadVerifiedSnapshot(manifestPath);
  const live = await captureLiveSnapshot();
  const liveSha = computeDataSha(live);
  if (liveSha !== loaded.manifest.dataSha256) {
    throw new Error('Os dados mudaram durante a criação do snapshot. Crie um novo snapshot em período de baixa atividade.');
  }

  console.log('\nSNAPSHOT READY');
  console.log(`Manifesto: ${manifestPath}`);
  console.log(`Documentos: ${counts.totalDocuments}`);
  console.log(`SHA-256 arquivo: ${snapshotSha256}`);
  console.log(`SHA-256 dados:   ${dataSha256}`);
  console.log('\nO snapshot foi validado localmente e comparado com a origem ao vivo.');
}

function resolveManifestPath(value) {
  if (!value) throw new Error('Informe --snapshot=/caminho/manifest.json.');
  const candidate = resolveUserPath(value);
  if (!existsSync(candidate)) throw new Error(`Snapshot não encontrado: ${candidate}`);
  if (statSync(candidate).isDirectory()) return join(candidate, 'manifest.json');
  return candidate;
}

function assertManifestTarget(manifest) {
  if (
    manifest.kind !== MANIFEST_KIND ||
    manifest.schemaVersion !== SCHEMA_VERSION ||
    manifest.projectId !== recoveryPolicy.projectId ||
    manifest.databaseId !== recoveryPolicy.databaseId ||
    manifest.workspaceId !== migrationPolicy.workspaceId ||
    manifest.authorizedEmail !== migrationPolicy.authorizedEmail
  ) {
    throw new Error('Manifesto não corresponde ao projeto/banco/workspace HGeSM esperado.');
  }
}

function assertSnapshotTarget(snapshot) {
  if (
    snapshot.kind !== SNAPSHOT_KIND ||
    snapshot.schemaVersion !== SCHEMA_VERSION ||
    snapshot.projectId !== recoveryPolicy.projectId ||
    snapshot.databaseId !== recoveryPolicy.databaseId ||
    snapshot.workspaceId !== migrationPolicy.workspaceId ||
    snapshot.authorizedEmail !== migrationPolicy.authorizedEmail
  ) {
    throw new Error('Snapshot não corresponde ao projeto/banco/workspace HGeSM esperado.');
  }
}

function loadVerifiedSnapshot(manifestInput) {
  const manifestPath = resolveManifestPath(manifestInput);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assertManifestTarget(manifest);

  const snapshotPath = resolve(dirname(manifestPath), basename(manifest.snapshotFile || 'snapshot.json'));
  if (!existsSync(snapshotPath)) throw new Error(`Arquivo do snapshot não encontrado: ${snapshotPath}`);
  const snapshotText = readFileSync(snapshotPath, 'utf8');
  const fileSha = sha256(snapshotText);
  if (fileSha !== manifest.snapshotSha256) {
    throw new Error('SHA-256 do arquivo de snapshot diverge do manifesto. Snapshot corrompido ou modificado.');
  }

  const snapshot = JSON.parse(snapshotText);
  assertSnapshotTarget(snapshot);
  const dataSha = computeDataSha(snapshot);
  if (dataSha !== manifest.dataSha256) {
    throw new Error('SHA-256 lógico dos dados diverge do manifesto. Snapshot inválido.');
  }

  const counts = buildCounts(snapshot);
  if (stableJson(counts) !== stableJson(manifest.counts)) {
    throw new Error('Contagens do snapshot divergem do manifesto.');
  }

  return { manifestPath, snapshotPath, manifest, snapshot };
}

async function verifyCommand() {
  const loaded = loadVerifiedSnapshot(flags.snapshot);
  console.log('Snapshot local: ÍNTEGRO');
  console.log(`Manifesto: ${loaded.manifestPath}`);
  console.log(`Documentos: ${loaded.manifest.counts.totalDocuments}`);
  console.log(`SHA-256 dados: ${loaded.manifest.dataSha256}`);

  if (flags.live === 'true' || flags.live === '1' || Object.hasOwn(flags, 'live')) {
    ensureTargetFlags();
    await assertTargetMetadata();
    const live = await captureLiveSnapshot();
    const liveSha = computeDataSha(live);
    if (liveSha !== loaded.manifest.dataSha256) {
      console.log(`SHA-256 origem atual: ${liveSha}`);
      throw new Error('SNAPSHOT DESATUALIZADO: a origem mudou desde a captura. Crie um novo snapshot antes da migração.');
    }
    console.log('Origem ao vivo: IDÊNTICA AO SNAPSHOT');
  }

  console.log('SNAPSHOT READY');
}

function snapshotMap(snapshot, collectionName) {
  return new Map((snapshot.collections[collectionName] || []).map((item) => [item.id, item]));
}

function snapshotSettingsMap(snapshot) {
  return new Map((snapshot.settingsDocuments || []).map((item) => [item.id, item]));
}

function sameFields(leftFields, rightDocument) {
  return stableJson(leftFields || {}) === stableJson(rightDocument?.fields || {});
}

async function inspectRollback(snapshot) {
  const sections = [];
  let safe = true;
  let identical = true;

  for (const collectionName of migrationPolicy.collections) {
    const expected = snapshotMap(snapshot, collectionName);
    const liveDocuments = await listDocuments(collectionName);
    const live = new Map(liveDocuments.map((item) => [documentId(item), item]));
    const missing = [];
    const different = [];
    const extra = [];

    for (const [id, item] of expected) {
      const current = live.get(id);
      if (!current) missing.push(id);
      else if (!sameFields(item.fields, current)) different.push(id);
    }
    for (const id of live.keys()) {
      if (!expected.has(id)) extra.push(id);
    }

    if (extra.length) safe = false;
    if (missing.length || different.length || extra.length) identical = false;
    sections.push({ name: collectionName, missing, different, extra });
  }

  const expectedSettings = snapshotSettingsMap(snapshot);
  for (const id of migrationPolicy.settingsDocuments) {
    const expected = expectedSettings.get(id);
    const current = await getDocument(`settings/${id}`);
    const missing = expected && !current ? ['document'] : [];
    const different = expected && current && !sameFields(expected.fields, current) ? ['document'] : [];
    const extra = !expected && current ? ['document'] : [];
    if (extra.length) safe = false;
    if (missing.length || different.length || extra.length) identical = false;
    sections.push({ name: `settings/${id}`, missing, different, extra });
  }

  return { safe, identical, sections };
}

function printRollbackReport(report) {
  console.log('\nPlano de rollback para coleções legadas');
  for (const section of report.sections) {
    console.log(`${section.name}: faltando=${section.missing.length} | diferentes=${section.different.length} | extras=${section.extra.length}`);
    if (section.missing.length) console.log(`  faltando: ${section.missing.slice(0, 10).join(', ')}`);
    if (section.different.length) console.log(`  diferentes: ${section.different.slice(0, 10).join(', ')}`);
    if (section.extra.length) console.log(`  extras: ${section.extra.slice(0, 10).join(', ')}`);
  }
  console.log(`\nEstado: ${report.identical ? 'JÁ IDÊNTICO' : report.safe ? 'ROLLBACK SEGURO DISPONÍVEL' : 'BLOQUEADO POR DOCUMENTOS EXTRAS'}`);
}

async function rollbackPlanCommand() {
  ensureTargetFlags();
  await assertTargetMetadata();
  const loaded = loadVerifiedSnapshot(flags.snapshot);
  const report = await inspectRollback(loaded.snapshot);
  printRollbackReport(report);
  const confirmation = rollbackConfirmation(loaded.manifest);
  console.log(`\nConfirmação exigida para rollback: --confirm=${confirmation}`);
  if (!report.safe) process.exitCode = 2;
}

function rollbackConfirmation(manifest) {
  return `RESTORE_LEGACY:${recoveryPolicy.projectId}:${recoveryPolicy.databaseId}:${migrationPolicy.workspaceId}:${manifest.dataSha256.slice(0, 12)}`;
}

function ensureRollbackConfirmation(manifest) {
  ensureTargetFlags();
  const expected = rollbackConfirmation(manifest);
  if (flags.confirm !== expected) {
    throw new Error(`Rollback bloqueado. Confirmação exigida:\n--confirm=${expected}`);
  }
}

async function writeLegacyDocument(path, fields, existingDocument) {
  const query = new URLSearchParams();
  if (existingDocument?.updateTime) {
    query.set('currentDocument.updateTime', existingDocument.updateTime);
  } else {
    query.set('currentDocument.exists', 'false');
  }
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: fields || {} }),
  });
}

async function rollbackCommand() {
  await assertTargetMetadata();
  const loaded = loadVerifiedSnapshot(flags.snapshot);
  ensureRollbackConfirmation(loaded.manifest);
  const before = await inspectRollback(loaded.snapshot);
  printRollbackReport(before);
  if (!before.safe) {
    throw new Error('Rollback bloqueado: existem documentos atuais ausentes no snapshot. O script não os apagará automaticamente.');
  }
  if (before.identical) {
    console.log('\nNenhuma alteração necessária. A origem já coincide com o snapshot.');
    return;
  }

  console.log('\nRestaurando somente documentos faltantes ou diferentes; nenhum documento será apagado...');
  for (const collectionName of migrationPolicy.collections) {
    const expected = snapshotMap(loaded.snapshot, collectionName);
    const liveDocuments = await listDocuments(collectionName);
    const live = new Map(liveDocuments.map((item) => [documentId(item), item]));
    let restored = 0;
    for (const [id, item] of expected) {
      const current = live.get(id);
      if (current && sameFields(item.fields, current)) continue;
      await writeLegacyDocument(`${collectionName}/${id}`, item.fields, current);
      restored += 1;
    }
    console.log(`${collectionName}: restaurados=${restored}`);
  }

  const expectedSettings = snapshotSettingsMap(loaded.snapshot);
  for (const id of migrationPolicy.settingsDocuments) {
    const expected = expectedSettings.get(id);
    const current = await getDocument(`settings/${id}`);
    if (!expected) continue;
    if (current && sameFields(expected.fields, current)) {
      console.log(`settings/${id}: já idêntico.`);
      continue;
    }
    await writeLegacyDocument(`settings/${id}`, expected.fields, current);
    console.log(`settings/${id}: restaurado.`);
  }

  const afterLive = await captureLiveSnapshot();
  const afterSha = computeDataSha(afterLive);
  if (afterSha !== loaded.manifest.dataSha256) {
    throw new Error('Rollback terminou, mas a verificação final não coincide com o snapshot. Interrompa novas alterações e revise manualmente.');
  }
  console.log('\nROLLBACK VALIDADO: origem legada idêntica ao snapshot.');
}
