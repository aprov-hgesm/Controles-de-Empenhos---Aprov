#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const findings = [];
const read = (path) => readFileSync(path, 'utf8');
const requireText = (source, marker, message) => {
  if (!source.includes(marker)) findings.push(message);
};
const forbidText = (source, marker, message) => {
  if (source.includes(marker)) findings.push(message);
};

const admin = read('components/admin/PlatformAdminView.tsx');
const consumption = read('components/admin/AdminConsumptionHub.tsx');
const google = read('components/admin/AdminGlobalUsagePanel.tsx');
const monitoring = read('lib/server/googleCloudMonitoring.ts');
const globalUsageHook = read('hooks/usePlatformAdminGlobalUsage.ts');
const reconciliation = read('lib/usageReconciliation.ts');

for (const marker of [
  'data-layout="sidebar"',
  'lg:grid-cols-[248px_minmax(0,1fr)]',
  'aria-label="Áreas administrativas"',
  "activeTabConfig.description",
  "id: 'consumo'",
  "id: 'assinaturas'",
]) requireText(admin, marker, `Admin sidebar perdeu requisito: ${marker}`);

for (const marker of [
  'data-testid="admin-consumption-sidebar"',
  'Google real · Cota diária',
  'Visão consolidada',
  'Consumo por UG',
  'Histórico & Relatórios',
  'Alertas e limites',
]) requireText(consumption, marker, `Consumo sidebar perdeu requisito: ${marker}`);

for (const marker of [
  'data-testid="google-usage-diagnostics"',
  'Último ponto Google',
  'Defasagem',
  'Banco Firestore nomeado',
  'Janela diária diferente do horário do Brasil',
  'Read Units e documentos lidos são métricas diferentes',
  'Google é global; UG é atribuição interna',
  'Frescor de cada métrica Google',
  'GOOGLE_METRIC_LABELS',
  'Read Units faturáveis',
  'Realtime Read Units',
  'Write Units faturáveis',
]) requireText(google, marker, `Painel Google perdeu diagnóstico/visualização: ${marker}`);

for (const marker of [
  'resource.labels.database_id',
  'firebaseConfig.firestoreDatabaseId',
  'google-cloud-monitoring',
  'America/Los_Angeles',
  'metricDataThrough',
  'credentialSource',
]) requireText(monitoring, marker, `Leitor Google perdeu requisito técnico: ${marker}`);

for (const marker of [
  'metricDataThrough',
  'credentialSource',
  'setMetricDataThrough',
  'setCredentialSource',
]) requireText(globalUsageHook, marker, `Hook Google perdeu diagnóstico: ${marker}`);

for (const marker of [
  'readCoverage',
  'estimatedBillableReadUnits',
  'estimatedUnattributedReadUnits',
]) requireText(reconciliation, marker, `Reconciliação por UG perdeu requisito: ${marker}`);

forbidText(google, 'NEXT_PUBLIC_', 'Diagnóstico Google não pode expor credenciais client-side.');
forbidText(consumption, 'onSnapshot(', 'Hub de consumo não deve criar novo listener realtime.');

if (findings.length) {
  console.error('ADMIN SIDEBAR + GOOGLE USAGE UX: FAIL');
  findings.forEach((finding) => console.error(`  [UX] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('ADMIN SIDEBAR + GOOGLE USAGE UX: READY');
  console.log('Navegação admin: SIDEBAR RESPONSIVA');
  console.log('Hub de consumo: SIDEBAR INTERNA');
  console.log('Google real: VISUALIZAÇÃO + FRESCOR POR MÉTRICA + DIAGNÓSTICO');
  console.log('UG: RECONCILIAÇÃO V2 PRESERVADA');
  console.log('Novos listeners admin: NENHUM');
}
