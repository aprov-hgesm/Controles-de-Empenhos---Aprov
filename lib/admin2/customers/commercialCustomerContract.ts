/**
 * Cadastro comercial é separado da identidade operacional: não contém senha,
 * UID Firebase, dados de estoque, faturamento ou documentos do setor.
 */
export const ADMIN2_COMMERCIAL_VERSION = 'emprovex_commercial_customer_v1' as const;
export const ADMIN2_MAX_LINKED_WORKSPACES = 8;
export const ADMIN2_COMMERCIAL_PAGE_SIZE = 10;
export type CommercialStatus = 'prospect' | 'negotiation' | 'active' | 'inactive';

export interface CommercialCustomerInput {
  displayName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  relationshipStatus: CommercialStatus;
  relationshipNotes: string;
  workspaceIds: string[];
}
export interface CommercialCustomer extends CommercialCustomerInput {
  version: typeof ADMIN2_COMMERCIAL_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
export interface CommercialWorkspaceIndex {
  workspaceId: string;
  customerId: string;
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
  if (!input.displayName.trim() || input.displayName.length > 120) errors.push('Nome comercial obrigatório (máximo 120 caracteres).');
  if (input.contactName.length > 100) errors.push('Contato excede 100 caracteres.');
  if (input.contactEmail && (!EMAIL.test(input.contactEmail) || input.contactEmail.length > 160)) errors.push('E-mail de contato inválido.');
  if (input.contactPhone.length > 30) errors.push('Telefone excede 30 caracteres.');
  if (input.relationshipNotes.length > 1000) errors.push('Observações excedem 1000 caracteres.');
  if (!COMMERCIAL_STATUSES.some(s => s.value === input.relationshipStatus)) errors.push('Situação comercial inválida.');
  if (input.workspaceIds.length > ADMIN2_MAX_LINKED_WORKSPACES) errors.push('Máximo de oito workspaces por cliente neste estágio.');
  if (new Set(input.workspaceIds).size !== input.workspaceIds.length) errors.push('Workspace repetido no vínculo.');
  if (input.workspaceIds.some(id => !WORKSPACE_ID.test(id))) errors.push('Identificador de workspace inválido.');
  return errors;
}

export function normalizeCommercialCustomerInput(input: CommercialCustomerInput): CommercialCustomerInput {
  return {
    displayName: input.displayName.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    contactPhone: input.contactPhone.trim(),
    relationshipStatus: input.relationshipStatus,
    relationshipNotes: input.relationshipNotes.trim(),
    workspaceIds: Array.from(new Set(input.workspaceIds.map(id => id.trim()).filter(Boolean))).sort(),
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
