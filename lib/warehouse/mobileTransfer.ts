import {
  normalizeWarehouseLocationQuantity,
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';
import type { WarehouseLot } from './lot';

export type WarehouseMobileTransferPreparationError =
  | 'NON_PHYSICAL_POSITION'
  | 'SAME_POSITION'
  | 'INVALID_QUANTITY'
  | 'INVALID_AVAILABLE_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PARTIAL_WITH_ACTIVE_LOTS_UNSUPPORTED';

export type WarehouseMobileTransferQuantityResult =
  | {
      ok: true;
      quantity: number;
      relocateLotIds: string[];
    }
  | {
      ok: false;
      error: Exclude<WarehouseMobileTransferPreparationError, 'SAME_POSITION' | 'NON_PHYSICAL_POSITION'>;
    };

export type WarehouseMobileTransferPreparationResult =
  | {
      ok: true;
      quantity: number;
      relocateLotIds: string[];
    }
  | {
      ok: false;
      error: WarehouseMobileTransferPreparationError;
    };

export function isWarehouseMobilePhysicalPosition(
  position: WarehouseStockPosition
): boolean {
  return position.kind === 'LOCATION' || position.kind === 'SUBPOSITION';
}

function activeLotsAtSource(input: {
  materialId: string;
  source: WarehouseStockPosition;
  lots: WarehouseLot[];
}): WarehouseLot[] {
  return input.lots.filter((lot) =>
    lot.materialId === input.materialId
    && lot.status === 'active'
    && lot.quantity > 0
    && warehouseStockPositionsEqual(lot.position, input.source)
  );
}

export function validateWarehouseMobileTransferQuantity(input: {
  materialId: string;
  source: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: WarehouseLot[];
}): WarehouseMobileTransferQuantityResult {
  const quantity = normalizeWarehouseLocationQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    return { ok: false, error: 'INVALID_QUANTITY' };
  }

  const availableQuantity = normalizeWarehouseLocationQuantity(input.availableQuantity);
  if (availableQuantity === null || availableQuantity < 0) {
    return { ok: false, error: 'INVALID_AVAILABLE_STOCK' };
  }
  if (quantity > availableQuantity) {
    return { ok: false, error: 'INSUFFICIENT_STOCK' };
  }

  const sourceLots = activeLotsAtSource({
    materialId: input.materialId,
    source: input.source,
    lots: input.lots,
  });

  if (sourceLots.length > 0 && quantity !== availableQuantity) {
    return { ok: false, error: 'PARTIAL_WITH_ACTIVE_LOTS_UNSUPPORTED' };
  }

  return {
    ok: true,
    quantity,
    relocateLotIds: quantity === availableQuantity
      ? Array.from(new Set(sourceLots.map((lot) => lot.id)))
      : [],
  };
}

export function prepareWarehouseMobileTransfer(input: {
  materialId: string;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  quantity: number;
  availableQuantity: number;
  lots: WarehouseLot[];
}): WarehouseMobileTransferPreparationResult {
  if (
    !isWarehouseMobilePhysicalPosition(input.from)
    || !isWarehouseMobilePhysicalPosition(input.to)
  ) {
    return { ok: false, error: 'NON_PHYSICAL_POSITION' };
  }
  if (warehouseStockPositionsEqual(input.from, input.to)) {
    return { ok: false, error: 'SAME_POSITION' };
  }

  return validateWarehouseMobileTransferQuantity({
    materialId: input.materialId,
    source: input.from,
    quantity: input.quantity,
    availableQuantity: input.availableQuantity,
    lots: input.lots,
  });
}
