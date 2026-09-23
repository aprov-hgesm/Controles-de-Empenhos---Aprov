import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db, handleFirestoreError, OperationType } from '../firebase';
import { isValidWorkspaceId, normalizeWorkspaceId } from '../platformIdentity';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  applyWarehouseMovementToBalance,
  createWarehouseMovementId,
  validateWarehouseBalance,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
  type WarehouseMovementSource,
  type WarehouseMovementType,
} from './movement';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import { warehouseDocumentPath } from './namespace';

export interface ApplyWarehouseMovementInput {
  materialId: string;
  type: WarehouseMovementType;
  quantityDelta: number;
  idempotencyKey: string;
  reversesMovementId?: string | null;
  note?: string | null;
  source?: WarehouseMovementSource | null;
}

export interface ApplyWarehouseMovementResult {
  applied: boolean;
  movement: WarehouseMovement;
  balance: WarehouseBalance;
}

export interface WarehouseMovementListItem {
  movement: WarehouseMovement;
  createdAt: string | null;
}

function normalizeRequiredWorkspace(workspaceId: string): string {
  const normalized = normalizeWorkspaceId(workspaceId);
  if (!isValidWorkspaceId(normalized)) {
    throw new Error('WAREHOUSE_INVALID_WORKSPACE_ID');
  }
  return normalized;
}

function parseMaterial(
  workspaceId: string,
  materialId: string,
  data: Record<string, unknown>
): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    { ...data, id: materialId },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MATERIAL: ' +
      result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

