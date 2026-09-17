#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const types = read('lib/types.ts');
const abstraction = read('lib/documentStorage.ts');
const empenhoClient = read('lib/empenhoDocuments.ts');
const invoiceClient = read('lib/invoiceDocuments.ts');
const empenhoRoute = read('app/api/empenho-documents/route.ts');
const invoiceRoute = read('app/api/invoice-documents/route.ts');

requireText(types, "DocumentStorageProvider = 'vercel-blob' | 'google-drive'", 'Contrato de providers incompleto.');
requireText(types, "'scheduled-for-deletion'", 'Status de retenção documental não foi declarado.');
requireText(types, 'storage?: DocumentStorageRef', 'PDFs não aceitam metadata de armazenamento opcional.');

requireText(abstraction, "LEGACY_DOCUMENT_STORAGE_PROVIDER = 'vercel-blob'", 'Fallback legado deixou de ser Vercel Blob.');
requireText(abstraction, 'if (document.storage) return document.storage', 'Resolução de metadata explícita ausente.');
requireText(abstraction, 'objectKey: document.pathname', 'Fallback legado não preserva pathname histórico.');
requireText(abstraction, "provider: 'vercel-blob'", 'Factory do Vercel Blob ausente.');
requireText(abstraction, "=== 'google-drive'", 'Abstração não reconhece Google Drive.');

for (const [label, source] of [
  ['cliente NE', empenhoClient],
  ['cliente NF', invoiceClient],
]) {
  requireText(source, '@vercel/blob/client', `${label}: upload oficial deixou de usar Vercel Blob durante o Bloco 14B.`);
  forbidText(source, 'googleDrivePoc', `${label}: POC do Drive vazou para o fluxo oficial.`);
  forbidText(source, 'drive.googleapis.com', `${label}: chamada direta ao Drive apareceu no fluxo oficial.`);
}

for (const [label, source] of [
  ['API NE', empenhoRoute],
  ['API NF', invoiceRoute],
]) {
  requireText(source, "from '@vercel/blob'", `${label}: API oficial deixou de usar Vercel Blob.`);
  requireText(source, 'createVercelBlobStorageRef', `${label}: novos documentos não recebem metadata explícita do Blob.`);
  requireText(source, 'storage: createVercelBlobStorageRef(pathname)', `${label}: metadata do provider não está vinculada ao pathname validado.`);
  forbidText(source, 'googleDrivePoc', `${label}: POC do Drive vazou para a API oficial.`);
  forbidText(source, 'drive.googleapis.com', `${label}: chamada direta ao Drive apareceu na API oficial.`);
}

if (findings.length) {
  console.error('Storage Provider Abstraction — gate de compatibilidade\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nSTORAGE PROVIDER ABSTRACTION: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Storage Provider Abstraction — gate de compatibilidade\n');
  console.log('Providers declarados: vercel-blob | google-drive');
  console.log('Legado sem metadata: vercel-blob por compatibilidade');
  console.log('Novos PDFs oficiais: metadata vercel-blob explícita');
  console.log('Upload oficial NE/NF: Vercel Blob preservado');
  console.log('Google Drive oficial: NÃO ATIVADO neste bloco');
  console.log('POC Drive: permanece isolada em /drive-poc');
  console.log('\nSTORAGE PROVIDER ABSTRACTION: READY');
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
