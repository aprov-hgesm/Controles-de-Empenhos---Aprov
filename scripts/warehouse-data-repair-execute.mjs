#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeForensics, positionKey } from './warehouse-data-repair-dry-run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recovery = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migration = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const warehouseDb = recovery.databases?.find((entry) => entry.role === 'warehouse-logistics');
if (!warehouseDb?.id) throw new Error('WAREHOUSE_REPAIR_DATABASE_NOT_CONFIGURED');

const EXPECTED = Object.freeze({
  projectId: recovery.projectId,
  databaseId: warehouseDb.id,
  workspaceId: migration.workspaceId,
  location: 'us-east1',
});
const REPAIR_ID = 'WAREHOUSE-LOT-REPAIR-2026-10-05-01';
const APPLY_CONFIRMATION = 'APPLY_AUTHORIZED_REPAIR';
const TARGETS = Object.freeze([
  Object.freeze({
    materialId: 'mat_272f2d996ee65ed3530ad2d7e27b66d7',
    lotId: 'lot_670e1ca177804501b90bf8cdd669683f',
    path: 'warehouse/hgesm-aprov/lots/lot_670e1ca177804501b90bf8cdd669683f',
    beforeQuantity: 440,
    afterQuantity: 340,
    cause: 'MANUAL_ENRICHMENT_CRIOU_ATRIBUICAO_DE_LOTE_ACIMA_DO_LEDGER',
  }),
  Object.freeze({
    materialId: 'mat_6feb0840ca4060f7d69fcce1663f21b8',
    lotId: 'lot_082ebcd7a2acf0c706c87464307cb1ff',
    path: 'warehouse/hgesm-aprov/lots/lot_082ebcd7a2acf0c706c87464307cb1ff',
    beforeQuantity: 50,
    afterQuantity: 40,
    cause: 'OUTBOUND_SEM_LOTID_NAO_REDUZIU_ATRIBUICAO_LOGISTICA_DE_LOTE',
  }),
]);
const TARGET_BY_PATH = new Map(TARGETS.map((target) => [target.path, target]));
const COLLECTIONS = Object.freeze([
  'depots',
  'locations',
  'movements',
  'balances',
  'locationBalances',
  'lots',
  'intakes',
  'withdrawals',
  'consumptions',
  'outboundReturns',
]);
const EPSILON = 0.000001;
let token = '';
let gcloudCommand = 'gcloud';
let readCount = 0;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('\nERRO: ' + error.message);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  });
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help || flags.h) return printHelp();
  assertTarget(flags);
  const apply = flags.apply === true;
  if (apply) assertApplyConfirmation(flags);

  const suppliedToken = String(process.env.WAREHOUSE_AUDIT_ACCESS_TOKEN || '').trim();
  if (suppliedToken) token = suppliedToken;
  else ensureGcloud(flags.gcloud);

  const pageSize = boundedInt(flags['page-size'], 200, 50, 300);
  const cap = boundedInt(flags['max-docs-per-collection'], 5000, 100, 20000);
  const dataApiBase =
    'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(EXPECTED.projectId)
    + '/databases/' + encodeURIComponent(EXPECTED.databaseId);
  const client = createClient(dataApiBase, pageSize, cap);

  console.log('WAREHOUSE-DATA-REPAIR-EXECUTION-01');
  console.log('repairId=' + REPAIR_ID);
  console.log('mode=' + (apply ? 'APPLY' : 'DRY-RUN'));
  console.log('project=' + EXPECTED.projectId);
  console.log('database=' + EXPECTED.databaseId);
  console.log('workspace=' + EXPECTED.workspaceId);

  const dataset = await loadDataset(client, EXPECTED.workspaceId);
  const report = analyzeForensics(dataset, {
    projectId: EXPECTED.projectId,
    databaseId: EXPECTED.databaseId,
    workspaceId: EXPECTED.workspaceId,
    readCount,
    cappedCollections: dataset.cappedCollections,
  });
  const plan = validateAuthorizedPlan(report, dataset);
  console.log('\nPRE-WRITE DRY-RUN: PASS');
  printPlan(plan);

  const recoveryState = await verifyRecoveryProtection();
  console.log('\nRECOVERY PRECONDITION: PASS');
  console.log(JSON.stringify(recoveryState, null, 2));

  if (!apply) {
    console.log('\nDRY-RUN ONLY — nenhuma escrita executada.');
    console.log('Para aplicar, use --apply --confirm-repair-id=' + REPAIR_ID + ' --confirm-write=' + APPLY_CONFIRMATION);
    return;
  }

  const tx = await beginTransaction(dataApiBase);
  let committed = false;
  try {
    const txSnapshot = await readTransactionPreconditions(dataApiBase, tx, plan);
    assertTransactionPreconditions(plan, txSnapshot);
    console.log('\nTRANSACTION PRECONDITIONS: PASS');

    const commitResult = await commitAuthorizedRepair(dataApiBase, tx, plan, txSnapshot);
    committed = true;
    console.log('\nWRITE COMMIT: SUCCESS');
    console.log(JSON.stringify({ commitTime: commitResult.commitTime || null, writeResults: commitResult.writeResults || [] }, null, 2));
  } catch (error) {
    if (!committed) await safeRollback(dataApiBase, tx);
    throw error;
  }

  const postDataset = await loadDataset(client, EXPECTED.workspaceId);
  const postReport = analyzeForensics(postDataset, {
    projectId: EXPECTED.projectId,
    databaseId: EXPECTED.databaseId,
    workspaceId: EXPECTED.workspaceId,
    readCount,
    cappedCollections: postDataset.cappedCollections,
  });
  const post = assertPostRepair(postReport, postDataset);
  console.log('\nPOST-REPAIR TARGETED VALIDATION: PASS');
  console.log(JSON.stringify(post, null, 2));

  const globalAudit = runGlobalAudit(flags);
  console.log('\nGLOBAL READ-ONLY AUDIT: ' + globalAudit.status);
  console.log(JSON.stringify(globalAudit.summary, null, 2));

  console.log('\nREPAIR_EXECUTION_JSON_BEGIN');
  console.log(JSON.stringify({
    repairId: REPAIR_ID,
    approvedBy: 'Fundador — autorização explícita registrada pelo Program Control em 2026-10-05',
    executedAt: new Date().toISOString(),
    targets: plan.map((entry) => ({
      materialId: entry.target.materialId,
      path: entry.target.path,
      before: entry.target.beforeQuantity,
      after: entry.target.afterQuantity,
      cause: entry.target.cause,
    })),
    recovery: recoveryState,
    postRepair: post,
    globalAudit: globalAudit.summary,
  }, null, 2));
  console.log('REPAIR_EXECUTION_JSON_END');
}

