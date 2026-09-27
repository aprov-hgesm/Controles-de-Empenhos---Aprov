#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const MODE = (process.argv[2] || 'plan').trim().toLowerCase();
const VALID_MODES = new Set(['plan', 'copy', 'verify']);

if (!VALID_MODES.has(MODE)) {
  console.error('Uso: node scripts/migrate-warehouse-database.mjs [plan|copy|verify]');
  process.exit(2);
}

const PROJECT_ID =
  process.env.EMPROVEX_FIREBASE_PROJECT_ID?.trim()
  || 'gen-lang-client-0982077967';

const SOURCE_DATABASE_ID =
  process.env.EMPROVEX_SOURCE_DATABASE_ID?.trim()
  || 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1';

const TARGET_DATABASE_ID =
  process.env.EMPROVEX_WAREHOUSE_DATABASE_ID?.trim()
  || 'emprovex-warehouse';

const WORKSPACE_ID =
  process.env.EMPROVEX_WAREHOUSE_WORKSPACE_ID?.trim()
  || 'hgesm-aprov';

const DOMAINS = [
  'materials',
  'depots',
  'locations',
  'movements',
  'balances',
  'locationBalances',
  'settings',
  'lots',
  'barcodes',
  'layouts',
  'inventories',
  'siscofisSnapshots',
  'alerts',
  'intakes',
  'queueExclusions',
  'destinations',
  'withdrawals',
  'consumptions',
];

const PAGE_SIZE = 300;
const WRITE_BATCH_SIZE = 100;

function accessToken() {
  const explicit = process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
  if (explicit) return explicit;

  try {
    return execFileSync(
      'gcloud',
      ['auth', 'print-access-token'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    ).trim();
  } catch {
    throw new Error(
      'Não foi possível obter token. Execute no Cloud Shell ou defina GOOGLE_OAUTH_ACCESS_TOKEN.'
    );
  }
}

let cachedToken = accessToken();

function refreshAccessToken() {
  cachedToken = accessToken();
  return cachedToken;
}

function encodeSegment(value) {
  return encodeURIComponent(value);
}

function documentsBase(databaseId) {
  return (
    'https://firestore.googleapis.com/v1/projects/'
    + encodeSegment(PROJECT_ID)
    + '/databases/'
    + encodeSegment(databaseId)
    + '/documents'
  );
}

async function requestJson(url, options = {}, retryAuth = true) {
  const doRequest = (token) => fetch(url, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let response = await doRequest(cachedToken);

  if (response.status === 401 && retryAuth && !process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim()) {
    console.warn('[AUTH] Token OAuth expirou; renovando credencial do gcloud e repetindo a requisição...');
    response = await doRequest(refreshAccessToken());
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      data?.error?.message
      || data?.message
      || response.statusText
      || 'erro desconhecido';
    throw new Error(
      'Firestore REST ' + response.status + ' em ' + url + ': ' + message
    );
  }

  return data;
}

async function listCollectionDocuments(databaseId, pathSegments) {
  const documents = [];
  let pageToken = '';

  do {
    const url = new URL(
      documentsBase(databaseId)
      + '/'
      + pathSegments.map(encodeSegment).join('/')
    );
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('showMissing', 'false');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await requestJson(url.toString());
    documents.push(...(Array.isArray(data.documents) ? data.documents : []));
    pageToken = typeof data.nextPageToken === 'string'
      ? data.nextPageToken
      : '';
  } while (pageToken);

  return documents;
}

async function listDomainDocuments(databaseId, domain) {
  return listCollectionDocuments(
    databaseId,
    ['warehouse', WORKSPACE_ID, domain]
  );
}

async function listInventoryItemDocuments(databaseId, inventoryDocuments) {
  const documents = [];

  for (const inventory of inventoryDocuments) {
    const pathSegments = relativeDocumentPath(inventory).split('/');
    if (
      pathSegments.length !== 4
      || pathSegments[0] !== 'warehouse'
      || pathSegments[1] !== WORKSPACE_ID
      || pathSegments[2] !== 'inventories'
    ) {
      throw new Error(
        'Inventário fora do namespace esperado: ' + relativeDocumentPath(inventory)
      );
    }

    documents.push(
      ...await listCollectionDocuments(
        databaseId,
        [...pathSegments, 'items']
      )
    );
  }

  return documents;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function relativeDocumentPath(document) {
  const marker = '/documents/';
  const index = document.name.indexOf(marker);
  if (index < 0) throw new Error('Documento sem caminho Firestore válido: ' + document.name);
  return document.name.slice(index + marker.length);
}

function fieldsForComparison(document, projectReferencesToTarget = false) {
  const fields = document.fields || {};
  if (!projectReferencesToTarget) return fields;

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      replaceDatabaseInReferenceValue(value),
    ])
  );
}

