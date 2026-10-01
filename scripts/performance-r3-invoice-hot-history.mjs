#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(
  readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8')
);

const command = (process.argv[2] || 'plan').trim().toLowerCase();
const flags = parseFlags(process.argv.slice(3));
const projectId = String(flags.project || recoveryPolicy.projectId || '').trim();
const databaseId = String(flags.database || recoveryPolicy.databaseId || '').trim();
const workspaceId = String(flags.workspace || '').trim();
const markerId = 'perf-r3-invoice-hot-history';
const schemaVersion = 'perf_r3_invoice_hot_history_v1';
const expectedConfirmation =
  `BACKFILL_INVOICE_HOT_HISTORY:${projectId}:${databaseId}:${workspaceId}`;
const apiBase =
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;

let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  if (!['plan', 'status', 'backfill'].includes(command)) {
    throw new Error('Comando desconhecido. Use plan, status ou backfill.');
  }
  if (!projectId || !databaseId) {
    throw new Error('Projeto/database Firestore não configurados.');
  }
  if (!workspaceId) {
    throw new Error('Informe --workspace=<workspaceId>.');
  }

  if (command === 'plan') {
    printPlan();
    return;
  }

  ensureGcloud();
  await assertWorkspaceExists();

  if (command === 'status') {
    const report = await inspectInvoices();
    printReport(report);
    if (!report.ready) process.exitCode = 2;
    return;
  }

  ensureBackfillConfirmation();
  const before = await inspectInvoices();
  printReport(before);

  if (before.invalid.length > 0) {
    throw new Error(
      'Backfill bloqueado: existem localizações modernas inválidas. Corrija os registros indicados antes de continuar.'
    );
  }

  let updated = 0;
  for (const invoice of before.missing) {
    await patchLocation(invoice);
    updated += 1;
  }

  const after = await inspectInvoices();
  if (!after.ready) {
    printReport(after);
    throw new Error('Backfill terminou, mas a verificação final não ficou READY. O marcador não será gravado.');
  }

  await writeReadyMarker(updated);
  const marker = await getDocument(
    `workspaces/${workspaceId}/settings/${markerId}`
  );
  if (
    fieldString(marker, 'schemaVersion') !== schemaVersion
    || fieldString(marker, 'workspaceId') !== workspaceId
    || fieldString(marker, 'status') !== 'ready'
  ) {
    throw new Error('Backfill validado, mas o marcador PERF-X não pôde ser certificado.');
  }

  console.log(`\nPERF-X INVOICE HOT/HISTORY BACKFILL: READY | atualizados=${updated}`);
}

function parseFlags(args) {
  return Object.fromEntries(
    args
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, ...value] = arg.replace(/^--/, '').split('=');
        return [key, value.join('=')];
      })
  );
}

function printPlan() {
  console.log('PERF-X — backfill mínimo de localizacaoAtual (nenhuma alteração executada)\n');
  console.log(`Projeto:   ${projectId}`);
  console.log(`Banco:     ${databaseId}`);
  console.log(`Workspace: ${workspaceId}`);
  console.log('\nRegra de derivação para documentos sem localizacaoAtual:');
  console.log('  tesourariaDate presente -> TESOURARIA');
  console.log('  senão comissaoDate presente -> COMISSAO');
  console.log('  senão -> APROVISIONAMENTO');
  console.log('\nGarantias:');
  console.log('  - somente /workspaces/<workspace>/invoices é lido/alterado;');
  console.log('  - documentos que já possuem localizacaoAtual válida não são regravados;');
  console.log('  - PATCH usa updateMask e precondição updateTime;');
  console.log('  - nenhum documento é criado, apagado ou renomeado;');
  console.log('  - o marcador READY só é gravado após verificação integral;');
  console.log('  - o marcador não substitui a NF como fonte canônica.');
  console.log('\nConfirmação exigida para backfill:');
  console.log(`  --confirm=${expectedConfirmation}`);
}