function parseFlags(args) {
  const out = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const raw = arg.slice(2);
    const index = raw.indexOf('=');
    if (index < 0) out[raw] = true;
    else out[raw.slice(0, index)] = raw.slice(index + 1);
  }
  return out;
}

function printHelp() {
  console.log([
    'Uso seguro:',
    'node scripts/warehouse-data-repair-execute.mjs',
    '  --project=' + EXPECTED.projectId,
    '  --database=' + EXPECTED.databaseId,
    '  --workspace=' + EXPECTED.workspaceId,
    '  [--page-size=200] [--max-docs-per-collection=5000]',
    '  [--gcloud="C:\\caminho\\para\\gcloud.cmd"]',
    '',
    'Sem --apply, o executor é read-only.',
    'Para aplicar o repair autorizado:',
    '  --apply',
    '  --confirm-repair-id=' + REPAIR_ID,
    '  --confirm-write=' + APPLY_CONFIRMATION,
    '',
    'Escopo de write: somente quantity dos dois lotes allowlisted.',
  ].join('\n'));
}

function assertTarget(flags) {
  if (
    flags.project !== EXPECTED.projectId
    || flags.database !== EXPECTED.databaseId
    || flags.workspace !== EXPECTED.workspaceId
  ) {
    throw new Error(
      'Alvo não confirmado. Use --project=' + EXPECTED.projectId
      + ' --database=' + EXPECTED.databaseId
      + ' --workspace=' + EXPECTED.workspaceId
    );
  }
}

function assertApplyConfirmation(flags) {
  if (flags['confirm-repair-id'] !== REPAIR_ID || flags['confirm-write'] !== APPLY_CONFIRMATION) {
    throw new Error('APPLY bloqueado: confirmação explícita do repairId/write ausente ou incorreta.');
  }
}

function boundedInt(value, fallback, min, max) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('Valor fora de ' + min + '..' + max + ': ' + String(value));
  }
  return parsed;
}

