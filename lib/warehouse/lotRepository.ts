import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  WAREHOUSE_LOT_SCHEMA_VERSION,
  createWarehouseLotId,
  validateWarehouseLot,
  type WarehouseLot,
  type WarehouseLotOrigin,
  type WarehouseLotStatus,
} from './lot';
import { validateWarehouseMaterial, type WarehouseMaterial } from './material';
import { validateWarehouseBalance, type WarehouseBalance } from './movement';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import { warehouseServerCommand } from './serverCommandClient';
import { warehouseVisualExpiryCutoffDate } from './stockVisual';

export interface WarehouseLotListItem {
  lot: WarehouseLot;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateWarehouseLotInput {
  materialId: string;
  code: string;
  expiresOn?: string | null;
  quantity: number;
  position: WarehouseStockPosition;
  origin?: WarehouseLotOrigin;
}

export interface UpdateWarehouseLotInput {
  code?: string;
  expiresOn?: string | null;
  quantity?: number;
  position?: WarehouseStockPosition;
  origin?: WarehouseLotOrigin;
  status?: WarehouseLotStatus;
}

function timestampToIso(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function currentScope(
  workspaceId: string
): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_LOT_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_LOT_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

function parseMaterial(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterial {
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
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_LOT: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

function manualOrigin(): WarehouseLotOrigin {
  return {
    kind: 'MANUAL_ENRICHMENT',
    movementId: null,
    invoiceRecordKey: null,
    invoiceId: null,
    supplier: null,
    supplierCnpj: null,
  };
}

async function assertLotPositionBackedByStock(input: {
  workspaceId: string;
  materialId: string;
  position: WarehouseStockPosition;
  quantity: number;
}): Promise<void> {
  const balancePath = warehouseDocumentPath(
    input.workspaceId,
    'balances',
    input.materialId
  );
  const balanceSnapshot = await getDoc(doc(db, balancePath));
  if (!balanceSnapshot.exists()) throw new Error('WAREHOUSE_BALANCE_NOT_FOUND');
  const balance = parseBalance(
    input.workspaceId,
    input.materialId,
    balanceSnapshot.data() as Record<string, unknown>
  );
  if (input.quantity > balance.quantity + 0.000001) {
    throw new Error('WAREHOUSE_LOT_QUANTITY_EXCEEDS_BALANCE');
  }

  if (input.position.kind === 'UNASSIGNED') return;

  const locationBalanceId = await createWarehouseLocationBalanceId(
    input.workspaceId,
    input.materialId,
    input.position
  );
  const locationBalancePath = warehouseDocumentPath(
    input.workspaceId,
    'locationBalances',
    locationBalanceId
  );
  const locationBalanceSnapshot = await getDoc(doc(db, locationBalancePath));
  if (!locationBalanceSnapshot.exists()) {
    throw new Error('WAREHOUSE_LOT_POSITION_WITHOUT_STOCK');
  }
  const locationBalance = parseLocationBalance(
    input.workspaceId,
    locationBalanceId,
    locationBalanceSnapshot.data() as Record<string, unknown>
  );
  if (input.quantity > locationBalance.quantity + 0.000001) {
    throw new Error('WAREHOUSE_LOT_QUANTITY_EXCEEDS_LOCATION');
  }
}

export async function listWarehouseLots(
  workspaceId: string,
  maxResults = 500,
  materialId?: string
): Promise<WarehouseLotListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'lots');
  try {
    const base = collection(db, path);
    const bounded = Math.max(1, Math.min(maxResults, 500));
    const snapshot = materialId
      ? await getDocs(query(base, where('materialId', '==', materialId), limit(bounded)))
      : await getDocs(query(base, limit(bounded)));
    recordWarehouseDocumentReads(workspaceId, snapshot.size);

    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          lot: parseLot(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      // Listagem técnica neutra: a validade é exibida, sem preferência FEFO.
      .sort((left, right) => left.lot.id.localeCompare(right.lot.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Smallest read for the 3D visual: only lot documents whose expiry is on or
 * before the 14-day cutoff. A single-field range index is sufficient.
 * Includes already expired dates so they can be shown in red.
 * Returns all queried rows, including inactive ones, to expose the 500-row
 * cap accurately; the pure visual mapper will ignore inactive/depleted rows.
 */
export async function listWarehouseVisualExpiryLots(
  workspaceId: string,
  maxResults = 500,
  today: Date = new Date()
): Promise<WarehouseLotListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'lots');
  try {
    const bounded = Math.max(1, Math.min(maxResults, 500));
    const snapshot = await getDocs(query(
      collection(db, path),
      where('expiresOn', '>=', '0000-01-01'),
      where('expiresOn', '<=', warehouseVisualExpiryCutoffDate(today)),
      limit(bounded)
    ));
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        lot: parseLot(scope.workspaceId, item.id, data),
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getWarehouseLot(
  workspaceId: string,
  lotId: string
): Promise<WarehouseLot | null> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'lots', lotId);
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    return parseLot(
      scope.workspaceId,
      snapshot.id,
      snapshot.data() as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/** Atribuição de lotes passa pelo servidor R2 com controle transacional. */
export async function createWarehouseLot(
  workspaceId:string,input:CreateWarehouseLotInput
):Promise<WarehouseLot> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<WarehouseLot>(
    scope.workspaceId,'LOT_CREATE',input
  );
}

export async function updateWarehouseLot(
  workspaceId:string,lotId:string,input:UpdateWarehouseLotInput
):Promise<WarehouseLot> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<WarehouseLot>(
    scope.workspaceId,'LOT_UPDATE',{lotId,input}
  );
}
