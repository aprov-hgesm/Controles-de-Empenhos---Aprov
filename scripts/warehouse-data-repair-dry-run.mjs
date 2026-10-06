#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recovery = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migration = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const warehouseDb = recovery.databases?.find((entry) => entry.role === 'warehouse-logistics');
if (!warehouseDb?.id) throw new Error('WAREHOUSE_FORENSICS_DATABASE_NOT_CONFIGURED');

const EXPECTED = Object.freeze({
  projectId: recovery.projectId,
  databaseId: warehouseDb.id,
  workspaceId: migration.workspaceId,
});
const TARGET_MATERIALS = Object.freeze([
  'mat_272f2d996ee65ed3530ad2d7e27b66d7',
  'mat_6feb0840ca4060f7d69fcce1663f21b8',
]);
const CONTROL_MATERIAL = 'mat_bb6d4a089c224b1a48ad3a43f32170a3';
const MATERIALS = Object.freeze([...TARGET_MATERIALS, CONTROL_MATERIAL]);
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
let readCount = 0;
let gcloudCommand = 'gcloud';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('\nERRO: ' + error.message);
    process.exitCode = error.code === 'DIAGNOSTIC_ACCESS_REQUIRED' ? 3 : 1;
  });
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help || flags.h) return printHelp();
  assertTarget(flags);

  const suppliedToken = String(process.env.WAREHOUSE_AUDIT_ACCESS_TOKEN || '').trim();
  if (suppliedToken) token = suppliedToken;
  else ensureGcloud(flags.gcloud);

  const pageSize = boundedInt(flags['page-size'], 200, 50, 300);
  const cap = boundedInt(flags['max-docs-per-collection'], 5000, 100, 20000);
  const apiBase =
    'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(EXPECTED.projectId)
    + '/databases/' + encodeURIComponent(EXPECTED.databaseId);

  console.log('WAREHOUSE-DATA-REPAIR-FORENSICS-01 — READ-ONLY DRY-RUN');
  console.log('Projeto: ' + EXPECTED.projectId);
  console.log('Banco: ' + EXPECTED.databaseId);
  console.log('Workspace: ' + EXPECTED.workspaceId);
  console.log('Materiais: ' + MATERIALS.join(', '));
  console.log('pageSize=' + pageSize + ' cap=' + cap);

  let dataset;
  try {
    dataset = await loadDataset(createClient(apiBase, pageSize, cap), EXPECTED.workspaceId);
  } catch (cause) {
    const error = new Error('DIAGNOSTIC ACCESS REQUIRED: ' + cause.message);
    error.code = 'DIAGNOSTIC_ACCESS_REQUIRED';
    throw error;
  }

  const report = analyzeForensics(dataset, {
    projectId: EXPECTED.projectId,
    databaseId: EXPECTED.databaseId,
    workspaceId: EXPECTED.workspaceId,
    readCount,
    cappedCollections: dataset.cappedCollections,
  });
  printReport(report);
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
    'Uso:',
    'node scripts/warehouse-data-repair-dry-run.mjs',
    '  --project=' + EXPECTED.projectId,
    '  --database=' + EXPECTED.databaseId,
    '  --workspace=' + EXPECTED.workspaceId,
    '  [--page-size=200] [--max-docs-per-collection=5000]',
    '  [--gcloud="C:\\caminho\\para\\gcloud.cmd"]',
    '',
    'Garantia: somente leitura Firestore REST via HTTP GET.',
    'O script não executa repair, migration, backfill, transaction write ou restore.',
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
  return value;
}

