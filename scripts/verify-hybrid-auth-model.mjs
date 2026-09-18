#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const identity = read('lib/platformIdentity.ts');
const access = read('lib/platformAccess.ts');
const operationalData = read('hooks/useOperationalData.ts');
const rules = read('firestore.rules');

requireText(
  identity,
  "export type PlatformAuthProvider = 'google.com' | 'password'",
  'Modelo de identidade não declara os dois provedores autorizados.'
);
requireText(
  identity,
  "FOUNDER_AUTH_PROVIDER: PlatformAuthProvider = 'google.com'",
  'Provedor do fundador não está fixado em Google.'
);
requireText(
  identity,
  "SECTOR_AUTH_PROVIDER: PlatformAuthProvider = 'password'",
  'Provedor dos setores externos não está fixado em email/senha.'
);
requireText(
  identity,
  'authProvider?: PlatformAuthProvider',
  'platformAccount não possui contrato transitório de authProvider.'
);

requireText(
  access,
  'await user.getIdTokenResult()',
  'Resolução de sessão não consulta o provider real do token Firebase.'
);
requireText(
  access,
  'tokenResult.signInProvider',
  'Resolução de sessão não usa signInProvider do token.'
);
requireText(
  access,
  'signInProvider !== FOUNDER_AUTH_PROVIDER',
  'Fundador não está restrito a sessão Google.'
);
requireText(
  access,
  'signInProvider !== SECTOR_AUTH_PROVIDER',
  'Setor externo não está restrito a sessão email/senha.'
);
requireText(
  access,
  'account.authProvider || SECTOR_AUTH_PROVIDER',
  'Contas legadas externas sem authProvider não possuem fallback seguro para password.'
);
requireText(
  access,
  'return unauthorized(normalizedEmail)',
  'Provider incompatível não falha fechado.'
);

// Bloco 1 não deve antecipar a UI de senha nem alterar as Rules; isso pertence
// respectivamente aos Blocos 3 e 4.
forbidText(
  operationalData,
  'signInWithEmailAndPassword',
  'Bloco 1 antecipou o formulário/login por senha que pertence ao Bloco 3.'
);
forbidText(
  rules,
  'sign_in_provider',
  'Bloco 1 antecipou enforcement de provider nas Firestore Rules; isso pertence ao Bloco 4.'
);

if (findings.length) {
  console.error('Nova autenticação — Bloco 1: modelo híbrido\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nHYBRID AUTH MODEL: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Nova autenticação — Bloco 1: modelo híbrido\n');
  console.log('Fundador: google.com');
  console.log('Setores externos: password');
  console.log('Provider real: validado pelo ID token Firebase');
  console.log('Conta externa por Google: bloqueada no runtime');
  console.log('Documentos legados sem authProvider: compatíveis como password');
  console.log('UI email/senha: adiada para Bloco 3');
  console.log('Enforcement nas Rules: adiado para Bloco 4');
  console.log('\nHYBRID AUTH MODEL: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
