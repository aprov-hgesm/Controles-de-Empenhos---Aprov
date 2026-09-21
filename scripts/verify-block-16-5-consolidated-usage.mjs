import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const panel = read('components/admin/AdminConsolidatedUsagePanel.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const consumptionHub = read('components/admin/AdminConsumptionHub.tsx');
const docs = read('docs/BLOCK_16_5_CONSOLIDATED_USAGE_DASHBOARD.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

for (const marker of [
  'data-testid="admin-consolidated-usage-panel"',
  'Bloco 16.5 · visão consolidada',
  'Painel consolidado de consumo',
  'google-cloud-monitoring',
  'emprovex-workspace-estimate',
  'getDefaultSimultaneousSessionLimit',
  'isAdminWorkspaceSessionActive',
  'Participação calculada somente sobre a soma das estimativas EMPROVEX',
  'data-testid="admin-primary-billing-quota"',
  'Limite principal de cota · Read Units',
  'api/billable_read_units',
  'cobrança monetária final continua no Google Cloud Billing',
]) {
  requireText(panel, marker, `Painel 16.5 perdeu requisito: ${marker}`);
}

for (const forbidden of [
  'onSnapshot(',
  'getDoc(',
  'getDocs(',
  'setDoc(',
  'updateDoc(',
  'deleteDoc(',
  'runTransaction(',
  'collectionGroup(',
]) {
  forbidText(
    panel,
    forbidden,
    `Painel consolidado abriu acesso Firestore próprio indevido: ${forbidden}`
  );
}

requireText(
  adminView,
  "import { AdminConsumptionHub } from './AdminConsumptionHub';",
  'PlatformAdminView não importa o hub de consumo.'
);
requireText(
  adminView,
  '<AdminConsumptionHub',
  'PlatformAdminView não renderiza o hub de consumo.'
);
for (const marker of [
  "import { AdminConsolidatedUsagePanel } from './AdminConsolidatedUsagePanel';",
  "import { AdminGlobalUsagePanel } from './AdminGlobalUsagePanel';",
  "import { AdminUsagePanel } from './AdminUsagePanel';",
  '<AdminConsolidatedUsagePanel',
  '<AdminGlobalUsagePanel',
  '<AdminUsagePanel',
]) {
  requireText(
    consumptionHub,
    marker,
    `Hub de consumo perdeu requisito 16.5: ${marker}`
  );
}

const globalIndex = consumptionHub.indexOf('<AdminGlobalUsagePanel');
const reportsIndex = consumptionHub.indexOf('<AdminUsageReportsPanel');
const consolidatedIndex = consumptionHub.indexOf('<AdminConsolidatedUsagePanel');
const workspaceIndex = consumptionHub.indexOf('<AdminUsagePanel');
if (
  globalIndex < 0
  || reportsIndex < 0
  || consolidatedIndex < 0
  || workspaceIndex < 0
  || !(globalIndex < reportsIndex && reportsIndex < consolidatedIndex && consolidatedIndex < workspaceIndex)
) {
  findings.push('Ordem principal Cota -> Relatórios -> Consolidado -> UG foi alterada no hub.');
}

for (const marker of [
  'sem criar uma terceira fonte de verdade',
  'participação por UG nunca é apresentada como rateio da fatura global',
  'edição Enterprise',
  'api/billable_read_units',
  '50.000 unidades por dia',
  'não um valor monetário fechado',
  'não altera:',
  'Firestore Rules',
  'Google Drive por workspace',
  'nenhum deploy Vercel',
]) {
  requireText(docs, marker, `Documentação 16.5 perdeu requisito: ${marker}`);
}

requireText(
  pkg,
  '"verify:block-16-5-consolidated-usage"',
  'package.json não registra o guard do Bloco 16.5.'
);
requireText(
  workflow,
  'Block 16.5 consolidated usage dashboard guard',
  'Application CI não executa o guard do Bloco 16.5.'
);

if (findings.length) {
  console.error('BLOCK 16.5 CONSOLIDATED USAGE DASHBOARD: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.5 CONSOLIDATED USAGE DASHBOARD: READY');
  console.log('Global real: GOOGLE CLOUD MONITORING');
  console.log('Por UG: ESTIMATIVA EMPROVEX');
  console.log('Sessões: REUTILIZADAS DO BLOCO 16.2');
  console.log('Firestore adicional no painel: NENHUM');
  console.log('Cota principal: READ UNITS ENTERPRISE / LIMITE DIÁRIO PARAMETRIZADO');
  console.log('Deploy Vercel: NÃO REALIZADO');
}
