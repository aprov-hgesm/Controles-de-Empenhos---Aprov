import type { BillingCycle, BillingCycleStatus } from '../../billing';

/**
 * Admin 2.0 CORE V2 — contrato de leitura da ficha 360.
 * Customer comercial NÃO é Workspace nem conta de autenticação.
 * Não cria coleções, papéis ou vínculos operacionais.
 */
export interface CommercialCustomerDraft {
  id: string;
  displayName: string;
  contactEmail: string | null;
  workspaceId: string;
  status: 'prospect' | 'active' | 'inactive';
}

export interface CustomerWorkspaceLinkDraft {
  customerId: string;
  workspaceId: string;
  relationship: 'billing' | 'administrative';
}

/** Modelo 1:1 vigente: um cadastro comercial para um workspace. */
export function planCommercialCustomerLink(
  customerId: string,
  workspaceId: string
): CustomerWorkspaceLinkDraft {
  if (!workspaceId || customerId !== workspaceId) {
    throw new Error('Cliente comercial e workspace devem ter o mesmo identificador.');
  }
  return { customerId, workspaceId, relationship: 'billing' };
}

export const ADMIN2_CYCLE_PAGE_SIZE = 6;
export const ADMIN2_AUDIT_SAMPLE_LIMIT = 12;

export interface CustomerCycleRecord {
  id: string;
  workspaceId: string;
  referenceMonth: string;
  amountCents: number;
  dueDate: string;
  status: BillingCycleStatus;
  confirmedAt: string | null;
  confirmedBy: string | null;
  note: string;
  updatedAt: string | null;
}

export interface CustomerAuditRecord {
  id: string;
  workspaceId: string;
  operation: string;
  entityType: string;
  actorEmail: string | null;
  occurredAt: string | null;
}

/** Firestore é a autoridade; dados inconsistentes nunca viram fatos da UI. */
export function mapCustomerBillingCycle(
  workspaceId: string,
  docId: string,
  value: Partial<BillingCycle>
): CustomerCycleRecord | null {
  if (value.workspaceId !== workspaceId) return null;
  if (!docId.startsWith(workspaceId + '__')) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.referenceMonth || '')) return null;
  if (docId !== workspaceId + '__' + value.referenceMonth) return null;
  const allowed: BillingCycleStatus[] = ['open', 'pending', 'paid', 'waived'];
  if (!allowed.includes(value.status as BillingCycleStatus)) return null;

  return {
    id: docId,
    workspaceId,
    referenceMonth: value.referenceMonth!,
    amountCents: typeof value.amountCents === 'number' && Number.isFinite(value.amountCents)
      ? value.amountCents : 0,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
    status: value.status!,
    confirmedAt: typeof value.confirmedAt === 'string' && value.confirmedAt ? value.confirmedAt : null,
    confirmedBy: typeof value.confirmedBy === 'string' && value.confirmedBy ? value.confirmedBy : null,
    note: typeof value.note === 'string' ? value.note : '',
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : null,
  };
}

export function billingCycleStatusLabel(status: BillingCycleStatus): string {
  switch (status) {
    case 'open': return 'Aberta';
    case 'pending': return 'Pendente';
    case 'paid': return 'Paga';
    case 'waived': return 'Dispensada';
  }
}

export function auditOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    'sector.create': 'Cadastro de setor',
    'sector.profile_update': 'Atualização institucional',
    'sector.status_change': 'Alteração de situação do setor',
    'sector.ug_backfill': 'Regularização de UG',
    'sector.password_reset': 'Redefinição de senha do setor',
    'sector.delete': 'Exclusão de setor',
    'session.terminate': 'Encerramento de sessão',
    'billing.trial_grant': 'Concessão de trial',
    'billing.status_change': 'Alteração de assinatura',
    'billing.payment_confirm': 'Confirmação de pagamento',
    'billing.payment_reopen': 'Reabertura de pagamento',
    'billing.price_migration': 'Atualização de preço',
  };
  return labels[operation] || 'Evento administrativo (' + operation + ')';
}

export function toCustomerAuditRecord(
  workspaceId: string,
  docId: string,
  data: Record<string, unknown>
): CustomerAuditRecord | null {
  if (data.workspaceId !== workspaceId) return null;
  const createdAt = data.createdAt;
  let occurredAt: string | null = null;
  if (typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))) {
    occurredAt = createdAt;
  } else if (
    createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
    && typeof (createdAt as { toDate: unknown }).toDate === 'function'
  ) {
    const parsed = (createdAt as { toDate: () => Date }).toDate();
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
      occurredAt = parsed.toISOString();
    }
  }
  return {
    id: docId,
    workspaceId,
    operation: typeof data.operation === 'string' ? data.operation : 'unknown',
    entityType: typeof data.entityType === 'string' ? data.entityType : 'unknown',
    actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : null,
    occurredAt,
  };
}
