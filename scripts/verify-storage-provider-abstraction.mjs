#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const findings = [];

const types = read('lib/types.ts');
const abstraction = read('lib/documentStorage.ts');
const empenhoClient = read('lib/empenhoDocuments.ts');
const invoiceClient = read('lib/invoiceDocuments.ts');

requireText(types, "DocumentStorageProvider = 'google-drive'", 'O contrato documental não está restrito ao Google Drive.');
forbidText(types, "'vercel-blob'", 'O tipo legado de storage ainda existe.');
requireText(abstraction, "storage.provider !== 'google-drive'", 'A abstração não rejeita providers diferentes do Google Drive.');
forbidText(abstraction, 'LEGACY_DOCUMENT_STORAGE_PROVIDER', 'Fallback legado ainda está declarado.');
forbidText(abstraction, 'createVercelBlobStorageRef', 'Factory do provider legado ainda está declarada.');

for (const [label, source] of [
  ['cliente NE', empenhoClient],
  ['cliente NF', invoiceClient],
]) {
  requireText(source, "provider: 'google-drive'", `${label}: novos PDFs não recebem metadata Google Drive.`);
  requireText(source, 'requireWorkspaceDriveRuntime', `${label}: operação documental não exige sessão Drive do workspace.`);
  forbidText(source, 'fetchLegacy', `${label}: fallback de leitura legado ainda existe.`);
  forbidText(source, '/api/empenho-documents', `${label}: referência à API legada de NE ainda existe.`);
  forbidText(source, '/api/invoice-documents', `${label}: referência à API legada de NF ainda existe.`);
}

const removedRuntimePaths = [
  'app/api/empenho-documents/route.ts',
  'app/api/empenho-documents/upload/route.ts',
  'app/api/invoice-documents/route.ts',
  'app/api/invoice-documents/upload/route.ts',
  'app/api/document-storage/blob-decommission/route.ts',
  'lib/blobDecommission.ts',
  'lib/documentDriveMigration.ts',
  'lib/server/empenhoDocumentSecurity.ts',
  'lib/server/invoiceDocumentSecurity.ts',
  'lib/server/firebaseIdToken.ts',
];
for (const path of removedRuntimePaths) {
  if (existsSync(resolve(root, path))) findings.push(`Artefato legado ainda existe: ${path}.`);
}

const forbiddenRuntimeMarkers = [
  '@vercel/blob',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_STORE_ID',
  'vercel-blob',
  'isBlobConfigured',
  'createVercelBlobStorageRef',
  'fetchLegacyEmpenhoPdfBlob',
  'fetchLegacyInvoicePdfBlob',
];

for (const file of collectFiles(['app', 'components', 'hooks', 'lib', '.github', '.env.example', 'package.json'])) {
  const source = read(file);
  for (const marker of forbiddenRuntimeMarkers) {
    if (source.includes(marker)) findings.push(`${file}: resíduo proibido detectado (${marker}).`);
  }
}

if (findings.length) {
  console.error('Document Storage — auditoria final Drive-only\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nDOCUMENT STORAGE FINAL: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Document Storage — auditoria final Drive-only\n');
  console.log('Provider documental: google-drive');
  console.log('Fallback legado: AUSENTE');
  console.log('Rotas antigas: AUSENTES');
  console.log('Secrets/configuração legada no repositório: AUSENTES');
  console.log('Uploads/leitura NE e NF: GOOGLE DRIVE');
  console.log('\nDOCUMENT STORAGE FINAL: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}

function forbidText(source, forbidden, failureMessage) {
  if (source.includes(forbidden)) findings.push(failureMessage);
}

function collectFiles(entries) {
  const files = [];
  const visit = (absolutePath) => {
    if (!existsSync(absolutePath)) return;
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      for (const name of readdirSync(absolutePath)) visit(resolve(absolutePath, name));
      return;
    }
    if (!/\.(?:ts|tsx|js|mjs|json|yml|yaml|example)$/.test(absolutePath) && !absolutePath.endsWith('.env.example')) return;
    files.push(relative(root, absolutePath));
  };
  for (const entry of entries) visit(resolve(root, entry));
  return files;
}
