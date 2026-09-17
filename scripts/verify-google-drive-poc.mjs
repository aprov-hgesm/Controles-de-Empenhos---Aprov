#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const driveClient = read('lib/googleDrivePoc.ts');
const drivePage = read('app/drive-poc/page.tsx');
const empenhoDocuments = read('lib/empenhoDocuments.ts');
const invoiceDocuments = read('lib/invoiceDocuments.ts');

assertIncludes(
  driveClient,
  "https://www.googleapis.com/auth/drive.file",
  'A POC não declara o escopo restrito drive.file.'
);

if (/https:\/\/www\.googleapis\.com\/auth\/drive(?:['"`]|\s)/.test(driveClient)) {
  findings.push('Escopo amplo https://www.googleapis.com/auth/drive detectado.');
}
if (/drive\.readonly/.test(driveClient)) {
  findings.push('Escopo drive.readonly detectado; a POC deve usar somente drive.file.');
}

for (const forbidden of ['localStorage', 'sessionStorage', 'refresh_token', 'refreshToken']) {
  if (driveClient.includes(forbidden) || drivePage.includes(forbidden)) {
    findings.push(`Persistência/credencial proibida detectada na POC: ${forbidden}.`);
  }
}

assertIncludes(
  driveClient,
  'reauthenticateWithPopup',
  'A POC não está usando reautenticação explícita da mesma sessão Firebase.'
);
assertIncludes(
  drivePage,
  'EXPERIMENTAL',
  'A tela /drive-poc perdeu a identificação de ambiente experimental.'
);
assertIncludes(
  drivePage,
  'não utilize NE/NF reais',
  'A tela /drive-poc perdeu o aviso para não utilizar documentos reais.'
);

assertIncludes(
  empenhoDocuments,
  "@vercel/blob/client",
  'O fluxo oficial de Nota de Empenho deixou de apontar para Vercel Blob durante a POC.'
);
assertIncludes(
  invoiceDocuments,
  "@vercel/blob/client",
  'O fluxo oficial de Nota Fiscal deixou de apontar para Vercel Blob durante a POC.'
);

if (findings.length) {
  console.error('Google Drive POC — gate de segurança\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nDRIVE POC SAFETY: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Google Drive POC — gate de segurança\n');
  console.log('Escopo OAuth: drive.file');
  console.log('Refresh token persistente: NÃO IMPLEMENTADO');
  console.log('Token em localStorage/sessionStorage: NÃO');
  console.log('Fluxo oficial NE: Vercel Blob preservado');
  console.log('Fluxo oficial NF: Vercel Blob preservado');
  console.log('Rota experimental: /drive-poc');
  console.log('\nDRIVE POC SAFETY: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function assertIncludes(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}
