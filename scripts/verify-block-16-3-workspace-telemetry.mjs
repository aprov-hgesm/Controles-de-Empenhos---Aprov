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

const telemetry = read('lib/workspaceUsageTelemetry.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const operational = read('hooks/useOperationalData.ts');
const lease = read('lib/platformSessionLease.ts');
const sync = read('lib/firebaseSync.ts');
const concurrency = read('lib/empenhoConcurrencyService.ts');
const adminUsage = read('lib/platformAdminUsage.ts');
const adminHook = read('hooks/usePlatformAdminUsage.ts');
const panel = read('components/admin/AdminUsagePanel.tsx');
const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const capacity = read('lib/platformCapacity.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const docs = read('docs/BLOCK_16_3_WORKSPACE_TELEMETRY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  "WORKSPACE_USAGE_SOURCE = 'emprovex-workspace-estimate'",
  'WORKSPACE_USAGE_INITIAL_FLUSH_MS = 60 * 1000',
  'WORKSPACE_USAGE_FLUSH_INTERVAL_MS = 15 * 60 * 1000',
  'sessionStorage',
  'increment(',
  'serverTimestamp()',
  "usageEstimates",
  'recordWorkspaceRealtimeSnapshot',
  'trackWorkspaceRealtimeListener',
]) requireText(telemetry, marker, `Buffer de telemetria perdeu requisito: ${marker}`);

forbidText(
  telemetry,
  'onSnapshot(',
  'O buffer de telemetria não pode abrir listener próprio.'
);
forbidText(
  telemetry,
  'getDoc(',
  'A consolidação da telemetria não pode fazer leitura prévia do próprio contador.'
);

for (const marker of [
  'recordWorkspaceRealtimeSnapshot',
  'firstSnapshot ? snapshot.size : snapshot.docChanges().length',
  'trackWorkspaceRealtimeListener',
]) requireText(realtime, marker, `Realtime operacional não está instrumentado: ${marker}`);

for (const marker of [
  'recordWorkspaceRealtimeSnapshot(telemetryScope, 1)',
  'stopWorkspaceListenerTelemetry',
  'stopAccountListenerTelemetry',
]) requireText(operational, marker, `Watchers de lifecycle perderam telemetria: ${marker}`);

for (const marker of [
  '{ documentReads: 3, documentWrites: 1 }',
  'documentDeletes: deleted ? 1 : 0',
  'recordWorkspaceRealtimeSnapshot(telemetryScope, 1)',
  'trackWorkspaceRealtimeListener',
]) requireText(lease, marker, `Lease de sessão perdeu atribuição de consumo: ${marker}`);

for (const marker of [
  'recordWorkspaceDocumentReads',
  'recordWorkspaceDocumentWrites',
  'recordWorkspaceDocumentDeletes',
]) requireText(sync, marker, `firebaseSync perdeu medidor: ${marker}`);

requireText(
  concurrency,
  'recordWorkspaceUsage(scope, { documentReads: 1, documentWrites: 1 })',
  'Concorrência de empenho não atribui a transação à UG.'
);

for (const marker of [
  "getDoc(",
  "'usageEstimates'",
  'AdminWorkspaceUsageEstimate',
]) requireText(adminUsage, marker, `Leitor administrativo perdeu requisito: ${marker}`);
forbidText(adminUsage, 'onSnapshot(', 'Painel de consumo não pode manter listener realtime.');
forbidText(adminUsage, 'collectionGroup(', 'Painel de consumo não deve usar collection-group.');

requireText(adminHook, 'loadPlatformWorkspaceUsage', 'Hook administrativo não carrega telemetria.');
for (const marker of [
  'Consumo estimado por UG',
  'não são a cobrança oficial do Firebase',
  'Cloud Monitoring',
  'emprovex-workspace-estimate',
  'Atualizar estimativas',
]) requireText(panel, marker, `Painel perdeu aviso/controle: ${marker}`);

requireText(adminPage, 'usePlatformAdminUsage', 'Página admin não conecta telemetria.');
requireText(adminView, '<AdminUsagePanel', 'Console administrativo não renderiza telemetria.');

requireText(
  capacity,
  "source: 'google-cloud-monitoring'",
  'Contrato global real deixou de apontar para Cloud Monitoring.'
);
requireText(
  capacity,
  "source: 'emprovex-workspace-estimate'",
  'Contrato por UG deixou de ser explicitamente estimado.'
);

for (const marker of [
  'validWorkspaceUsageEstimate',
  "request.resource.data.telemetryVersion == 'emprovex_usage_v1'",
  "request.resource.data.source == 'emprovex-workspace-estimate'",
  'request.resource.data.ug == workspace.ug',
  'request.resource.data.estimatedDocumentReads >= resource.data.estimatedDocumentReads',
  'request.resource.data.telemetryFlushes > resource.data.telemetryFlushes',
  'match /workspaces/{workspaceId}/usageEstimates/{dayKey}',
  'allow get, list: if isPlatformAdmin();',
  'allow delete: if false;',
]) requireText(rules, marker, `Rules perderam proteção 16.3: ${marker}`);

for (const marker of [
  'Setor grava telemetria estimada somente no próprio workspace/UG',
  'Setor incrementa apenas contadores monotônicos da própria UG',
  'Setor não pode reduzir contador consolidado de telemetria',
  'Setor não pode falsificar UG na própria telemetria',
  'Outro workspace não grava telemetria no Setor A',
  'Setor operacional não lê o documento administrativo de telemetria',
  'Administrador lê a estimativa consolidada por UG',
  'Telemetria diária não pode ser apagada pelo setor',
]) requireText(security, marker, `Emulator perdeu cenário 16.3: ${marker}`);

for (const marker of [
  'não grava uma linha de telemetria a cada leitura',
  'uma vez a cada 15 minutos',
  'google-cloud-monitoring',
  'não introduz Vercel Blob nem Firebase Storage',
]) requireText(docs, marker, `Documentação 16.3 perdeu requisito: ${marker}`);

requireText(pkg, '"verify:block-16-3-workspace-telemetry"', 'package.json não registra guard 16.3.');
requireText(workflow, 'Block 16.3 workspace telemetry guard', 'Application CI não executa guard 16.3.');

if (findings.length) {
  console.error('BLOCK 16.3 WORKSPACE TELEMETRY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.3 WORKSPACE TELEMETRY: READY');
  console.log('Consumo por UG: ESTIMATIVA EMPROVEX');
  console.log('Flush por leitura: DESATIVADO');
  console.log('Consolidação: BUFFER LOCAL + BAIXA FREQUÊNCIA');
  console.log('Painel fundador: GET PONTUAL / SEM LISTENER GLOBAL');
  console.log('Firebase global real: RESERVADO PARA CLOUD MONITORING');
}
