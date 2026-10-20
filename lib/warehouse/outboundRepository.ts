import { warehouseServerCommand } from './serverCommandClient';
import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  validateWarehouseBarcodeAssociation,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  validateWarehouseLot,
  type WarehouseLot,
} from './lot';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';
import {
  applyWarehouseMovementToBalance,
  createWarehouseMovementId,
  validateWarehouseBalance,
  normalizeWarehouseQuantity,
  validateWarehouseMovement,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseExpressOutboundMovementSource,
  type WarehouseMovement,
} from './movement';
import {
  prepareWarehouseExpressOutbound,
  type WarehouseExpressOutboundPlan,
} from './outbound';
import { warehouseDocumentPath } from './namespace';
import {
  warehouseCanonicalBarcodeReadInput,
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';

export interface ApplyWarehouseExpressOutboundInput {
  materialId: string;
  requestedQuantity: number;
  presentation: WarehouseMaterialUnit;
  position: WarehouseStockPosition;
  barcodeAssociation?: WarehouseBarcodeAssociation | null;
  lotId?: string | null;
  idempotencyKey: string;
  note?: string | null;
}

export interface ApplyWarehouseExpressOutboundResult {
  applied: boolean;
  movement: WarehouseMovement;
  previousBalance: WarehouseBalance;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
  plan: WarehouseExpressOutboundPlan;
  lot: WarehouseLot | null;
}

function currentScope(workspaceId: string): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_OUTBOUND_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_OUTBOUND_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

function parseMaterial(workspaceId: string, id: string, data: Record<string, unknown>): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
  return result.data;
}

function parseBalance(
  workspaceId: string,
  materialId: string,
  data: Record<string, unknown>
): WarehouseBalance {
  const result = validateWarehouseBalance(
    {
      schemaVersion: data.schemaVersion,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      quantity: data.quantity,
      revision: data.revision,
      lastMovementId: data.lastMovementId,
    },
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_BALANCE');
  return result.data;
}

function parseLocationBalance(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  const result = validateWarehouseLocationBalance(
    warehouseCanonicalLocationBalanceReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_LOCATION_BALANCE');
  return result.data;
}

function parseMovement(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMovement {
  const result = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      type: data.type,
      quantityDelta: data.quantityDelta,
      idempotencyKeyHash: data.idempotencyKeyHash,
      reversesMovementId: data.reversesMovementId ?? null,
      note: data.note ?? null,
      source: data.source ?? null,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MOVEMENT');
  return result.data;
}

function parseLot(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const result = validateWarehouseLot(
    warehouseCanonicalLotReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_LOT');
  return result.data;
}

function parseBarcode(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseBarcodeAssociation {
  const result = validateWarehouseBarcodeAssociation(
    warehouseCanonicalBarcodeReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_BARCODE');
  return result.data;
}

export function createWarehouseOutboundIdempotencyKey(): string {
  return 'phase8:express-outbound:' + crypto.randomUUID();
}

/**
 * Retirada de estoque via backend Warehouse R2.
 * O navegador não calcula saldos finais nem grava movimentos.
 */
export async function applyWarehouseExpressOutbound(
  workspaceId: string,input: ApplyWarehouseExpressOutboundInput
): Promise<ApplyWarehouseExpressOutboundResult> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<ApplyWarehouseExpressOutboundResult>(
    scope.workspaceId,'EXPRESS_OUTBOUND',input
  );
}
