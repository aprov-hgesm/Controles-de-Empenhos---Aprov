import { classifyWarehouseMobileProductScan } from './mobileIntakeAllocation';
import type { WarehouseMobileScanKind } from './mobileScanner';
import {
  normalizeWarehouseLocationQuantity,
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';
import type { WarehouseLot } from './lot';

export const WAREHOUSE_MOBILE_TRANSFER_MAX_RELOCATE_LOTS = 24;
const QUANTITY_EPSILON = 0.000001;

export interface WarehouseMobileTransferLotAllocation {
  lotId: string;
  quantity: number;
}

export function classifyWarehouseMobileTransferProductScan(
  value: string
): WarehouseMobileScanKind {
  return classifyWarehouseMobileProductScan(value);
}

export type WarehouseMobileTransferPreparationError =
  | 'NON_PHYSICAL_POSITION'
  | 'SAME_POSITION'
  | 'INVALID_QUANTITY'
  | 'INVALID_AVAILABLE_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'TOO_MANY_ACTIVE_LOTS'
  | 'LOT_ATTRIBUTION_EXCEEDS_STOCK';

export type WarehouseMobileTransferQuantityResult =
  | {
      ok: true;
      quantity: number;
      relocateLotIds: string[];
      lotAllocations: WarehouseMobileTransferLotAllocation[];
      unattributedQuantity: number;
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
      lotAllocations: WarehouseMobileTransferLotAllocation[];
      unattributedQuantity: number;
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

function sortLotsForTransfer(lots: WarehouseLot[]): WarehouseLot[] {
  return [...lots].sort((left, right) => {
    const leftExpiry = left.expiresOn || '9999-12-31';
    const rightExpiry = right.expiresOn || '9999-12-31';
    const expiryCompare = leftExpiry.localeCompare(rightExpiry);
    if (expiryCompare !== 0) return expiryCompare;

    const codeCompare = left.code.localeCompare(right.code, 'pt-BR');
    if (codeCompare !== 0) return codeCompare;
    return left.id.localeCompare(right.id);
  });
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

  if (sourceLots.length > WAREHOUSE_MOBILE_TRANSFER_MAX_RELOCATE_LOTS) {
    return { ok: false, error: 'TOO_MANY_ACTIVE_LOTS' };
  }

  const lotQuantity = normalizeWarehouseLocationQuantity(
    sourceLots.reduce((total, lot) => total + lot.quantity, 0)
  );
  if (lotQuantity === null) {
    return { ok: false, error: 'INVALID_AVAILABLE_STOCK' };
  }
  if (lotQuantity > availableQuantity + QUANTITY_EPSILON) {
    return { ok: false, error: 'LOT_ATTRIBUTION_EXCEEDS_STOCK' };
  }

  // Quantidade física sem atribuição de lote permanece sem inventar
  // procedência. Somente a parcela que precisa de lote é fracionada.
  const unattributedAvailable = Math.max(0, availableQuantity - lotQuantity);
  const unattributedQuantity = Math.min(quantity, unattributedAvailable);
  let remainingLotQuantity = normalizeWarehouseLocationQuantity(
    quantity - unattributedQuantity
  ) ?? 0;

  const lotAllocations: WarehouseMobileTransferLotAllocation[] = [];
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
    remainingLotQuantity = normalizeWarehouseLocationQuantity(
      remainingLotQuantity - allocation
    ) ?? 0;
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
