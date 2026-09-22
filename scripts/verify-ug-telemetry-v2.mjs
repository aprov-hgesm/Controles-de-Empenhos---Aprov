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

const billingDay = read('lib/firestoreBillingDay.ts');
const telemetry = read('lib/workspaceUsageTelemetry.ts');
const monitoring = read('lib/server/googleCloudMonitoring.ts');
const history = read('lib/platformAdminUsageHistory.ts');
const reconciliation = read('lib/usageReconciliation.ts');
const consolidated = read('components/admin/AdminConsolidatedUsagePanel.tsx');
const reports = read('components/admin/AdminUsageReportsPanel.tsx');
const docs = read('docs/UG_TELEMETRY_V2_RECONCILIATION.md');

for (const marker of [
  "FIRESTORE_BILLING_TIME_ZONE = 'America/Los_Angeles'",
  'getFirestoreBillingDayKey',
  'getFirestoreBillingDayWindow',
  'shiftFirestoreBillingDayKey',
]) requireText(billingDay, marker, `Janela de faturamento perdeu requisito: ${marker}`);

for (const marker of [
  'getFirestoreBillingDayKey(date)',
  'getFirestoreBillingDayWindow(requestedDayKey)',
  'windowStartedAt: billingWindow.startedAt',
  'windowEndedAt: billingWindow.endedAt',
]) requireText(telemetry, marker, `Telemetria UG não está alinhada ao billing day: ${marker}`);

for (const marker of [
  'getFirestoreBillingDayKey(now)',
  'getFirestoreBillingDayWindow(billingDayKey)',
  'shiftFirestoreBillingDayKey(currentDayKey, -1)',
]) requireText(monitoring, marker, `Monitoring perdeu janela compartilhada: ${marker}`);

for (const marker of [
  'getFirestoreBillingDayKey(now)',
  'shiftFirestoreBillingDayKey(endDayKey, -6)',
]) requireText(history, marker, `Histórico perdeu janela compartilhada: ${marker}`);

for (const marker of [
  "USAGE_RECONCILIATION_VERSION = 'emprovex_usage_reconciliation_v1'",
  'readCoverage',
  'writeCoverage',
  'unattributed',
  'overAttributed',
  'estimatedBillableReadUnits',
  'estimatedUnattributedReadUnits',
  'mismatchedUsageCount',
]) requireText(reconciliation, marker, `Reconciliação perdeu contrato: ${marker}`);

forbidText(reconciliation, 'onSnapshot(', 'Reconciliação não pode abrir listener.');
forbidText(reconciliation, 'setDoc(', 'Reconciliação não pode persistir rateio.');
forbidText(reconciliation, 'updateDoc(', 'Reconciliação não pode persistir rateio.');

for (const marker of [
  'admin-usage-reconciliation-v2',
  'Telemetria por UG v2 · reconciliação',
  'Cobertura reads',
  'Reads não atribuídos',
  'Proxy Read Units não atribuídas',
  'parcela não atribuída nunca é redistribuída artificialmente',
  'Read Units proxy',
]) requireText(consolidated, marker, `Painel consolidado perdeu reconciliação: ${marker}`);

for (const marker of [
  'Read Units proxy UG',
  'admin-usage-report-reconciliation',
  'Cobertura global de reads',
  'A parcela restante não é redistribuída artificialmente',
]) requireText(reports, marker, `Relatório perdeu reconciliação: ${marker}`);

for (const marker of [
  'America/Los_Angeles',
  'cobertura = reads atribuídos às UGs / document reads observados pelo Google',
  'nunca é redistribuída artificialmente',
  'não é faturamento oficial',
  'não cria listeners administrativos',
]) requireText(docs, marker, `Documentação v2 perdeu requisito: ${marker}`);

if (findings.length) {
  console.error('UG TELEMETRY V2 RECONCILIATION: FAIL');
  findings.forEach((finding) => console.error(`  [V2] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('UG TELEMETRY V2 RECONCILIATION: READY');
  console.log('Billing day: AMERICA/LOS_ANGELES');
  console.log('Global real: GOOGLE CLOUD MONITORING');
  console.log('UG: EMPROVEX ATTRIBUTION');
  console.log('Coverage: EXPLICIT');
  console.log('Unattributed share: PRESERVED');
  console.log('Read Units by UG: PROXY / NOT OFFICIAL BILLING');
  console.log('Additional realtime admin listeners: NONE');
}
