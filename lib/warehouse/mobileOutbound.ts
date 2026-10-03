import type { WarehouseBarcodeAssociation } from './barcode';
import {
  warehouseStockPositionKey,
  warehouseStockPositionsEqual,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import { selectWarehouseFefoLot, type WarehouseLot } from './lot';
import type { WarehouseMaterial } from './material';
import { classifyWarehouseMobileProductScan } from './mobileIntakeAllocation';
import type { WarehouseMobileScanKind } from './mobileScanner';
import type { WarehouseBalance } from './movement';
import {
  prepareWarehouseExpressOutbound,
  type WarehouseExpressOutboundPlan,
} from './outbound';

const QUANTITY_EPSILON = 0.000001;

export type WarehouseMobilePhysicalPosition = Exclude<
  WarehouseStockPosition,
  { kind: 'UNASSIGNED' }
>;

export interface WarehouseMobileOutboundPositionOption {
  key: string;
  position: WarehouseMobilePhysicalPosition;
  balance: WarehouseLocationBalance;
  lots: WarehouseLot[];
  fefoLot: WarehouseLot | null;
}

export interface WarehouseMobileOutboundPreparation {
  requestedQuantity: number;
  baseQuantity: number;
  plan: WarehouseExpressOutboundPlan;
  options: WarehouseMobileOutboundPositionOption[];
  recommendedLot: WarehouseLot | null;
  recommendedPosition: WarehouseMobilePhysicalPosition | null;
}

export function classifyWarehouseMobileOutboundProductScan(
  value: string
): WarehouseMobileScanKind {
  return classifyWarehouseMobileProductScan(value);
}

function assertSnapshotScope(input: {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  locationBalances: readonly WarehouseLocationBalance[];
  lots: readonly WarehouseLot[];
}) {
  const { material, balance } = input;
  if (
    balance.workspaceId !== material.workspaceId
    || balance.ug !== material.ug
    || balance.materialId !== material.id
  ) {
    throw new Error('WAREHOUSE_MOBILE_OUTBOUND_BALANCE_SCOPE_MISMATCH');
  }

  input.locationBalances.forEach((item) => {
    if (
      item.workspaceId !== material.workspaceId
      || item.ug !== material.ug
      || item.materialId !== material.id
    ) {
      throw new Error('WAREHOUSE_MOBILE_OUTBOUND_LOCATION_SCOPE_MISMATCH');
    }
  });

  input.lots.forEach((lot) => {
    if (
      lot.workspaceId !== material.workspaceId
      || lot.ug !== material.ug
      || lot.materialId !== material.id
    ) {
      throw new Error('WAREHOUSE_MOBILE_OUTBOUND_LOT_SCOPE_MISMATCH');
    }
  });
}

export function prepareWarehouseMobileOutboundOptions(input: {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  barcodeAssociation: WarehouseBarcodeAssociation;
  requestedQuantity: number;
  locationBalances: readonly WarehouseLocationBalance[];
  lots: readonly WarehouseLot[];
  today?: Date;
}): WarehouseMobileOutboundPreparation {
  assertSnapshotScope(input);

  const plan = prepareWarehouseExpressOutbound({
    material: input.material,
    balance: input.balance,
    requestedQuantity: input.requestedQuantity,
    presentation: input.barcodeAssociation.presentation,
    position: { kind: 'UNASSIGNED' },
    barcodeAssociation: input.barcodeAssociation,
  });

  const physicalBalances = input.locationBalances.filter(
    (item): item is WarehouseLocationBalance & { position: WarehouseMobilePhysicalPosition } =>
      item.position.kind !== 'UNASSIGNED'
      && item.quantity + QUANTITY_EPSILON >= plan.baseQuantity
  );

  if (physicalBalances.length === 0) {
    throw new Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
  }

  const options = physicalBalances.map((balance) => {
    const lots = input.lots.filter(
      (lot) =>
        lot.quantity > 0
        && warehouseStockPositionsEqual(lot.position, balance.position)
    );
    const fefoLot = selectWarehouseFefoLot(
      lots.filter((lot) => lot.quantity + QUANTITY_EPSILON >= plan.baseQuantity),
      input.today
    );

    return {
      key: warehouseStockPositionKey(balance.position),
      position: balance.position,
      balance,
      lots,
      fefoLot,
    };
  });

  const recommendedLot = selectWarehouseFefoLot(
    options.flatMap((option) =>
      option.lots.filter(
        (lot) => lot.quantity + QUANTITY_EPSILON >= plan.baseQuantity
      )
    ),
    input.today
  );

  let recommendedPosition: WarehouseMobilePhysicalPosition | null = null;
  if (recommendedLot && recommendedLot.position.kind !== 'UNASSIGNED') {
    recommendedPosition = recommendedLot.position;
  }
  const recommendedKey = recommendedPosition
    ? warehouseStockPositionKey(recommendedPosition)
    : null;

  options.sort((left, right) => {
    if (recommendedKey) {
      if (left.key === recommendedKey && right.key !== recommendedKey) return -1;
      if (right.key === recommendedKey && left.key !== recommendedKey) return 1;
    }
    return left.key.localeCompare(right.key);
  });

  return {
    requestedQuantity: plan.requestedQuantity,
    baseQuantity: plan.baseQuantity,
    plan,
    options,
    recommendedLot,
    recommendedPosition,
  };
}

export function prepareWarehouseMobileOutboundReview(input: {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  barcodeAssociation: WarehouseBarcodeAssociation;
  requestedQuantity: number;
  position: WarehouseMobilePhysicalPosition;
  locationBalance: WarehouseLocationBalance;
  lot?: WarehouseLot | null;
}): WarehouseExpressOutboundPlan {
  if (
    input.locationBalance.workspaceId !== input.material.workspaceId
    || input.locationBalance.ug !== input.material.ug
    || input.locationBalance.materialId !== input.material.id
    || !warehouseStockPositionsEqual(input.locationBalance.position, input.position)
  ) {
    throw new Error('WAREHOUSE_MOBILE_OUTBOUND_LOCATION_SCOPE_MISMATCH');
  }

  const plan = prepareWarehouseExpressOutbound({
    material: input.material,
    balance: input.balance,
    requestedQuantity: input.requestedQuantity,
    presentation: input.barcodeAssociation.presentation,
    position: input.position,
    barcodeAssociation: input.barcodeAssociation,
    lot: input.lot || null,
  });

  if (input.locationBalance.quantity + QUANTITY_EPSILON < plan.baseQuantity) {
    throw new Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
  }

  return plan;
}

export function warehouseMobileOutboundScannedPositionMatches(
  scanned: WarehouseStockPosition,
  selected: WarehouseStockPosition
): boolean {
  return (
    scanned.kind !== 'UNASSIGNED'
    && selected.kind !== 'UNASSIGNED'
    && warehouseStockPositionsEqual(scanned, selected)
  );
}