function canonicalFields(document, projectReferencesToTarget = false) {
  return JSON.stringify(
    canonicalize(fieldsForComparison(document, projectReferencesToTarget))
  );
}

function domainDigest(documents, projectReferencesToTarget = false) {
  const hash = createHash('sha256');
  const sorted = [...documents].sort((left, right) =>
    relativeDocumentPath(left).localeCompare(relativeDocumentPath(right))
  );

  for (const document of sorted) {
    hash.update(relativeDocumentPath(document));
    hash.update('\n');
    hash.update(canonicalFields(document, projectReferencesToTarget));
    hash.update('\n');
  }

  return hash.digest('hex');
}

function replaceDatabaseInReferenceValue(value) {
  if (!value || typeof value !== 'object') return value;

  if (
    typeof value.referenceValue === 'string'
    && value.referenceValue.includes('/databases/' + SOURCE_DATABASE_ID + '/documents/')
  ) {
    return {
      ...value,
      referenceValue: value.referenceValue.replace(
        '/databases/' + SOURCE_DATABASE_ID + '/documents/',
        '/databases/' + TARGET_DATABASE_ID + '/documents/'
      ),
    };
  }

  if (Array.isArray(value.arrayValue?.values)) {
    return {
      ...value,
      arrayValue: {
        ...value.arrayValue,
        values: value.arrayValue.values.map(replaceDatabaseInReferenceValue),
      },
    };
  }

  if (value.mapValue?.fields && typeof value.mapValue.fields === 'object') {
    return {
      ...value,
      mapValue: {
        ...value.mapValue,
        fields: Object.fromEntries(
          Object.entries(value.mapValue.fields).map(([key, child]) => [
            key,
            replaceDatabaseInReferenceValue(child),
          ])
        ),
      },
    };
  }

  return value;
}

function targetDocument(document) {
  const relativePath = relativeDocumentPath(document);
  const fields = fieldsForComparison(document, true);

  return {
    name:
      'projects/'
      + PROJECT_ID
      + '/databases/'
      + TARGET_DATABASE_ID
      + '/documents/'
      + relativePath,
    fields,
  };
}

async function commitWrites(writes) {
  if (!writes.length) return;
  const url =
    'https://firestore.googleapis.com/v1/projects/'
    + encodeSegment(PROJECT_ID)
    + '/databases/'
    + encodeSegment(TARGET_DATABASE_ID)
    + '/documents:commit';

  await requestJson(url, {
    method: 'POST',
    body: JSON.stringify({ writes }),
  });
}

async function copyDomain(domain, sourceDocuments, targetDocuments) {
  const targetByPath = new Map(
    targetDocuments.map((document) => [
      relativeDocumentPath(document),
      canonicalFields(document),
    ])
  );

  const pending = sourceDocuments
    .filter((document) => {
      const target = targetByPath.get(relativeDocumentPath(document));
      return target !== canonicalFields(document, true);
    })
    .map((document) => ({
      update: targetDocument(document),
    }));

  for (let index = 0; index < pending.length; index += WRITE_BATCH_SIZE) {
    await commitWrites(pending.slice(index, index + WRITE_BATCH_SIZE));
  }

  return pending.length;
}

