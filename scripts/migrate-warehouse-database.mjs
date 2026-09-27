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

const TOKEN = accessToken();

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

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

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

async function listDomainDocuments(databaseId, domain) {
  const documents = [];
  let pageToken = '';

  do {
    const url = new URL(
      documentsBase(databaseId)
      + '/warehouse/'
      + encodeSegment(WORKSPACE_ID)
      + '/'
      + encodeSegment(domain)
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

function canonicalFields(document) {
  return JSON.stringify(canonicalize(document.fields || {}));
}

function domainDigest(documents) {
  const hash = createHash('sha256');
  const sorted = [...documents].sort((left, right) =>
    relativeDocumentPath(left).localeCompare(relativeDocumentPath(right))
  );

  for (const document of sorted) {
    hash.update(relativeDocumentPath(document));
    hash.update('\n');
    hash.update(canonicalFields(document));
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
  const fields = Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [
      key,
      replaceDatabaseInReferenceValue(value),
    ])
  );

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
      return target !== canonicalFields(document);
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
  const sourceDigest = domainDigest(sourceDocuments);
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

for (const domain of DOMAINS) {
  const sourceBefore = await listDomainDocuments(SOURCE_DATABASE_ID, domain);
  const targetBefore = await listDomainDocuments(TARGET_DATABASE_ID, domain);

  totalSource += sourceBefore.length;
  totalTarget += targetBefore.length;

  if (MODE === 'copy') {
    const writes = await copyDomain(domain, sourceBefore, targetBefore);
    totalWrites += writes;

    const targetAfter = await listDomainDocuments(TARGET_DATABASE_ID, domain);
    const result = formatDomain(domain, sourceBefore, targetAfter);

    console.log(
      (result.equal ? '[OK]   ' : '[FAIL] ')
      + domain
      + ': origem='
      + result.source
      + ' destino='
      + result.target
      + ' writes='
      + writes
    );

    if (!result.equal) verifyFailed = true;
    continue;
  }

  const result = formatDomain(domain, sourceBefore, targetBefore);

  if (MODE === 'plan') {
    console.log(
      '[PLAN] '
      + domain
      + ': origem='
      + result.source
      + ' destino='
      + result.target
      + (result.equal ? ' (já sincronizado)' : '')
    );
  } else {
    console.log(
      (result.equal ? '[PASS] ' : '[FAIL] ')
      + domain
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
