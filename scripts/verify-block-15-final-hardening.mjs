#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');
const rules = read('firestore.rules');
const securitySuite = read('scripts/firestore-multitenancy-security.test.mjs');
const immutableAudit = read('scripts/verify-immutable-audit.mjs');
const browserE2e = read('scripts/verify-block-9-e2e.mjs');
const block14 = read('scripts/verify-block-14-scalability.mjs');
const docs = read('docs/BLOCK_15_FINAL_HARDENING.md');

const requiredScripts = [
  'verify:multitenant-security',
  'test:security:multitenant',
  'verify:production-multitenant-readiness',
  'verify:immutable-audit',
  'verify:block-9-e2e',
  'verify:block-10-consistency',
  'verify:block-11-sag-refactor',
  'verify:block-12-empenho-deletion',
  'test:empenho-concurrency',
  'verify:block-13-empenho-concurrency',
  'test:operational-subscription-plan',
  'verify:block-14-scalability',
  'test:e2e:browser',
  'build',
  'typecheck',
];

for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) findings.push(`package.json perdeu script obrigatório: ${script}`);
}

for (const expected of [
  'Multi-tenant Firestore security tests',
  'Immutable audit trail guard',
  'Block 9 browser E2E guard',
  'Block 10 historical consistency guard',
  'Block 11 SAG conservative refactor guard',
  'Block 12 empenho deletion integrity guard',
  'Empenho concurrency domain tests',
  'Block 13 empenho concurrency guard',
  'Operational subscription plan tests',
  'Block 14 operational scalability guard',
  'Browser E2E with Firebase Emulator',
  'Production build',
  'Final TypeScript validation',
  'Diff hygiene',
]) {
  requireText(workflow, expected, `CI perdeu etapa crítica: ${expected}`);
}

requireText(workflow, 'permissions:\n  contents: read', 'Workflow perdeu permissão mínima contents: read.');
requireText(workflow, 'timeout-minutes: 12', 'Job principal perdeu timeout explícito.');
requireText(workflow, 'timeout-minutes: 15', 'Job browser E2E perdeu timeout explícito.');
requireText(workflow, 'actions/setup-java@v4', 'CI não prepara Java para Firebase Emulator.');
requireText(workflow, 'npm ci', 'CI deixou de usar instalação reprodutível npm ci.');
forbidText(workflow, 'continue-on-error: true', 'CI contém continue-on-error em etapa de validação.');
forbidText(workflow, '|| exit 0', 'CI contém bypass explícito de falha.');
forbidText(workflow, '--no-verify', 'CI contém bypass de verificação.');
requireText(workflow, 'npm run test:e2e:browser', 'Job browser E2E não executa a jornada real com emuladores.');

for (const expected of [
  'function boundIdentityMatchesAccount(account)',
  'account.firebaseUid == request.auth.uid',
  'function canAccessWorkspace(workspaceId)',
  "workspace.status == 'active'",
  "account.status == 'active'",
  'account.workspaceId == workspaceId',
  'workspace.ug == account.ug',
  'function validAuditEventShape',
  "request.resource.data.eventVersion == 'emprovex_audit_v1'",
  'request.resource.data.actorUid == request.auth.uid',
  'request.resource.data.actorEmail == request.auth.token.email',
  'request.resource.data.createdAt == request.time',
  'match /platformAuditEvents/{eventId}',
  'match /workspaces/{workspaceId}/auditEvents/{eventId}',
  'allow update, delete: if false;',
]) {
  requireText(rules, expected, `Firestore Rules perderam invariável final: ${expected}`);
}

for (const expected of [
  'Setor A não lê empenho do Setor B',
  'Setor B não lê empenho do Setor A',
  'Mesmo e-mail com UID divergente não acessa dados operacionais',
  'Setor suspenso não acessa dados operacionais',
  'Administrador não lê dados operacionais de setor externo',
  'Administrador não grava dados operacionais de setor externo',
  'Setor não pode forjar actorUid em evento de auditoria',
  'Setor A não cria auditoria dentro do workspace B',
  'Administrador cria evento de auditoria administrativa',
  'Evento de auditoria administrativa não pode ser alterado',
  'Evento de auditoria administrativa não pode ser excluído',
  'Setor externo não cria evento na auditoria administrativa',
  'BROWSER E2E FIXTURE: READY',
]) {
  requireText(securitySuite, expected, `Emulator perdeu cenário de fechamento: ${expected}`);
}

requireText(immutableAudit, 'Update/delete de auditoria: BLOQUEADOS', 'Guard de auditoria perdeu prova append-only.');
requireText(immutableAudit, 'Eventos administrativos críticos: RASTREADOS', 'Guard de auditoria perdeu cobertura administrativa.');
requireText(browserE2e, 'Produção: ISOLADA POR OPT-IN', 'Browser E2E perdeu isolamento explícito de produção.');
requireText(browserE2e, 'Jornada login -> NS -> reload: COBERTA', 'Browser E2E perdeu persistência da jornada crítica.');
requireText(block14, 'Listeners de identidade/lifecycle: PRESERVADOS', 'Bloco 14 perdeu preservação dos watchers de segurança.');
requireText(block14, 'PDF toolkit: LAZY-LOADED', 'Bloco 14 perdeu requisito de bundle/performance.');

for (const expected of [
  'não altera regras de negócio',
  'não altera Firestore Rules',
  'segurança multi-tenant',
  'auditoria append-only',
  'Browser E2E',
  'build',
  'TypeScript',
  'diff hygiene',
]) {
  requireText(docs, expected, `Documentação do Bloco 15 perdeu requisito: ${expected}`);
}

requireText(
  pkg.scripts?.['verify:block-15-hardening'] || '',
  'verify-block-15-final-hardening.mjs',
  'package.json não registra o guard final do Bloco 15.'
);
requireText(workflow, 'Block 15 final hardening guard', 'Application CI não executa o guard final do Bloco 15.');
requireText(workflow, 'npm run verify:block-15-hardening', 'CI não chama o script do Bloco 15.');

if (findings.length) {
  console.error('BLOCK 15 FINAL HARDENING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 15 FINAL HARDENING: READY');
  console.log('Firestore multi-tenant: PROTEGIDO');
  console.log('Auditoria administrativa/operacional: APPEND-ONLY');
  console.log('Browser E2E + Emulator Suite: OBRIGATÓRIOS');
  console.log('Blocos 9-14: PRESERVADOS NO CI');
  console.log('Build + TypeScript + diff hygiene: OBRIGATÓRIOS');
  console.log('Mudança funcional de produção: NENHUMA');
}