function parseMovement(
  workspaceId: string,
  movementId: string,
  data: Record<string, unknown>
): WarehouseMovement {
  const result = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id: movementId,
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
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MOVEMENT: ' +
      result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
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
    {
      expectedWorkspaceId: workspaceId,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_BALANCE: ' +
      result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

function parseLocationBalance(
  workspaceId: string,
  locationBalanceId: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  const result = validateWarehouseLocationBalance(
    {
      schemaVersion: data.schemaVersion,
      id: locationBalanceId,
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
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_LOCATION_BALANCE: ' +
      result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}


export async function getWarehouseBalance(
  workspaceId: string,
  materialId: string
): Promise<WarehouseBalance | null> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'balances', materialId);

  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    return parseBalance(
      normalizedWorkspaceId,
      snapshot.id,
      snapshot.data() as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getWarehouseMovement(
  workspaceId: string,
  movementId: string
): Promise<WarehouseMovement | null> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'movements', movementId);

  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    return parseMovement(
      normalizedWorkspaceId,
      snapshot.id,
      snapshot.data() as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function listWarehouseBalances(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseBalance[]> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'balances', '__probe__')
    .replace('/__probe__', '');

  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500))))
    );
    return snapshot.docs.map((item) =>
      parseBalance(
        normalizedWorkspaceId,
        item.id,
        item.data() as Record<string, unknown>
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseMovements(
  workspaceId: string,
  maxResults = 100
): Promise<WarehouseMovementListItem[]> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'movements', '__probe__')
    .replace('/__probe__', '');

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        orderBy('createdAt', 'desc'),
        limit(Math.max(1, Math.min(maxResults, 250)))
      )
    );
    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      const rawCreatedAt = data.createdAt as { toDate?: () => Date } | undefined;
      return {
        movement: parseMovement(normalizedWorkspaceId, item.id, data),
        createdAt:
          rawCreatedAt && typeof rawCreatedAt.toDate === 'function'
            ? rawCreatedAt.toDate().toISOString()
            : null,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function applyWarehouseMovement(
  workspaceId: string,
  input: ApplyWarehouseMovementInput
): Promise<ApplyWarehouseMovementResult> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  if (input.type === 'TRANSFER') {
    throw new Error('WAREHOUSE_TRANSFER_REQUIRES_LOCATION_FLOW');
  }
  const movementId = await createWarehouseMovementId(
    normalizedWorkspaceId,
    input.idempotencyKey
  );
  const idempotencyKeyHash = movementId.slice('mov_'.length);

  const materialPath = warehouseDocumentPath(
    normalizedWorkspaceId,
    'materials',
    input.materialId
  );
  const movementPath = warehouseDocumentPath(
    normalizedWorkspaceId,
    'movements',
    movementId
  );
  const balancePath = warehouseDocumentPath(
    normalizedWorkspaceId,
    'balances',
    input.materialId
  );
  const reversalPath = input.reversesMovementId
    ? warehouseDocumentPath(
        normalizedWorkspaceId,
        'movements',
        input.reversesMovementId
      )
    : null;
  const unassignedPosition: WarehouseStockPosition = { kind: 'UNASSIGNED' };
  const unassignedBalanceId = await createWarehouseLocationBalanceId(
    normalizedWorkspaceId,
    input.materialId,
    unassignedPosition
  );
  const unassignedBalancePath = warehouseDocumentPath(
    normalizedWorkspaceId,
    'locationBalances',
    unassignedBalanceId
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, materialPath);
      const movementRef = doc(db, movementPath);
      const balanceRef = doc(db, balancePath);
      const reversalRef = reversalPath ? doc(db, reversalPath) : null;
      const unassignedBalanceRef = doc(db, unassignedBalancePath);

      const materialSnapshot = await transaction.get(materialRef);
      const existingMovementSnapshot = await transaction.get(movementRef);
      const balanceSnapshot = await transaction.get(balanceRef);
      const unassignedBalanceSnapshot = await transaction.get(unassignedBalanceRef);
      const reversedSnapshot = reversalRef
        ? await transaction.get(reversalRef)
        : null;

      if (!materialSnapshot.exists()) {
        throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      }

      const material = parseMaterial(
        normalizedWorkspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      const candidateResult = validateWarehouseMovement(
        {
          schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
          id: movementId,
          workspaceId: normalizedWorkspaceId,
          ug: material.ug,
          materialId: material.id,
          type: input.type,
          quantityDelta: input.quantityDelta,
          idempotencyKeyHash,
          reversesMovementId: input.reversesMovementId ?? null,
          note: input.note ?? null,
          source: input.source ?? null,
        },
        {
          expectedWorkspaceId: normalizedWorkspaceId,
          expectedUg: material.ug,
          expectedMaterialId: material.id,
        }
      );

      if (!candidateResult.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_MOVEMENT: ' +
          candidateResult.issues.map((item) => item.path + ': ' + item.message).join('; ')
        );
      }

      const candidate = candidateResult.data;

      const currentBalance = balanceSnapshot.exists()
        ? parseBalance(
            normalizedWorkspaceId,
            balanceSnapshot.id,
            balanceSnapshot.data() as Record<string, unknown>
          )
        : null;

      if (existingMovementSnapshot.exists()) {
        const existing = parseMovement(
          normalizedWorkspaceId,
          existingMovementSnapshot.id,
          existingMovementSnapshot.data() as Record<string, unknown>
        );

        if (!warehouseMovementMatchesReplay(existing, candidate)) {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        if (!currentBalance) {
          throw new Error('WAREHOUSE_LEDGER_BALANCE_INCONSISTENT');
        }

        return {
          applied: false,
          movement: existing,
          balance: currentBalance,
        };
      }

      if (material.status !== 'active') {
        throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
      }

      if (candidate.type === 'REVERSAL') {
        if (!reversedSnapshot?.exists()) {
          throw new Error('WAREHOUSE_REVERSAL_TARGET_NOT_FOUND');
        }
        const reversed = parseMovement(
          normalizedWorkspaceId,
          reversedSnapshot.id,
          reversedSnapshot.data() as Record<string, unknown>
        );
        if (
          reversed.materialId !== candidate.materialId ||
          candidate.quantityDelta !== -reversed.quantityDelta
        ) {
          throw new Error('WAREHOUSE_INVALID_REVERSAL');
        }
      }

      const nextBalance = applyWarehouseMovementToBalance(candidate, currentBalance);
      const currentUnassignedBalance = unassignedBalanceSnapshot.exists()
        ? parseLocationBalance(
            normalizedWorkspaceId,
            unassignedBalanceSnapshot.id,
            unassignedBalanceSnapshot.data() as Record<string, unknown>
          )
        : null;
      const nextUnassignedBalance = applyWarehouseLocationDelta(
        currentUnassignedBalance,
        {
          id: unassignedBalanceId,
          workspaceId: normalizedWorkspaceId,
          ug: material.ug,
          materialId: material.id,
          position: unassignedPosition,
          quantityDelta: candidate.quantityDelta,
          movementId: candidate.id,
          initialQuantity: currentUnassignedBalance ? 0 : (currentBalance?.quantity || 0),
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
      transaction.set(unassignedBalanceRef, {
        ...nextUnassignedBalance,
        updatedAt: serverTimestamp(),
      });

      return {
        applied: true,
        movement: candidate,
        balance: nextBalance,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
}
