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

const auth = read('lib/server/firebaseFounderAuth.ts');
const monitoring = read('lib/server/googleCloudMonitoring.ts');
const route = read('app/api/admin/firebase-global-usage/route.ts');
const requestSecurity = read('lib/server/requestSecurity.ts');
const hook = read('hooks/usePlatformAdminGlobalUsage.ts');
const panel = read('components/admin/AdminGlobalUsagePanel.tsx');
const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const consumptionHub = read('components/admin/AdminConsumptionHub.tsx');
const docs = read('docs/BLOCK_16_4_GLOBAL_CLOUD_MONITORING.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  'createRemoteJWKSet',
  'jwtVerify',
  'securetoken@system.gserviceaccount.com',
  'audience: firebaseConfig.projectId',
  'email !== HGESM_SECTOR_EMAIL',
]) requireText(auth, marker, `Auth fundador perdeu requisito: ${marker}`);

for (const marker of [
  'https://www.googleapis.com/auth/monitoring.read',
  'EMPROVEX_GCP_MONITORING_CLIENT_EMAIL',
  'EMPROVEX_GCP_MONITORING_PRIVATE_KEY',
  'firestore.googleapis.com/document/read_ops_count',
  'firestore.googleapis.com/document/write_ops_count',
  'firestore.googleapis.com/document/delete_ops_count',
  'firestore.googleapis.com/network/active_connections',
  'firestore.googleapis.com/network/snapshot_listeners',
  'resource.type = "firestore.googleapis.com/Database"',
  'resource.labels.database_id',
  'firebaseConfig.firestoreDatabaseId',
  "source: 'google-cloud-monitoring'",
]) requireText(monitoring, marker, `Cloud Monitoring perdeu requisito: ${marker}`);

forbidText(monitoring, 'NEXT_PUBLIC_', 'Credencial sensível não pode usar NEXT_PUBLIC_.');

for (const marker of [
  "runtime = 'nodejs'",
  'verifyFounderFirebaseRequest',
  'isGoogleCloudMonitoringConfigured',
  'loadFirebaseGlobalUsageObservation',
  'CLOUD_MONITORING_NOT_CONFIGURED',
  'securityResponseHeaders',
]) requireText(route, marker, `Rota global perdeu proteção: ${marker}`);

requireText(
  requestSecurity,
  "'Cache-Control': 'private, no-store, max-age=0'",
  'Rota global perdeu proteção no-store centralizada.'
);

for (const marker of [
  'adminUser.getIdToken()',
  "fetch('/api/admin/firebase-global-usage'",
  'authorization:',
  'CLOUD_MONITORING_NOT_CONFIGURED',
]) requireText(hook, marker, `Hook global perdeu requisito: ${marker}`);

for (const marker of [
  'Consumo global real do Firebase',
  'google-cloud-monitoring',
  'não representa a fatura final',
  'estimativa por UG',
]) requireText(panel, marker, `Painel global perdeu separação: ${marker}`);

requireText(adminPage, 'usePlatformAdminGlobalUsage', 'Página admin não conecta consumo global.');
requireText(adminView, '<AdminConsumptionHub', 'Console admin não renderiza o hub de consumo.');
requireText(consumptionHub, '<AdminGlobalUsagePanel', 'Hub de consumo não preserva o painel global.');

for (const marker of [
  'sempre no servidor',
  'roles/monitoring.viewer',
  'não tenta transformar a soma das UGs',
  'Nenhum deploy Vercel',
]) requireText(docs, marker, `Documentação 16.4 perdeu requisito: ${marker}`);

requireText(pkg, '"verify:block-16-4-global-monitoring"', 'package.json não registra guard 16.4.');
requireText(workflow, 'Block 16.4 global Cloud Monitoring guard', 'Application CI não executa guard 16.4.');

if (findings.length) {
  console.error('BLOCK 16.4 GLOBAL CLOUD MONITORING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.4 GLOBAL CLOUD MONITORING: READY');
  console.log('Métrica global: GOOGLE CLOUD MONITORING / SERVER-SIDE');
  console.log('Autorização: FIREBASE ID TOKEN + CONTA FUNDADORA');
  console.log('Credenciais no cliente: PROIBIDAS');
  console.log('Banco: FIRESTORE DATABASE ID NOMEADO');
  console.log('Estimativa por UG: PRESERVADA E SEPARADA');
}
