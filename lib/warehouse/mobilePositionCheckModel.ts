import {
  warehouseStockPositionKey,
  warehouseStockPositionsEqual,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import type { WarehouseMobilePhysicalQueryItem } from './mobilePhysicalQueryModel';

export type WarehouseMobilePositionCheckDecision =
  | {
      status: 'CORRECT';
      current: WarehouseMobilePhysicalQueryItem;
      alternatives: [];
    }
  | {
      status: 'INCORRECT';
      current: null;
      alternatives: WarehouseLocationBalance[];
    };

function assertPhysicalPosition(position: WarehouseStockPosition): void {
  if (position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PHYSICAL_POSITION_REQUIRED');
  }
}

function assertScope(
  entity: { workspaceId: string; ug: string },
  workspaceId: string,
  ug: string,
  label: string
): void {
  if (entity.workspaceId !== workspaceId) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_' + label + '_WORKSPACE_MISMATCH');
  }
  if (entity.ug !== ug) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_' + label + '_UG_MISMATCH');
  }
}

export function buildWarehouseMobilePositionCheckDecision(input: {
  workspaceId: string;
  ug: string;
  selectedPosition: WarehouseStockPosition;
  materialId: string;
  physicalItems: readonly WarehouseMobilePhysicalQueryItem[];
  materialBalances: readonly WarehouseLocationBalance[];
}): WarehouseMobilePositionCheckDecision {
  assertPhysicalPosition(input.selectedPosition);

  const currentMatches = input.physicalItems.filter((item) => {
    assertScope(item.material, input.workspaceId, input.ug, 'MATERIAL');
    assertScope(item.balance, input.workspaceId, input.ug, 'BALANCE');

    if (item.material.id !== item.balance.materialId) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_ITEM_MATERIAL_MISMATCH');
    }

    return item.material.id === input.materialId
      && item.balance.quantity > 0
      && warehouseStockPositionsEqual(item.balance.position, input.selectedPosition);
  });

  if (currentMatches.length > 1) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_DUPLICATE_CURRENT_BALANCE');
  }

  if (currentMatches.length === 1) {
    return {
      status: 'CORRECT',
      current: currentMatches[0],
      alternatives: [],
    };
  }

  const alternatives: WarehouseLocationBalance[] = [];
  const seen = new Set<string>();

  input.materialBalances.forEach((balance) => {
    assertScope(balance, input.workspaceId, input.ug, 'ALTERNATIVE_BALANCE');

    if (balance.materialId !== input.materialId) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_ALTERNATIVE_MATERIAL_MISMATCH');
    }
    if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') {
      return;
    }

    if (warehouseStockPositionsEqual(balance.position, input.selectedPosition)) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_CONCURRENT_POSITION_CHANGE');
    }

    const key = warehouseStockPositionKey(balance.position);
    if (seen.has(key)) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_DUPLICATE_ALTERNATIVE_POSITION');
    }
    seen.add(key);
    alternatives.push(balance);
  });

  return {
    status: 'INCORRECT',
    current: null,
    alternatives: alternatives.sort((left, right) =>
      warehouseStockPositionKey(left.position).localeCompare(
        warehouseStockPositionKey(right.position)
      )
    ),
  };
}
