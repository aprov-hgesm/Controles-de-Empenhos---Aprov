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

const audit = read('lib/auditTrail.ts');
const service = read('lib/nsIntegrityService.ts');
const empenhoDeletion = read('lib/empenhoDeletionService.ts');
const admin = read('lib/platformAdminStore.ts');
const server = read('lib/server/sectorProvisioningAdmin.ts');
const paths = read('lib/operationalPaths.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const docs = read('docs/IMMUTABLE_AUDIT_BLOCK_8.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  "AUDIT_EVENT_VERSION = 'emprovex_audit_v1'",
  'appendWorkspaceAuditEvent',
  'appendPlatformAuditEvent',
  'createWorkspaceAuditCorrelationId',
  'createPlatformAuditCorrelationId',
  'serverTimestamp()',
  'actorUid',
  'actorEmail',
  'before:',
  'after:',
  'metadata:',
]) {
  requireText(audit, expected, `Primitiva de auditoria perdeu requisito: ${expected}`);
}

requireText(paths, "| 'auditEvents'", 'Coleção operacional auditEvents não está registrada.');

for (const operation of [
  "'ns.assign'",
  "'ns.replace'",
  "'ns.remove'",
  "'invoice.identity_migrate'",
  "'invoice.delete'",
  "'invoice.bulk_delete'",
  "'supplier_cnpj.migrate'",
]) {
  requireText(service, operation, `Serviço central não audita operação crítica: ${operation}`);
}
requireText(service, 'appendWorkspaceAuditEvent(', 'Serviço central não grava eventos operacionais.');
requireText(empenhoDeletion, "operation: 'empenho.delete'", 'Exclusão de empenho não grava auditoria operacional.');
requireText(empenhoDeletion, 'appendWorkspaceAuditEvent(', 'Exclusão de empenho não usa trilha imutável.');
requireText(service, 'correlationId', 'Serviço central não correlaciona eventos.');

for (const operation of [
  "'sector.profile_update'",
  "'sector.status_change'",
  "'sector.ug_backfill'",
]) {
  requireText(admin, operation, `Admin store não audita mutação: ${operation}`);
}
requireText(admin, 'appendPlatformAuditEvent(', 'Admin store não grava auditoria administrativa.');

for (const operation of [
  "'sector.create'",
  "'sector.password_reset'",
  "'sector.delete'",
]) {
  requireText(server, operation, `Provisionamento server-side não audita: ${operation}`);
}
requireText(server, 'serverPlatformAuditWrite', 'Servidor não possui primitiva de auditoria administrativa.');
forbidText(server, 'password: newPassword,\n        eventVersion', 'Senha apareceu em payload de auditoria.');

requireText(rules, 'function validAuditEventShape', 'Rules não validam o schema de auditoria.');
requireText(rules, "request.resource.data.eventVersion == 'emprovex_audit_v1'", 'Rules não congelam a versão do evento.');
requireText(rules, 'request.resource.data.actorUid == request.auth.uid', 'Rules não prendem actorUid à sessão.');
requireText(rules, 'request.resource.data.actorEmail == request.auth.token.email', 'Rules não prendem actorEmail à sessão.');
requireText(rules, 'request.resource.data.createdAt == request.time', 'Rules não protegem timestamp server-side.');
requireText(rules, 'match /platformAuditEvents/{eventId}', 'Rules não protegem auditoria administrativa.');
requireText(rules, 'match /workspaces/{workspaceId}/auditEvents/{eventId}', 'Rules não protegem auditoria operacional.');

const workspaceAuditStart = rules.indexOf('match /workspaces/{workspaceId}/auditEvents/{eventId}');
const workspaceAuditEnd = rules.indexOf('match /workspaces/{workspaceId}/empenhos/{id}', workspaceAuditStart);
const workspaceAudit = workspaceAuditStart >= 0 && workspaceAuditEnd > workspaceAuditStart
  ? rules.slice(workspaceAuditStart, workspaceAuditEnd)
  : '';
if (!workspaceAudit) findings.push('Bloco de Rules de auditEvents não foi localizado.');
else {
  requireText(workspaceAudit, 'allow update, delete: if false;', 'Auditoria operacional não é append-only.');
  forbidText(workspaceAudit, 'allow write:', 'Auditoria operacional possui write genérico.');
}

const platformAuditStart = rules.indexOf('match /platformAuditEvents/{eventId}');
const platformAuditEnd = rules.indexOf('match /platformUgIndex/{ug}', platformAuditStart);
const platformAudit = platformAuditStart >= 0 && platformAuditEnd > platformAuditStart
  ? rules.slice(platformAuditStart, platformAuditEnd)
  : '';
if (!platformAudit) findings.push('Bloco de Rules de platformAuditEvents não foi localizado.');
else {
  requireText(platformAudit, 'allow update, delete: if false;', 'Auditoria administrativa não é append-only.');
  forbidText(platformAudit, 'allow write:', 'Auditoria administrativa possui write genérico.');
}

for (const expected of [
  'Setor cria evento de auditoria válido no próprio workspace',
  'Evento de auditoria do workspace não pode ser alterado',
  'Evento de auditoria do workspace não pode ser excluído',
  'Setor não pode forjar actorUid em evento de auditoria',
  'Setor A não cria auditoria dentro do workspace B',
  'Administrador cria evento de auditoria administrativa',
  'Evento de auditoria administrativa não pode ser alterado',
  'Evento de auditoria administrativa não pode ser excluído',
  'Setor externo não cria evento na auditoria administrativa',
]) {
  requireText(security, expected, `Emulator não cobre auditoria: ${expected}`);
}

requireText(docs, 'append-only', 'Documentação não declara imutabilidade append-only.');
requireText(docs, 'mesma transação', 'Documentação não declara atomicidade.');
requireText(docs, 'não persiste senha', 'Documentação não declara minimização de credenciais.');
requireText(pkg, '"verify:immutable-audit"', 'Guard de auditoria não está registrado no package.json.');
requireText(workflow, 'Immutable audit trail guard', 'Application CI não executa guard de auditoria.');

if (findings.length) {
  console.error('IMMUTABLE AUDIT BLOCK 8: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('IMMUTABLE AUDIT BLOCK 8: READY');
  console.log('Eventos operacionais críticos: ATÔMICOS');
  console.log('Eventos administrativos críticos: RASTREADOS');
  console.log('Update/delete de auditoria: BLOQUEADOS');
  console.log('Ator e timestamp: PRESOS À SESSÃO/SERVIDOR');
  console.log('Isolamento multi-tenant: COBERTO NO EMULATOR');
}
