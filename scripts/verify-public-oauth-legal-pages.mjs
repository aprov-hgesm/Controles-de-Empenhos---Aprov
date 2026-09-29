#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const page = read('app/page.tsx');
const login = read('components/auth/EmprovexLogin.tsx');
const privacy = read('app/privacy/page.tsx');
const terms = read('app/terms/page.tsx');
const drive = read('lib/googleDriveWorkspace.ts');
const gmail = read('lib/googleWorkspaceMail.ts');

requireText(page, '<EmprovexLogin', 'Homepage pública não monta a experiência pública de autenticação.');
requireText(login, 'Sobre o EMPROVEX', 'Homepage pública não descreve a finalidade do aplicativo.');
requireText(login, 'href="/privacy"', 'Homepage não possui link público para a Política de Privacidade.');
requireText(login, 'href="/terms"', 'Homepage não possui link público para os Termos de Serviço.');
requireText(privacy, 'Política de Privacidade', 'Página pública de privacidade ausente ou incompleta.');
requireText(privacy, 'Google Drive, Gmail e dados do Google', 'Política de Privacidade não explica o uso de dados do Google.');
requireText(privacy, 'drive.file', 'Política de Privacidade não informa o escopo limitado do Drive.');
requireText(privacy, 'gmail.send', 'Política de Privacidade não informa o escopo mínimo de envio do Gmail.');
requireText(privacy, 'não é persistido em Firestore', 'Política não informa o tratamento do token temporário do Drive.');
requireText(privacy, 'Google API Services User Data', 'Política não registra compromisso com a política de dados das APIs Google.');
requireText(terms, 'Termos de Serviço', 'Página pública de Termos de Serviço ausente ou incompleta.');
requireText(terms, 'Google Drive e Gmail', 'Termos não explicam as integrações opcionais Google Drive e Gmail.');
requireText(terms, 'legislação brasileira', 'Termos não identificam a legislação aplicável.');
requireText(
  drive,
  "GOOGLE_DRIVE_WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/drive.file'",
  'Código do Drive deixou de usar o escopo limitado drive.file.'
);
requireText(
  gmail,
  "GOOGLE_GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'",
  'Envio de cronograma deixou de usar o escopo mínimo gmail.send.'
);
if (gmail.includes('https://mail.google.com/')) {
  findings.push('Envio de cronograma não pode solicitar o escopo amplo mail.google.com.');
}

if (findings.length > 0) {
  console.error('PUBLIC OAUTH LEGAL PAGES: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('PUBLIC OAUTH LEGAL PAGES: READY');
  console.log('Homepage pública: descrição + links legais');
  console.log('Privacidade: Google Drive + Gmail + escopos mínimos + tratamento dos tokens');
  console.log('Termos de Serviço: publicados');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
