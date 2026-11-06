import type { CompanyAction } from '../../company/contracts';

/** Company-only roles. Never import or inherit permissions from military tenants. */
export const MEMBER_ROLES = ['admin', 'operations', 'stock', 'logistics', 'driver', 'finance'] as const;
export type CompanyMemberRole = typeof MEMBER_ROLES[number];
export type CompanyActorRole = 'owner' | CompanyMemberRole;

export const MEMBER_ROLE_LABELS: Record<CompanyMemberRole, string> = {
  admin: 'Administrador',
  operations: 'Operações e Compras',
  stock: 'Estoque',
  logistics: 'Logística',
  driver: 'Motorista',
  finance: 'Financeiro',
};

/** Static, reviewable permissions; the W0 guard remains the perimeter. */
export const MEMBER_ROLE_ACTIONS: Record<CompanyMemberRole, readonly CompanyAction[]> = {
  admin: [
    'company:read', 'company:write', 'publicCustomers:read', 'publicCustomers:write',
    'commitments:read', 'commitments:write', 'customerOrders:read', 'customerOrders:write',
    'sourceSuppliers:read', 'sourceSuppliers:write', 'catalogItems:read', 'catalogItems:write',
    'members:read', 'members:write', 'documents:read', 'documents:write',
    'purchaseOrders:read', 'purchaseOrders:write', 'stockEvents:read', 'stockEvents:write',
    'allocations:read', 'allocations:write', 'inboundShipments:read', 'inboundShipments:write',
    'deliveries:read', 'deliveries:write', 'accountsPayable:read', 'accountsPayable:write',
    'accountsReceivable:read', 'accountsReceivable:write', 'auditEvents:read',
    'deliveryRoutes:read', 'deliveryRoutes:write', 'vehicles:read', 'vehicles:write',
    'fiscal:read', 'fiscal:write', 'fiscal:configure', 'fiscal:approve', 'fiscal:issue', 'fiscal:download',
  ],
  operations: [
    'company:read', 'publicCustomers:read', 'publicCustomers:write',
    'commitments:read', 'commitments:write', 'customerOrders:read', 'customerOrders:write',
    'sourceSuppliers:read', 'sourceSuppliers:write', 'catalogItems:read', 'catalogItems:write',
    'documents:read', 'documents:write', 'purchaseOrders:read', 'purchaseOrders:write',
    'stockEvents:read', 'allocations:read', 'inboundShipments:read', 'deliveries:read',
    'deliveryRoutes:read', 'vehicles:read',
  ],
  stock: [
    'company:read', 'sourceSuppliers:read', 'catalogItems:read', 'customerOrders:read',
    'purchaseOrders:read', 'stockEvents:read', 'stockEvents:write',
    'allocations:read', 'allocations:write', 'inboundShipments:read',
    'inboundShipments:write', 'deliveries:read', 'documents:read',
  ],
  logistics: [
    'company:read', 'publicCustomers:read', 'customerOrders:read',
    'purchaseOrders:read', 'stockEvents:read', 'allocations:read',
    'inboundShipments:read', 'inboundShipments:write',
    'deliveries:read', 'deliveries:write', 'documents:read',
    'deliveryRoutes:read', 'deliveryRoutes:write', 'vehicles:read', 'vehicles:write',
  ],
  driver: [
    'company:read', 'publicCustomers:read', 'customerOrders:read',
    'deliveries:read', 'deliveries:write', 'documents:read',
    'deliveryRoutes:read',
  ],
  finance: [
    'company:read', 'publicCustomers:read', 'commitments:read',
    'customerOrders:read', 'purchaseOrders:read', 'documents:read',
    'accountsPayable:read', 'accountsPayable:write',
    'accountsReceivable:read', 'accountsReceivable:write',
    'fiscal:read', 'fiscal:write', 'fiscal:download',
  ],
};
const allowedActions = new Set<CompanyAction>(MEMBER_ROLE_ACTIONS.admin);
const allowedRoles = new Set<string>(MEMBER_ROLES);

export function normalizeMemberRoles(value: unknown): CompanyMemberRole[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MEMBER_ROLES.length
    || value.some(v => typeof v !== 'string' || !allowedRoles.has(v))) {
    throw new Error('COMPANY_INVALID_ROLES');
  }
  return [...new Set(value as CompanyMemberRole[])].sort();
}

/** Fails closed on revoked/invited/expired membership. Compose roles as a union. */
export function permitsCompanyAction(
  assigned: readonly CompanyMemberRole[],
  status: 'active' | 'invited' | 'revoked' | 'expired',
  action: CompanyAction,
  owner = false,
): boolean {
  if (!allowedActions.has(action) || status !== 'active') return false;
  if (owner) return true;
  return assigned.some(role => MEMBER_ROLE_ACTIONS[role]?.includes(action));
}

/** Only the verified bootstrap owner may delegate administrator. */
export function canGrantRoles(
  actor: 'owner' | 'admin' | 'member',
  next: readonly CompanyMemberRole[],
  current: readonly CompanyMemberRole[] = [],
): boolean {
  if (actor === 'owner') return true;
  return actor === 'admin' && !next.includes('admin') && !current.includes('admin');
}

/** Future external supplier collaboration does NOT grant any company membership. */
export interface CompanyOrderShareFutureContract {
  orderId: string;
  companyId: string;
  recipientEmail: string;
  grantedCapabilities: readonly ('order:read' | 'order:reply')[];
  expiresAt: string;
}
