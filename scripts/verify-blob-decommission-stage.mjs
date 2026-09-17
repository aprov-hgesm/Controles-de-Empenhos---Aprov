#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const route = read('app/api/document-storage/blob-decommission/route.ts');
const cleanup = read('lib/blobDecommission.ts');
const control = read('components/layout/WorkspaceDriveControl.tsx');

requireText(route, 'requireAuthorizedFirebaseUser', 'A rota de descomissionamento não exige autenticação Firebase.');
requireText(route, 'assertEmpenhoPath', 'A rota não valida pathname de Nota de Empenho.');
requireText(route, 'assertInvoiceUploadPath', 'A rota não valida pathname de Nota Fiscal.');
requireText(route, 'await del(target.pathname)', 'A exclusão física controlada do Blob não foi encontrada.');
requireText(route, 'verifyDeleted', 'A rota não verifica a ausência do Blob após exclusão.');
requireText(route, "status: existedBefore ? 'deleted' : 'already-missing'", 'A rota não é idempotente para arquivos já ausentes.');

requireText(cleanup, "document.storage?.provider === 'google-drive'", 'A limpeza não restringe candidatos a documentos já migrados ao Drive.');
requireText(cleanup, "/^[a-f0-9]{64}$/i", 'A limpeza não exige SHA-256 válido do documento migrado.');
requireText(cleanup, "pathname.startsWith(`empenhos/", 'A limpeza não restringe pathnames históricos de empenhos.');
requireText(cleanup, "pathname.startsWith(`notas-fiscais/", 'A limpeza não restringe pathnames históricos de notas fiscais.');
requireText(cleanup, '/api/document-storage/blob-decommission', 'O cliente não usa a rota dedicada de descomissionamento.');

requireText(control, 'Bloco 14E — Descomissionar Vercel Blob', 'O painel não identifica explicitamente o estágio 14E.');
requireText(control, 'Excluir definitivamente as cópias antigas do Blob?', 'A confirmação destrutiva explícita está ausente.');
requireText(control, 'migrationCounts.totalLegacy !== 0', 'A interface não bloqueia a limpeza quando há referências legadas no Firestore.');

forbidText(route, 'saveEmpenho', 'A rota temporária de limpeza não pode alterar empenhos no Firestore.');
forbidText(route, 'saveInvoice', 'A rota temporária de limpeza não pode alterar notas fiscais no Firestore.');
forbidText(route, 'deleteWorkspaceDriveFile', 'A rota de limpeza do Blob não pode excluir arquivos do Google Drive.');
forbidText(cleanup, 'deleteWorkspaceDriveFile', 'O cliente de limpeza do Blob não pode excluir arquivos do Google Drive.');
forbidText(cleanup, 'saveEmpenho', 'O cliente de limpeza do Blob não pode regravar empenhos.');
forbidText(cleanup, 'saveInvoice', 'O cliente de limpeza do Blob não pode regravar notas fiscais.');

if (findings.length) {
  console.error('Vercel Blob Decommission — gate do Bloco 14E\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nBLOB DECOMMISSION STAGE: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Vercel Blob Decommission — gate do Bloco 14E\n');
  console.log('Alvo: somente pathnames históricos já migrados ao Google Drive');
  console.log('Pré-condição: 0 referências legadas no Firestore');
  console.log('Autenticação: obrigatória');
  console.log('SHA-256 migrado: obrigatório');
  console.log('Google Drive/Firestore: não alterados');
  console.log('Exclusão: idempotente + verificação pós-delete');
  console.log('\nBLOB DECOMMISSION STAGE: READY');
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
