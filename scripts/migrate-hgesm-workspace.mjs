#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));

const command = process.argv[2] || 'plan';
const flags = parseFlags(process.argv.slice(3));
const expectedConfirmation = `COPY:${recoveryPolicy.projectId}:${recoveryPolicy.databaseId}:${migrationPolicy.workspaceId}`;
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
    case 'status':
      ensureGcloud();
      await assertTargetMetadata();
      printReport(await inspectMigration());
      return;
    case 'copy':
      ensureCopyConfirmation();
      ensureGcloud();
      ensureSafetyReady();
      await assertTargetMetadata();
      await copyLegacyData();
      return;
    case 'verify': {
      ensureGcloud();
      await assertTargetMetadata();
      const report = await inspectMigration();
      printReport(report);
      if (!report.ready) process.exitCode = 2;
      return;
    }
    default:
      throw new Error('Comando desconhecido. Use plan, status, copy ou verify.');
  }
}

function parseFlags(args) {
  return Object.fromEntries(args.map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }));
}

function printPlan() {
  console.log('Migração segura HGeSM -> workspace (nenhuma alteração executada)\n');
  console.log(`Projeto:    ${recoveryPolicy.projectId}`);
  console.log(`Banco:      ${recoveryPolicy.databaseId}`);
  console.log(`Workspace:  ${migrationPolicy.workspaceId}`);
  console.log(`Conta:      ${migrationPolicy.authorizedEmail}`);
  console.log('\nColeções:');
  for (const collectionName of migrationPolicy.collections) {
    console.log(`  /${collectionName} -> /workspaces/${migrationPolicy.workspaceId}/${collectionName}`);
  }
  for (const documentId of migrationPolicy.settingsDocuments) {
    console.log(`  /settings/${documentId} -> /workspaces/${migrationPolicy.workspaceId}/settings/${documentId}`);
  }
  console.log('\nGarantias:');
  console.log('  - operação por cópia; fontes legadas não são apagadas;');
  console.log('  - exige recovery:verify READY OU snapshot local íntegro e idêntico à origem;');
  console.log('  - destino é sincronizado somente após confirmação literal;');
  console.log('  - legacyDataMode não é alterado por este script;');
  console.log('  - verificação compara IDs e campos Firestore exatamente.');
  console.log('\nFallback gratuito:');
  console.log('  use --snapshot=/caminho/manifest.json quando PITR/backup nativo não estiver disponível.');
  console.log('  o snapshot é revalidado contra a origem ao vivo imediatamente antes da cópia.');
  console.log('\nConfirmação exigida para copy:');
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
  console.log('Verificando proteção de recuperação antes da migração...');
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
    throw new Error([
      'Migração bloqueada: recovery:verify não está READY e nenhum snapshot local foi informado.',
      'Crie/valide o fallback gratuito e repita o copy com:',
      '--snapshot=/caminho/manifest.json',
    ].join('\n'));
  }

  const snapshotResult = spawnSync(
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

  if (snapshotResult.status !== 0) {
    throw new Error('Migração bloqueada: o snapshot local não está íntegro ou não corresponde à origem atual.');
  }
  console.log('Fallback local: READY');
}

