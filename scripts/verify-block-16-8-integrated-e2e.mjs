#!/usr/bin/env node

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(content, needle, message) {
  if (!content.includes(needle)) throw new Error(message);
}

function forbidText(content, needle, message) {
  if (content.includes(needle)) throw new Error(message);
}

const browserIntegrated = read('tests/e2e/block-16-integrated.spec.mjs');
const browserExisting = read('tests/e2e/operator-critical-flow.spec.mjs');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const domain = read('scripts/block-16-integrated-domain.test.mjs');
const packageJson = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const sessionsPanel = read('components/admin/AdminSessionsPanel.tsx');
const adminSessions = read('lib/platformAdminSessions.ts');
const usageHook = read('hooks/usePlatformAdminUsage.ts');
const globalUsageHook = read('hooks/usePlatformAdminGlobalUsage.ts');
const alertPolicyHook = read('hooks/usePlatformAdminUsageAlertPolicy.ts');
const consolidated = read('components/admin/AdminConsolidatedUsagePanel.tsx');
const driveGuard = read('scripts/verify-workspace-drive-storage.mjs');
const docs = read('docs/BLOCK_16_8_INTEGRATED_E2E.md');

for (const scenario of [
  'heartbeat eficiente renova lease de 30 minutos sem redescobrir capacidade',
  'slot expirado pode ser retomado por uma nova identidade de sessão',
  'duas tentativas concorrentes disputando o último slot produzem exatamente um vencedor',
  'revogação administrativa derruba a sessão, tombstone bloqueia retorno e novo login cria nova identidade',
]) {
  requireText(browserIntegrated, scenario, `Browser E2E integrado perdeu cenário: ${scenario}`);
}

for (const existingScenario of [
  'duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada',
  'Liberar a segunda sessão devolve a vaga imediatamente.',
  'segundo workspace não enxerga a NS nem o fornecedor do primeiro',
]) {
  requireText(
    browserExisting,
    existingScenario,
    `Cobertura Browser E2E pré-existente não pode regredir: ${existingScenario}`
  );
}

for (const emulatorScenario of [
  'Slot expirado pode ser retomado por uma nova sessão',
  'Administrador lista slots de sessão de toda a plataforma',
  'Administrador revoga e libera uma sessão na mesma transação',
  'Tombstone existente é imutável e não pode ser reciclado pelo administrador',
  'Administrador lê a estimativa consolidada por UG',
  'Outro workspace não grava telemetria no Setor A',
  'Duas sessões com a mesma revision não geram lost update',
]) {
  requireText(
    security,
    emulatorScenario,
    `Emulator multi-tenant perdeu requisito integrado: ${emulatorScenario}`
  );
}

for (const contract of [
  'capacidade integrada preserva fundador ilimitado, setor externo em 2 e lease/heartbeat em 30/15 minutos',
  'limiares de consumo permanecem determinísticos em 70%, 85%, 95%, 100% e acima de 100%',
  'política sem referências não fabrica alertas, franquia ou cobrança',
  'política com referências separa métrica global real de estimativa interna por UG',
  'Cloud Monitoring não configurado falha de forma segura sem chamada externa',
  'Cloud Monitoring configurado usa respostas mockadas e mantém fonte global real separada',
]) {
  requireText(domain, contract, `Contrato determinístico do Bloco 16.8 ausente: ${contract}`);
}

requireText(
  sessionsPanel,
  'data-testid="admin-sessions-panel"',
  'Painel administrativo de sessões perdeu o marcador E2E.'
);
requireText(
  adminSessions,
  'terminatePlatformWorkspaceSession',
  'Encerramento remoto administrativo não pode ser removido.'
);
for (const identityGuard of [
  "String(current.slotId || '') !== session.slotId",
  "String(current.sessionId || '') !== session.sessionId",
  "String(current.browserInstanceId || '') !== session.browserInstanceId",
]) {
  requireText(
    adminSessions,
    identityGuard,
    `Encerramento remoto perdeu validação de identidade: ${identityGuard}`
  );
}

for (const [label, source] of [
  ['telemetria estimada', usageHook],
  ['Cloud Monitoring', globalUsageHook],
  ['política de alertas', alertPolicyHook],
]) {
  requireText(source, 'requestSequence', `${label}: refresh sem proteção contra resposta fora de ordem.`);
  requireText(
    source,
    'requestSequence.current !== requestId',
    `${label}: resposta administrativa superseded pode voltar a vencer.`
  );
}

for (const marker of [
  'Fonte real · google-cloud-monitoring',
  'Fonte estimada · emprovex-workspace-estimate',
  'Alertas não bloqueiam operações e não representam cobrança oficial',
  'Nenhuma referência operacional foi configurada',
]) {
  requireText(
    consolidated,
    marker,
    `Painel consolidado perdeu separação/estado obrigatório: ${marker}`
  );
}

for (const script of [
  '"test:block-16-8-integrated-domain"',
  '"verify:block-16-8-integrated-e2e"',
  '"test:e2e:browser"',
  '"test:security:multitenant"',
  '"test:empenho-concurrency"',
  '"verify:workspace-drive"',
  '"test:external-drive-auth-emulator"',
]) {
  requireText(packageJson, script, `package.json perdeu gate necessário: ${script}`);
}

for (const ciStep of [
  'Block 16.8 integrated domain tests',
  'Block 16.8 integrated E2E guard',
  'Multi-tenant Firestore security tests',
  'Empenho concurrency domain tests',
  'Workspace Google Drive guard',
  'External Drive OAuth Firebase Auth emulator tests',
  'Production build',
  'Final TypeScript validation',
  'Diff hygiene',
  'Browser E2E with Firebase Emulator',
  'Block 16 Final Release Gate',
]) {
  requireText(workflow, ciStep, `Application CI perdeu gate integrado: ${ciStep}`);
}

for (const driveInvariant of [
  "provider: 'google-drive'",
  'fetchWorkspaceDrivePdf',
  'uploadAndVerifyWorkspacePdf',
  'Fallback legado: AUSENTE',
]) {
  requireText(driveGuard, driveInvariant, `Regressão no contrato documental Drive: ${driveInvariant}`);
}

for (const docInvariant of [
  'não altera `firestore.rules`',
  'nenhum deploy manual ou de produção na Vercel',
  'PDFs e documentos continuam exclusivamente no Google Drive',
  'Cloud Monitoring é testado sem credenciais reais e sem tráfego externo',
]) {
  requireText(docs, docInvariant, `Documentação do Bloco 16.8 perdeu restrição: ${docInvariant}`);
}

forbidText(
  browserIntegrated,
  'https://monitoring.googleapis.com',
  'Browser E2E não pode depender do Cloud Monitoring real.'
);
forbidText(
  browserIntegrated,
  'https://www.googleapis.com/drive',
  'Browser E2E não pode depender do Google Drive real.'
);

console.log('Bloco 16.8: matriz E2E integrada e gates permanentes verificados.');
