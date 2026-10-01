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
const primaryCreatePanel = read('components/admin/AdminCreateSectorPanel.tsx');
const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const adminPanel = read('components/admin/AdminBillingPanel.tsx');
const header = read('components/layout/AppHeader.tsx');
const regularizationPage = read('app/regularizacao/page.tsx');
const regularizationRoute = read('app/api/billing/regularization/route.ts');
const platformAccess = read('lib/platformAccess.ts');
const workspaceContext = read('lib/workspaceContext.ts');
const securityTest = read('scripts/firestore-multitenancy-security.test.mjs');

requireText(domain, 'EMPROVEX_FULL_PLAN_PRICE_CENTS = 7000', 'Plano Completo deixou de usar R$ 70.');
requireText(domain, 'defaultTrialDays: 30', 'Trial padrão deixou de ser 30 dias.');
requireText(domain, 'dueBusinessDay: 5', 'Vencimento deixou de usar o 5º dia útil.');
requireText(domain, 'gracePeriodDays: 10', 'Tolerância comercial deixou de ser 10 dias.');
requireText(domain, "billingMode: 'observe'", 'Billing deixou de iniciar em modo OBSERVE.');
requireText(domain, 'requirePayment: false', 'Exigência de pagamento deixou de iniciar desativada.');
requireText(domain, 'automaticSuspension: false', 'Suspensão automática precisa permanecer desativada.');
requireText(domain, 'migratePlatformBillingConfigToSaasR1', 'Migração idempotente do preço não está centralizada.');
requireText(domain, 'migrateBillingAccountToSaasR1', 'Migração idempotente das contas não está centralizada.');
requireText(domain, 'buildBillingExemptionUpdate', 'Contrato VIP/isento não está centralizado.');
requireText(domain, 'buildBillingCycleStatusTransition', 'Confirmação idempotente de competência não está centralizada.');
requireText(domain, 'paymentLinkUrl', 'Configuração não possui Link de Pagamento público.');
requireText(domain, 'supportContact', 'Configuração não possui canal de suporte.');
requireText(domain, 'getFifthBusinessDay', 'Domínio não possui cálculo centralizado do 5º dia útil.');

requireText(store, 'setBillingExemption', 'Store não possui ação administrativa de VIP/isento.');
requireText(store, "persistedAccount.status === 'exempt'", 'Store permite competência financeira para conta isenta.');
requireText(store, 'sanitizeHttpsUrl', 'Link de Pagamento não exige HTTPS.');
requireText(store, "saas_r1_full_plan_70_brl", 'Migração de preço não registra motivo auditável.');
requireText(store, 'idempotentDocumentId', 'Confirmação manual não registra identidade determinística.');
forbidText(store, 'monthly_price_reduced_to_50_brl', 'Migração legada 70 -> 50 ainda está ativa.');

requireText(sharedProvisioning, 'grantTrial: boolean', 'Provisionamento não possui opção explícita de trial.');
requireText(modal + primaryCreatePanel, 'Período de teste', 'Cadastro de setor não expõe a opção de trial.');
requireText(modal + primaryCreatePanel, 'grantTrial', 'Cadastro de setor não vincula a opção visual ao grantTrial.');
requireText(provisioning, 'buildInitialBillingAccount', 'Provisionamento server-side não materializa billing.');
requireText(provisioning, 'billingAccounts/', 'Billing não participa do provisionamento atômico do setor.');

requireText(adminPage, 'usePlatformAdminBilling', 'Página administrativa não carrega o domínio de billing.');
requireText(adminView, "id: 'assinaturas'", 'Administração não possui aba Assinaturas.');
requireText(adminPanel, 'Plano Completo EMPROVEX', 'Painel não apresenta o plano comercial único.');
requireText(adminPanel, 'Tornar VIP / Isento', 'Painel não permite conceder VIP/isento.');
requireText(adminPanel, 'Remover VIP', 'Painel não permite remover VIP.');
requireText(adminPanel, 'Referência ou observação administrativa', 'Confirmação não aceita referência administrativa opcional.');
requireText(adminPanel, 'Link de Pagamento', 'Painel não configura regularização por link.');
requireText(adminPanel, 'Exigir pagamento', 'Painel não preserva indicação de enforcement desativado.');
requireText(adminPanel, 'disabled', 'Ativação de pagamento não está protegida na SAAS-B.');

