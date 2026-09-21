#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const findings = [];

function requireText(source, text, message) {
  if (!source.includes(text)) findings.push(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) findings.push(message);
}

const domain = read('lib/billing.ts');
const store = read('lib/platformBillingStore.ts');
const rules = read('firestore.rules');
const provisioning = read('lib/server/sectorProvisioningAdmin.ts');
const sharedProvisioning = read('lib/sectorProvisioning.ts');
const modal = read('components/admin/CreateSectorModal.tsx');
const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const adminPanel = read('components/admin/AdminBillingPanel.tsx');
const header = read('components/layout/AppHeader.tsx');
const platformAccess = read('lib/platformAccess.ts');
const workspaceContext = read('lib/workspaceContext.ts');
const securityTest = read('scripts/firestore-multitenancy-security.test.mjs');

requireText(domain, "monthlyPriceCents: 7000", 'Mensalidade padrão deixou de ser R$ 70.');
requireText(domain, "defaultTrialDays: 30", 'Trial padrão deixou de ser 30 dias.');
requireText(domain, "dueBusinessDay: 5", 'Vencimento deixou de usar o 5º dia útil.');
requireText(domain, "gracePeriodDays: 10", 'Tolerância comercial deixou de ser 10 dias.');
requireText(domain, "billingMode: 'observe'", 'Billing deixou de iniciar em modo OBSERVE.');
requireText(domain, "requirePayment: false", 'Exigência de pagamento deixou de iniciar desativada.');
requireText(domain, "automaticSuspension: false", 'Suspensão automática precisa permanecer desativada.');
requireText(domain, 'getFifthBusinessDay', 'Domínio não possui cálculo centralizado do 5º dia útil.');
requireText(domain, 'getBrazilFixedNationalHolidays', 'Cálculo não considera feriados nacionais fixos.');
requireText(domain, 'holidayDates', 'Calendário não aceita feriados adicionais cadastrados.');

requireText(sharedProvisioning, 'grantTrial: boolean', 'Provisionamento não possui opção explícita de trial.');
requireText(modal, 'Conceder período de teste', 'Cadastro de setor não expõe a opção de trial.');
requireText(provisioning, 'buildInitialBillingAccount', 'Provisionamento server-side não materializa billing.');
requireText(provisioning, 'billingAccounts/', 'Billing não participa do provisionamento atômico do setor.');

requireText(adminPage, 'usePlatformAdminBilling', 'Página administrativa não carrega o domínio de billing.');
requireText(adminView, "id: 'assinaturas'", 'Administração não possui aba Assinaturas.');
requireText(adminPanel, 'Cobrança em modo de observação', 'Painel não deixa explícito o modo OBSERVE.');
requireText(adminPanel, 'Exigir pagamento', 'Painel não mostra o comando futuro de exigir pagamento.');
requireText(adminPanel, 'disabled', 'Ativação de pagamento não está protegida durante a fase de testes.');
requireText(adminPanel, 'Confirmar pagamento', 'Painel não permite confirmação manual de mensalidade.');
requireText(adminPanel, 'Suspender comercial', 'Painel não possui status comercial manual.');
requireText(adminPanel, 'Pix manual preparado administrativamente', 'Preparação de Pix manual não está visível ao administrador.');

requireText(header, 'billing-trial-badge', 'Usuário externo não recebe indicação visual do período de teste.');
requireText(header, 'Período de Teste', 'Badge de trial não usa a nomenclatura definida.');

forbidText(platformAccess, 'billingAccounts', 'platformAccess não pode impor billing nesta fase.');
forbidText(platformAccess, 'requirePayment', 'Autorização operacional não pode exigir pagamento nesta fase.');
forbidText(workspaceContext, 'billingAccounts', 'workspaceContext não pode bloquear por billing nesta fase.');

requireText(rules, 'match /billingAccounts/{workspaceId}', 'Firestore não protege billingAccounts.');
requireText(rules, 'allow get: if isPlatformAdmin() || canAccessWorkspace(workspaceId);', 'Setor não possui leitura tenant-scoped do próprio billing.');
requireText(rules, 'allow create: if isPlatformAdmin()', 'Criação de billing não está restrita à administração.');
requireText(rules, 'allow update: if isPlatformAdmin()', 'Alteração de billing não está restrita à administração.');
requireText(rules, 'match /billingCycles/{cycleId}', 'Competências mensais não possuem regras dedicadas.');
requireText(rules, 'match /platformBillingConfig/{configId}', 'Configuração comercial não possui regras dedicadas.');

requireText(securityTest, 'Setor não altera o próprio trial', 'Suite de segurança não testa fraude de trial.');
requireText(securityTest, 'Billing pending em OBSERVE não pode bloquear o acesso operacional.', 'Suite não prova ausência de enforcement operacional.');

forbidText(store.toLowerCase(), 'woovi', 'Fundação atual não deve depender da Woovi.');
forbidText(store.toLowerCase(), 'asaas', 'Fundação atual não deve depender do Asaas.');

if (findings.length > 0) {
  console.error('Bloco 22 — Assinaturas, Trial e Billing OBSERVE\n');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error(`\nBLOCK 22 BILLING: BLOQUEADO (${findings.length} achado(s))`);
  process.exit(1);
}

console.log('Bloco 22 — Assinaturas, Trial e Billing OBSERVE\n');
console.log('Mensalidade: R$ 70,00');
console.log('Trial padrão: 30 dias');
console.log('Vencimento: 5º dia útil');
console.log('Tolerância: 10 dias corridos');
console.log('Modo: OBSERVE');
console.log('Exigir pagamento: DESATIVADO');
console.log('Suspensão automática: DESATIVADA');
console.log('Acesso operacional: INDEPENDENTE DO BILLING');
console.log('Pix manual: PREPARADO / NÃO EXPOSTO AO USUÁRIO');
console.log('\nBLOCK 22 BILLING: READY');
