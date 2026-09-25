import type { WarehouseDepotLayoutObject } from './layout';
import type { WarehouseLocationBalance } from './location';

export interface WarehouseMaterialPositionProjection {
  positiveBalances: WarehouseLocationBalance[];
  currentDepotBalances: WarehouseLocationBalance[];
  otherDepotBalances: WarehouseLocationBalance[];
  unassignedQuantity: number;
  totalPositiveQuantity: number;
}

export function deriveWarehouseMaterialPositions(
  balances: WarehouseLocationBalance[],
  materialId: string,
  depotId: string
): WarehouseMaterialPositionProjection {
  if (!materialId) {
    return {
      positiveBalances: [],
      currentDepotBalances: [],
      otherDepotBalances: [],
      unassignedQuantity: 0,
      totalPositiveQuantity: 0,
    };
  }

  const positiveBalances = balances.filter(
    (balance) => balance.materialId === materialId && balance.quantity > 0
  );

  let unassignedQuantity = 0;
  let totalPositiveQuantity = 0;
  const currentDepotBalances: WarehouseLocationBalance[] = [];
  const otherDepotBalances: WarehouseLocationBalance[] = [];

  for (const balance of positiveBalances) {
    totalPositiveQuantity += balance.quantity;

    if (balance.position.kind === 'UNASSIGNED') {
      unassignedQuantity += balance.quantity;
      continue;
    }

    if (balance.position.depotId === depotId) {
      currentDepotBalances.push(balance);
    } else {
      otherDepotBalances.push(balance);
    }
  }

  return {
    positiveBalances,
    currentDepotBalances,
    otherDepotBalances,
    unassignedQuantity,
    totalPositiveQuantity,
  };
}

export function representedWarehouseLocationIds(
  objects: WarehouseDepotLayoutObject[]
): Set<string> {
  return new Set(
    objects
      .map((object) => object.warehouseLocationId)
      .filter((locationId): locationId is string => Boolean(locationId))
  );
}