requireText(header, 'billing-trial-badge', 'Usuário externo não recebe indicação visual do período de teste.');
requireText(header, 'billing-active-badge', 'Usuário regular não recebe indicação comercial compreensível.');
requireText(header, 'billing-exempt-badge', 'VIP/isento não recebe indicação comercial compreensível.');
requireText(header, 'billing-regularization-link', 'Usuário pendente não recebe caminho simples de regularização.');
requireText(regularizationPage, 'Regularização da assinatura', 'Página pública de regularização não existe.');
requireText(regularizationPage, 'Nenhum dado de cartão', 'Página de regularização não explica o processamento externo.');
requireText(regularizationRoute, 'EMPROVEX_FULL_PLAN_PRICE_CENTS', 'API pública não fixa o preço canônico do Plano Completo.');
requireText(regularizationRoute, 'publicHttpsUrl', 'API pública não filtra Link de Pagamento para HTTPS.');

forbidText(platformAccess, 'billingAccounts', 'platformAccess não pode impor billing na SAAS-B.');
forbidText(platformAccess, 'requirePayment', 'Autorização operacional não pode exigir pagamento na SAAS-B.');
forbidText(workspaceContext, 'billingAccounts', 'workspaceContext não pode bloquear por billing na SAAS-B.');

requireText(rules, "request.resource.data.billingMode == 'observe'", 'Rules não travam billing em OBSERVE.');
requireText(rules, 'request.resource.data.monthlyPriceCents == 7000', 'Rules não fixam o Plano Completo em R$ 70.');
requireText(rules, 'request.resource.data.requirePayment == false', 'Rules permitem ativar exigência de pagamento.');
requireText(rules, 'request.resource.data.paymentRequired == false', 'Rules permitem marcar workspace como paymentRequired.');
requireText(rules, 'paymentLinkUrl', 'Rules não validam Link de Pagamento.');
requireText(rules, "paymentLinkUrl.matches('^https://.+')", 'Rules não exigem HTTPS no Link de Pagamento.');
requireText(rules, 'supportContact', 'Rules não validam contato de suporte.');
requireText(rules, 'request.resource.data.amountCents == resource.data.amountCents', 'Competências materializadas podem ser reprecificadas.');
requireText(rules, 'match /billingAccounts/{workspaceId}', 'Firestore não protege billingAccounts.');
requireText(rules, 'match /billingCycles/{cycleId}', 'Competências mensais não possuem regras dedicadas.');
requireText(rules, 'match /platformBillingConfig/{configId}', 'Configuração comercial não possui regras dedicadas.');

requireText(securityTest, 'Administrador concede VIP usando exempt e valor zero', 'Suite de segurança não cobre VIP/isento.');
requireText(securityTest, 'Competência histórica materializada não pode ser reprecificada', 'Suite não protege histórico de preço.');
requireText(securityTest, 'Link público de pagamento exige HTTPS', 'Suite não valida configuração segura de regularização.');
requireText(securityTest, 'Billing pending em OBSERVE não pode bloquear o acesso operacional.', 'Suite não prova ausência de enforcement operacional.');

for (const source of [adminPanel, regularizationPage]) {
  forbidText(source, 'MERCADO_PAGO_ACCESS_TOKEN', 'Interface expõe credencial do Mercado Pago.');
  forbidText(source, 'name="cvv"', 'Interface não pode possuir campo de CVV.');
  forbidText(source, 'checkout transparente', 'SAAS-B não pode implementar checkout transparente.');
}

forbidText(store.toLowerCase(), 'woovi', 'Billing R1 não deve depender da Woovi.');
forbidText(store.toLowerCase(), 'asaas', 'Billing R1 não deve depender do Asaas.');

if (findings.length > 0) {
  console.error('SAAS-B / Bloco 22 — Billing, Plano Completo e Regularização\n');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error(`\nBLOCK 22 BILLING: BLOQUEADO (${findings.length} achado(s))`);
  process.exit(1);
}

console.log('SAAS-B / Bloco 22 — Billing, Plano Completo e Regularização\n');
console.log('Plano Completo: R$ 70,00 por workspace');
console.log('Trial padrão: 30 dias');
console.log('Vencimento: 5º dia útil');
console.log('Tolerância: 10 dias corridos');
console.log('VIP externo: exempt / R$ 0,00');
console.log('Fundador: exempt / R$ 0,00');
console.log('Pagamento: externo por Link/Pix + confirmação administrativa');
console.log('Modo: OBSERVE / sem enforcement operacional');
console.log('Histórico materializado: valor imutável');
console.log('\nBLOCK 22 BILLING: READY');
