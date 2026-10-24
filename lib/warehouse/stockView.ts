export interface WarehouseStockAvailabilityLike {
  balance: {
    quantity: number;
  };
  material: {
    description: string;
  };
  nearestExpiry: string | null;
}

export function hasWarehouseAvailableStock(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0;
}

export interface WarehouseStockLocationBalanceLike {
  quantity: number;
  position: {
    kind: string;
  };
}

export function isWarehouseLocatedBalance(
  balance: WarehouseStockLocationBalanceLike
): boolean {
  return Number.isFinite(balance.quantity)
    && balance.quantity > 0
    && balance.position.kind !== 'UNASSIGNED';
}

export type WarehouseStockExpiryFilter =
  | ''
  | 'EXPIRED'
  | 'NEAR_EXPIRY'
  | 'VALID'
  | 'NO_EXPIRY';

export function matchesWarehouseExpiryState(
  states: readonly string[],
  filter: WarehouseStockExpiryFilter
): boolean {
  return !filter || states.includes(filter);
}

export function compareWarehouseStockAvailability(
  left: WarehouseStockAvailabilityLike,
  right: WarehouseStockAvailabilityLike
): number {
  return left.material.description.localeCompare(
    right.material.description,
    'pt-BR',
    { sensitivity: 'base' }
  );
}
