#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recoveryPolicy = JSON.parse(readFileSync(resolve(root, 'ops/firestore-recovery.json'), 'utf8'));
const migrationPolicy = JSON.parse(readFileSync(resolve(root, 'ops/hgesm-workspace-migration.json'), 'utf8'));
const workspaceId = migrationPolicy.workspaceId;
const apiBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(recoveryPolicy.projectId)}/databases/${encodeURIComponent(recoveryPolicy.databaseId)}`;
let accessToken = '';

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  ensureGcloud();
  console.log('Auditoria documental pré-descomissionamento — EMPROVEX Bloco 14E');
  console.log(`Projeto:   ${recoveryPolicy.projectId}`);
  console.log(`Banco:     ${recoveryPolicy.databaseId}`);
  console.log(`Workspace: ${workspaceId}\n`);

  const [empenhosRaw, invoicesRaw, settingsRaw] = await Promise.all([
    listDocuments(`workspaces/${workspaceId}/empenhos`),
    listDocuments(`workspaces/${workspaceId}/invoices`),
    getDocument(`workspaces/${workspaceId}/settings/documentStorage`),
  ]);

  const empenhos = empenhosRaw.map((document) => ({
    _documentId: documentId(document),
    ...decodeFields(document.fields || {}),
  }));
  const invoices = invoicesRaw.map((document) => ({
    _documentId: documentId(document),
    ...decodeFields(document.fields || {}),
  }));
  const settings = settingsRaw ? decodeFields(settingsRaw.fields || {}) : null;

  const findings = [];
  const unique = new Map();
  let currentEmpenhoPdfs = 0;
  let currentInvoicePdfs = 0;

  auditSettings(settings, findings);

  for (const empenho of empenhos) {
    if (empenho.notaEmpenhoPdf) currentEmpenhoPdfs += 1;
    const documents = uniqueDocuments(empenho.notaEmpenhoPdf, empenho.notaEmpenhoPdfVersions);
    for (const document of documents) {
      auditPdf(document, `empenho/${empenho._documentId}`, findings, unique);
    }
  }

  for (const invoice of invoices) {
    if (invoice.notaFiscalPdf) currentInvoicePdfs += 1;
    const documents = uniqueDocuments(invoice.notaFiscalPdf, invoice.notaFiscalPdfVersions);
    for (const document of documents) {
      auditPdf(document, `invoice/${invoice._documentId}`, findings, unique);
    }
  }

  const documents = [...unique.values()];
  const providerCounts = documents.reduce((acc, item) => {
    const provider = item.document?.storage?.provider || 'legacy-without-storage';
    acc[provider] = (acc[provider] || 0) + 1;
    return acc;
  }, {});

  console.log('Resumo documental');
  console.log(`Empenhos no workspace:       ${empenhos.length}`);
  console.log(`Notas Fiscais no workspace:  ${invoices.length}`);
  console.log(`NEs com PDF atual:            ${currentEmpenhoPdfs}`);
  console.log(`NFs com PDF atual:            ${currentInvoicePdfs}`);
  console.log(`PDFs únicos referenciados:    ${documents.length}`);
  console.log(`Google Drive:                 ${providerCounts['google-drive'] || 0}`);
  console.log(`Vercel Blob:                  ${providerCounts['vercel-blob'] || 0}`);
  console.log(`Sem metadata storage:         ${providerCounts['legacy-without-storage'] || 0}`);

  if (findings.length) {
    console.log('\nAchados bloqueantes');
    for (const finding of findings.slice(0, 40)) {
      console.log(`  [BLOCK] ${finding}`);
    }
    if (findings.length > 40) console.log(`  ... +${findings.length - 40} achado(s)`);
  }

  const blobRefs = (providerCounts['vercel-blob'] || 0) + (providerCounts['legacy-without-storage'] || 0);
  console.log(`\nReferências legadas/Blob: ${blobRefs}`);
  console.log(`Achados bloqueantes:      ${findings.length}`);
  console.log(`\nDOCUMENT STORAGE PRE-DECOMMISSION: ${findings.length === 0 && blobRefs === 0 ? 'READY' : 'BLOQUEADO'}`);

  if (findings.length > 0 || blobRefs > 0) process.exitCode = 2;
}

function auditSettings(settings, findings) {
  if (!settings) {
    findings.push('settings/documentStorage ausente.');
    return;
  }
  if (settings.provider !== 'google-drive') findings.push(`settings/documentStorage provider=${String(settings.provider)}; esperado google-drive.`);
  if (settings.status !== 'configured') findings.push(`settings/documentStorage status=${String(settings.status)}; esperado configured.`);
  if (settings.workspaceId !== workspaceId) findings.push(`settings/documentStorage workspaceId=${String(settings.workspaceId)}; esperado ${workspaceId}.`);
  for (const field of ['rootFolderId', 'empenhosFolderId', 'invoicesFolderId']) {
    if (!nonEmptyString(settings[field])) findings.push(`settings/documentStorage ${field} ausente.`);
  }
}

function auditPdf(document, owner, findings, unique) {
  if (!document || typeof document !== 'object') {
    findings.push(`${owner}: referência PDF inválida.`);
    return;
  }

  const storage = document.storage;
  const pathname = nonEmptyString(document.pathname) ? document.pathname : '(sem pathname)';
  if (!storage || typeof storage !== 'object') {
    findings.push(`${owner}: PDF ${pathname} sem metadata storage.`);
    unique.set(`legacy:${pathname}`, { owner, document });
    return;
  }

  const key = `${String(storage.provider)}:${String(storage.objectKey || pathname)}`;
  if (!unique.has(key)) unique.set(key, { owner, document });

  if (storage.provider !== 'google-drive') findings.push(`${owner}: PDF ${pathname} provider=${String(storage.provider)}.`);
  if (storage.status !== 'active') findings.push(`${owner}: PDF ${pathname} status=${String(storage.status)}; esperado active.`);
  if (!nonEmptyString(storage.objectKey)) findings.push(`${owner}: PDF ${pathname} sem Drive fileId/objectKey.`);
  if (!nonEmptyString(storage.folderKey)) findings.push(`${owner}: PDF ${pathname} sem Drive folderId/folderKey.`);
  if (storage.workspaceId !== workspaceId) findings.push(`${owner}: PDF ${pathname} workspaceId=${String(storage.workspaceId)}; esperado ${workspaceId}.`);
  if (!/^[a-f0-9]{64}$/i.test(String(storage.sha256 || ''))) findings.push(`${owner}: PDF ${pathname} sem SHA-256 válido.`);
}

function uniqueDocuments(current, versions) {
  const candidates = [...(Array.isArray(versions) ? versions : []), ...(current ? [current] : [])];
  const map = new Map();
  for (const document of candidates) {
    if (!document || typeof document !== 'object') continue;
    const provider = document.storage?.provider || 'legacy';
    const objectKey = document.storage?.objectKey || document.pathname || document.id || JSON.stringify(document);
    map.set(`${provider}:${objectKey}`, document);
  }
  return [...map.values()];
}

function ensureGcloud() {
  const check = spawnSync('gcloud', ['--version'], { encoding: 'utf8' });
  if (check.error?.code === 'ENOENT') throw new Error('Google Cloud CLI não encontrado. Use o Cloud Shell.');
  if (check.status !== 0) throw new Error('Não foi possível executar o gcloud.');
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Não foi possível obter token do gcloud: ${result.stderr.trim() || result.stdout.trim()}`);
  const token = result.stdout.trim();
  if (!token) throw new Error('gcloud retornou token vazio.');
  return token;
}

