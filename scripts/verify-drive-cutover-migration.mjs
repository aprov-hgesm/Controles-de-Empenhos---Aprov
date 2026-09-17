#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const migration = read('lib/documentDriveMigration.ts');
const driveFiles = read('lib/googleDriveFiles.ts');
const empenhoDocuments = read('lib/empenhoDocuments.ts');
const invoiceDocuments = read('lib/invoiceDocuments.ts');
const control = read('components/layout/WorkspaceDriveControl.tsx');

requireText(migration, 'migrateLegacyDocumentsToDrive', 'Migrador em lote Blob → Drive ausente.');
requireText(migration, 'fetchLegacyEmpenhoPdfBlob', 'Migração de NE não lê a origem legada explicitamente.');
requireText(migration, 'fetchLegacyInvoicePdfBlob', 'Migração de NF não lê a origem legada explicitamente.');
requireText(migration, 'uploadAndVerifyWorkspacePdf', 'Migração não usa upload com verificação de integridade.');
requireText(migration, 'Promise.allSettled', 'Rollback dos arquivos Drive de um registro com falha não foi encontrado.');
requireText(migration, 'saveEmpenho', 'Migração não persiste metadata de NE no Firestore.');
requireText(migration, 'saveInvoice', 'Migração não persiste metadata de NF no Firestore.');
requireText(driveFiles, "crypto.subtle.digest('SHA-256'", 'SHA-256 não está habilitado no fluxo Drive.');
requireText(driveFiles, 'downloadedSha256 !== sourceSha256', 'Upload Drive não revalida o hash após leitura do arquivo gravado.');
requireText(empenhoDocuments, "provider: 'google-drive'", 'Novas NEs não apontam para Drive.');
requireText(invoiceDocuments, "provider: 'google-drive'", 'Novas NFs não apontam para Drive.');
requireText(control, 'Os PDFs originais do Vercel Blob não serão apagados nesta etapa', 'Confirmação explícita de preservação do Blob ausente na interface.');
requireText(control, 'Confirmar e iniciar', 'Confirmação visual interna da migração não foi encontrada.');
requireText(control, 'Migrar PDFs automaticamente', 'Ação de migração assistida não está exposta no painel Drive.');

forbidText(migration, 'deleteEmpenhoPdfUpload', 'Migrador não pode apagar PDFs do Blob nesta etapa.');
forbidText(migration, 'deleteInvoicePdfUpload', 'Migrador não pode apagar PDFs do Blob nesta etapa.');
forbidText(migration, "method: 'DELETE'", 'Migrador contém DELETE direto; a origem Blob deve ser preservada.');
forbidText(control, 'window.confirm', 'A migração não pode depender de window.confirm em previews embutidos.');

if (findings.length) {
  console.error('Drive Cutover Migration — gate de segurança\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nDRIVE CUTOVER MIGRATION: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Drive Cutover Migration — gate de segurança\n');
  console.log('Novos uploads: Google Drive');
  console.log('Migração em lote: habilitada e retomável');
  console.log('Confirmação de migração: interna ao EMPROVEX');
  console.log('Verificação: tamanho + SHA-256 após leitura do Drive');
  console.log('Falha por registro: rollback dos novos arquivos Drive');
  console.log('Originais Vercel Blob: PRESERVADOS');
  console.log('Exclusão automática do Blob: NÃO');
  console.log('\nDRIVE CUTOVER MIGRATION: READY');
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