function createClient(apiBase, pageSize, cap) {
  async function request(relative, retry = true) {
    if (!token) token = accessToken();
    const response = await fetch(apiBase + relative, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (response.status === 401 && retry) {
      token = accessToken();
      return request(relative, false);
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error('Firestore REST ' + response.status + ': ' + (detail || relative));
    }
    return response.json();
  }

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
      const payload = await request(
        '/documents/' + encodePath(collectionPath) + '?' + qs.toString()
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
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
  );
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

function analyzeForensics(dataset, meta = {}) {
  const c = dataset.collections;
  const depots = new Map(c.depots.map((row) => [row._documentId, row]));
  const locations = new Map(c.locations.map((row) => [row._documentId, row]));
  const movementById = new Map(c.movements.map((row) => [row._documentId, row]));
  const consumptionById = new Map(c.consumptions.map((row) => [row._documentId, row]));
  const results = MATERIALS.map((materialId) =>
    analyzeMaterial(materialId, c, depots, locations, movementById, consumptionById)
  );

  const blockers = results.filter((row) => TARGET_MATERIALS.includes(row.materialId));
  const allCausesProven = blockers.every((row) => row.causeProven);
  const allRepairsDeterministic = blockers.every((row) => row.repairDeterministic);
  const complete = (dataset.cappedCollections || []).length === 0;

  const finalClassification =
    complete && allCausesProven && allRepairsDeterministic
      ? 'PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO'
      : complete && blockers.some((row) => row.causeProven)
        ? 'PASS PARCIAL — CAUSA PROVADA EM PARTE / MAIS EVIDÊNCIA NECESSÁRIA'
        : 'BLOCKED — CAUSALIDADE INSUFICIENTE PARA REPAIR SEGURO';

  return {
    meta: {
      ...meta,
      generatedAt: new Date().toISOString(),
      materials: MATERIALS,
    },
    results,
    repairManifest: {
      repairId: 'warehouse-data-repair-forensics-01',
      approvedBy: null,
      executedAt: null,
      candidates: blockers.flatMap((row) => row.repairCandidates),
      globalPreconditions: [
        'reexecutar este dry-run imediatamente antes de qualquer repair',
        'abortar se revision/lastMovementId/updatedAt/quantidades/IDs de lote mudarem',
        'preservar movements append-only',
        'confirmar backup Warehouse READY antes da execução',
      ],
      rollbackPlan:
        'Manifesto before/after + backup Warehouse READY; nenhum rollback por edição de ledger.',
    },
    finalClassification,
    readyForHumanRepairAuthorization:
      complete && allCausesProven && allRepairsDeterministic,
  };
}

function analyzeMaterial(
  materialId,
  c,
  depots,
  locations,
  movementById,
  consumptionById
) {
  const balance = c.balances.find((row) => row.materialId === materialId) || null;
  const locationBalances = c.locationBalances.filter((row) => row.materialId === materialId);
  const lots = c.lots.filter((row) => row.materialId === materialId);
  const movements = c.movements.filter((row) => row.materialId === materialId);
  const intakes = c.intakes.filter((row) => row.materialId === materialId);
  const consumptions = c.consumptions.filter((row) => row.materialId === materialId);
  const returns = c.outboundReturns.filter((row) =>
    row.materialId === materialId
    || consumptionById.get(row.consumptionId)?.materialId === materialId
  );
  const withdrawalIds = new Set(consumptions.map((row) => row.withdrawalId).filter(Boolean));
  const withdrawals = c.withdrawals.filter((row) => withdrawalIds.has(row._documentId));

  const physicalByPosition = new Map();
  let physicalActive = 0;
  let legacyUnassigned = 0;
  for (const row of locationBalances) {
    const quantity = number(row.quantity) ?? 0;
    const classification = classifyPosition(row.position, depots, locations);
    const key = positionKey(row.position);
    if (classification === 'ACTIVE_PHYSICAL') {
      physicalActive += quantity;
      physicalByPosition.set(key, (physicalByPosition.get(key) || 0) + quantity);
    } else if (classification === 'UNASSIGNED') {
      legacyUnassigned += quantity;
    }
  }

  const activeLots = lots.filter((row) => row.status === 'active');
  const lotByPosition = new Map();
  for (const lot of activeLots) {
    const key = positionKey(lot.position);
    lotByPosition.set(key, (lotByPosition.get(key) || 0) + (number(lot.quantity) ?? 0));
  }

  const excessByPosition = [];
  for (const [key, lotQuantity] of lotByPosition) {
    const physical = physicalByPosition.get(key) || 0;
    if (lotQuantity - physical > EPSILON) {
      excessByPosition.push({
        positionKey: key,
        activeLotQuantity: round(lotQuantity),
        physicalQuantity: round(physical),
        excess: round(lotQuantity - physical),
      });
    }
  }

  const outbounds = movements.filter((row) => row.type === 'OUTBOUND');
  const noLotOutbounds = outbounds.filter((row) =>
    row.source?.kind === 'EXPRESS_OUTBOUND' && !row.source.lotId
  );
  const lotAwareOutbounds = outbounds.filter((row) =>
    row.source?.kind === 'EXPRESS_OUTBOUND' && Boolean(row.source.lotId)
  );
  const unclassifiedOutbounds = outbounds.filter(
    (row) => row.source?.kind !== 'EXPRESS_OUTBOUND'
  );
  const competingQuantitativeMovements = movements.filter((row) =>
    ['INVENTORY_ADJUSTMENT', 'INVOICE_CORRECTION', 'REVERSAL', 'OUTBOUND_RETURN']
      .includes(row.type)
  );

  const noLotReturnQuantityByMovement = new Map();
  for (const summary of returns) {
    const consumption = consumptionById.get(summary.consumptionId);
    const originalMovement = consumption?.movementId
      ? movementById.get(consumption.movementId)
      : null;
    if (
      originalMovement?.type === 'OUTBOUND'
      && originalMovement.source?.kind === 'EXPRESS_OUTBOUND'
      && !originalMovement.source.lotId
    ) {
      noLotReturnQuantityByMovement.set(
        originalMovement._documentId,
        (noLotReturnQuantityByMovement.get(originalMovement._documentId) || 0)
          + (number(summary.returnedQuantity) ?? number(consumption.returnedQuantity) ?? 0)
      );
    }
  }

  const noLotNetByPosition = new Map();
  for (const movement of noLotOutbounds) {
    const key = positionKey(movement.source.position);
    const outboundQuantity = Math.abs(number(movement.quantityDelta) ?? 0);
    const returned = noLotReturnQuantityByMovement.get(movement._documentId) || 0;
    const net = Math.max(0, outboundQuantity - returned);
    noLotNetByPosition.set(key, (noLotNetByPosition.get(key) || 0) + net);
  }

  const globalLotQuantity = activeLots.reduce(
    (sum, row) => sum + (number(row.quantity) ?? 0),
    0
  );
  const lotExcess = round(globalLotQuantity - physicalActive);
  const netNoLotOutbound = round(
    [...noLotNetByPosition.values()].reduce((sum, value) => sum + value, 0)
  );
  const perPositionNoLotMatch =
    excessByPosition.length > 0
    && excessByPosition.every((row) =>
      approx(row.excess, noLotNetByPosition.get(row.positionKey) || 0)
    )
    && [...noLotNetByPosition.entries()]
      .filter(([, value]) => value > EPSILON)
      .every(([key, value]) =>
        approx(value, excessByPosition.find((row) => row.positionKey === key)?.excess || 0)
      );

  const duplicateLotGroups = duplicateLots(activeLots);
  const noLotQuantityMatch =
    lotExcess > EPSILON
    && netNoLotOutbound > EPSILON
    && approx(lotExcess, netNoLotOutbound)
    && perPositionNoLotMatch;
  // Igualdade quantitativa não prova causalidade quando existe uma hipótese
  // concorrente concreta (duplicidade ativa de lote). Nessa situação a
  // forensics permanece inconclusiva até distinguir os documentos históricos.
  const codeMechanismProven =
    noLotQuantityMatch
    && duplicateLotGroups.length === 0
    && unclassifiedOutbounds.length === 0
    && competingQuantitativeMovements.length === 0;

  const affectedLots = excessByPosition.flatMap((row) =>
    activeLots.filter((lot) => positionKey(lot.position) === row.positionKey)
  );
  const repairCandidates = [];
  let repairDeterministic = false;
  if (codeMechanismProven && affectedLots.length === 1) {
    const lot = affectedLots[0];
    const excess = lotExcess;
    const before = number(lot.quantity) ?? 0;
    const after = round(before - excess);
    if (after >= -EPSILON) {
      repairDeterministic = true;
      repairCandidates.push({
        path: 'warehouse/' + (lot.workspaceId || EXPECTED.workspaceId) + '/lots/' + lot._documentId,
        type: 'warehouse_lot_v1',
        materialId,
        before: {
          quantity: before,
          status: lot.status,
          position: lot.position,
          code: lot.code,
          updatedAt: lot._updateTime,
        },
        after: {
          quantity: Math.max(0, after),
          status: lot.status,
          position: lot.position,
          code: lot.code,
        },
        delta: round(-excess),
        cause:
          'OUTBOUND sem lotId reduziu saldo físico/agregado sem reduzir a única atribuição de lote da posição.',
        preconditions: {
          expectedLotQuantity: before,
          expectedLotUpdatedAt: lot._updateTime,
          expectedBalanceRevision: balance?.revision ?? null,
          expectedBalanceLastMovementId: balance?.lastMovementId ?? null,
          activeLotIdsAtPosition: affectedLots.map((item) => item._documentId).sort(),
        },
        rollback:
          'Restaurar exatamente o documento before somente sob manifesto aprovado; ledger permanece imutável.',
      });
    }
  }

  const causeProven = codeMechanismProven;
  const cause = causeProven
    ? 'OUTBOUND_SEM_LOTID_NAO_REDUZIU_ATRIBUICAO_LOGISTICA_DE_LOTE'
    : lotExcess <= EPSILON
      ? 'SEM_BLOCKER_QUANTITATIVO'
      : 'INCONCLUSIVO';

  const timeline = buildTimeline({
    lots,
    movements,
    intakes,
    consumptions,
    returns,
    withdrawals,
  });

  return {
    materialId,
    role: TARGET_MATERIALS.includes(materialId) ? 'BLOCKER' : 'CONTROL',
    aggregate: round(number(balance?.quantity) ?? 0),
    balanceRevision: balance?.revision ?? null,
    balanceLastMovementId: balance?.lastMovementId ?? null,
    physicalActive: round(physicalActive),
    legacyUnassigned: round(legacyUnassigned),
    activeLotQuantity: round(globalLotQuantity),
    lotExcess,
    excessByPosition,
    noLotOutboundGross: round(
      noLotOutbounds.reduce(
        (sum, row) => sum + Math.abs(number(row.quantityDelta) ?? 0),
        0
      )
    ),
    noLotReturnQuantity: round(
      [...noLotReturnQuantityByMovement.values()].reduce((sum, value) => sum + value, 0)
    ),
    netNoLotOutbound,
    lotAwareOutboundQuantity: round(
      lotAwareOutbounds.reduce(
        (sum, row) => sum + Math.abs(number(row.quantityDelta) ?? 0),
        0
      )
    ),
    noLotOutbounds: noLotOutbounds.map(summarizeMovement),
    lotAwareOutbounds: lotAwareOutbounds.map(summarizeMovement),
    unclassifiedOutbounds: unclassifiedOutbounds.map(summarizeMovement),
    competingQuantitativeMovements: competingQuantitativeMovements.map(summarizeMovement),
    lots: lots.map(summarizeLot),
    intakes: intakes.map(summarizeIntake),
    consumptions: consumptions.map(summarizeConsumption),
    returns: returns.map(summarizeReturn),
    withdrawals: withdrawals.map((row) => ({
      id: row._documentId,
      status: row.status ?? null,
      createdAt: timestamp(row),
      updatedAt: row._updateTime,
    })),
    duplicateLotGroups,
    perPositionNoLotMatch,
    noLotQuantityMatch,
    causeProven,
    cause,
    repairNecessary: lotExcess > EPSILON,
    repairDeterministic,
    exactDocumentsIdentified: repairCandidates.length > 0,
    repairCandidates,
    timeline,
    hypotheses: {
      noLotOutbound:
        noLotOutbounds.length > 0
          ? 'EVIDÊNCIA PRESENTE'
          : 'SEM EVIDÊNCIA',
      duplicateTechnicalLot:
        duplicateLotGroups.length > 0
          ? 'EVIDÊNCIA PRESENTE — não implica excesso isoladamente'
          : 'SEM EVIDÊNCIA',
      transfer:
        movements.some((row) => row.type === 'TRANSFER')
          ? 'EVIDÊNCIA PRESENTE — TRANSFER não altera total agregado; avaliar somente posição'
          : 'SEM EVIDÊNCIA',
      inventory:
        movements.some((row) => row.type === 'INVENTORY_ADJUSTMENT')
          ? 'EVIDÊNCIA PRESENTE'
          : 'SEM EVIDÊNCIA',
    },
  };
}

function buildTimeline({ lots, movements, intakes, consumptions, returns, withdrawals }) {
  const rows = [];
  for (const row of movements) rows.push({
    at: timestamp(row),
    kind: 'MOVEMENT',
    id: row._documentId,
    type: row.type ?? null,
    quantity: number(row.quantityDelta),
    position: row.source?.position || row.source?.to || null,
    lotId: row.source?.lotId ?? null,
    sourceKind: row.source?.kind ?? null,
  });
  for (const row of lots) rows.push({
    at: row._createTime,
    kind: 'LOT_CREATED',
    id: row._documentId,
    type: row.status ?? null,
    quantity: number(row.quantity),
    position: row.position ?? null,
    lotId: row._documentId,
    sourceKind: row.origin?.kind ?? null,
  });
  for (const row of intakes) rows.push({
    at: timestamp(row),
    kind: 'INTAKE',
    id: row._documentId,
    type: row.status ?? null,
    quantity: number(row.receivedQuantity),
    position: null,
    lotId: null,
    sourceKind: row.schemaVersion ?? null,
  });
  for (const row of consumptions) rows.push({
    at: row.occurredAt || timestamp(row),
    kind: 'CONSUMPTION',
    id: row._documentId,
    type: row.origin ?? null,
    quantity: number(row.quantity),
    position: null,
    lotId: null,
    sourceKind: row.movementId ?? null,
  });
  for (const row of returns) rows.push({
    at: row.lastReturnAt || timestamp(row),
    kind: 'RETURN_SUMMARY',
    id: row._documentId,
    type: 'RETURN',
    quantity: number(row.returnedQuantity),
    position: null,
    lotId: null,
    sourceKind: row.lastReturnMovementId ?? null,
  });
  for (const row of withdrawals) rows.push({
    at: timestamp(row),
    kind: 'WITHDRAWAL',
    id: row._documentId,
    type: row.status ?? null,
    quantity: null,
    position: null,
    lotId: null,
    sourceKind: null,
  });
  return rows.sort((left, right) =>
    String(left.at || '').localeCompare(String(right.at || ''))
  );
}

function duplicateLots(lots) {
  const groups = new Map();
  for (const lot of lots) {
    const key = [
      lot.materialId || '',
      positionKey(lot.position),
      String(lot.code || '').trim().toUpperCase(),
    ].join('|');
    const rows = groups.get(key) || [];
    rows.push(lot);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      lotIds: rows.map((row) => row._documentId).sort(),
      quantity: round(rows.reduce((sum, row) => sum + (number(row.quantity) ?? 0), 0)),
    }));
}