function ensureBackfillConfirmation() {
  if (flags.confirm !== expectedConfirmation) {
    throw new Error(
      `Backfill bloqueado. Confirmação exigida:\n--confirm=${expectedConfirmation}`
    );
  }
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') {
    throw new Error('Google Cloud CLI não encontrado. Execute no Cloud Shell.');
  }
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `Não foi possível obter token do gcloud: ${result.stderr.trim() || result.stdout.trim()}`
    );
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
    throw new Error(
      `Firestore REST ${response.status}: ${detail || relativeUrl}`
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

function encodeFirestorePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function getDocument(path) {
  return firestoreRequest(
    `/documents/${encodeFirestorePath(path)}`,
    {},
    true
  );
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = '';
  do {
    const search = new URLSearchParams({
      pageSize: '300',
      showMissing: 'false',
    });
    if (pageToken) search.set('pageToken', pageToken);
    const payload = await firestoreRequest(
      `/documents/${encodeFirestorePath(collectionPath)}?${search.toString()}`
    );
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

async function assertWorkspaceExists() {
  const workspace = await getDocument(`workspaces/${workspaceId}`);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} não existe.`);
  }
}

function fieldString(document, key) {
  return document?.fields?.[key]?.stringValue || '';
}

function documentId(document) {
  const name = String(document?.name || '');
  const id = name.split('/').pop();
  if (!id) throw new Error(`Documento Firestore sem ID válido: ${name}`);
  return id;
}

function deriveLocation(document) {
  const tesourariaDate = fieldString(document, 'tesourariaDate');
  const comissaoDate = fieldString(document, 'comissaoDate');
  if (tesourariaDate) return 'TESOURARIA';
  if (comissaoDate) return 'COMISSAO';
  return 'APROVISIONAMENTO';
}

async function inspectInvoices() {
  const documents = await listDocuments(`workspaces/${workspaceId}/invoices`);
  const missing = [];
  const invalid = [];
  let operational = 0;
  let completed = 0;

  for (const document of documents) {
    const location = fieldString(document, 'localizacaoAtual');
    if (!location) {
      missing.push({
        id: documentId(document),
        updateTime: document.updateTime,
        location: deriveLocation(document),
      });
      continue;
    }
    if (!['APROVISIONAMENTO', 'COMISSAO', 'TESOURARIA'].includes(location)) {
      invalid.push({ id: documentId(document), location });
      continue;
    }
    if (location === 'TESOURARIA') completed += 1;
    else operational += 1;
  }

  return {
    total: documents.length,
    operational,
    completed,
    missing,
    invalid,
    ready: missing.length === 0 && invalid.length === 0,
  };
}

function printReport(report) {
  console.log('\nPERF-X — estado de localizacaoAtual');
  console.log(`total=${report.total}`);
  console.log(`operacionais=${report.operational}`);
  console.log(`concluídas=${report.completed}`);
  console.log(`sem localizacaoAtual=${report.missing.length}`);
  console.log(`localizacaoAtual inválida=${report.invalid.length}`);
  if (report.missing.length) {
    console.log(
      `  pendentes de backfill: ${report.missing.slice(0, 12).map((item) => item.id).join(', ')}`
    );
  }
  if (report.invalid.length) {
    console.log(
      `  inválidos: ${report.invalid.slice(0, 12).map((item) => `${item.id}=${item.location}`).join(', ')}`
    );
  }
  console.log(`Estado: ${report.ready ? 'READY' : 'PENDENTE'}`);
}

async function patchLocation(invoice) {
  if (!invoice.updateTime) {
    throw new Error(`NF ${invoice.id} não possui updateTime para precondição segura.`);
  }

  const search = new URLSearchParams();
  search.append('updateMask.fieldPaths', 'localizacaoAtual');
  search.set('currentDocument.updateTime', invoice.updateTime);

  await firestoreRequest(
    `/documents/${encodeFirestorePath(
      `workspaces/${workspaceId}/invoices/${invoice.id}`
    )}?${search.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          localizacaoAtual: {
            stringValue: invoice.location,
          },
        },
      }),
    }
  );
}

async function writeReadyMarker(migratedCount) {
  const markerPath =
    `workspaces/${workspaceId}/settings/${markerId}`;
  const existing = await getDocument(markerPath);
  const search = new URLSearchParams();
  for (const field of [
    'schemaVersion',
    'workspaceId',
    'status',
    'migratedCount',
    'verifiedAt',
  ]) {
    search.append('updateMask.fieldPaths', field);
  }
  if (existing?.updateTime) {
    search.set('currentDocument.updateTime', existing.updateTime);
  }

  await firestoreRequest(
    `/documents/${encodeFirestorePath(markerPath)}?${search.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          schemaVersion: { stringValue: schemaVersion },
          workspaceId: { stringValue: workspaceId },
          status: { stringValue: 'ready' },
          migratedCount: { integerValue: String(migratedCount) },
          verifiedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    }
  );
}
