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

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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

    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          lot: parseLot(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((left, right) => {
        const expiryA = left.lot.expiresOn || '9999-12-31';
        const expiryB = right.lot.expiresOn || '9999-12-31';
        const expiryCompare = expiryA.localeCompare(expiryB);
        return expiryCompare !== 0
          ? expiryCompare
          : left.lot.code.localeCompare(right.lot.code, 'pt-BR');
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

export async function createWarehouseLot(
  workspaceId: string,
  input: CreateWarehouseLotInput
): Promise<WarehouseLot> {
  const scope = currentScope(workspaceId);
  const position = validateWarehouseStockPosition(input.position);
  if (!position) throw new Error('WAREHOUSE_LOT_INVALID_POSITION');

  await assertLotPositionBackedByStock({
    workspaceId: scope.workspaceId,
    materialId: input.materialId,
    position,
    quantity: input.quantity,
  });

  const id = createWarehouseLotId();
  const candidate = validateWarehouseLot(
    {
      schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
      id,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      materialId: input.materialId,
      code: input.code,
      expiresOn: input.expiresOn ?? null,
      quantity: input.quantity,
      position,
      origin: input.origin || manualOrigin(),
      status: 'active',
      createdBy: scope.uid,
      updatedBy: scope.uid,
    },
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedUg: scope.ug,
      expectedMaterialId: input.materialId,
    }
  );
  if (!candidate.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_LOT: '
      + candidate.issues.map((item) => item.message).join('; ')
    );
  }

  const materialPath = warehouseDocumentPath(
    scope.workspaceId,
    'materials',
    candidate.data.materialId
  );
  const lotPath = warehouseDocumentPath(scope.workspaceId, 'lots', candidate.data.id);

  try {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, materialPath);
      const lotRef = doc(db, lotPath);
      const [materialSnapshot, existingLotSnapshot] = await Promise.all([
        transaction.get(materialRef),
        transaction.get(lotRef),
      ]);

      if (!materialSnapshot.exists()) throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      const material = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      if (material.ug !== scope.ug || material.status !== 'active') {
        throw new Error('WAREHOUSE_MATERIAL_SCOPE_MISMATCH');
      }
      if (existingLotSnapshot.exists()) throw new Error('WAREHOUSE_LOT_ID_CONFLICT');

      transaction.set(lotRef, {
        ...candidate.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return candidate.data;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, lotPath);
    throw error;
  }
}

export async function updateWarehouseLot(
  workspaceId: string,
  lotId: string,
  input: UpdateWarehouseLotInput
): Promise<WarehouseLot> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'lots', lotId);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) throw new Error('WAREHOUSE_LOT_NOT_FOUND');
  const current = parseLot(
    scope.workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );

  const position = input.position
    ? validateWarehouseStockPosition(input.position)
    : current.position;
  if (!position) throw new Error('WAREHOUSE_LOT_INVALID_POSITION');

  const nextQuantity = input.quantity ?? current.quantity;
  await assertLotPositionBackedByStock({
    workspaceId: scope.workspaceId,
    materialId: current.materialId,
    position,
    quantity: nextQuantity,
  });

  const candidate = validateWarehouseLot(
    {
      ...current,
      code: input.code ?? current.code,
      expiresOn:
        input.expiresOn === undefined ? current.expiresOn : input.expiresOn,
      quantity: nextQuantity,
      position,
      origin: input.origin ?? current.origin,
      status: input.status ?? current.status,
      updatedBy: scope.uid,
    },
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedUg: scope.ug,
      expectedMaterialId: current.materialId,
    }
  );
  if (!candidate.ok) throw new Error('WAREHOUSE_INVALID_LOT_UPDATE');

  try {
    await updateDoc(doc(db, path), {
      code: candidate.data.code,
      expiresOn: candidate.data.expiresOn,
      quantity: candidate.data.quantity,
      position: candidate.data.position,
      origin: candidate.data.origin,
      status: candidate.data.status,
      updatedBy: scope.uid,
      updatedAt: serverTimestamp(),
    });
    return candidate.data;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}