function summarizeMovement(row) {
  return {
    id: row._documentId,
    type: row.type ?? null,
    quantityDelta: number(row.quantityDelta),
    at: timestamp(row),
    sourceKind: row.source?.kind ?? null,
    position: row.source?.position ?? null,
    lotId: row.source?.lotId ?? null,
    lotCode: row.source?.lotCode ?? null,
    withdrawalOrReference:
      row.source?.consumptionId
      || row.source?.reference
      || null,
  };
}

function summarizeLot(row) {
  return {
    id: row._documentId,
    code: row.code ?? null,
    quantity: number(row.quantity),
    position: row.position ?? null,
    status: row.status ?? null,
    origin: row.origin ?? null,
    createdAt: row._createTime,
    updatedAt: row._updateTime,
  };
}

function summarizeIntake(row) {
  return {
    id: row._documentId,
    schemaVersion: row.schemaVersion ?? null,
    receivedQuantity: number(row.receivedQuantity),
    allocatedQuantity: number(row.allocatedQuantity),
    immediateConsumptionQuantity: number(row.immediateConsumptionQuantity),
    pendingQuantity: number(row.pendingQuantity),
    status: row.status ?? null,
    createdAt: row.createdAt || row._createTime,
    updatedAt: row.updatedAt || row._updateTime,
  };
}

