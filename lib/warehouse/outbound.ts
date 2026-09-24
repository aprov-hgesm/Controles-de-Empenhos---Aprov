import {
  barcodeAssociationMatchesMaterial,
  convertWarehouseBarcodeQuantityToBase,
  warehousePresentationFactor,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  convertWarehouseMaterialQuantityToBase,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';
import { warehouseStockPositionsEqual, type WarehouseStockPosition } from './location';
import type { WarehouseLot } from './lot';
import { normalizeWarehouseQuantity, type WarehouseBalance } from './movement';

export type WarehouseExpressOutboundInterface =
  | 'BARCODE_SCANNER'
  | 'MANUAL_SEARCH';

export interface PrepareWarehouseExpressOutboundInput {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  requestedQuantity: number;
  presentation: WarehouseMaterialUnit;
  position: WarehouseStockPosition;
  barcodeAssociation?: WarehouseBarcodeAssociation | null;
  lot?: WarehouseLot | null;
}

export interface WarehouseExpressOutboundPlan {
  requestedQuantity: number;
  baseQuantity: number;
  factorToBaseUnit: number;
  presentation: WarehouseMaterialUnit;
  position: WarehouseStockPosition;
  interface: WarehouseExpressOutboundInterface;
  barcodeAssociation: WarehouseBarcodeAssociation | null;
  lot: WarehouseLot | null;
}

export function prepareWarehouseExpressOutbound(
  input: PrepareWarehouseExpressOutboundInput
): WarehouseExpressOutboundPlan {
  if (input.material.status !== 'active') {
    throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
  }
  if (
    input.balance.workspaceId !== input.material.workspaceId
    || input.balance.ug !== input.material.ug
    || input.balance.materialId !== input.material.id
  ) {
    throw new Error('WAREHOUSE_OUTBOUND_BALANCE_SCOPE_MISMATCH');
  }

  const requestedQuantity = normalizeWarehouseQuantity(input.requestedQuantity);
  if (requestedQuantity === null || requestedQuantity <= 0) {
    throw new Error('WAREHOUSE_OUTBOUND_INVALID_QUANTITY');
  }
  const factorToBaseUnit = warehousePresentationFactor(
    input.material,
    input.presentation
  );
  if (factorToBaseUnit === null) {
    throw new Error('WAREHOUSE_OUTBOUND_PRESENTATION_NOT_CONFIGURED');
  }

  const barcodeAssociation = input.barcodeAssociation || null;
  let baseQuantity: number;
  if (barcodeAssociation) {
    if (barcodeAssociation.status !== 'active') {
      throw new Error('WAREHOUSE_BARCODE_INACTIVE');
    }
    if (!barcodeAssociationMatchesMaterial(barcodeAssociation, input.material)) {
      throw new Error('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH');
    }
    if (
      JSON.stringify(barcodeAssociation.presentation) !== JSON.stringify(input.presentation)
      || barcodeAssociation.factorToBaseUnit !== factorToBaseUnit
    ) {
      throw new Error('WAREHOUSE_BARCODE_PRESENTATION_MISMATCH');
    }
    baseQuantity = convertWarehouseBarcodeQuantityToBase(
      barcodeAssociation,
      requestedQuantity
    );
  } else {
    baseQuantity = convertWarehouseMaterialQuantityToBase(
      input.material,
      requestedQuantity,
      input.presentation
    );
    const normalizedBase = normalizeWarehouseQuantity(baseQuantity);
    if (normalizedBase === null || normalizedBase <= 0) {
      throw new Error('WAREHOUSE_OUTBOUND_INVALID_CONVERSION');
    }
    baseQuantity = normalizedBase;
  }

  if (baseQuantity > input.balance.quantity + 0.000001) {
    throw new Error('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
  }

  const lot = input.lot || null;
  if (lot) {
    if (
      lot.workspaceId !== input.material.workspaceId
      || lot.ug !== input.material.ug
      || lot.materialId !== input.material.id
    ) {
      throw new Error('WAREHOUSE_OUTBOUND_LOT_SCOPE_MISMATCH');
    }
    if (lot.status !== 'active') throw new Error('WAREHOUSE_OUTBOUND_LOT_INACTIVE');
    if (!warehouseStockPositionsEqual(lot.position, input.position)) {
      throw new Error('WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH');
    }
    if (lot.quantity + 0.000001 < baseQuantity) {
      throw new Error('WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION');
    }
  }

  return {
    requestedQuantity,
    baseQuantity,
    factorToBaseUnit,
    presentation: input.presentation,
    position: input.position,
    interface: barcodeAssociation ? 'BARCODE_SCANNER' : 'MANUAL_SEARCH',
    barcodeAssociation,
    lot,
  };
}
