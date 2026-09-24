import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
    { ...data, id },
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
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      position: data.position,
      quantity: data.quantity,
      revision: data.revision,
      lastMovementId: data.lastMovementId,
    },
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
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      code: data.code,
      expiresOn: data.expiresOn ?? null,
      quantity: data.quantity,
      position: data.position,
      origin: data.origin,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
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
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      barcode: data.barcode,
      presentation: data.presentation,
      factorToBaseUnit: data.factorToBaseUnit,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_BARCODE');
  return result.data;
}

export function createWarehouseOutboundIdempotencyKey(): string {
  return 'phase8:express-outbound:' + crypto.randomUUID();
}

export async function applyWarehouseExpressOutbound(
  workspaceId: string,
  input: ApplyWarehouseExpressOutboundInput
): Promise<ApplyWarehouseExpressOutboundResult> {
  const scope = currentScope(workspaceId);
  const position = validateWarehouseStockPosition(input.position);
  if (!position) throw new Error('WAREHOUSE_OUTBOUND_INVALID_POSITION');

  const movementId = await createWarehouseMovementId(
    scope.workspaceId,
    input.idempotencyKey
  );
  const idempotencyKeyHash = movementId.slice('mov_'.length);
  const locationBalanceId = await createWarehouseLocationBalanceId(
    scope.workspaceId,
    input.materialId,
    position
  );

  const materialPath = warehouseDocumentPath(scope.workspaceId, 'materials', input.materialId);
  const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', input.materialId);
  const movementPath = warehouseDocumentPath(scope.workspaceId, 'movements', movementId);
  const locationBalancePath = warehouseDocumentPath(
    scope.workspaceId,
    'locationBalances',
    locationBalanceId
  );
  const barcodePath = input.barcodeAssociation
    ? warehouseDocumentPath(scope.workspaceId, 'barcodes', input.barcodeAssociation.id)
    : null;
  const lotPath = input.lotId
    ? warehouseDocumentPath(scope.workspaceId, 'lots', input.lotId)
    : null;

  try {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, materialPath);
      const balanceRef = doc(db, balancePath);
      const movementRef = doc(db, movementPath);
      const locationBalanceRef = doc(db, locationBalancePath);
      const barcodeRef = barcodePath ? doc(db, barcodePath) : null;
      const lotRef = lotPath ? doc(db, lotPath) : null;

      const [
        materialSnapshot,
        balanceSnapshot,
        movementSnapshot,
        locationBalanceSnapshot,
        barcodeSnapshot,
        lotSnapshot,
      ] = await Promise.all([
        transaction.get(materialRef),
        transaction.get(balanceRef),
        transaction.get(movementRef),
        transaction.get(locationBalanceRef),
        barcodeRef ? transaction.get(barcodeRef) : Promise.resolve(null),
        lotRef ? transaction.get(lotRef) : Promise.resolve(null),
      ]);

      if (!materialSnapshot.exists()) throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      if (!balanceSnapshot.exists()) throw new Error('WAREHOUSE_BALANCE_NOT_FOUND');

      const material = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      const currentBalance = parseBalance(
        scope.workspaceId,
        balanceSnapshot.id,
        balanceSnapshot.data() as Record<string, unknown>
      );
      if (material.ug !== scope.ug || currentBalance.ug !== scope.ug) {
        throw new Error('WAREHOUSE_OUTBOUND_UG_MISMATCH');
      }

      const currentLocationBalance = locationBalanceSnapshot.exists()
        ? parseLocationBalance(
            scope.workspaceId,
            locationBalanceSnapshot.id,
            locationBalanceSnapshot.data() as Record<string, unknown>
          )
        : null;

      const liveBarcode = barcodeSnapshot && barcodeSnapshot.exists()
        ? parseBarcode(
            scope.workspaceId,
            barcodeSnapshot.id,
            barcodeSnapshot.data() as Record<string, unknown>
          )
        : null;
      if (input.barcodeAssociation && !liveBarcode) {
        throw new Error('WAREHOUSE_BARCODE_NOT_FOUND');
      }
      if (
        input.barcodeAssociation
        && liveBarcode
        && JSON.stringify(liveBarcode) !== JSON.stringify(input.barcodeAssociation)
      ) {
        throw new Error('WAREHOUSE_BARCODE_CHANGED');
      }

      const lot = lotSnapshot && lotSnapshot.exists()
        ? parseLot(
            scope.workspaceId,
            lotSnapshot.id,
            lotSnapshot.data() as Record<string, unknown>
          )
        : null;
      if (input.lotId && !lot) throw new Error('WAREHOUSE_OUTBOUND_LOT_NOT_FOUND');

      if (movementSnapshot.exists()) {
        const existingMovement = parseMovement(
          scope.workspaceId,
          movementSnapshot.id,
          movementSnapshot.data() as Record<string, unknown>
        );
        const source = existingMovement.source;
        const requestedQuantity = normalizeWarehouseQuantity(input.requestedQuantity);
        const barcodeId = input.barcodeAssociation?.id || null;
        const lotId = input.lotId || null;
        const sameRequest =
          existingMovement.type === 'OUTBOUND'
          && existingMovement.workspaceId === scope.workspaceId
          && existingMovement.ug === scope.ug
          && existingMovement.materialId === input.materialId
          && source?.kind === 'EXPRESS_OUTBOUND'
          && requestedQuantity !== null
          && source.requestedQuantity === requestedQuantity
          && JSON.stringify(source.presentation) === JSON.stringify(input.presentation)
          && JSON.stringify(source.position) === JSON.stringify(position)
          && source.barcodeId === barcodeId
          && source.lotId === lotId
          && (existingMovement.note ?? null) === (input.note ?? null);

        if (!sameRequest || source?.kind !== 'EXPRESS_OUTBOUND') {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }

        if (!currentLocationBalance) {
          throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
        }

        return {
          applied: false,
          movement: existingMovement,
          previousBalance: currentBalance,
          balance: currentBalance,
          locationBalance: currentLocationBalance,
          plan: {
            requestedQuantity: source.requestedQuantity,
            baseQuantity: source.quantity,
            factorToBaseUnit: source.factorToBaseUnit,
            presentation: source.presentation,
            position: source.position,
            interface: source.interface,
            barcodeAssociation: liveBarcode,
            lot,
          },
          lot,
        };
      }

      const plan = prepareWarehouseExpressOutbound({
        material,
        balance: currentBalance,
        requestedQuantity: input.requestedQuantity,
        presentation: input.presentation,
        position,
        barcodeAssociation: liveBarcode,
        lot,
      });

      const initialLocationQuantity =
        position.kind === 'UNASSIGNED' && !currentLocationBalance
          ? currentBalance.quantity
          : 0;
      const availableAtPosition =
        currentLocationBalance?.quantity ?? initialLocationQuantity;
      if (availableAtPosition + 0.000001 < plan.baseQuantity) {
        throw new Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
      }

      const source: WarehouseExpressOutboundMovementSource = {
        kind: 'EXPRESS_OUTBOUND',
        interface: plan.interface,
        actorUid: scope.uid,
        requestedQuantity: plan.requestedQuantity,
        quantity: plan.baseQuantity,
        presentation: plan.presentation,
        factorToBaseUnit: plan.factorToBaseUnit,
        barcodeId: liveBarcode?.id || null,
        barcode: liveBarcode?.barcode || null,
        position,
        locationBalanceId,
        lotId: lot?.id || null,
        lotCode: lot?.code || null,
      };
      const candidateResult = validateWarehouseMovement(
        {
          schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
          id: movementId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          type: 'OUTBOUND',
          quantityDelta: -plan.baseQuantity,
          idempotencyKeyHash,
          reversesMovementId: null,
          note: input.note ?? null,
          source,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
          expectedMaterialId: material.id,
        }
      );
      if (!candidateResult.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_OUTBOUND_MOVEMENT: '
          + candidateResult.issues.map((item) => item.message).join('; ')
        );
      }
      const candidate = candidateResult.data;

      if (currentBalance.quantity + 0.000001 < plan.baseQuantity) {
        throw new Error('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
      }

      const nextBalance = applyWarehouseMovementToBalance(
        candidate,
        currentBalance
      );
      if (nextBalance.quantity < 0) {
        throw new Error('WAREHOUSE_OUTBOUND_NEGATIVE_STOCK');
      }
      const nextLocationBalance = applyWarehouseLocationDelta(
        currentLocationBalance,
        {
          id: locationBalanceId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          position,
          quantityDelta: -plan.baseQuantity,
          movementId,
          initialQuantity: initialLocationQuantity,
        }
      );

      transaction.set(movementRef, {
        ...candidate,
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        ...nextBalance,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationBalanceRef, {
        ...nextLocationBalance,
        updatedAt: serverTimestamp(),
      });

      let nextLot: WarehouseLot | null = lot;
      if (lot && lotRef) {
        const nextLotQuantity = Math.max(0, lot.quantity - plan.baseQuantity);
        transaction.update(lotRef, {
          quantity: nextLotQuantity,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
        nextLot = { ...lot, quantity: nextLotQuantity, updatedBy: scope.uid };
      }

      return {
        applied: true,
        movement: candidate,
        previousBalance: currentBalance,
        balance: nextBalance,
        locationBalance: nextLocationBalance,
        plan,
        lot: nextLot,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
}
