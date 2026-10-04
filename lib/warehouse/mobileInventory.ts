import {
  warehouseInventoryScopeIncludesPosition,
  type WarehouseInventoryItem,
  type WarehouseInventoryScope,
  type WarehouseInventoryStatus,
} from './inventory';
import {
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';
import { classifyWarehouseMobileProductScan } from './mobileIntakeAllocation';
import type { WarehouseMobileScanKind } from './mobileScanner';

export type WarehouseMobileInventoryPositionDisposition =
  | 'IN_SCOPE_WITH_ITEMS'
  | 'OUT_OF_SCOPE'
  | 'EMPTY';

export type WarehouseMobileInventorySessionMode =
  | 'COUNT'
  | 'REVIEW'
  | 'CONFIRM'
  | 'RECONCILE'
  | 'FINALIZED'
  | 'WAIT';

export function classifyWarehouseMobileInventoryProductScan(
  value: string
): WarehouseMobileScanKind {
  return classifyWarehouseMobileProductScan(value);
}

export function warehouseMobileInventoryScopeFromPosition(
  position: WarehouseStockPosition
): WarehouseInventoryScope {
  if (position.kind === 'LOCATION') {
    return {
      kind: 'LOCATION',
      depotId: position.depotId,
      locationId: position.locationId,
    };
  }
  if (position.kind === 'SUBPOSITION') {
    return {
      kind: 'SUBPOSITION',
      depotId: position.depotId,
      locationId: position.locationId,
      subpositionId: position.subpositionId,
    };
  }
  throw new Error('WAREHOUSE_MOBILE_INVENTORY_POSITION_REQUIRED');
}

export function warehouseMobileInventoryItemsAtPosition(
  items: readonly WarehouseInventoryItem[],
  position: WarehouseStockPosition
): WarehouseInventoryItem[] {
  return items.filter((item) =>
    warehouseStockPositionsEqual(item.position, position)
  );
}

export function warehouseMobileInventoryPositionDisposition(
  scope: WarehouseInventoryScope,
  items: readonly WarehouseInventoryItem[],
  position: WarehouseStockPosition
): WarehouseMobileInventoryPositionDisposition {
  if (!warehouseInventoryScopeIncludesPosition(scope, position)) {
    return 'OUT_OF_SCOPE';
  }
  return warehouseMobileInventoryItemsAtPosition(items, position).length > 0
    ? 'IN_SCOPE_WITH_ITEMS'
    : 'EMPTY';
}

export function findWarehouseMobileInventoryItem(
  items: readonly WarehouseInventoryItem[],
  position: WarehouseStockPosition,
  materialId: string
): WarehouseInventoryItem | null {
  return items.find((item) =>
    item.materialId === materialId
    && warehouseStockPositionsEqual(item.position, position)
  ) || null;
}

export function warehouseMobileInventorySessionMode(
  status: WarehouseInventoryStatus
): WarehouseMobileInventorySessionMode {
  if (status === 'COUNTING') return 'COUNT';
  if (status === 'REVIEW') return 'REVIEW';
  if (status === 'CONFIRMING') return 'CONFIRM';
  if (status === 'RECONCILIATION_REQUIRED') return 'RECONCILE';
  if (status === 'CONFIRMED' || status === 'CANCELLED') return 'FINALIZED';
  return 'WAIT';
}
