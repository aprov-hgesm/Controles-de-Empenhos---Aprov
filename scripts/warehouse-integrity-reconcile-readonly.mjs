#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recovery = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migration = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const warehouseDb = recovery.databases?.find((entry) => entry.role === 'warehouse-logistics');
if (!warehouseDb?.id) throw new Error('WAREHOUSE_AUDIT_DATABASE_NOT_CONFIGURED');

const EXPECTED = Object.freeze({
  projectId: recovery.projectId,
  databaseId: warehouseDb.id,
  workspaceId: migration.workspaceId,
});
const EPSILON = 0.000001;
const COLLECTIONS = [
  'materials', 'depots', 'locations', 'movements', 'balances', 'locationBalances',
  'lots', 'intakes', 'withdrawals', 'consumptions', 'outboundReturns', 'inventories',
];
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
    'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(EXPECTED.projectId) +
    '/databases/' + encodeURIComponent(EXPECTED.databaseId);

  console.log('WAREHOUSE-INTEGRITY-RECONCILE-01 — READ-ONLY');
  console.log('Projeto: ' + EXPECTED.projectId);
  console.log('Banco: ' + EXPECTED.databaseId);
  console.log('Workspace: ' + EXPECTED.workspaceId);
  console.log('pageSize=' + pageSize + ' cap=' + cap);

  let dataset;
  try {
    dataset = await loadDataset(createClient(apiBase, pageSize, cap), EXPECTED.workspaceId);
  } catch (cause) {
    const error = new Error('DIAGNOSTIC ACCESS REQUIRED: ' + cause.message);
    error.code = 'DIAGNOSTIC_ACCESS_REQUIRED';
    throw error;
  }

  const report = auditDataset(dataset, {
    projectId: EXPECTED.projectId,
    databaseId: EXPECTED.databaseId,
    workspaceId: EXPECTED.workspaceId,
    readCount,
    cap,
  });
  printReport(report);
}

function parseFlags(args) {
  const out = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const text = arg.slice(2);
    const index = text.indexOf('=');
    if (index < 0) out[text] = true;
    else out[text.slice(0, index)] = text.slice(index + 1);
  }
  return out;
}

function printHelp() {
  console.log([
    'Uso:',
    'node scripts/warehouse-integrity-reconcile-readonly.mjs',
    '  --project=' + EXPECTED.projectId,
    '  --database=' + EXPECTED.databaseId,
    '  --workspace=' + EXPECTED.workspaceId,
    '  [--page-size=200] [--max-docs-per-collection=5000]',
    '  [--gcloud="C:\\caminho\\para\\gcloud.cmd"]',
    '',
    'Windows/PowerShell recomendado:',
    '  $env:WAREHOUSE_AUDIT_ACCESS_TOKEN = & $Gcloud auth print-access-token',
    '',
    'Garantia: transporte Firestore exclusivamente HTTP GET; nenhuma escrita.',
  ].join('\n'));
}

