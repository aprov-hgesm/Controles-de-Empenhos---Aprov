/**
 * EMPROVEX Empresas R1-M / W0 — contrato congelado v1.
 * Identidade setorial permanece nas coleções platform*. Nunca usar UG ou CNPJ
 * como chave de autorização. Este namespace é exclusivo para dados empresariais.
 */
import { isValidWorkspaceId } from '../../platformIdentity';

export const COMPANY_CONTRACT_VERSION = 'company-r1-v1' as const;
export const COMPANY_ROOT_COLLECTION = 'supplierCompanyWorkspaces' as const;
export const COMPANY_IDENTITY_COLLECTIONS = [
  'workspaces', 'platformAccounts', 'platformAuthUidIndex',
  'platformCnpjIndex', 'platformProvisioningLocks', 'platformAuditEvents',
] as const;

export const COMPANY_SUBCOLLECTIONS = [
  'publicCustomers', 'commitments', 'customerOrders', 'sourceSuppliers',
  'catalogItems', 'members', 'documents', 'purchaseOrders',
  'stockEvents', 'allocations', 'inboundShipments', 'deliveries',
  'accountsPayable', 'accountsReceivable', 'deliveryRoutes', 'vehicles', 'auditEvents', 'idempotencyKeys',
] as const;

export type CompanySubcollection = typeof COMPANY_SUBCOLLECTIONS[number];
export const COMPANY_ACTIONS = [
  'company:read', 'company:write',
  'publicCustomers:read', 'publicCustomers:write',
  'commitments:read', 'commitments:write',
  'customerOrders:read', 'customerOrders:write',
  'sourceSuppliers:read', 'sourceSuppliers:write',
  'catalogItems:read', 'catalogItems:write',
  'members:read', 'members:write',
  'documents:read', 'documents:write',
  'purchaseOrders:read', 'purchaseOrders:write',
  'stockEvents:read', 'stockEvents:write',
  'allocations:read', 'allocations:write',
  'inboundShipments:read', 'inboundShipments:write',
  'deliveries:read', 'deliveries:write',
  'deliveryRoutes:read', 'deliveryRoutes:write', 'vehicles:read', 'vehicles:write',
  'accountsPayable:read', 'accountsPayable:write',
  'accountsReceivable:read', 'accountsReceivable:write',
  'auditEvents:read',
] as const;
export type CompanyAction = typeof COMPANY_ACTIONS[number];

/** R1-M só permite o titular do provisionamento. W3 introduz memberships. */
export type CompanyPrincipalRole = 'owner' | 'member';
export type CompanyRecordStatus = 'draft' | 'active' | 'suspended' | 'cancelled' | 'archived';
export type CompanyErrorCode =
  | 'COMPANY_AUTH_INVALID' | 'COMPANY_ACCOUNT_FORBIDDEN'
  | 'COMPANY_WORKSPACE_FORBIDDEN' | 'COMPANY_DIRECTORY_UNAVAILABLE'
  | 'COMPANY_SESSION_UNAVAILABLE' | 'COMPANY_PILOT_DISABLED'
  | 'COMPANY_SCOPE_FORBIDDEN' | 'COMPANY_OPERATION_FORBIDDEN'
  | 'COMPANY_INVALID_RESOURCE' | 'COMPANY_CONFLICT' | 'COMPANY_INVALID_INPUT';

/** ISO 8601 UTC. Datas distintas preservam proveniência, não são intercambiáveis. */
export type IsoUtcDateTime = string;
export type CompanyTemporalFact = {
  value: IsoUtcDateTime;
  basis: 'requested' | 'promised' | 'estimated' | 'confirmed' | 'actual';
  updatedAt: IsoUtcDateTime;
  source: 'user' | 'supplier' | 'system' | 'publicCustomer';
};
/** Inteiro seguro de centavos; conversão/arredondamento explícitos. */
export interface CompanyMoney { amountCents: number; currency: 'BRL' }
export type CompanyUnit = 'UN' | 'KG' | 'G' | 'L' | 'ML' | 'CX' | 'FD' | 'M';
/** Quantidade decimal canônica como string, sem aritmética float para saldos. */
export interface CompanyQuantity { value: string; unit: CompanyUnit }
/** Conversão racional exata (numerador/denominador inteiros positivos). */
export interface CompanyUnitConversion {
  from: CompanyUnit;
  to: CompanyUnit;
  numerator: number;
  denominator: number;
}

export interface CompanyOwnedRecord {
  schemaVersion: typeof COMPANY_CONTRACT_VERSION;
  id: string;
  companyId: string;
  workspaceId: string;
  status: CompanyRecordStatus;
  createdByUid: string;
  createdAt: IsoUtcDateTime;
  updatedAt: IsoUtcDateTime;
  revision: number;
}
export interface CompanyIdempotentCommand {
  idempotencyKey: string;
  /** A chave pertence à empresa + ação + hash da requisição, no servidor. */
  requestHash: string;
  requestedAt: IsoUtcDateTime;
}
export interface CompanyAuditEvent {
  schemaVersion: typeof COMPANY_CONTRACT_VERSION;
  eventId: string;
  companyId: string;
  actorUid: string;
  action: CompanyAction;
  entityType: CompanySubcollection;
  entityId: string;
  correlationId: string;
  idempotencyKey?: string;
  beforeRevision: number | null;
  afterRevision: number | null;
  occurredAt: IsoUtcDateTime;
}
/** Nunca permitir "/" ou ".." em segmentos vindos da rota ou do corpo. */
export function companyRootPath(companyId: string): string {
  if (!isValidWorkspaceId(companyId) || companyId.includes('/')) {
    throw new Error('COMPANY_INVALID_RESOURCE');
  }
  return `${COMPANY_ROOT_COLLECTION}/${companyId}`;
}
export function companyCollectionPath(companyId: string, collection: CompanySubcollection): string {
  if (!(COMPANY_SUBCOLLECTIONS as readonly string[]).includes(collection)) {
    throw new Error('COMPANY_INVALID_RESOURCE');
  }
  return `${companyRootPath(companyId)}/${collection}`;
}
export function companyDocumentPath(companyId: string, collection: CompanySubcollection, id: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error('COMPANY_INVALID_RESOURCE');
  }
  return `${companyCollectionPath(companyId, collection)}/${id}`;
}
export interface CompanyApiError {
  ok: false;
  code: CompanyErrorCode;
  error: string;
}
export type CompanyApiResult<T> = { ok: true; result: T } | CompanyApiError;
