import {
  applyWarehouseLocationDelta,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  type WarehouseLocationBalance,
} from './location';
import {
  applyWarehouseMovementToBalance,
  normalizeWarehouseQuantity,
  validateWarehouseBalance,
  validateWarehouseMovement,
  type WarehouseBalance,
  type WarehouseMovement,
} from './movement';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import type {
  WarehouseConsumptionRecord,
} from './withdrawal';

const EPSILON = 0.000001;

export interface WarehouseOutboundReturnPlanInput {
  workspaceId: string;
  ug: string;
  actorUid: string;
  movementId: string;
  quantity: number;
  reason: string;
  consumption: WarehouseConsumptionRecord;
  originalMovement: WarehouseMovement;
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
}

export interface WarehouseOutboundReturnPlan {
  movement: WarehouseMovement;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
  returnedQuantity: number;
  remainingQuantity: number;
}

function samePosition(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function planWarehouseOutboundReturn(
  input: WarehouseOutboundReturnPlanInput
): WarehouseOutboundReturnPlan {
  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_INVALID_QUANTITY');
  }

  const reason = input.reason.trim().replace(/\s+/g, ' ');
  if (!reason || reason.length > 180) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_REASON_REQUIRED');
  }

  const materialValidation = validateWarehouseMaterial(
    input.material,
    {
      expectedWorkspaceId: input.workspaceId,
      expectedUg: input.ug,
    }
  );
  if (!materialValidation.ok || materialValidation.data.status !== 'active') {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_INVALID_MATERIAL');
  }
  const material = materialValidation.data;

  const balanceValidation = validateWarehouseBalance(
    input.balance,
    {
      expectedWorkspaceId: input.workspaceId,
      expectedUg: input.ug,
      expectedMaterialId: material.id,
    }
  );
  if (!balanceValidation.ok) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_INVALID_BALANCE');
  }
  const balance = balanceValidation.data;

  if (
    input.consumption.workspaceId !== input.workspaceId
    || input.consumption.ug !== input.ug
    || input.consumption.origin !== 'STOCK_OUTBOUND'
    || input.consumption.materialId !== material.id
    || !input.consumption.movementId
    || input.consumption.legacy
  ) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_INVALID_CONSUMPTION');
  }

  const original = input.originalMovement;
  if (
    original.workspaceId !== input.workspaceId
    || original.ug !== input.ug
    || original.materialId !== material.id
    || original.id !== input.consumption.movementId
    || original.type !== 'OUTBOUND'
    || original.source?.kind !== 'EXPRESS_OUTBOUND'
  ) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_ORIGINAL_INVALID');
  }

  const position = validateWarehouseStockPosition(original.source.position);
  if (!position) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_POSITION_INVALID');
  }

  const locationValidation = validateWarehouseLocationBalance(
    input.locationBalance,
    {
      expectedWorkspaceId: input.workspaceId,
      expectedUg: input.ug,
      expectedMaterialId: material.id,
    }
  );
  if (!locationValidation.ok) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_LOCATION_INVALID');
  }
  const locationBalance = locationValidation.data;
  if (
    locationBalance.id !== original.source.locationBalanceId
    || !samePosition(locationBalance.position, position)
  ) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_LOCATION_MISMATCH');
  }

  const returnedBefore = normalizeWarehouseQuantity(
    input.consumption.returnedQuantity
  );
  if (
    returnedBefore === null
    || returnedBefore < 0
    || returnedBefore > input.consumption.quantity + EPSILON
  ) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_INVALID_RETURNED_QUANTITY');
  }

  const remaining = normalizeWarehouseQuantity(
    input.consumption.quantity - returnedBefore
  );
  if (remaining === null || quantity > remaining + EPSILON) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING');
  }

  const idempotencyKeyHash = input.movementId.startsWith('mov_')
    ? input.movementId.slice(4)
    : '';
  const candidateValidation = validateWarehouseMovement(
    {
      schemaVersion: 'warehouse_movement_v1',
      id: input.movementId,
      workspaceId: input.workspaceId,
      ug: input.ug,
      materialId: material.id,
      type: 'OUTBOUND_RETURN',
      quantityDelta: quantity,
      idempotencyKeyHash,
      reversesMovementId: null,
      note: 'Devolução/cancelamento de saída · ' + input.consumption.id,
      source: {
        kind: 'OUTBOUND_RETURN',
        actorUid: input.actorUid,
        consumptionId: input.consumption.id,
        originalMovementId: original.id,
        quantity,
        position,
        locationBalanceId: original.source.locationBalanceId,
        lotId: original.source.lotId,
        reason,
      },
    },
    {
      expectedWorkspaceId: input.workspaceId,
      expectedUg: input.ug,
      expectedMaterialId: material.id,
    }
  );
  if (!candidateValidation.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_OUTBOUND_RETURN: '
      + candidateValidation.issues.map((item) => item.message).join('; ')
    );
  }
  const movement = candidateValidation.data;

  const nextBalance = applyWarehouseMovementToBalance(movement, balance);
  const nextLocationBalance = applyWarehouseLocationDelta(locationBalance, {
    id: locationBalance.id,
    workspaceId: input.workspaceId,
    ug: input.ug,
    materialId: material.id,
    position,
    quantityDelta: quantity,
    movementId: movement.id,
  });
  const returnedQuantity = normalizeWarehouseQuantity(
    returnedBefore + quantity
  );
  if (returnedQuantity === null) {
    throw new Error('WAREHOUSE_OUTBOUND_RETURN_OVERFLOW');
  }

  return {
    movement,
    balance: nextBalance,
    locationBalance: nextLocationBalance,
    returnedQuantity,
    remainingQuantity: normalizeWarehouseQuantity(
      input.consumption.quantity - returnedQuantity
    ) ?? 0,
  };
}
