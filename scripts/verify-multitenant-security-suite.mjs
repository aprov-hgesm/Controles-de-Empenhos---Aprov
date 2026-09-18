#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const pkg = JSON.parse(read('package.json'));
const ci = read('.github/workflows/application-ci.yml');
const config = read('firebase.security-test.json');
const suite = read('scripts/firestore-multitenancy-security.test.mjs');
const rules = read('firestore.rules');
const driveClient = read('lib/googleDriveWorkspace.ts');

requireText(
  pkg.scripts?.['test:security:multitenant'] || '',
  'firebase-tools',
  'Script de segurança não inicializa o Firebase Emulator Suite.'
);
requireText(
  pkg.scripts?.['test:security:multitenant'] || '',
  'firestore-multitenancy-security.test.mjs',
  'Script de segurança não executa a suíte multi-tenant.'
);

requireText(config, '"auth"', 'Config de testes não habilita Auth Emulator.');
requireText(config, '"firestore"', 'Config de testes não habilita Firestore Emulator.');
requireText(config, '"rules": "firestore.rules"', 'Emulador não usa as Rules oficiais do repositório.');

requireText(
  pkg.scripts?.['test:security:multitenant'] || '',
  '--project demo-emprovex-security',
  'Suíte não está restrita a um projeto Firebase demo local.'
);
requireText(
  suite,
  "const PROJECT_ID = 'demo-emprovex-security';",
  'Script de teste não está vinculado ao projeto demo local.'
);

for (const scenario of [
  'Setor A não lê empenho do Setor B',
  'Setor B não lê empenho do Setor A',
  'Mesmo e-mail com UID divergente não acessa dados operacionais',
  'Conta ainda sem UID não acessa coleção operacional',
  'Setor suspenso não acessa dados operacionais',
  'Vínculo adulterado entre conta e workspace é bloqueado',
  'Administrador não lê dados operacionais de setor externo',
  'Administrador não grava dados operacionais de setor externo',
  'Admin executa preflight e provisiona workspace + conta + contador na mesma transação',
  'Admin não lê contador operacional depois que o workspace existe',
  'Setor B não lê documentStorage do Setor A',
  'documentStorage rejeita persistência de accessToken',
  'Admin não pode suspender somente o workspace',
  'Admin suspende workspace + conta atomicamente',
  'Setor perde acesso operacional após suspensão',
  'Admin não altera firebaseUid de setor externo',
  'Admin não altera workspace fundador pelo lifecycle',
]) {
  requireText(suite, scenario, `Cenário obrigatório ausente: ${scenario}`);
}

requireText(suite, 'MULTI-TENANT SECURITY: READY', 'Suíte perdeu o marcador final READY.');
requireText(ci, 'npm run test:security:multitenant', 'CI não executa a suíte de segurança multi-tenant.');
requireText(ci, 'actions/setup-java@v4', 'CI não prepara Java para o Firestore Emulator.');

requireText(rules, 'function boundIdentityMatchesAccount(account)', 'Rules não exigem UID vinculado.');
requireText(rules, 'operationalIdentityMatchesAccount(', 'Rules perderam fronteira operacional por identidade.');
requireText(rules, "workspaceId != 'hgesm-aprov'", 'Proteção do workspace fundador ausente.');
requireText(rules, "id != 'documentStorage'", 'documentStorage voltou a cair na regra genérica de settings.');

requireText(driveClient, 'emprovexWorkspaceId', 'Pastas Drive não estão marcadas pelo workspaceId.');
requireText(driveClient, 'normalizePlatformEmail(context.email)', 'Drive não vincula autorização ao e-mail do workspace.');
requireText(driveClient, 'result.user.uid !== user.uid', 'Drive não valida que a sessão reautenticada preserva o UID.');

if (findings.length) {
  console.error('Bloco 20 — integridade da suíte de segurança multi-tenant\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nMULTI-TENANT SECURITY SUITE: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 20 — integridade da suíte de segurança multi-tenant\n');
  console.log('Auth + Firestore Emulator: configurados');
  console.log('A ↔ B: coberto');
  console.log('UID incorreto / bootstrap: cobertos');
  console.log('Suspensão / adulteração: cobertas');
  console.log('Admin sem bypass operacional: coberto');
  console.log('Google Drive / documentStorage: coberto');
  console.log('Lifecycle atômico: coberto');
  console.log('CI: suíte obrigatória');
  console.log('\nMULTI-TENANT SECURITY SUITE: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}
