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

export function compareWarehouseStockAvailability(
  left: WarehouseStockAvailabilityLike,
  right: WarehouseStockAvailabilityLike
): number {
  const leftExpiry = left.nearestExpiry || '9999-12-31';
  const rightExpiry = right.nearestExpiry || '9999-12-31';

  const expiryComparison = leftExpiry.localeCompare(rightExpiry);
  if (expiryComparison !== 0) return expiryComparison;

  return left.material.description.localeCompare(
    right.material.description,
    'pt-BR',
    { sensitivity: 'base' }
  );
}
