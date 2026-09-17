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
requireText(abstraction, "=== 'google-drive'", 'Abstração não reconhece Google Drive.');

for (const [label, source] of [
  ['cliente NE', empenhoClient],
  ['cliente NF', invoiceClient],
]) {
  forbidText(source, '@vercel/blob/client', `${label}: upload oficial ainda usa Vercel Blob após o cutover.`);
  requireText(source, "provider: 'google-drive'", `${label}: novos PDFs não recebem metadata Google Drive.`);
  requireText(source, 'requireWorkspaceDriveRuntime', `${label}: operação Drive não exige sessão do workspace.`);
}

for (const [label, source] of [
  ['API NE legada', empenhoRoute],
  ['API NF legada', invoiceRoute],
]) {
  requireText(source, "from '@vercel/blob'", `${label}: rota de compatibilidade Blob foi removida antes da auditoria final.`);
}

if (findings.length) {
  console.error('Storage Provider Abstraction — gate de cutover\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nSTORAGE PROVIDER ABSTRACTION: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Storage Provider Abstraction — gate de cutover\n');
  console.log('Providers reconhecidos: vercel-blob | google-drive');
  console.log('Legado sem metadata: vercel-blob por compatibilidade');
  console.log('Novos PDFs oficiais: google-drive');
  console.log('Cliente Vercel Blob em novos uploads: NÃO');
  console.log('Rotas Blob legadas: preservadas temporariamente para migração');
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
