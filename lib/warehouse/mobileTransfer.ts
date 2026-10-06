import { classifyWarehouseMobileProductScan } from './mobileIntakeAllocation';
import type { WarehouseMobileScanKind } from './mobileScanner';
import {
  WAREHOUSE_TRANSFER_MAX_ACTIVE_LOTS,
  isWarehousePhysicalStockPosition,
  planWarehouseTransferLots,
  prepareWarehousePhysicalTransfer,
  type WarehousePhysicalTransferPreparationResult,
  type WarehouseTransferLotAllocation,
  type WarehouseTransferPlanResult,
  type WarehouseTransferPreparationError,
} from './transfer';
import type { WarehouseStockPosition } from './location';
import type { WarehouseLot } from './lot';

/**
 * Compatibility adapter for the MOBILE-D public surface.
 *
 * Stock, lot and split decisions live in transfer.ts and in the canonical
 * transfer repository. Mobile only keeps scanner naming and backwards
 * compatible aliases while callers migrate to the shared domain names.
 */
export const WAREHOUSE_MOBILE_TRANSFER_MAX_RELOCATE_LOTS =
  WAREHOUSE_TRANSFER_MAX_ACTIVE_LOTS;

export type WarehouseMobileTransferLotAllocation =
  WarehouseTransferLotAllocation;
export type WarehouseMobileTransferPreparationError =
  WarehouseTransferPreparationError;
export type WarehouseMobileTransferQuantityResult =
  WarehouseTransferPlanResult;
export type WarehouseMobileTransferPreparationResult =
  WarehousePhysicalTransferPreparationResult;

export function classifyWarehouseMobileTransferProductScan(
  value: string
): WarehouseMobileScanKind {
  return classifyWarehouseMobileProductScan(value);
}

export function isWarehouseMobilePhysicalPosition(
  position: WarehouseStockPosition
): boolean {
  return isWarehousePhysicalStockPosition(position);
}

export function validateWarehouseMobileTransferQuantity(input: {
  materialId: string;
  source: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: readonly WarehouseLot[];
}): WarehouseMobileTransferQuantityResult {
  return planWarehouseTransferLots(input);
}

export function prepareWarehouseMobileTransfer(input: {
  materialId: string;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: readonly WarehouseLot[];
}): WarehouseMobileTransferPreparationResult {
  return prepareWarehousePhysicalTransfer(input);
}
