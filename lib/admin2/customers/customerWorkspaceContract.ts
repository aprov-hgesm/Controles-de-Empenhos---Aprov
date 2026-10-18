import type { BillingAccount, BillingAccountStatus } from '../../billing';
import type { Workspace } from '../../platformIdentity';

/**
 * CORE V2: "Cliente" nesta fase é uma PROJEÇÃO de um Workspace existente.
 *
 * Não cria uma conta comercial nova, não altera UG, Firebase UID, e-mail de
 * autenticação, billing nem delega acesso operacional a outros workspaces.
 * Customer e CustomerWorkspaceLink formais serão introduzidos separadamente.
 */
export const ADMIN2_CUSTOMER_PAGE_SIZE = 10;

export type CustomerSearchField = 'name' | 'ug' | 'workspaceId';

export interface CustomerWorkspaceRecord {
  customerKey: string;
  workspaceId: string;
  name: string;
  ug: string | null;
  organizationName: string;
  organizationShortName: string;
  sectionName: string;
  authorizedEmail: string;
  workspaceStatus: 'active' | 'disabled';
  updatedAt: string | null;
  legacyWorkspace: boolean;
}

export interface CustomerBillingSnapshot {
  status: BillingAccountStatus;
  monthlyPriceCents: number;
  trialEndsAt: string | null;
  paymentRequired: boolean;
  exemptionSource: string | null;
}

export function buildCustomerWorkspaceRecord(
  workspaceId: string,
  workspace: Partial<Workspace>
): CustomerWorkspaceRecord {
  const profile = workspace.institutionalProfile;
  return {
    customerKey: 'workspace:' + workspaceId,
    workspaceId,
    name: typeof workspace.name === 'string' && workspace.name.trim()
      ? workspace.name.trim()
      : workspaceId,
    ug: typeof workspace.ug === 'string' && /^\d{6}$/.test(workspace.ug)
      ? workspace.ug
      : null,
    organizationName: typeof profile?.organizationName === 'string'
      ? profile.organizationName
      : '',
    organizationShortName: typeof profile?.organizationShortName === 'string'
      ? profile.organizationShortName
      : '',
    sectionName: typeof profile?.sectionName === 'string'
      ? profile.sectionName
      : '',
    authorizedEmail: typeof workspace.authorizedEmail === 'string'
      ? workspace.authorizedEmail
      : '',
    workspaceStatus: workspace.status === 'disabled' ? 'disabled' : 'active',
    updatedAt: typeof workspace.updatedAt === 'string' ? workspace.updatedAt : null,
    legacyWorkspace: workspace.legacyWorkspace === true,
  };
}

export function buildCustomerBillingSnapshot(
  workspaceId: string,
  billing: Partial<BillingAccount> | null
): CustomerBillingSnapshot | null {
  // Evita associar por engano um billingAccount pertencente a outro workspace.
  if (!billing || billing.workspaceId !== workspaceId) return null;
  return {
    status: billing.status || 'pending',
    monthlyPriceCents: typeof billing.monthlyPriceCents === 'number'
      ? billing.monthlyPriceCents
      : 0,
    trialEndsAt: typeof billing.trialEndsAt === 'string' ? billing.trialEndsAt : null,
    paymentRequired: billing.paymentRequired === true,
    exemptionSource: typeof billing.exemptionSource === 'string'
      ? billing.exemptionSource
      : null,
  };
}

export function customerBillingLabel(billing: CustomerBillingSnapshot | null): string {
  if (!billing) return 'Não configurada';
  switch (billing.status) {
    case 'trial': return 'Período de teste';
    case 'active': return 'Ativa';
    case 'pending': return 'Pendente';
    case 'suspended': return 'Suspensa';
    case 'canceled': return 'Cancelada';
    case 'exempt': return 'Isenta / VIP';
    default: return 'Sem classificação';
  }
}

export function formatCustomerCurrency(valueCents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valueCents / 100);
}

export function formatCustomerDate(value: string | null): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR');
}
