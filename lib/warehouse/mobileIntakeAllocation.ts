import {
  normalizeWarehouseBarcode,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  isWarehouseLocationBarcode,
  WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX,
  WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX,
  WAREHOUSE_LOCATION_BARCODE_PREFIX,
} from './locationBarcode';
import type { WarehouseMobileScanKind } from './mobileScanner';

const QUANTITY_EPSILON = 0.000001;

export type WarehouseMobileBarcodeDisposition =
  | 'MATCH'
  | 'UNKNOWN'
  | 'CONFLICT'
  | 'INACTIVE';

export function classifyWarehouseMobileProductScan(
  value: string
): WarehouseMobileScanKind {
  const normalized = normalizeWarehouseBarcode(value);
  if (!normalized) return 'UNKNOWN';
  if (isWarehouseLocationBarcode(normalized)) return 'LOCATION';
  if (
    normalized.toUpperCase().startsWith(WAREHOUSE_LOCATION_BARCODE_PREFIX)
    || normalized.toUpperCase().startsWith(WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX)
    || normalized.startsWith(WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX)
  ) {
    return 'UNKNOWN';
  }
  return 'PRODUCT';
}

export function normalizeWarehouseMobileAllocationQuantity(
  value: string | number,
  pendingQuantity: number
): number | null {
  const quantity = typeof value === 'number' ? value : Number(value);
  if (
    !Number.isFinite(quantity)
    || quantity <= 0
    || !Number.isFinite(pendingQuantity)
    || pendingQuantity <= 0
    || quantity > pendingQuantity + QUANTITY_EPSILON
  ) {
    return null;
  }
  return quantity;
}

export function warehouseMobileBarcodeDisposition(
  association: WarehouseBarcodeAssociation | null,
  expectedMaterialId: string
): WarehouseMobileBarcodeDisposition {
  if (!association) return 'UNKNOWN';
  if (association.materialId !== expectedMaterialId) return 'CONFLICT';
  if (association.status !== 'active') return 'INACTIVE';
  return 'MATCH';
}

export function createWarehouseMobileAllocationOperationId(
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  const compact = randomUuid().trim().toLowerCase().replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/.test(compact)) {
    throw new Error('WAREHOUSE_MOBILE_ALLOCATION_OPERATION_ID_INVALID');
  }
  return 'mobile_' + compact;
}

export function shouldRefreshWarehouseMobileAllocationAfterError(
  error: unknown
): boolean {
  const code = error instanceof Error ? error.message : String(error || '');
  return [
    'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION',
    'WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED',
    'WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED',
    'WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING',
    'WAREHOUSE_FAST_PATH_CANONICAL_INVOICE_MISSING',
  ].some((candidate) => code.includes(candidate));
}