function summarizeConsumption(row) {
  return {
    id: row._documentId,
    origin: row.origin ?? null,
    quantity: number(row.quantity),
    returnedQuantity: number(row.returnedQuantity),
    movementId: row.movementId ?? null,
    withdrawalId: row.withdrawalId ?? null,
    lineId: row.lineId ?? null,
    lotCode: row.lotCode ?? null,
    occurredAt: row.occurredAt || row._createTime,
  };
}

function summarizeReturn(row) {
  return {
    id: row._documentId,
    consumptionId: row.consumptionId ?? null,
    originalQuantity: number(row.originalQuantity),
    returnedQuantity: number(row.returnedQuantity),
    pendingQuantity: number(row.pendingQuantity),
    lastReturnMovementId: row.lastReturnMovementId ?? null,
    lastReturnAt: row.lastReturnAt ?? null,
  };
}

function classifyPosition(position, depots, locations) {
  if (!position || typeof position !== 'object') return 'INVALID_OR_ORPHAN';
  if (position.kind === 'UNASSIGNED') return 'UNASSIGNED';
  if (position.kind !== 'LOCATION' && position.kind !== 'SUBPOSITION') {
    return 'INVALID_OR_ORPHAN';
  }
  const depot = depots.get(position.depotId);
  const location = locations.get(position.locationId);
  if (
    !depot
    || !location
    || location.kind !== 'LOCAL'
    || location.depotId !== position.depotId
  ) {
    return 'INVALID_OR_ORPHAN';
  }
  if (position.kind === 'LOCATION') {
    return depot.status === 'active' && location.status === 'active'
      ? 'ACTIVE_PHYSICAL'
      : 'INACTIVE_PHYSICAL';
  }
  const sub = locations.get(position.subpositionId);
  if (
    !sub
    || sub.kind !== 'SUBPOSITION'
    || sub.depotId !== position.depotId
    || sub.parentLocationId !== position.locationId
  ) {
    return 'INVALID_OR_ORPHAN';
  }
  return depot.status === 'active'
    && location.status === 'active'
    && sub.status === 'active'
    ? 'ACTIVE_PHYSICAL'
    : 'INACTIVE_PHYSICAL';
}