function assertTarget(flags) {
  if (
    flags.project !== EXPECTED.projectId ||
    flags.database !== EXPECTED.databaseId ||
    flags.workspace !== EXPECTED.workspaceId
  ) {
    throw new Error(
      'Alvo não confirmado. Use --project=' + EXPECTED.projectId +
      ' --database=' + EXPECTED.databaseId +
      ' --workspace=' + EXPECTED.workspaceId
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

  const unique = [...new Set(candidates.map((value) => String(value).trim()).filter(Boolean))];
  for (const candidate of unique) {
    if (/[\r\n]/.test(candidate)) continue;
    const result = spawnGcloud(candidate, ['--version']);
    if (!result.error && result.status === 0) {
      gcloudCommand = candidate;
      return;
    }
  }

  throw new Error(
    'Google Cloud CLI não encontrado. No Windows, use --gcloud="C:\\\\...\\\\gcloud.cmd" ou defina GCLOUD_CMD.'
  );
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
  if (result.status !== 0) throw new Error('Falha ao obter token gcloud: ' + String(result.stderr || '').trim());
  const value = result.stdout.trim();
  if (!value) throw new Error('Token gcloud vazio.');
  return value;
}

function createClient(apiBase, pageSize, cap) {
  async function request(relative, allow404 = false, retry = true) {
    if (!token) token = accessToken();
    const response = await fetch(apiBase + relative, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (response.status === 401 && retry) {
      token = accessToken();
      return request(relative, allow404, false);
    }
    if (allow404 && response.status === 404) return null;
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
      const payload = await request('/documents/' + encodePath(collectionPath) + '?' + qs.toString());
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

  const inventoryItems = [];
  let inventoryItemsCapped = false;
  for (const inventory of collections.inventories) {
    const result = await client.list(rootPath + '/inventories/' + inventory._documentId + '/items');
    if (result.capped) inventoryItemsCapped = true;
    for (const doc of result.documents) {
      inventoryItems.push({ ...decodeDocument(doc), _inventoryId: inventory._documentId });
    }
  }
  return { collections, inventoryItems, cappedCollections, inventoryItemsCapped };
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

function auditDataset(dataset, meta) {
  const c = dataset.collections;
  const issues = [];
  const depots = new Map(c.depots.map((x) => [x._documentId, x]));
  const locations = new Map(c.locations.map((x) => [x._documentId, x]));
  const balanceByMaterial = group(c.balances, (x) => x.materialId);
  const locationByMaterial = group(c.locationBalances, (x) => x.materialId);
  const lotsByMaterial = group(c.lots, (x) => x.materialId);
  const movementByMaterial = group(c.movements, (x) => x.materialId);
  const intakeByMaterial = group(c.intakes, (x) => x.materialId);
  const inventoryByMaterial = group(dataset.inventoryItems, (x) => x.materialId);
  const consumptionByMaterial = group(c.consumptions, (x) => x.materialId);
  const returnByMaterial = group(c.outboundReturns, (x) => x.materialId);

  const materialIds = new Set([
    ...c.materials.map((x) => x._documentId),
    ...c.balances.map((x) => x.materialId).filter(Boolean),
    ...c.locationBalances.map((x) => x.materialId).filter(Boolean),
    ...c.lots.map((x) => x.materialId).filter(Boolean),
    ...c.movements.map((x) => x.materialId).filter(Boolean),
    ...c.intakes.map((x) => x.materialId).filter(Boolean),
    ...dataset.inventoryItems.map((x) => x.materialId).filter(Boolean),
  ]);

  const materials = [];
  for (const materialId of [...materialIds].sort()) {
    const aggregateRows = balanceByMaterial.get(materialId) || [];
    if (aggregateRows.length > 1) issue(issues, 'INCONSISTENT', 'DUPLICATE_AGGREGATE_BALANCE', materialId, null, aggregateRows.map((x) => x._documentId).join(','));
    const aggregate = number(aggregateRows[0]?.quantity) ?? 0;
    if (aggregate < -EPSILON) issue(issues, 'INCONSISTENT', 'NEGATIVE_AGGREGATE_BALANCE', materialId, null, String(aggregate));

    let physicalActive = 0;
    let physicalInactive = 0;
    let legacyUnassigned = 0;
    let invalidOrOrphan = 0;
    const positionBalances = new Map();

    for (const row of locationByMaterial.get(materialId) || []) {
      const quantity = number(row.quantity);
      if (quantity == null) {
        issue(issues, 'INCONSISTENT', 'INVALID_LOCATION_BALANCE_QUANTITY', materialId, row._documentId, 'quantity inválida');
        continue;
      }
      if (quantity < -EPSILON) issue(issues, 'INCONSISTENT', 'NEGATIVE_LOCATION_BALANCE', materialId, row._documentId, String(quantity));
      const pos = classifyPosition(row.position, depots, locations);
      positionBalances.set(pos.key, (positionBalances.get(pos.key) || 0) + quantity);
      if (pos.classification === 'ACTIVE_PHYSICAL') physicalActive += quantity;
      if (pos.classification === 'INACTIVE_PHYSICAL') physicalInactive += quantity;
      if (pos.classification === 'UNASSIGNED') legacyUnassigned += quantity;
      if (pos.classification === 'INVALID_OR_ORPHAN') invalidOrOrphan += quantity;
      if (pos.classification === 'INACTIVE_PHYSICAL' && quantity > EPSILON) issue(issues, 'RECONCILIATION_REQUIRED', 'STOCK_IN_INACTIVE_POSITION', materialId, row._documentId, pos.key);
      if (pos.classification === 'INVALID_OR_ORPHAN' && Math.abs(quantity) > EPSILON) issue(issues, 'INCONSISTENT', 'ORPHAN_LOCATION_BALANCE', materialId, row._documentId, pos.key);
    }

    if (legacyUnassigned > EPSILON) issue(issues, 'RECONCILIATION_REQUIRED', 'POSITIVE_UNASSIGNED', materialId, null, String(round(legacyUnassigned)));
    if (physicalActive - aggregate > EPSILON) issue(issues, 'INCONSISTENT', 'PHYSICAL_EXCEEDS_AGGREGATE', materialId, null, 'physical=' + round(physicalActive) + ' aggregate=' + round(aggregate));
    const projected = physicalActive + physicalInactive + legacyUnassigned + invalidOrOrphan;
    if (!approx(projected, aggregate)) issue(issues, 'RECONCILIATION_REQUIRED', 'AGGREGATE_PROJECTION_MISMATCH', materialId, null, 'projection=' + round(projected) + ' aggregate=' + round(aggregate));

    let activeLots = 0;
    let inactiveLots = 0;
    const activeLotsByPosition = new Map();
    for (const lot of lotsByMaterial.get(materialId) || []) {
      const quantity = number(lot.quantity);
      if (quantity == null) {
        issue(issues, 'INCONSISTENT', 'INVALID_LOT_QUANTITY', materialId, lot._documentId, 'quantity inválida');
        continue;
      }
      const pos = classifyPosition(lot.position, depots, locations);
      if (lot.status === 'active') {
        activeLots += quantity;
        activeLotsByPosition.set(pos.key, (activeLotsByPosition.get(pos.key) || 0) + quantity);
        if (pos.classification === 'INVALID_OR_ORPHAN') issue(issues, 'INCONSISTENT', 'ACTIVE_LOT_ORPHAN_POSITION', materialId, lot._documentId, pos.key);
        if (pos.classification === 'INACTIVE_PHYSICAL') issue(issues, 'RECONCILIATION_REQUIRED', 'ACTIVE_LOT_INACTIVE_POSITION', materialId, lot._documentId, pos.key);
        if (pos.classification === 'UNASSIGNED') issue(issues, 'LEGACY_BUT_EXPLAINABLE', 'ACTIVE_LOT_UNASSIGNED', materialId, lot._documentId, pos.key);
      } else {
        inactiveLots += quantity;
      }
    }
    for (const [key, lotQuantity] of activeLotsByPosition) {
      const physical = key === 'UNASSIGNED' ? legacyUnassigned : (positionBalances.get(key) || 0);
      if (lotQuantity - physical > EPSILON) {
        issue(issues, 'INCONSISTENT', 'LOT_ATTRIBUTION_EXCEEDS_STOCK', materialId, key, 'activeLots=' + round(lotQuantity) + ' physical=' + round(physical) + ' diff=' + round(lotQuantity - physical));
      }
    }

    let movementDerived = 0;
    const movements = movementByMaterial.get(materialId) || [];
    for (const movement of movements) {
      const delta = number(movement.quantityDelta);
      if (delta != null) movementDerived += delta;
      if (movement.type === 'TRANSFER' && delta != null && Math.abs(delta) > EPSILON) {
        issue(issues, 'INCONSISTENT', 'TRANSFER_NON_ZERO_AGGREGATE_DELTA', materialId, movement._documentId, String(delta));
      }
    }
    if (!approx(movementDerived, aggregate)) issue(issues, 'RECONCILIATION_REQUIRED', 'LEDGER_AGGREGATE_MISMATCH', materialId, null, 'ledger=' + round(movementDerived) + ' aggregate=' + round(aggregate));

    for (const intake of intakeByMaterial.get(materialId) || []) auditIntake(intake, issues, materialId);
    for (const item of inventoryByMaterial.get(materialId) || []) auditInventory(item, issues, materialId);

    const latest = [...movements].sort((a, b) => String(b._createTime || b._updateTime || '').localeCompare(String(a._createTime || a._updateTime || '')))[0] || null;
    const ownIssues = issues.filter((x) => x.materialId === materialId);
    materials.push({
      materialId,
      aggregateBalance: round(aggregate),
      physicalActive: round(physicalActive),
      physicalInactive: round(physicalInactive),
      legacyUnassigned: round(legacyUnassigned),
      invalidOrOrphan: round(invalidOrOrphan),
      activeLotQuantity: round(activeLots),
      inactiveLotQuantity: round(inactiveLots),
      differenceAggregateVsPhysical: round(aggregate - physicalActive),
      differenceLotsVsPhysical: round(activeLots - physicalActive),
      movementDerivedBalance: round(movementDerived),
      latestMovement: latest?.type || null,
      lastMovementId: latest?._documentId || null,
      inventoryReferences: (inventoryByMaterial.get(materialId) || []).length,
      consumptionReferences: (consumptionByMaterial.get(materialId) || []).length,
      returnReferences: (returnByMaterial.get(materialId) || []).length,
      intakeReferences: (intakeByMaterial.get(materialId) || []).length,
      classification: materialClass(ownIssues),
    });
  }

  auditDuplicateLots(c.lots, issues);
  auditMovementRefs(c.movements, c.locationBalances, issues);
  auditReturns(c.outboundReturns, c.consumptions, c.movements, depots, locations, issues);

  const palCandidates = materials.filter((row) => approx(row.physicalActive, 440) && approx(row.activeLotQuantity, 540));
  const palDetected = palCandidates.length > 0 || issues.some((x) => x.code === 'LOT_ATTRIBUTION_EXCEEDS_STOCK' && String(x.detail).includes('diff=100'));

  if (dataset.cappedCollections.length || dataset.inventoryItemsCapped) {
    issue(
      issues,
      'PERFORMANCE_RISK',
      'AUDIT_CAP_REACHED',
      null,
      null,
      [...dataset.cappedCollections, ...(dataset.inventoryItemsCapped ? ['inventories/*/items'] : [])].join(',')
    );
  }

  const blockerCodes = new Set([
    'NEGATIVE_AGGREGATE_BALANCE', 'NEGATIVE_LOCATION_BALANCE', 'PHYSICAL_EXCEEDS_AGGREGATE',
    'ORPHAN_LOCATION_BALANCE', 'ACTIVE_LOT_ORPHAN_POSITION', 'LOT_ATTRIBUTION_EXCEEDS_STOCK',
    'TRANSFER_NON_ZERO_AGGREGATE_DELTA', 'INTAKE_QUANTITY_MISMATCH', 'INTAKE_STATUS_MISMATCH',
    'INVENTORY_UNASSIGNED_POSITION', 'RETURN_ORPHAN_CONSUMPTION', 'RETURN_INVALID_POSITION',
  ]);
  const blockers = issues.filter((x) => x.category === 'INCONSISTENT' && blockerCodes.has(x.code));
  const incomplete = dataset.cappedCollections.length > 0 || dataset.inventoryItemsCapped;
  const finalClassification =
    blockers.length > 0
      ? 'BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC'
      : incomplete || issues.some((x) => x.category === 'RECONCILIATION_REQUIRED')
        ? 'PASS COM RECONCILIAÇÕES CONTROLADAS'
        : 'PASS — INTEGRIDADE GLOBAL COMPATÍVEL';

  return {
    meta: { ...meta, generatedAt: new Date().toISOString(), cappedCollections: dataset.cappedCollections, inventoryItemsCapped: dataset.inventoryItemsCapped },
    counts: {
      materials: materials.length,
      physicalPositions: c.locationBalances.filter((x) => x.position?.kind === 'LOCATION' || x.position?.kind === 'SUBPOSITION').length,
      unassignedBalances: c.locationBalances.filter((x) => x.position?.kind === 'UNASSIGNED').length,
      lots: c.lots.length,
      movements: c.movements.length,
      inventories: c.inventories.length,
      inventoryItems: dataset.inventoryItems.length,
      intakes: c.intakes.length,
      consumptions: c.consumptions.length,
      outboundReturns: c.outboundReturns.length,
      inconsistencies: issues.filter((x) => x.category === 'INCONSISTENT').length,
      reconciliationRequired: issues.filter((x) => x.category === 'RECONCILIATION_REQUIRED').length,
      performanceRisks: issues.filter((x) => x.category === 'PERFORMANCE_RISK').length,
    },
    pal01: { detected: palDetected, candidates: palCandidates.map((x) => x.materialId) },
    materials,
    issues,
    finalClassification,
    rcCanAdvanceWithoutDataRepair: blockers.length === 0 && palDetected,
  };
}

function classifyPosition(position, depots, locations) {
  if (!position || typeof position !== 'object') return { key: 'INVALID', classification: 'INVALID_OR_ORPHAN' };
  if (position.kind === 'UNASSIGNED') return { key: 'UNASSIGNED', classification: 'UNASSIGNED' };
  if (position.kind !== 'LOCATION' && position.kind !== 'SUBPOSITION') return { key: 'INVALID:' + String(position.kind), classification: 'INVALID_OR_ORPHAN' };
  const key = positionKey(position);
  const depot = depots.get(position.depotId);
  const location = locations.get(position.locationId);
  if (!depot || !location || location.kind !== 'LOCAL' || location.depotId !== position.depotId) return { key, classification: 'INVALID_OR_ORPHAN' };
  if (position.kind === 'LOCATION') {
    return { key, classification: depot.status === 'active' && location.status === 'active' ? 'ACTIVE_PHYSICAL' : 'INACTIVE_PHYSICAL' };
  }
  const sub = locations.get(position.subpositionId);
  if (!sub || sub.kind !== 'SUBPOSITION' || sub.depotId !== position.depotId || sub.parentLocationId !== position.locationId) return { key, classification: 'INVALID_OR_ORPHAN' };
  return { key, classification: depot.status === 'active' && location.status === 'active' && sub.status === 'active' ? 'ACTIVE_PHYSICAL' : 'INACTIVE_PHYSICAL' };
}

function auditIntake(intake, issues, materialId) {
  if (intake.schemaVersion !== 'warehouse_item_intake_v2') return;
  const received = number(intake.receivedQuantity);
  const allocated = number(intake.allocatedQuantity);
  const immediate = number(intake.immediateConsumptionQuantity);
  const pending = number(intake.pendingQuantity);
  if ([received, allocated, immediate, pending].some((x) => x == null)) {
    issue(issues, 'INCONSISTENT', 'INTAKE_INVALID_QUANTITY', materialId, intake._documentId, 'quantidade inválida');
    return;
  }
  const expectedPending = received - allocated - immediate;
  if (!approx(expectedPending, pending)) issue(issues, 'INCONSISTENT', 'INTAKE_QUANTITY_MISMATCH', materialId, intake._documentId, 'received=' + received + ' allocated=' + allocated + ' immediate=' + immediate + ' pending=' + pending);
  const processed = allocated + immediate;
  const expectedStatus = expectedPending <= EPSILON ? 'PROCESSED' : processed <= EPSILON ? 'PENDING' : 'PARTIALLY_PROCESSED';
  if (intake.status !== expectedStatus) issue(issues, 'INCONSISTENT', 'INTAKE_STATUS_MISMATCH', materialId, intake._documentId, 'status=' + String(intake.status) + ' expected=' + expectedStatus);
}

function auditInventory(item, issues, materialId) {
  if (item.position?.kind === 'UNASSIGNED') issue(issues, 'INCONSISTENT', 'INVENTORY_UNASSIGNED_POSITION', materialId, item._documentId, 'inventory=' + item._inventoryId);
  if (item.status === 'STALE') issue(issues, 'RECONCILIATION_REQUIRED', 'INVENTORY_STALE_ITEM', materialId, item._documentId, 'inventory=' + item._inventoryId);
}

function auditDuplicateLots(lots, issues) {
  const groups = group(lots.filter((x) => x.status === 'active'), (x) => (x.materialId || '') + '|' + positionKey(x.position) + '|' + String(x.code || '').trim().toUpperCase());
  for (const [key, rows] of groups) {
    if (rows.length > 1) issue(issues, 'RECONCILIATION_REQUIRED', 'APPARENT_DUPLICATE_ACTIVE_LOT', rows[0].materialId || null, key, rows.map((x) => x._documentId).join(','));
  }
}

function auditMovementRefs(movements, locationBalances, issues) {
  const ids = new Set(locationBalances.map((x) => x._documentId));
  for (const movement of movements) {
    const source = movement.source;
    if (!source || typeof source !== 'object') continue;
    for (const key of ['locationBalanceId', 'fromBalanceId', 'toBalanceId']) {
      const id = source[key];
      if (typeof id === 'string' && id && !ids.has(id)) issue(issues, 'RECONCILIATION_REQUIRED', 'MOVEMENT_REFERENCES_MISSING_LOCATION_BALANCE', movement.materialId || null, movement._documentId, key + '=' + id);
    }
  }
}

function auditReturns(returns, consumptions, movements, depots, locations, issues) {
  const consumptionIds = new Set(consumptions.map((x) => x._documentId));
  const movementIds = new Set(movements.map((x) => x._documentId));
  for (const row of returns) {
    if (row.consumptionId && !consumptionIds.has(row.consumptionId)) issue(issues, 'INCONSISTENT', 'RETURN_ORPHAN_CONSUMPTION', row.materialId || null, row._documentId, row.consumptionId);
    if (row.lastReturnMovementId && !movementIds.has(row.lastReturnMovementId)) issue(issues, 'RECONCILIATION_REQUIRED', 'RETURN_MOVEMENT_MISSING', row.materialId || null, row._documentId, row.lastReturnMovementId);
    if (row.position) {
      const pos = classifyPosition(row.position, depots, locations);
      if (pos.classification !== 'ACTIVE_PHYSICAL') issue(issues, 'INCONSISTENT', 'RETURN_INVALID_POSITION', row.materialId || null, row._documentId, pos.key);
    }
  }
}

function group(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key == null || key === '') continue;
    const rows = map.get(key) || [];
    rows.push(item);
    map.set(key, rows);
  }
  return map;
}

function positionKey(position) {
  if (!position || typeof position !== 'object') return 'INVALID';
  if (position.kind === 'UNASSIGNED') return 'UNASSIGNED';
  if (position.kind === 'LOCATION') return 'LOCATION:' + position.depotId + ':' + position.locationId;
  if (position.kind === 'SUBPOSITION') return 'SUBPOSITION:' + position.depotId + ':' + position.locationId + ':' + position.subpositionId;
  return 'INVALID:' + String(position.kind);
}

function materialClass(rows) {
  if (rows.some((x) => x.category === 'INCONSISTENT')) return 'INCONSISTENT';
  if (rows.some((x) => x.category === 'RECONCILIATION_REQUIRED')) return 'RECONCILIATION_REQUIRED';
  if (rows.some((x) => x.category === 'PERFORMANCE_RISK')) return 'PERFORMANCE_RISK';
  if (rows.some((x) => x.category === 'LEGACY_BUT_EXPLAINABLE')) return 'LEGACY_BUT_EXPLAINABLE';
  return 'CANONICAL';
}

function issue(issues, category, code, materialId, entity, detail) {
  issues.push({ category, code, materialId, entity, detail });
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
  console.log('\nResumo global');
  for (const [key, value] of Object.entries(report.counts)) console.log(key + ': ' + value);
  console.log('reads aproximados: ' + report.meta.readCount);
  console.log('PAL-01 detectado: ' + (report.pal01.detected ? 'SIM' : 'NÃO'));
  if (report.pal01.candidates.length) console.log('PAL-01 candidatos: ' + report.pal01.candidates.join(', '));
  console.log('\nMateriais não canônicos');
  for (const row of report.materials.filter((x) => x.classification !== 'CANONICAL')) {
    console.log(row.materialId + ' | ' + row.classification + ' | aggregate=' + row.aggregateBalance + ' physical=' + row.physicalActive + ' unassigned=' + row.legacyUnassigned + ' lots=' + row.activeLotQuantity);
  }
  console.log('\nIssues');
  for (const row of report.issues) console.log('[' + row.category + '] ' + row.code + ' | material=' + (row.materialId || '-') + ' | entity=' + (row.entity || '-') + ' | ' + row.detail);
  console.log('\nCLASSIFICAÇÃO FINAL: ' + report.finalClassification);
  console.log('RC pode avançar sem reparo de dados: ' + (report.rcCanAdvanceWithoutDataRepair ? 'SIM' : 'NÃO'));
  console.log('\nJSON_REPORT_BEGIN');
  console.log(JSON.stringify(report, null, 2));
  console.log('JSON_REPORT_END');
}

export { auditDataset, classifyPosition, decodeValue, positionKey };
