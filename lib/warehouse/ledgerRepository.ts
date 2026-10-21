import { warehouseServerCommand } from './serverCommandClient';
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
  where,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
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


export async function listWarehousePositiveBalances(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseBalance[]> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'balances', '__probe__')
    .replace('/__probe__', '');

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('quantity', '>', 0),
        limit(Math.max(1, Math.min(maxResults, 500)))
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    // Um documento histórico inválido não deve ocultar os demais movimentos.
    // Nunca fabricar origem PHYSICAL_INVENTORY nem modificar registros antigos.
    return snapshot.docs.flatMap((item) => {
      const data = item.data() as Record<string, unknown>;
      try {
        const movement = parseMovement(normalizedWorkspaceId, item.id, data);
        const rawCreatedAt = data.createdAt as { toDate?: () => Date } | undefined;
        return [{
          movement,
          createdAt: rawCreatedAt && typeof rawCreatedAt.toDate === 'function'
            ? rawCreatedAt.toDate().toISOString() : null,
        }];
      } catch (error) {
        console.warn('[warehouse] Movimento histórico incompatível; leitura parcial preservada', {
          movementId: item.id,
          type: data.type,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseMovementsForMaterial(
  workspaceId: string,
  materialId: string,
  maxResults = 50
): Promise<WarehouseMovementListItem[]> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'movements', '__probe__')
    .replace('/__probe__', '');
  const bounded = Math.max(1, Math.min(maxResults, 100));

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('materialId', '==', materialId)
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs
      .flatMap((item) => {
        const data = item.data() as Record<string, unknown>;
        try {
          const movement = parseMovement(normalizedWorkspaceId, item.id, data);
          const rawCreatedAt = data.createdAt as { toDate?: () => Date } | undefined;
          return [{
            movement,
            createdAt: rawCreatedAt && typeof rawCreatedAt.toDate === 'function'
              ? rawCreatedAt.toDate().toISOString() : null,
          }];
        } catch (error) {
          console.warn('[warehouse] Movimento histórico incompatível em consulta por material', {
            movementId: item.id,
            type: data.type,
            error: error instanceof Error ? error.message : String(error),
          });
          return [];
        }
      })
      .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
      .slice(0, bounded);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseMovementsInPeriod(
  workspaceId: string,
  startAt: Date,
  endAt: Date,
  maxResults = 500
): Promise<WarehouseMovementListItem[]> {
  const normalizedWorkspaceId = normalizeRequiredWorkspace(workspaceId);
  if (
    !Number.isFinite(startAt.getTime())
    || !Number.isFinite(endAt.getTime())
    || endAt.getTime() < startAt.getTime()
  ) {
    throw new Error('WAREHOUSE_MOVEMENT_INVALID_PERIOD');
  }
  const path = warehouseDocumentPath(normalizedWorkspaceId, 'movements', '__probe__')
    .replace('/__probe__', '');
  const bounded = Math.max(1, Math.min(maxResults, 500));

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('createdAt', '>=', startAt),
        where('createdAt', '<=', endAt),
        orderBy('createdAt', 'desc'),
        limit(bounded)
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.flatMap((item) => {
      const data = item.data() as Record<string, unknown>;
      try {
        const movement = parseMovement(normalizedWorkspaceId, item.id, data);
        const rawCreatedAt = data.createdAt as { toDate?: () => Date } | undefined;
        return [{
          movement,
          createdAt: rawCreatedAt && typeof rawCreatedAt.toDate === 'function'
            ? rawCreatedAt.toDate().toISOString() : null,
        }];
      } catch (error) {
        console.warn('[warehouse] Movimento histórico incompatível em consulta por período', {
          movementId: item.id, type: data.type,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
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
  return warehouseServerCommand<ApplyWarehouseMovementResult>(workspaceId, 'LEDGER_MOVEMENT', input);
}
