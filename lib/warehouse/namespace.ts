import { isValidWorkspaceId, normalizeWorkspaceId } from '../platformIdentity';

/**
 * Namespace Firestore dedicado ao ADM Depósito.
 *
 * Estrutura:
 * warehouse/{workspaceId}/{domain}/{documentId}
 *
 * Nenhuma coleção operacional existente é reutilizada como armazenamento do
 * módulo logístico. As regras de segurança do namespace são independentes.
 */
export const WAREHOUSE_NAMESPACE_ROOT = 'warehouse';
export const WAREHOUSE_NAMESPACE_VERSION = 'warehouse_v1';

export const WAREHOUSE_DOMAIN_COLLECTIONS = {
  materials: 'materials',
  depots: 'depots',
  locations: 'locations',
  movements: 'movements',
  balances: 'balances',
  locationBalances: 'locationBalances',
  settings: 'settings',
  lots: 'lots',
  barcodes: 'barcodes',
  layouts: 'layouts',
  inventories: 'inventories',
  siscofisSnapshots: 'siscofisSnapshots',
  alerts: 'alerts',
  intakes: 'intakes',
  destinations: 'destinations',
  withdrawals: 'withdrawals',
  consumptions: 'consumptions',
} as const;

export type WarehouseDomain =
  keyof typeof WAREHOUSE_DOMAIN_COLLECTIONS;

export function warehouseWorkspaceRoot(workspaceId: string): string {
  const normalized = normalizeWorkspaceId(workspaceId);

  if (!isValidWorkspaceId(normalized)) {
    throw new Error('WAREHOUSE_INVALID_WORKSPACE_ID');
  }

  return `${WAREHOUSE_NAMESPACE_ROOT}/${normalized}`;
}

export function warehouseDomainPath(
  workspaceId: string,
  domain: WarehouseDomain
): string {
  return `${warehouseWorkspaceRoot(workspaceId)}/${WAREHOUSE_DOMAIN_COLLECTIONS[domain]}`;
}

export function warehouseDocumentPath(
  workspaceId: string,
  domain: WarehouseDomain,
  documentId: string
): string {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId || normalizedDocumentId.includes('/')) {
    throw new Error('WAREHOUSE_INVALID_DOCUMENT_ID');
  }

  return `${warehouseDomainPath(workspaceId, domain)}/${normalizedDocumentId}`;
}