function ensureGcloud(explicitCommand) {
  const windowsDefault = process.env.LOCALAPPDATA
    ? process.env.LOCALAPPDATA + '\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd'
    : null;
  const candidates = [
    explicitCommand,
    process.env.GCLOUD,
    process.env.GCLOUD_CMD,
    windowsDefault,
    process.platform === 'win32' ? 'gcloud.cmd' : null,
    'gcloud',
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates.map(String))]) {
    if (/[\r\n]/.test(candidate)) continue;
    const result = spawnGcloud(candidate, ['--version']);
    if (!result.error && result.status === 0) {
      gcloudCommand = candidate;
      return;
    }
  }
  throw new Error('Google Cloud CLI não encontrado. Defina GCLOUD_CMD ou use --gcloud.');
}

function spawnGcloud(command, args) {
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const commandLine = [command, ...args].map(quoteCmdArg).join(' ');
    return spawnSync(comspec, ['/d', '/s', '/c', commandLine], { encoding: 'utf8' });
  }
  return spawnSync(command, args, { encoding: 'utf8' });
}

function quoteCmdArg(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function accessToken() {
  if (token) return token;
  const result = spawnGcloud(gcloudCommand, ['auth', 'print-access-token']);
  if (result.status !== 0) {
    throw new Error('Falha ao obter token gcloud: ' + String(result.stderr || '').trim());
  }
  const value = result.stdout.trim();
  if (!value) throw new Error('Token gcloud vazio.');
  token = value;
  return token;
}

async function requestJson(url, options = {}, retry = true) {
  if (!token) token = accessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (response.status === 401 && retry) {
    token = '';
    accessToken();
    return requestJson(url, options, false);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error('Google API ' + response.status + ': ' + (text || url));
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return parseStreamingJson(text);
  }
}

function parseStreamingJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {}
  const rows = [];
  for (const line of trimmed.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    rows.push(JSON.parse(line.replace(/^,/, '')));
  }
  return rows;
}

function createClient(apiBase, pageSize, cap) {
  async function list(collectionPath) {
    const documents = [];
    let pageToken = '';
    while (documents.length < cap) {
      const remaining = cap - documents.length;
      const qs = new URLSearchParams({
        pageSize: String(Math.min(pageSize, remaining)),
        showMissing: 'false',
      });
      if (pageToken) qs.set('pageToken', pageToken);
      const payload = await requestJson(
        apiBase + '/documents/' + encodePath(collectionPath) + '?' + qs.toString(),
        { method: 'GET' }
      );
      const page = payload.documents || [];
      documents.push(...page);
      readCount += page.length;
      pageToken = payload.nextPageToken || '';
      if (!pageToken) return { documents, capped: false };
    }
    return { documents, capped: Boolean(pageToken) };
  }
  return { list };
}

function encodePath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function loadDataset(client, workspaceId) {
  const rootPath = 'warehouse/' + workspaceId;
  const collections = {};
  const cappedCollections = [];
  for (const name of COLLECTIONS) {
    const result = await client.list(rootPath + '/' + name);
    collections[name] = result.documents.map(decodeDocument);
    if (result.capped) cappedCollections.push(name);
  }
  return { collections, cappedCollections };
}

function decodeDocument(document) {
  return {
    _documentId: String(document.name || '').split('/').pop(),
    _createTime: document.createTime || null,
    _updateTime: document.updateTime || null,
    ...decodeFields(document.fields || {}),
  };
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  return value;
}

