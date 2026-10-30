#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const rules = read('firestore.rules');
const securityTest = read('scripts/firestore-multitenancy-security.test.mjs');

requireText(
  rules,
  'function hasSignInProvider(provider)',
  'Rules não possuem helper central para o provider do token.'
);
requireText(
  rules,
  'request.auth.token.firebase.sign_in_provider == provider',
  'Rules não consultam firebase.sign_in_provider.'
);
requireText(
  rules,
  "function isPasswordSectorSession()",
  'Rules não definem a sessão password dos setores.'
);
requireText(
  rules,
  "return hasSignInProvider('password')",
  'Sessão externa não está fixada no provider password.'
);
requireText(
  rules,
  "function isPasswordFounderSession()",
  'Rules não definem a sessão password do fundador.'
);
requireText(
  rules,
  "return hasSignInProvider('password')",
  'Fundador não tem verificacao password.'
);
requireText(
  rules,
  "function isGoogleFounderSession()",
  'Founder perdeu a compatibilidade com o provider Google.'
);
requireText(
  rules,
  'sectorAccountUsesPasswordProvider(account)',
  'Conta de setor não confere o provider esperado do diretório.'
);
requireText(
  rules,
  'isPasswordSectorSession()',
  'Fluxos self-service do setor não exigem provider password.'
);
requireText(
  rules,
  "hasSignInProvider('google.com')",
  'Firebase Google deve permanecer habilitado para a identidade fundadora.'
);
requireText(
  securityTest,
  'Setor com mesmo e-mail e UID via Google não acessa dados operacionais',
  'Teste multi-tenant não cobre setor tentando usar Google.'
);
requireText(
  securityTest,
  'Fundador com mesmo e-mail e UID via Google mantém dados operacionais HGeSM',
  'Teste multi-tenant não cobre o acesso preservado do fundador via Google.'
);
requireText(
  securityTest,
  "provider = 'password'",
  'Harness de segurança não diferencia providers de autenticação.'
);
requireText(
  securityTest,
  "tokenResult.signInProvider",
  'Harness não confirma o provider emitido pelo Auth Emulator.'
);

if (findings.length > 0) {
  console.error('FIRESTORE PROVIDER ENFORCEMENT: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('FIRESTORE PROVIDER ENFORCEMENT: READY');
  console.log('Fundador: password na interface, Google Firebase preservado');
  console.log('Setores externos: password');
  console.log('Provider é validado no token e novamente nas Firestore Rules.');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
