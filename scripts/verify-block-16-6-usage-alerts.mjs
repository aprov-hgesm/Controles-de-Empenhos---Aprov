import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(content, needle, message) {
  if (!content.includes(needle)) {
    throw new Error(message);
  }
}

const capacity = read('lib/platformCapacity.ts');
const alerts = read('lib/usageAlerts.ts');
const policy = read('lib/server/usageAlertPolicy.ts');
const route = read('app/api/admin/usage-alert-policy/route.ts');
const requestSecurity = read('lib/server/requestSecurity.ts');
const panel = read('components/admin/AdminConsolidatedUsagePanel.tsx');
const docs = read('docs/BLOCK_16_6_USAGE_ALERTS.md');
const rules = read('firestore.rules');

for (const threshold of ['0.95', '0.85', '0.7']) {
  requireText(
    capacity,
    threshold,
    `assessUsageBudget deixou de preservar o limiar ${threshold}.`
  );
}

requireText(alerts, 'assessUsageBudget', 'O motor 16.6 deve reutilizar assessUsageBudget.');
requireText(alerts, "'global-real'", 'Alertas globais reais precisam manter origem própria.');
requireText(alerts, "'workspace-estimate'", 'Alertas por UG precisam manter origem estimada própria.');
requireText(policy, 'EMPROVEX_GLOBAL_DAILY_USAGE_REFERENCE_JSON', 'Referência global explícita ausente.');
requireText(policy, 'EMPROVEX_WORKSPACE_DAILY_USAGE_BUDGETS_JSON', 'Orçamentos por UG explícitos ausentes.');
requireText(route, 'verifyFounderFirebaseRequest', 'Rota de política deve permanecer founder-only.');
requireText(route, 'securityResponseHeaders', 'Rota deve aplicar headers de segurança centralizados.');
requireText(
  requestSecurity,
  "'Cache-Control': 'private, no-store, max-age=0'",
  'Rota deve impedir cache compartilhado via camada central.'
);
requireText(panel, 'Alertas de consumo/cotas', 'Painel consolidado deve exibir a seção de alertas.');
requireText(panel, 'não representam cobrança oficial', 'Painel deve preservar o aviso de cobrança.');
requireText(docs, 'não gera alerta de orçamento', 'Documentação deve tratar ausência de referência sem falso positivo.');
requireText(docs, 'não calcula USD, BRL ou fatura estimada', 'Documentação deve separar alertas de cobrança.');
requireText(docs, 'Nenhum deploy Vercel', 'Documentação deve preservar bloqueio de deploy.');

if (rules.includes('usage-alert-policy') || rules.includes('usageAlertPolicy')) {
  throw new Error('O Bloco 16.6 não deve introduzir política de alertas nas Firestore Rules.');
}

console.log('Bloco 16.6: alertas de consumo/cotas verificados.');