function validateAuthorizedPlan(report, dataset) {
  if ((dataset.cappedCollections || []).length) {
    throw new Error('ABORT — REFORENSICS REQUIRED: auditoria pré-write atingiu cap.');
  }
  if (!report.readyForHumanRepairAuthorization) {
    throw new Error('ABORT — REFORENSICS REQUIRED: dry-run não confirma repair determinístico.');
  }
  const candidates = report.repairManifest?.candidates || [];
  if (candidates.length !== TARGETS.length) {
    throw new Error('ABORT — REFORENSICS REQUIRED: número inesperado de candidatos: ' + candidates.length);
  }

  const resultByMaterial = new Map(
    (report.results || []).map((row) => [row.materialId, row])
  );
  const plan = [];

  for (const candidate of candidates) {
    const target = TARGET_BY_PATH.get(candidate.path);
    if (!target) throw new Error('ABORT — candidato fora da allowlist: ' + candidate.path);

    const materialResult = resultByMaterial.get(target.materialId);
    if (
      !materialResult
      || materialResult.cause !== target.cause
      || materialResult.causeProven !== true
      || materialResult.repairDeterministic !== true
    ) {
      throw new Error(
        'ABORT — causa canônica diverge da autorização para ' + candidate.path
      );
    }

    if (
      candidate.materialId !== target.materialId
      || !approx(candidate.before?.quantity, target.beforeQuantity)
      || !approx(candidate.after?.quantity, target.afterQuantity)
    ) {
      throw new Error('ABORT — manifesto atual diverge da autorização para ' + candidate.path);
    }

    if (!candidate.preconditions?.expectedLotUpdatedAt) {
      throw new Error('ABORT — precondição updateTime ausente para ' + candidate.path);
    }

    plan.push({ target, candidate, materialResult });
  }

  for (const target of TARGETS) {
    if (!plan.some((entry) => entry.target.path === target.path)) {
      throw new Error('ABORT — target autorizado não apareceu no dry-run: ' + target.path);
    }
  }

  return plan.sort((a, b) => a.target.path.localeCompare(b.target.path));
}

function printPlan(plan) {
  for (const entry of plan) {
    console.log(
      entry.target.path
      + ' | ' + entry.target.beforeQuantity
      + ' -> ' + entry.target.afterQuantity
      + ' | cause=' + entry.target.cause
    );
  }
}

async function verifyRecoveryProtection() {
  const databaseName = 'projects/' + EXPECTED.projectId + '/databases/' + EXPECTED.databaseId;
  const database = await requestJson(
    'https://firestore.googleapis.com/v1/' + databaseName,
    { method: 'GET' }
  );
  const pitrEnabled = database.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED';
  if (!pitrEnabled) throw new Error('ABORT — BACKUP/PITR NOT READY: PITR Warehouse não está ativo.');

  const payload = await requestJson(
    'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(EXPECTED.projectId)
      + '/locations/' + encodeURIComponent(EXPECTED.location) + '/backups?pageSize=100',
    { method: 'GET' }
  );
  const now = Date.now();
  const backups = (payload.backups || [])
    .filter((backup) => backup.state === 'READY')
    .filter((backup) => String(backup.database || '').endsWith('/databases/' + EXPECTED.databaseId))
    .filter((backup) => !backup.expireTime || Date.parse(backup.expireTime) > now)
    .sort((a, b) => String(b.snapshotTime || '').localeCompare(String(a.snapshotTime || '')));
  if (!backups.length) throw new Error('ABORT — BACKUP/PITR NOT READY: nenhum backup READY não expirado.');

  const earliest = database.earliestVersionTime ? Date.parse(database.earliestVersionTime) : NaN;
  if (!Number.isFinite(earliest) || earliest >= now) {
    throw new Error('ABORT — BACKUP/PITR NOT READY: earliestVersionTime inválido.');
  }

  return {
    pointInTimeRecoveryEnablement: database.pointInTimeRecoveryEnablement,
    earliestVersionTime: database.earliestVersionTime || null,
    deleteProtectionState: database.deleteProtectionState || null,
    latestReadyBackup: {
      name: backups[0].name,
      snapshotTime: backups[0].snapshotTime || null,
      expireTime: backups[0].expireTime || null,
      state: backups[0].state,
    },
  };
}

async function beginTransaction(apiBase) {
  const payload = await requestJson(apiBase + '/documents:beginTransaction', {
    method: 'POST',
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  if (!payload.transaction) throw new Error('Falha ao abrir transação Firestore.');
  return payload.transaction;
}

function fullDocumentName(path) {
  return 'projects/' + EXPECTED.projectId
    + '/databases/' + EXPECTED.databaseId
    + '/documents/' + path;
}

async function readTransactionPreconditions(apiBase, transaction, plan) {
  const documents = [];
  for (const entry of plan) {
    documents.push(fullDocumentName(entry.target.path));
    documents.push(fullDocumentName(
      'warehouse/' + EXPECTED.workspaceId + '/balances/' + entry.target.materialId
    ));
  }
  const batch = await requestJson(apiBase + '/documents:batchGet', {
    method: 'POST',
    body: JSON.stringify({ documents: [...new Set(documents)], transaction }),
  });
  const batchRows = Array.isArray(batch) ? batch : [batch];
  const found = new Map();
  for (const row of batchRows) {
    if (row?.found?.name) found.set(row.found.name, row.found);
  }

  const lotsByMaterial = new Map();
  for (const entry of plan) {
    const response = await requestJson(
      apiBase + '/documents/' + encodePath('warehouse/' + EXPECTED.workspaceId) + ':runQuery',
      {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'lots' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'materialId' },
                op: 'EQUAL',
                value: { stringValue: entry.target.materialId },
              },
            },
          },
          transaction,
        }),
      }
    );
    const rows = Array.isArray(response) ? response : [response];
    const docs = rows.map((row) => row.document).filter(Boolean);
    lotsByMaterial.set(entry.target.materialId, docs);
  }

  return { found, lotsByMaterial };
}

