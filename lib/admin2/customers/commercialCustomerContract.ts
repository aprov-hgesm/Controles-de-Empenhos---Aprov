/**
 * Decisão do Fundador (18/10/2026): 1 workspace = 1 cliente comercial.
 * Workspace é a unidade comercial de contratação/cobrança, não a pessoa de
 * contato nem a OM. A identidade operacional e seus dados ficam separados.
 */
export const ADMIN2_COMMERCIAL_VERSION = 'emprovex_commercial_customer_v2' as const;
export const ADMIN2_COMMERCIAL_PAGE_SIZE = 10;
export type CommercialStatus = 'prospect' | 'negotiation' | 'active' | 'inactive';

export interface CommercialCustomerInput {
  workspaceId: string;
  displayName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  relationshipStatus: CommercialStatus;
  relationshipNotes: string;
}
export interface CommercialCustomer extends CommercialCustomerInput {
  version: typeof ADMIN2_COMMERCIAL_VERSION;
  /** ID determinístico igual ao workspaceId: não há vínculos N:1 ou 1:N. */
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export const COMMERCIAL_STATUSES: Array<{ value: CommercialStatus; label: string }> = [
  { value: 'prospect', label: 'Prospecto' },
  { value: 'negotiation', label: 'Em negociação' },
  { value: 'active', label: 'Cliente ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const WORKSPACE_ID = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCommercialCustomerInput(input: CommercialCustomerInput): string[] {
  const errors: string[] = [];
  if (!WORKSPACE_ID.test(input.workspaceId)) errors.push('Selecione um workspace existente com ID válido.');
  if (!input.displayName.trim() || input.displayName.length > 120) errors.push('Nome comercial obrigatório (máximo 120 caracteres).');
  if (input.contactName.length > 100) errors.push('Contato excede 100 caracteres.');
  if (input.contactEmail && (!EMAIL.test(input.contactEmail) || input.contactEmail.length > 160)) errors.push('E-mail de contato inválido.');
  if (input.contactPhone.length > 30) errors.push('Telefone excede 30 caracteres.');
  if (input.relationshipNotes.length > 1000) errors.push('Observações excedem 1000 caracteres.');
  if (!COMMERCIAL_STATUSES.some(s => s.value === input.relationshipStatus)) errors.push('Situação comercial inválida.');
  return errors;
}

export function normalizeCommercialCustomerInput(input: CommercialCustomerInput): CommercialCustomerInput {
  return {
    workspaceId: input.workspaceId.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    contactPhone: input.contactPhone.trim(),
    relationshipStatus: input.relationshipStatus,
    relationshipNotes: input.relationshipNotes.trim(),
  };
}

export function buildCommercialCustomer(
  id: string,
  value: CommercialCustomerInput,
  actor: string,
  now: string,
  existing?: CommercialCustomer
): CommercialCustomer {
  const input = normalizeCommercialCustomerInput(value);
  const errors = validateCommercialCustomerInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  if (id !== input.workspaceId || (existing && existing.workspaceId !== input.workspaceId)) {
    throw new Error('O identificador comercial deve ser o próprio workspace e não pode ser alterado.');
  }
  return {
    ...input,
    version: ADMIN2_COMMERCIAL_VERSION,
    id,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actor,
    updatedAt: now,
    updatedBy: actor,
  };
}