async function firestoreRequest(relativeUrl, allow404 = false, retryAuth = true) {
  if (!accessToken) accessToken = getAccessToken();
  const response = await fetch(`${apiBase}${relativeUrl}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (response.status === 401 && retryAuth) {
    accessToken = getAccessToken();
    return firestoreRequest(relativeUrl, allow404, false);
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${detail || relativeUrl}`);
  }
  return response.json();
}

function encodeFirestorePath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function getDocument(path) {
  return firestoreRequest(`/documents/${encodeFirestorePath(path)}`, true);
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
  const id = String(document?.name || '').split('/').pop();
  if (!id) throw new Error(`Documento Firestore sem ID válido: ${String(document?.name || '')}`);
  return id;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.hasOwn(value, 'nullValue')) return null;
  if (Object.hasOwn(value, 'booleanValue')) return Boolean(value.booleanValue);
  if (Object.hasOwn(value, 'integerValue')) return Number(value.integerValue);
  if (Object.hasOwn(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.hasOwn(value, 'timestampValue')) return value.timestampValue;
  if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
  if (Object.hasOwn(value, 'bytesValue')) return value.bytesValue;
  if (Object.hasOwn(value, 'referenceValue')) return value.referenceValue;
  if (Object.hasOwn(value, 'geoPointValue')) return value.geoPointValue;
  if (Object.hasOwn(value, 'arrayValue')) return (value.arrayValue?.values || []).map(decodeValue);
  if (Object.hasOwn(value, 'mapValue')) return decodeFields(value.mapValue?.fields || {});
  return value;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
