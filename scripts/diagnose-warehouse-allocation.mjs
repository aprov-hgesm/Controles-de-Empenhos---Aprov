#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const PROJECT_ID =
  process.env.EMPROVEX_FIREBASE_PROJECT_ID?.trim()
  || 'gen-lang-client-0982077967';
const DATABASE_ID =
  process.env.EMPROVEX_WAREHOUSE_DATABASE_ID?.trim()
  || 'emprovex-warehouse';
const WORKSPACE_ID =
  process.env.EMPROVEX_WAREHOUSE_WORKSPACE_ID?.trim()
  || 'hgesm-aprov';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] || '').trim() : '';
}

const movementId = arg('--movement');
const invoiceId = arg('--invoice');

if (!movementId && !invoiceId) {
  console.error(
    'Uso: node scripts/diagnose-warehouse-allocation.mjs '
    + '--movement mov_<sha256> [--invoice <numero>]'
  );
  process.exit(2);
}

if (movementId && !/^mov_[a-f0-9]{64}$/.test(movementId)) {
  console.error('movementId inválido.');
  process.exit(2);
}

function accessToken() {
  return execFileSync(
    'gcloud',
    ['auth', 'print-access-token'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  ).trim();
}

let token = accessToken();

function refreshToken() {
  token = accessToken();
  return token;
}

function databaseBase() {
  return (
    'https://firestore.googleapis.com/v1/projects/'
    + encodeURIComponent(PROJECT_ID)
    + '/databases/'
    + encodeURIComponent(DATABASE_ID)
    + '/documents'
  );
}

async function requestJson(url, options = {}, retry = true) {
  const run = (currentToken) => fetch(url, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + currentToken,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let response = await run(token);
  if (response.status === 401 && retry) {
    response = await run(refreshToken());
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      'Firestore REST ' + response.status + ': '
      + (data?.error?.message || response.statusText)
    );
  }
  return data;
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(decodeValue);
  }
  if (value.mapValue) {
    return decodeFields(value.mapValue.fields || {});
  }
  return value;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
  );
}

function documentId(document) {
  return document?.name?.split('/').pop() || '';
}

function decodeDocument(document) {
  if (!document) return null;
  return {
    id: documentId(document),
    ...decodeFields(document.fields || {}),
  };
}

async function getDocument(domain, id) {
  return requestJson(
    databaseBase()
    + '/warehouse/'
    + encodeURIComponent(WORKSPACE_ID)
    + '/'
    + encodeURIComponent(domain)
    + '/'
    + encodeURIComponent(id)
  );
}

async function runQuery(collectionId, fieldPath, stringValue) {
  const url =
    databaseBase()
    + '/warehouse/'
    + encodeURIComponent(WORKSPACE_ID)
    + ':runQuery';

  const rows = await requestJson(url, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue },
          },
        },
        limit: 100,
      },
    }),
  });

  return (Array.isArray(rows) ? rows : [])
    .flatMap((row) => row?.document ? [decodeDocument(row.document)] : []);
}

function compactMovement(movement) {
  if (!movement) return null;
  return {
    id: movement.id,
    type: movement.type,
    materialId: movement.materialId,
    quantityDelta: movement.quantityDelta,
    note: movement.note,
    sourceKind: movement.source?.kind || null,
    sourceAction: movement.source?.action || null,
    invoiceRecordKey: movement.source?.invoiceRecordKey || null,
    invoiceId: movement.source?.invoiceId || null,
    itemIds: movement.source?.itemIds || null,
    fromBalanceId: movement.source?.fromBalanceId || null,
    toBalanceId: movement.source?.toBalanceId || null,
    from: movement.source?.from || null,
    to: movement.source?.to || null,
    transferQuantity: movement.source?.quantity || null,
  };
}

function compactIntake(intake) {
  return {
    id: intake.id,
    schemaVersion: intake.schemaVersion,
    invoiceRecordKey: intake.invoiceRecordKey,
    invoiceId: intake.invoiceId,
    itemId: intake.itemId,
    materialId: intake.materialId,
    receivedQuantity: intake.receivedQuantity ?? intake.quantity ?? null,
    allocatedQuantity: intake.allocatedQuantity ?? null,
    immediateConsumptionQuantity: intake.immediateConsumptionQuantity ?? null,
    pendingQuantity: intake.pendingQuantity ?? null,
    status: intake.status ?? null,
    mode: intake.mode ?? null,
  };
}

function compactLocationBalance(balance) {
  return {
    id: balance.id,
    materialId: balance.materialId,
    position: balance.position,
    quantity: balance.quantity,
    revision: balance.revision,
    lastMovementId: balance.lastMovementId,
  };
}

console.log('EMPROVEX — diagnóstico somente leitura da alocação');
console.log('Projeto:', PROJECT_ID);
console.log('Database:', DATABASE_ID);
console.log('Workspace:', WORKSPACE_ID);
console.log('Nenhuma escrita será executada.\n');

let exactMovement = null;
if (movementId) {
  exactMovement = decodeDocument(await getDocument('movements', movementId));
  console.log('=== MOVIMENTO INFORMADO ===');
  if (exactMovement) {
    console.log(JSON.stringify(compactMovement(exactMovement), null, 2));
  } else {
    console.log('NÃO EXISTE no database alvo.');
    console.log(
      'Isso é compatível com uma transação TRANSFER rejeitada antes do commit.'
    );
  }
  console.log('');
}

let invoiceMovements = [];
let intakes = [];
if (invoiceId) {
  [invoiceMovements, intakes] = await Promise.all([
    runQuery('movements', 'source.invoiceId', invoiceId),
    runQuery('intakes', 'invoiceId', invoiceId),
  ]);

  console.log('=== MOVIMENTOS DA NF ' + invoiceId + ' ===');
  console.log(
    JSON.stringify(invoiceMovements.map(compactMovement), null, 2)
  );
  console.log('');

  console.log('=== INTAKES DA NF ' + invoiceId + ' ===');
  console.log(JSON.stringify(intakes.map(compactIntake), null, 2));
  console.log('');
}

const materialIds = new Set(
  [
    exactMovement?.materialId,
    ...invoiceMovements.map((movement) => movement.materialId),
    ...intakes.map((intake) => intake.materialId),
  ].filter((value) => typeof value === 'string' && value)
);

for (const materialId of materialIds) {
  const [materialDoc, balanceDoc, locationBalances] = await Promise.all([
    getDocument('materials', materialId),
    getDocument('balances', materialId),
    runQuery('locationBalances', 'materialId', materialId),
  ]);

  const material = decodeDocument(materialDoc);
  const balance = decodeDocument(balanceDoc);

  console.log('=== MATERIAL ' + materialId + ' ===');
  console.log(JSON.stringify({
    material: material ? {
      id: material.id,
      schemaVersion: material.schemaVersion,
      ug: material.ug,
      status: material.status,
      unit: material.unit,
    } : null,
    balance: balance ? {
      materialId: balance.materialId,
      quantity: balance.quantity,
      revision: balance.revision,
      lastMovementId: balance.lastMovementId,
    } : null,
    locationBalances: locationBalances.map(compactLocationBalance),
  }, null, 2));
  console.log('');
}

console.log('DIAGNÓSTICO SOMENTE LEITURA: CONCLUÍDO');
