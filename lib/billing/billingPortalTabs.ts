/**
 * Public navigation contract only. No plan-price tables or cross-tenant data.
 * Each tab has an independent panel; changing tab never calls billing writes.
 */
export type BillingPortalTab = 'overview' | 'history' | 'payments' | 'help';

export const BILLING_PORTAL_TABS: ReadonlyArray<{
  id: BillingPortalTab;
  title: string;
  description: string;
}> = [
  { id: 'overview', title: 'Minha assinatura', description: 'Plano, identidade e situação comercial' },
  { id: 'history', title: 'Histórico financeiro', description: 'Competências, vencimentos e pagamentos registrados' },
  { id: 'payments', title: 'Formas de pagamento', description: 'Checkout, Pix e confirmação segura' },
  { id: 'help', title: 'Ajuda e orientações', description: 'Dúvidas e cuidados com cobranças' },
];

export function isBillingPortalTab(value: unknown): value is BillingPortalTab {
  return typeof value === 'string' && BILLING_PORTAL_TABS.some((tab) => tab.id === value);
}
