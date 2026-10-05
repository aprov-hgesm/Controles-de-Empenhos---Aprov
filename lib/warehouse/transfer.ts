import {
  normalizeWarehouseLocationQuantity,
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';
import type { WarehouseLot } from './lot';

export const WAREHOUSE_TRANSFER_MAX_ACTIVE_LOTS = 24;
const QUANTITY_EPSILON = 0.000001;

export interface WarehouseTransferLotAllocation {
  lotId: string;
  quantity: number;
}

export type WarehouseTransferPreparationError =
  | 'NON_PHYSICAL_POSITION'
  | 'SAME_POSITION'
  | 'INVALID_QUANTITY'
  | 'INVALID_AVAILABLE_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'TOO_MANY_ACTIVE_LOTS'
  | 'LOT_ATTRIBUTION_EXCEEDS_STOCK';

export type WarehouseTransferPlanResult =
  | {
      ok: true;
      quantity: number;
      relocateLotIds: string[];
      lotAllocations: WarehouseTransferLotAllocation[];
      unattributedQuantity: number;
    }
  | {
      ok: false;
      error: Exclude<
        WarehouseTransferPreparationError,
        'SAME_POSITION' | 'NON_PHYSICAL_POSITION'
      >;
    };

export type WarehousePhysicalTransferPreparationResult =
  | {
      ok: true;
      quantity: number;
      relocateLotIds: string[];
      lotAllocations: WarehouseTransferLotAllocation[];
      unattributedQuantity: number;
    }
  | {
      ok: false;
      error: WarehouseTransferPreparationError;
    };

export type WarehousePhysicalStockPosition = Exclude<
  WarehouseStockPosition,
  { kind: 'UNASSIGNED' }
>;

export function isWarehousePhysicalStockPosition(
  position: WarehouseStockPosition
): position is WarehousePhysicalStockPosition {
  return position.kind === 'LOCATION' || position.kind === 'SUBPOSITION';
}

function activeLotsAtSource(input: {
  materialId: string;
  source: WarehouseStockPosition;
  lots: readonly WarehouseLot[];
}): WarehouseLot[] {
  return input.lots.filter(
    (lot) =>
      lot.materialId === input.materialId
      && lot.status === 'active'
      && lot.quantity > 0
      && warehouseStockPositionsEqual(lot.position, input.source)
  );
}

function sortLotsForTransfer(lots: readonly WarehouseLot[]): WarehouseLot[] {
  return [...lots].sort((left, right) => {
    const leftExpiry = left.expiresOn || '9999-12-31';
    const rightExpiry = right.expiresOn || '9999-12-31';
    const expiryCompare = leftExpiry.localeCompare(rightExpiry);
    if (expiryCompare !== 0) return expiryCompare;

    const codeCompare = (left.code || '').localeCompare(
      right.code || '',
      'pt-BR'
    );
    if (codeCompare !== 0) return codeCompare;
    return left.id.localeCompare(right.id);
  });
}

/**
 * Canonical lot plan for physical transfers.
 *
 * This is domain logic, not a Mobile rule. It is reused by the repository that
 * owns the TRANSFER transaction and may also be used by a UI for an early,
 * non-authoritative validation. The transaction remains the final authority.
 */
export function planWarehouseTransferLots(input: {
  materialId: string;
  source: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: readonly WarehouseLot[];
}): WarehouseTransferPlanResult {
  const quantity = normalizeWarehouseLocationQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    return { ok: false, error: 'INVALID_QUANTITY' };
  }

  const availableQuantity = normalizeWarehouseLocationQuantity(
    input.availableQuantity
  );
  if (availableQuantity === null || availableQuantity < 0) {
    return { ok: false, error: 'INVALID_AVAILABLE_STOCK' };
  }
  if (quantity > availableQuantity + QUANTITY_EPSILON) {
    return { ok: false, error: 'INSUFFICIENT_STOCK' };
  }

  const sourceLots = activeLotsAtSource({
    materialId: input.materialId,
    source: input.source,
    lots: input.lots,
  });

  if (sourceLots.length > WAREHOUSE_TRANSFER_MAX_ACTIVE_LOTS) {
    return { ok: false, error: 'TOO_MANY_ACTIVE_LOTS' };
  }

  const lotQuantity = normalizeWarehouseLocationQuantity(
    sourceLots.reduce((total, lot) => total + lot.quantity, 0)
  );
  if (lotQuantity === null) {
    return { ok: false, error: 'INVALID_AVAILABLE_STOCK' };
  }

  // A lot projection above the physical balance is a real inconsistency. Do
  // not hide or auto-reconcile it during a transfer.
  if (lotQuantity > availableQuantity + QUANTITY_EPSILON) {
    return { ok: false, error: 'LOT_ATTRIBUTION_EXCEEDS_STOCK' };
  }

  // Physical quantity without lot attribution stays unattributed. Only the
  // quantity that is actually backed by lots is carried to the destination.
  const unattributedAvailable = Math.max(0, availableQuantity - lotQuantity);
  const unattributedQuantity = Math.min(quantity, unattributedAvailable);
  let remainingLotQuantity =
    normalizeWarehouseLocationQuantity(quantity - unattributedQuantity) ?? 0;

  const lotAllocations: WarehouseTransferLotAllocation[] = [];
  const relocateLotIds: string[] = [];

  for (const lot of sortLotsForTransfer(sourceLots)) {
    if (remainingLotQuantity <= QUANTITY_EPSILON) break;
    const allocation = normalizeWarehouseLocationQuantity(
      Math.min(lot.quantity, remainingLotQuantity)
    );
    if (allocation === null || allocation <= 0) continue;

    lotAllocations.push({ lotId: lot.id, quantity: allocation });
    if (Math.abs(allocation - lot.quantity) <= QUANTITY_EPSILON) {
      relocateLotIds.push(lot.id);
    }
    remainingLotQuantity =
      normalizeWarehouseLocationQuantity(remainingLotQuantity - allocation) ?? 0;
  }

  if (remainingLotQuantity > QUANTITY_EPSILON) {
    return { ok: false, error: 'INVALID_AVAILABLE_STOCK' };
  }

  return {
    ok: true,
    quantity,
    relocateLotIds,
    lotAllocations,
    unattributedQuantity,
  };
}

export function prepareWarehousePhysicalTransfer(input: {
  materialId: string;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: readonly WarehouseLot[];
}): WarehousePhysicalTransferPreparationResult {
  if (
    !isWarehousePhysicalStockPosition(input.from)
    || !isWarehousePhysicalStockPosition(input.to)
  ) {
    return { ok: false, error: 'NON_PHYSICAL_POSITION' };
  }
  if (warehouseStockPositionsEqual(input.from, input.to)) {
    return { ok: false, error: 'SAME_POSITION' };
  }

  return planWarehouseTransferLots({
    materialId: input.materialId,
    source: input.from,
    quantity: input.quantity,
    availableQuantity: input.availableQuantity,
    lots: input.lots,
  });
}