function ensureCopyConfirmation() {
  if (
    flags.project !== recoveryPolicy.projectId ||
    flags.database !== recoveryPolicy.databaseId ||
    flags.workspace !== migrationPolicy.workspaceId ||
    flags.confirm !== expectedConfirmation
  ) {
    throw new Error([
      'Cópia bloqueada. Confirme explicitamente o alvo:',
      `--project=${recoveryPolicy.projectId}`,
      `--database=${recoveryPolicy.databaseId}`,
      `--workspace=${migrationPolicy.workspaceId}`,
      `--confirm=${expectedConfirmation}`,
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

function sameFields(left, right) {
  return JSON.stringify(canonical(left?.fields || {})) === JSON.stringify(canonical(right?.fields || {}));
}

async function writeDocument(path, sourceDocument, existingDocument) {
  const query = new URLSearchParams();
  if (existingDocument?.updateTime) {
    query.set('currentDocument.updateTime', existingDocument.updateTime);
  } else {
    query.set('currentDocument.exists', 'false');
  }
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: sourceDocument.fields || {} }),
  });
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

function collectionPairs() {
  return migrationPolicy.collections.map((collectionName) => ({
    label: collectionName,
    sourcePath: collectionName,
    destinationPath: `workspaces/${migrationPolicy.workspaceId}/${collectionName}`,
  }));
}

function settingPairs() {
  return migrationPolicy.settingsDocuments.map((documentId) => ({
    label: `settings/${documentId}`,
    sourcePath: `settings/${documentId}`,
    destinationPath: `workspaces/${migrationPolicy.workspaceId}/settings/${documentId}`,
  }));
}

async function inspectMigration() {
  const sections = [];
  let ready = true;

  for (const pair of collectionPairs()) {
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
    sections.push({
      name: pair.label,
      sourceCount: sourceDocuments.length,
      destinationCount: destinationDocuments.length,
      missing,
      different,
      extra,
      ready: sectionReady,
    });
  }

  for (const pair of settingPairs()) {
    const source = await getDocument(pair.sourcePath);
    const destination = await getDocument(pair.destinationPath);
    const sourceCount = source ? 1 : 0;
    const destinationCount = destination ? 1 : 0;
    const missing = source && !destination ? ['document'] : [];
    const different = source && destination && !sameFields(source, destination) ? ['document'] : [];
    const extra = !source && destination ? ['document'] : [];
    const sectionReady = missing.length === 0 && different.length === 0 && extra.length === 0;
    ready = ready && sectionReady;
    sections.push({
      name: pair.label,
      sourceCount,
      destinationCount,
      missing,
      different,
      extra,
      ready: sectionReady,
    });
  }

  return { ready, workspaceId: migrationPolicy.workspaceId, sections };
}

function printReport(report) {
  console.log(`\nMigração HGeSM -> ${report.workspaceId}`);
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
  console.log(`\nIntegridade: ${report.ready ? 'READY' : 'NÃO VALIDADA'}`);
}

async function copyLegacyData() {
  console.log('\nIniciando cópia segura. Nenhum documento legado será apagado.');

  for (const pair of collectionPairs()) {
    const sourceDocuments = await listDocuments(pair.sourcePath);
    const destinationDocuments = await listDocuments(pair.destinationPath);
    const sourceIds = new Set(sourceDocuments.map(documentId));
    const destinationById = new Map(destinationDocuments.map((item) => [documentId(item), item]));
    const extras = [...destinationById.keys()].filter((id) => !sourceIds.has(id));
    if (extras.length) {
      throw new Error(`Destino ${pair.destinationPath} possui documentos extras (${extras.slice(0, 10).join(', ')}). Revisão manual obrigatória; nada será apagado.`);
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
    console.log(`${pair.label}: criados=${created}, atualizados=${updated}, já iguais=${unchanged}`);
  }

  for (const pair of settingPairs()) {
    const source = await getDocument(pair.sourcePath);
    const destination = await getDocument(pair.destinationPath);
    if (!source) {
      if (destination) throw new Error(`Destino ${pair.destinationPath} existe sem documento de origem correspondente.`);
      console.log(`${pair.label}: origem inexistente; nada a copiar.`);
      continue;
    }
    if (destination && sameFields(source, destination)) {
      console.log(`${pair.label}: já idêntico.`);
      continue;
    }
    await writeDocument(pair.destinationPath, source, destination);
    console.log(`${pair.label}: ${destination ? 'atualizado' : 'criado'}.`);
  }

  const report = await inspectMigration();
  printReport(report);
  if (!report.ready) {
    throw new Error('A cópia terminou, mas a verificação encontrou divergências. A produção continua no legado; não prossiga para a troca de paths.');
  }
  console.log('\nCópia concluída e verificada. A produção continua em legacyDataMode=true.');
}
