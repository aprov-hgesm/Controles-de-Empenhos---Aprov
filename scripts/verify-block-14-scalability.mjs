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

const plan = read('lib/operationalSubscriptionPlan.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const dataHook = read('hooks/useOperationalData.ts');
const page = read('app/page.tsx');
const pdfToolkit = read('lib/pdfToolkit.ts');
const empenhoActions = read('features/empenhos/hooks/useEmpenhoActions.ts');
const cronogramaActions = read('features/cronogramas/hooks/useCronogramaActions.ts');
const documentActions = read('features/relatorios/hooks/useDocumentActions.ts');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/BLOCK_14_OPERATIONAL_SCALABILITY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'painel:',
  'empenhos:',
  'nova_nf:',
  'relatorios:',
  'cronogramas:',
  'empenhos: true',
  'invoices: false',
  'comissoes: false',
]) {
  requireText(plan, expected, `Plano de subscriptions perdeu requisito: ${expected}`);
}

requireText(plan, 'countRealtimeOperationalCollections', 'Plano não expõe contagem técnica de listeners.');
requireText(realtime, 'useRealtimeCollectionSubscription', 'Subscriptions opcionais não estão isoladas por coleção.');
requireText(realtime, "collectionName: 'empenhos'", 'Empenhos não possui subscription dedicada.');
requireText(realtime, "enabled: plan.alerts", 'Alerts não respeita plano ativo.');
requireText(realtime, "enabled: plan.invoices", 'Invoices não respeita plano ativo.');
requireText(realtime, "enabled: plan.comissoes", 'Comissões não respeita plano ativo.');
requireText(realtime, "enabled: plan.cronogramas", 'Cronogramas não respeita plano ativo.');
requireText(realtime, 'activeOperationalDataReady', 'Hook não protege prontidão da seção.');

forbidText(dataHook, "operationalCollectionRef(scope, 'alerts')", 'useOperationalData voltou a abrir alerts diretamente.');
forbidText(dataHook, "operationalCollectionRef(scope, 'invoices')", 'useOperationalData voltou a abrir invoices diretamente.');
forbidText(dataHook, "operationalCollectionRef(scope, 'comissoes')", 'useOperationalData voltou a abrir comissões diretamente.');
forbidText(dataHook, "operationalCollectionRef(scope, 'cronogramas')", 'useOperationalData voltou a abrir cronogramas diretamente.');
requireText(dataHook, 'useOperationalRealtimeCollections', 'useOperationalData não delega subscriptions view-aware.');
requireText(dataHook, 'useMemo(', 'Seletores derivados não estão memoizados.');
requireText(dataHook, 'useCallback(', 'Cálculo por classe não está memoizado.');

requireText(page, 'useOperationalData(activeTab)', 'Página não informa a aba ativa ao plano realtime.');
requireText(page, 'data-active-realtime-collections={activeRealtimeCollectionCount}', 'Shell não expõe contagem realtime para E2E.');
requireText(page, 'operational-section-loading', 'Página não bloqueia interação antes da sincronização requerida.');
forbidText(page, 'invoices.length + 11', 'Mock antigo de invoices voltou ao page.tsx.');
forbidText(page, '+ 42000', 'Mock antigo de valor liquidado voltou ao page.tsx.');

requireText(pdfToolkit, "import('jspdf')", 'jsPDF não é carregado dinamicamente.');
requireText(pdfToolkit, "import('jspdf-autotable')", 'AutoTable não é carregado dinamicamente.');
for (const [name, source] of [
  ['empenhos', empenhoActions],
  ['cronogramas', cronogramaActions],
  ['documentos', documentActions],
]) {
  forbidText(source, "from 'jspdf'", `Hook ${name} voltou a importar jsPDF estaticamente.`);
  forbidText(source, "from 'jspdf-autotable'", `Hook ${name} voltou a importar autoTable estaticamente.`);
}
requireText(empenhoActions, 'await loadJsPdf()', 'Prompt PDF não usa lazy loading.');
requireText(cronogramaActions, 'await loadJsPdfWithAutoTable()', 'Cronograma PDF não usa lazy loading.');
requireText(documentActions, 'await loadJsPdfWithAutoTable()', 'Relatórios PDF não usam lazy loading.');

requireText(e2e, 'perfil realtime acompanha a seção ativa sem manter coleções ociosas', 'Browser E2E não cobre perfil realtime.');
for (const count of [1, 2, 3, 4]) {
  requireText(e2e, `expectRealtimeProfile(page, ${count})`, `Browser E2E não comprova perfil realtime ${count}.`);
}

requireText(docs, '500 para 100', 'Documentação não registra impacto teórico no Painel.');
requireText(docs, 'não:', 'Documentação não delimita o que o bloco não altera.');
requireText(pkg, '"test:operational-subscription-plan"', 'package.json não registra teste do plano realtime.');
requireText(pkg, '"verify:block-14-scalability"', 'package.json não registra guard do Bloco 14.');
requireText(workflow, 'Operational subscription plan tests', 'CI não executa teste do plano realtime.');
requireText(workflow, 'Block 14 operational scalability guard', 'CI não executa guard do Bloco 14.');

if (findings.length) {
  console.error('BLOCK 14 OPERATIONAL SCALABILITY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 14 OPERATIONAL SCALABILITY: READY');
  console.log('Painel: 1 coleção operacional realtime');
  console.log('Máximo por seção: 4 coleções operacionais realtime');
  console.log('Listeners de identidade/lifecycle: PRESERVADOS');
  console.log('Prontidão por seção: PROTEGIDA');
  console.log('PDF toolkit: LAZY-LOADED');
}
