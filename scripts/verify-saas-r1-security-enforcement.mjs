#!/usr/bin/env node

import fs from 'node:fs';

const findings = [];

const read = (path) => fs.readFileSync(path, 'utf8');

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

const route = read('app/api/admin/sector-lifecycle/route.ts');
const lifecycle = read('lib/server/sectorLifecycleAdmin.ts');
const hook = read('hooks/usePlatformAdminDirectory.ts');
const coreRules = read('firestore.rules');
const warehouseRules = read('firestore.warehouse.rules');
const view = read('components/admin/PlatformAdminView.tsx');
const billingPanel = read('components/admin/AdminBillingPanel.tsx');
const warehouseSecurity = read('scripts/warehouse-external-access-security.test.mjs');
const multitenantSecurity = read('scripts/firestore-multitenancy-security.test.mjs');
const packageJson = read('package.json');
const ci = read('.github/workflows/application-ci.yml');

requireText(route, 'verifyFounderSession(bearerToken(request))', 'Lifecycle API deixou de exigir a sessão fundadora.');
requireText(route, "assertAdminMutationEnabled(security, 'sector-lifecycle')", 'Lifecycle API perdeu o guard de mutação administrativa.');
requireText(route, 'applySectorLifecycleStatus(input, founder)', 'Lifecycle API não delega para o serviço server-side.');

requireText(lifecycle, "workspaceId === HGESM_WORKSPACE_ID", 'Lifecycle deixou de proteger o workspace fundador.');
requireText(lifecycle, 'SESSION_REVOCATION_VERSION', 'Suspensão deixou de materializar tombstones de sessão.');
requireText(lifecycle, 'sessionRevocations', 'Suspensão deixou de gravar revogação de sessão.');
requireText(lifecycle, 'sessionSlots', 'Suspensão deixou de remover leases ativos.');
requireText(lifecycle, "WAREHOUSE_DATABASE_ID = 'emprovex-warehouse'", 'Lifecycle deixou de sincronizar autorização da Central.');
requireText(lifecycle, "WAREHOUSE_ACCESS_COLLECTION = 'warehouseAccess'", 'Lifecycle perdeu o espelho mínimo de autorização da Central.');
requireText(lifecycle, "currentDocument: { updateTime:", 'Lifecycle deixou de usar precondições contra concorrência.');
requireText(lifecycle, "operation: 'sector.status_change'", 'Lifecycle perdeu auditoria de mudança de status.');
requireText(lifecycle, "reason: 'warehouse_reactivation_compensation'", 'Reativação perdeu rollback seguro quando a Central falha.');

forbidText(lifecycle, 'billingAccounts/', 'Lifecycle não pode escrever ou depender de billingAccounts.');
forbidText(lifecycle, 'empenhos/', 'Lifecycle não pode tocar em empenhos.');
forbidText(lifecycle, 'invoices/', 'Lifecycle não pode tocar em notas fiscais.');
forbidText(lifecycle, 'cronogramas/', 'Lifecycle não pode tocar em cronogramas.');
forbidText(lifecycle, '/materials/', 'Lifecycle não pode tocar em materiais da Central.');

requireText(hook, "fetch('/api/admin/sector-lifecycle'", 'Painel administrativo não usa o endpoint seguro de lifecycle.');
forbidText(hook, 'setSectorWorkspaceStatus(', 'Painel ainda altera status diretamente pelo cliente.');

requireText(coreRules, "workspace.status == 'active'", 'Rules principais deixaram de exigir workspace ativo.');
requireText(coreRules, "account.status == 'active'", 'Rules principais deixaram de exigir conta ativa.');
forbidText(coreRules, 'get(/databases/$(database)/documents/billingAccounts/', 'Billing foi acoplado ao acesso operacional das Rules principais.');

requireText(warehouseRules, 'function warehouseLifecycleAllowsAccess(workspaceId)', 'Rules da Central não materializam lifecycle.');
requireText(warehouseRules, "/documents/warehouseAccess/$(workspaceId)", 'Rules da Central perderam o documento de lifecycle.');
requireText(warehouseRules, ".data.status == 'active'", 'Rules da Central deixaram de exigir lifecycle ativo.');
forbidText(warehouseRules, 'billingAccounts', 'Billing foi acoplado às Rules da Central.');

requireText(warehouseSecurity, 'workspace suspenso perde acesso à Central com a sessão já aberta', 'Emulator da Central não cobre suspensão de sessão existente.');
requireText(warehouseSecurity, 'reativação restaura a Central sem reutilizar billing', 'Emulator da Central não cobre reativação.');
requireText(multitenantSecurity, 'Admin suspende workspace + conta atomicamente', 'Teste multi-tenant perdeu suspensão atômica.');
requireText(multitenantSecurity, 'Setor perde acesso operacional após suspensão', 'Teste multi-tenant perdeu o DENY após suspensão.');
requireText(multitenantSecurity, 'Setor recupera acesso após reativação', 'Teste multi-tenant perdeu a recuperação após reativação.');

requireText(view, 'as sessões ativas serão revogadas e nenhum dado será apagado', 'UX de suspensão deixou de explicar revogação e preservação de dados.');
requireText(view, 'Sessões revogadas não voltam a ser válidas', 'UX de reativação deixou de explicar que sessões antigas não retornam.');
requireText(billingPanel, 'Billing não suspende o acesso automaticamente', 'UI de billing deixou de separar cobrança de enforcement.');

requireText(packageJson, '"verify:saas-r1-security-enforcement"', 'package.json não expõe o guard SAAS-DS.');
requireText(ci, 'SAAS R1 security enforcement guard', 'Application CI não executa o guard SAAS-DS.');

if (findings.length > 0) {
  console.error('SAAS-DS — SEGURANÇA E ENFORCEMENT: FAIL\n');
  findings.forEach((finding) => console.error('- ' + finding));
  process.exit(1);
}

console.log('SAAS-DS — SEGURANÇA E ENFORCEMENT: READY');
console.log('Founder-only lifecycle API: READY');
console.log('Workspace/account atomic authorization: READY');
console.log('Session revocation: READY');
console.log('Warehouse lifecycle enforcement: READY');
console.log('Billing decoupling / VIP compatibility: READY');
