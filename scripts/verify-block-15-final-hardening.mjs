#!/usr/bin/env node

import fs from 'node:fs';

const findings = [];

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, text, message) {
  if (!source.includes(text)) findings.push(message);
}

function requireRegex(source, regex, message) {
  if (!regex.test(source)) findings.push(message);
}

const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/BLOCK_15_FINAL_HARDENING.md');

// CI must validate both proposed changes and the merged main branch.
requireRegex(
  workflow,
  /on:\s*\n\s*pull_request:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- main\s*\n\s*workflow_dispatch:/,
  'CI não valida pull requests, push na main e execução manual.'
);
requireText(workflow, 'concurrency:', 'CI não possui controle de concorrência.');
requireText(workflow, 'cancel-in-progress: true', 'CI não cancela execução obsoleta da mesma referência.');
requireText(workflow, 'Block 15 final hardening guard', 'Workflow não executa o guard do Bloco 15.');
requireText(workflow, 'block-15-release-gate:', 'Workflow não possui gate final consolidado.');
requireText(workflow, 'validate-application', 'Gate final não depende da validação da aplicação.');
requireText(workflow, 'browser-e2e-emulator', 'Gate final não depende do Browser E2E.');
requireText(workflow, 'needs.validate-application.result', 'Gate final não verifica o resultado da validação da aplicação.');
requireText(workflow, 'needs.browser-e2e-emulator.result', 'Gate final não verifica o resultado do Browser E2E.');

// The final matrix must keep all critical execution layers alive.
requireText(pkg, '"verify:block-15-final-hardening"', 'package.json não registra o guard do Bloco 15.');
requireText(workflow, 'npm run test:security:multitenant', 'CI não executa a suíte multi-tenant.');
requireText(workflow, 'npm run test:external-drive-auth-emulator', 'CI não executa o teste de autorização Drive no emulator.');
requireText(workflow, 'npm run verify:workspace-drive-onboarding', 'CI não executa o guard de onboarding Drive.');
requireText(workflow, 'npm run test:e2e:browser', 'CI não executa Browser E2E.');
requireText(workflow, 'npm run build', 'CI não executa build de produção.');
requireText(workflow, 'npm run typecheck', 'CI não executa validação TypeScript final.');

// Administrative metadata must not become an operational bypass.
requireRegex(
  rules,
  /match \/workspaces\/\{workspaceId\}\/empenhos\/\{id\} \{[\s\S]*?allow read: if canAccessWorkspace\(workspaceId\);/,
  'Rules de empenhos não preservam leitura exclusivamente pelo tenant.'
);
requireRegex(
  rules,
  /match \/workspaces\/\{workspaceId\}\/settings\/documentStorage \{[\s\S]*?allow read: if canAccessWorkspace\(workspaceId\);/,
  'Configuração Drive não permanece restrita ao próprio workspace.'
);
requireRegex(
  rules,
  /match \/platformAuditEvents\/\{eventId\} \{[\s\S]*?allow update, delete: if false;/,
  'Auditoria administrativa deixou de ser imutável.'
);
requireRegex(
  rules,
  /match \/platformUgIndex\/\{ug\} \{[\s\S]*?allow update, delete: if false;/,
  'Índice global de UG deixou de ser imutável.'
);
requireRegex(
  rules,
  /match \/empenhos\/\{id\} \{[\s\S]*?allow write: if false;/,
  'Coleção legada raiz de empenhos voltou a aceitar escrita.'
);

// Emulator regression cases pin the critical boundaries.
for (const marker of [
  'Administrador lista somente o diretório de workspaces',
  'Setor externo não lista o diretório global de workspaces',
  'Administrador não lista dados operacionais de setor externo',
  'Administrador não lê configuração Drive operacional de setor externo',
  'Índice global de UG não pode ser alterado depois de criado',
  'Índice global de UG não pode ser excluído',
  'Fundador não pode voltar a gravar no legado raiz',
  'Fundador autenticado por senha não acessa o legado raiz',
  'Administrador pode listar a auditoria administrativa',
  'Setor externo não lista a auditoria administrativa',
]) {
  requireText(security, marker, `Suíte multi-tenant perdeu o caso crítico: ${marker}`);
}

// Destructive browser flow remains part of the release gate.
requireText(
  e2e,
  'exclusão protegida remove empenho, NF e NS lock sem estado parcial',
  'Browser E2E não cobre o fluxo destrutivo protegido.'
);
requireText(
  e2e,
  'perfil realtime acompanha a seção ativa sem manter coleções ociosas',
  'Browser E2E não preserva a cobertura de escalabilidade do Bloco 14.'
);

requireText(docs, 'sem alterar regras de negócio', 'Documentação não delimita o caráter conservador do bloco.');
requireText(docs, 'GitHub Actions', 'Documentação não registra o hardening de CI.');
requireText(docs, 'Google Drive', 'Documentação não registra o gate de Drive.');

if (findings.length) {
  console.error('BLOCK 15 FINAL HARDENING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 15 FINAL HARDENING: READY');
  console.log('CI pós-merge: PROTEGIDO');
  console.log('Admin sem bypass operacional: PROTEGIDO');
  console.log('Auditoria e índice UG: IMUTÁVEIS');
  console.log('Legado raiz: SOMENTE LEITURA');
  console.log('Drive + Browser E2E + multi-tenant: GATES OBRIGATÓRIOS');
}