function assertTransactionPreconditions(plan, snapshot) {
  for (const entry of plan) {
    const lotName = fullDocumentName(entry.target.path);
    const lotRaw = snapshot.found.get(lotName);
    if (!lotRaw) throw new Error('ABORT — target ausente na transação: ' + entry.target.path);
    const lot = decodeDocument(lotRaw);
    const p = entry.candidate.preconditions;
    if (!approx(lot.quantity, p.expectedLotQuantity) || !approx(lot.quantity, entry.target.beforeQuantity)) {
      throw new Error('ABORT — lote mudou desde o dry-run: ' + entry.target.path);
    }
    if (lotRaw.updateTime !== p.expectedLotUpdatedAt) {
      throw new Error('ABORT — updatedAt mudou desde o dry-run: ' + entry.target.path);
    }

    const balancePath = 'warehouse/' + EXPECTED.workspaceId + '/balances/' + entry.target.materialId;
    const balanceRaw = snapshot.found.get(fullDocumentName(balancePath));
    if (!balanceRaw) throw new Error('ABORT — balance ausente: ' + balancePath);
    const balance = decodeDocument(balanceRaw);
    if (!sameNullable(balance.revision, p.expectedBalanceRevision)) {
      throw new Error('ABORT — balance.revision divergiu para ' + entry.target.materialId);
    }
    if (!sameNullable(balance.lastMovementId, p.expectedBalanceLastMovementId)) {
      throw new Error('ABORT — balance.lastMovementId divergiu para ' + entry.target.materialId);
    }

    const materialLots = (snapshot.lotsByMaterial.get(entry.target.materialId) || []).map(decodeDocument);
    const currentIds = materialLots
      .filter((row) => row.status === 'active' && positionKey(row.position) === positionKey(lot.position))
      .map((row) => row._documentId)
      .sort();
    const expectedIds = [...(p.activeLotIdsAtPosition || [])].sort();
    if (JSON.stringify(currentIds) !== JSON.stringify(expectedIds)) {
      throw new Error('ABORT — conjunto de lotes ativos mudou para ' + entry.target.materialId);
    }
  }
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

async function commitAuthorizedRepair(apiBase, transaction, plan, snapshot) {
  const writes = plan.map((entry) => {
    const raw = snapshot.found.get(fullDocumentName(entry.target.path));
    return {
      update: {
        name: raw.name,
        fields: {
          quantity: encodeNumericLike(raw.fields?.quantity, entry.target.afterQuantity),
        },
      },
      updateMask: { fieldPaths: ['quantity'] },
      currentDocument: { updateTime: raw.updateTime },
    };
  });
  if (writes.length !== 2) throw new Error('ABORT — executor tentou quantidade inesperada de writes.');
  for (const write of writes) {
    const relative = String(write.update.name).split('/documents/')[1] || '';
    if (!TARGET_BY_PATH.has(relative)) throw new Error('ABORT — write fora da allowlist: ' + relative);
  }
  return requestJson(apiBase + '/documents:commit', {
    method: 'POST',
    body: JSON.stringify({ writes, transaction }),
  });
}

function encodeNumericLike(raw, value) {
  if (raw && Object.prototype.hasOwnProperty.call(raw, 'integerValue')) {
    if (!Number.isSafeInteger(value)) throw new Error('Valor não inteiro para campo integerValue.');
    return { integerValue: String(value) };
  }
  if (raw && Object.prototype.hasOwnProperty.call(raw, 'doubleValue')) {
    return { doubleValue: Number(value) };
  }
  throw new Error('Tipo numérico inesperado do campo quantity.');
}

async function safeRollback(apiBase, transaction) {
  if (!transaction) return;
  try {
    await requestJson(apiBase + '/documents:rollback', {
      method: 'POST',
      body: JSON.stringify({ transaction }),
    });
  } catch {}
}

function assertPostRepair(report, dataset) {
  if ((dataset.cappedCollections || []).length) {
    throw new Error('POST-REPAIR VALIDATION FAILURE — auditoria pós-write atingiu cap.');
  }
  const expected = new Map([
    ['mat_272f2d996ee65ed3530ad2d7e27b66d7', { aggregate: 445, physical: 440, unassigned: 5, lots: 440 }],
    ['mat_6feb0840ca4060f7d69fcce1663f21b8', { aggregate: 90, physical: 90, unassigned: 0, lots: 90 }],
  ]);
  const summary = [];
  for (const [materialId, target] of expected) {
    const row = report.results.find((item) => item.materialId === materialId);
    if (!row) throw new Error('POST-REPAIR VALIDATION FAILURE — material ausente: ' + materialId);
    const aggregate = row.aggregate ?? row.currentAggregate ?? row.aggregateBalance;
    if (
      !approx(aggregate, target.aggregate)
      || !approx(row.physicalActive, target.physical)
      || !approx(row.legacyUnassigned, target.unassigned)
      || !approx(row.activeLotQuantity, target.lots)
      || !approx(row.lotExcess, 0)
    ) {
      const error = new Error('POST-REPAIR VALIDATION FAILURE — estado inesperado em ' + materialId);
      error.details = { row, expected: target };
      throw error;
    }
    summary.push({
      materialId,
      aggregate,
      physicalActive: row.physicalActive,
      legacyUnassigned: row.legacyUnassigned,
      activeLots: row.activeLotQuantity,
      lotExcess: row.lotExcess,
    });
  }
  return summary;
}

function runGlobalAudit(flags) {
  const script = resolve(root, 'scripts/warehouse-integrity-reconcile-readonly.mjs');
  const args = [
    script,
    '--project=' + EXPECTED.projectId,
    '--database=' + EXPECTED.databaseId,
    '--workspace=' + EXPECTED.workspaceId,
    '--page-size=' + boundedInt(flags['page-size'], 200, 50, 300),
    '--max-docs-per-collection=' + boundedInt(flags['max-docs-per-collection'], 5000, 100, 20000),
  ];
  if (flags.gcloud) args.push('--gcloud=' + flags.gcloud);
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, WAREHOUSE_AUDIT_ACCESS_TOKEN: token || accessToken() },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error('POST-REPAIR VALIDATION FAILURE — auditoria global falhou: ' + String(result.stderr || result.stdout || '').trim());
  }
  const parsed = extractJsonBlock(result.stdout, 'JSON_REPORT_BEGIN', 'JSON_REPORT_END');
  const forbidden = (parsed.issues || []).filter((issue) =>
    issue.category === 'INCONSISTENT'
    && issue.code === 'LOT_ATTRIBUTION_EXCEEDS_STOCK'
    && TARGETS.some((target) => target.materialId === issue.materialId)
  );
  if (forbidden.length) {
    const error = new Error('POST-REPAIR VALIDATION FAILURE — blocker de lote persiste.');
    error.details = forbidden;
    throw error;
  }
  const blockers = (parsed.issues || []).filter((issue) => issue.category === 'INCONSISTENT');
  if (blockers.length) {
    const error = new Error('POST-REPAIR VALIDATION FAILURE — auditoria global encontrou inconsistência bloqueadora.');
    error.details = blockers;
    throw error;
  }
  return {
    status: parsed.finalClassification,
    summary: {
      finalClassification: parsed.finalClassification,
      counts: parsed.counts,
      remainingIssues: (parsed.issues || []).filter((issue) => issue.category !== 'INCONSISTENT'),
    },
  };
}

function extractJsonBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) throw new Error('Bloco JSON da auditoria global não encontrado.');
  return JSON.parse(text.slice(start + startMarker.length, end).trim());
}

function approx(left, right) {
  return typeof left === 'number' && typeof right === 'number' && Math.abs(left - right) <= EPSILON;
}

export {
  APPLY_CONFIRMATION,
  REPAIR_ID,
  TARGETS,
  assertApplyConfirmation,
  assertPostRepair,
  assertTransactionPreconditions,
  encodeNumericLike,
  extractJsonBlock,
  parseFlags,
  parseStreamingJson,
  validateAuthorizedPlan,
};