function positionKey(position) {
  if (!position || typeof position !== 'object') return 'INVALID';
  if (position.kind === 'UNASSIGNED') return 'UNASSIGNED';
  if (position.kind === 'LOCATION') {
    return 'LOCATION:' + position.depotId + ':' + position.locationId;
  }
  if (position.kind === 'SUBPOSITION') {
    return [
      'SUBPOSITION',
      position.depotId,
      position.locationId,
      position.subpositionId,
    ].join(':');
  }
  return 'INVALID:' + String(position.kind);
}

function timestamp(row) {
  return row.createdAt
    || row.occurredAt
    || row.updatedAt
    || row._createTime
    || row._updateTime
    || null;
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function approx(left, right) {
  return Math.abs(left - right) <= EPSILON;
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function printReport(report) {
  console.log('\nResumo por material');
  for (const row of report.results) {
    console.log(
      row.materialId
      + ' | role=' + row.role
      + ' | aggregate=' + row.aggregate
      + ' physical=' + row.physicalActive
      + ' unassigned=' + row.legacyUnassigned
      + ' lots=' + row.activeLotQuantity
      + ' excess=' + row.lotExcess
      + ' noLotNet=' + row.netNoLotOutbound
      + ' causeProven=' + (row.causeProven ? 'SIM' : 'NÃO')
      + ' repairDeterministic=' + (row.repairDeterministic ? 'SIM' : 'NÃO')
    );
  }
  console.log('\nCLASSIFICAÇÃO FINAL: ' + report.finalClassification);
  console.log(
    'PRONTO PARA AUTORIZAÇÃO HUMANA DE REPAIR: '
    + (report.readyForHumanRepairAuthorization ? 'SIM' : 'NÃO')
  );
  console.log('reads aproximados: ' + report.meta.readCount);
  console.log('\nFORENSICS_JSON_BEGIN');
  console.log(JSON.stringify(report, null, 2));
  console.log('FORENSICS_JSON_END');
}

export {
  analyzeForensics,
  analyzeMaterial,
  classifyPosition,
  decodeValue,
  positionKey,
};
