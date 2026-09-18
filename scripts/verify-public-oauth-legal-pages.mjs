#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const page = read('app/page.tsx');
const privacy = read('app/privacy/page.tsx');
const terms = read('app/terms/page.tsx');
const drive = read('lib/googleDriveWorkspace.ts');

requireText(page, 'Sobre o EMPROVEX', 'Homepage pública não descreve a finalidade do aplicativo.');
requireText(page, 'href="/privacy"', 'Homepage não possui link público para a Política de Privacidade.');
requireText(page, 'href="/terms"', 'Homepage não possui link público para os Termos de Serviço.');
requireText(privacy, 'Política de Privacidade', 'Página pública de privacidade ausente ou incompleta.');
requireText(privacy, 'Google Drive e dados do Google', 'Política de Privacidade não explica o uso de dados do Google.');
requireText(privacy, 'drive.file', 'Política de Privacidade não informa o escopo limitado do Drive.');
requireText(privacy, 'não é persistido em Firestore', 'Política não informa o tratamento do token temporário do Drive.');
requireText(privacy, 'Google API Services User Data', 'Política não registra compromisso com a política de dados das APIs Google.');
requireText(terms, 'Termos de Serviço', 'Página pública de Termos de Serviço ausente ou incompleta.');
requireText(terms, 'Google Drive', 'Termos não explicam a integração opcional com Google Drive.');
requireText(terms, 'legislação brasileira', 'Termos não identificam a legislação aplicável.');
requireText(
  drive,
  "GOOGLE_DRIVE_WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/drive.file'",
  'Código do Drive deixou de usar o escopo limitado drive.file.'
);

if (findings.length > 0) {
  console.error('PUBLIC OAUTH LEGAL PAGES: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('PUBLIC OAUTH LEGAL PAGES: READY');
  console.log('Homepage pública: descrição + links legais');
  console.log('Privacidade: Google Drive + drive.file + tratamento do token');
  console.log('Termos de Serviço: publicados');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