function formatDomain(domain, sourceDocuments, targetDocuments) {
  // Referências Firestore da origem são comparadas como ficarão no destino.
  // Assim copy/verify permanecem idempotentes mesmo quando um documento contém
  // referenceValue apontando para o database antigo.
  const sourceDigest = domainDigest(sourceDocuments, true);
  const targetDigest = domainDigest(targetDocuments);
  const equal =
    sourceDocuments.length === targetDocuments.length
    && sourceDigest === targetDigest;

  return {
    domain,
    source: sourceDocuments.length,
    target: targetDocuments.length,
    equal,
    sourceDigest,
    targetDigest,
  };
}

console.log('EMPROVEX — migração do database ADM Depósito');
console.log('Modo:', MODE);
console.log('Projeto:', PROJECT_ID);
console.log('Origem:', SOURCE_DATABASE_ID);
console.log('Destino:', TARGET_DATABASE_ID);
console.log('Workspace:', WORKSPACE_ID);
console.log('');

let totalSource = 0;
let totalTarget = 0;
let totalWrites = 0;
let verifyFailed = false;

async function processScope(label, sourceLoader, targetLoader) {
  const sourceBefore = await sourceLoader();
  const targetBefore = await targetLoader();

  totalSource += sourceBefore.length;
  totalTarget += targetBefore.length;

  if (MODE === 'copy') {
    const writes = await copyDomain(label, sourceBefore, targetBefore);
    totalWrites += writes;

    const targetAfter = await targetLoader();
    const result = formatDomain(label, sourceBefore, targetAfter);

    console.log(
      (result.equal ? '[OK]   ' : '[FAIL] ')
      + label
      + ': origem='
      + result.source
      + ' destino='
      + result.target
      + ' writes='
      + writes
    );

    if (!result.equal) verifyFailed = true;
    return;
  }

  const result = formatDomain(label, sourceBefore, targetBefore);

  if (MODE === 'plan') {
    console.log(
      '[PLAN] '
      + label
      + ': origem='
      + result.source
      + ' destino='
      + result.target
      + (result.equal ? ' (já sincronizado)' : '')
    );
    return;
  }

  console.log(
    (result.equal ? '[PASS] ' : '[FAIL] ')
    + label
    + ': origem='
    + result.source
    + ' destino='
    + result.target
  );
  if (!result.equal) {
    console.log('       origem sha256=' + result.sourceDigest);
    console.log('       destino sha256=' + result.targetDigest);
    verifyFailed = true;
  }
}

for (const domain of DOMAINS) {
  await processScope(
    domain,
    () => listDomainDocuments(SOURCE_DATABASE_ID, domain),
    () => listDomainDocuments(TARGET_DATABASE_ID, domain)
  );

  // Inventário possui itens em subcoleção:
  // warehouse/{workspaceId}/inventories/{inventoryId}/items/{itemId}.
  // Eles precisam ser copiados e verificados separadamente; listar apenas a
  // coleção inventories não percorre descendentes no Firestore REST.
  if (domain === 'inventories') {
    await processScope(
      'inventories/*/items',
      async () => {
        const parents = await listDomainDocuments(
          SOURCE_DATABASE_ID,
          'inventories'
        );
        return listInventoryItemDocuments(SOURCE_DATABASE_ID, parents);
      },
      async () => {
        const parents = await listDomainDocuments(
          TARGET_DATABASE_ID,
          'inventories'
        );
        return listInventoryItemDocuments(TARGET_DATABASE_ID, parents);
      }
    );
  }
}
console.log('');
console.log('Documentos na origem:', totalSource);
console.log('Documentos no destino antes da operação:', totalTarget);
if (MODE === 'copy') console.log('Documentos gravados/atualizados:', totalWrites);

if (MODE === 'verify' || MODE === 'copy') {
  if (verifyFailed) {
    console.error('WAREHOUSE DATABASE MIGRATION: FAIL');
    process.exit(1);
  }
  console.log('WAREHOUSE DATABASE MIGRATION: PASS');
} else {
  console.log('WAREHOUSE DATABASE MIGRATION PLAN: OK');
}
