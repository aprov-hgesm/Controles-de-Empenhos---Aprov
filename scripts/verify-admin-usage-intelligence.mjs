#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

const adminPage = read('app/admin/page.tsx');
const hub = read('components/admin/AdminConsumptionHub.tsx');
const reports = read('components/admin/AdminUsageReportsPanel.tsx');
const history = read('lib/platformAdminUsageHistory.ts');
const monitoring = read('lib/server/googleCloudMonitoring.ts');
const historyServer = read('lib/server/globalUsageHistory.ts');
const globalRoute = read('app/api/admin/firebase-global-usage/route.ts');
const rules = read('firestore.rules');
const docs = read('docs/ADMIN_USAGE_INTELLIGENCE.md');

for (const marker of [
  'HGESM_WORKSPACE_ID',
  'createHgesmFoundingWorkspace()',
  'adminWorkspaces',
]) {
  requireText(adminPage, marker, `Admin deixou de garantir HGeSM fundador: ${marker}`);
}

for (const marker of [
  "type ConsumptionTab = 'quota' | 'reports'",
  "useState<ConsumptionTab>('quota')",
  'Cota diária',
  'Histórico & Relatórios',
  '<AdminUsageReportsPanel',
]) {
  requireText(hub, marker, `Hub de consumo perdeu prioridade de cota/relatórios: ${marker}`);
}

for (const marker of [
  "type UsageReportPeriod = 'daily' | 'weekly' | 'monthly' | 'annual'",
  "collection(db, 'platformUsageHistory')",
  "'usageEstimates'",
  'orderBy(documentId())',
]) {
  requireText(history, marker, `Histórico administrativo perdeu contrato: ${marker}`);
}

forbidText(history, 'onSnapshot(', 'Histórico de consumo não pode abrir listener realtime.');

for (const marker of [
  'monitoringCredentialCandidates',
  'firebase-admin',
  'dedicated-monitoring',
  'for (const credentials of candidates)',
  'billable_read_units',
]) {
  requireText(monitoring, marker, `Leitor resiliente do Monitoring perdeu requisito: ${marker}`);
}

for (const marker of [
  'platformUsageHistory',
  "method: 'PATCH'",
  'readQuotaPercentage',
  'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON',
]) {
  requireText(historyServer, marker, `Persistência histórica global perdeu requisito: ${marker}`);
}

requireText(
  globalRoute,
  'persistGlobalUsageObservation',
  'Rota global não persiste fotografia diária.'
);
requireText(
  globalRoute,
  'CLOUD_MONITORING_PERMISSION_DENIED',
  'Rota global perdeu diagnóstico de permissão.'
);

for (const marker of [
  'match /platformUsageHistory/{dayKey}',
  'allow get, list: if isPlatformAdmin();',
  'allow create, update, delete: if false;',
]) {
  requireText(rules, marker, `Rules do histórico global perderam proteção: ${marker}`);
}

for (const marker of [
  'Diário',
  'Semanal',
  'Mensal',
  'Anual',
  'Exportar CSV',
  'Cota global hoje',
  'HGeSM · conta fundadora',
  'não separa a cobrança por UG',
]) {
  requireText(reports, marker, `Painel histórico perdeu requisito visual/semântico: ${marker}`);
}

forbidText(reports, 'onSnapshot(', 'Painel histórico não pode abrir listener realtime.');

for (const marker of [
  'Global real',
  'Por UG',
  '50.000/dia',
  'hgesm-aprov',
  '160416',
  'getDocs',
  'listeners adicionais',
]) {
  requireText(docs, marker, `Documentação da inteligência de consumo perdeu requisito: ${marker}`);
}

if (findings.length) {
  console.error('ADMIN USAGE INTELLIGENCE: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('ADMIN USAGE INTELLIGENCE: READY');
  console.log('Cota principal: FIRESTORE ENTERPRISE BILLABLE READ UNITS');
  console.log('HGeSM fundador: INCLUÍDO');
  console.log('Histórico: DIÁRIO / SEMANAL / MENSAL / ANUAL');
  console.log('UG: ATRIBUIÇÃO ESTIMADA E SEPARADA');
  console.log('Realtime histórico: NENHUM LISTENER');
}
