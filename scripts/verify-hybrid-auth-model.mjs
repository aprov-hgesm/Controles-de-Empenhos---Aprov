#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const identity = read('lib/platformIdentity.ts');
const access = read('lib/platformAccess.ts');
const operationalData = read('hooks/useOperationalData.ts');
const page = read('app/page.tsx');
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

requireText(
  operationalData,
  'signInWithEmailAndPassword',
  'Login por e-mail/senha dos setores externos não está implementado.'
);
requireText(
  operationalData,
  'signInSectorUser',
  'Hook operacional não expõe o login específico dos setores.'
);
requireText(
  page,
  'Entrar com e-mail e senha',
  'Tela principal não oferece o login por senha dos setores.'
);
requireText(
  page,
  'Entrar com Google — HGeSM',
  'Tela principal não preserva o acesso Google exclusivo do fundador.'
);
requireText(
  rules,
  "request.auth.token.firebase.sign_in_provider == provider",
  'Firestore Rules não validam o sign_in_provider real do token.'
);
requireText(
  rules,
  "hasSignInProvider('google.com')",
  'Firestore Rules não restringem o fundador ao provider Google.'
);
requireText(
  rules,
  "hasSignInProvider('password')",
  'Firestore Rules não restringem setores externos ao provider password.'
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
  console.log('UI email/senha: implementada para setores externos');
  console.log('Login Google: preservado exclusivamente para o fundador');
  console.log('Enforcement nas Rules: ativo para Google/password');
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
