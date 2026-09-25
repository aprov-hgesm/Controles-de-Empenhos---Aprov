import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  createWarehouseDepotLayoutId,
  validateWarehouseDepotLayout,
  type WarehouseDepotLayout,
  type WarehouseDepotLayoutObject,
} from './layout';
import {
  listWarehouseDepots,
  listWarehouseLocations,
} from './locationRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

export interface WarehouseDepotLayoutListItem {
  layout: WarehouseDepotLayout;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SaveWarehouseDepotLayoutVersionInput {
  name: string;
  depotId: string | null;
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  baseLayoutId?: string | null;
  expectedVersion?: number | null;
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

function currentScope(workspaceId: string): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_LAYOUT_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_LAYOUT_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

function parseLayout(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseDepotLayout {
  const result = validateWarehouseDepotLayout(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      name: data.name,
      depotId: data.depotId ?? null,
      logicalWidth: data.logicalWidth,
      logicalHeight: data.logicalHeight,
      objects: data.objects,
      version: data.version,
      status: data.status,
      previousVersionId: data.previousVersionId ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_DEPOT_LAYOUT: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

export async function listWarehouseDepotLayouts(
  workspaceId: string,
  maxResults = 100
): Promise<WarehouseDepotLayoutListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'layouts');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        orderBy('version', 'desc'),
        limit(Math.max(1, Math.min(maxResults, 150)))
      )
    );
    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          layout: parseLayout(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((a, b) => b.layout.version - a.layout.version);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseDepotLayoutsForDepot(
  workspaceId: string,
  depotId: string,
  maxResults = 100
): Promise<WarehouseDepotLayoutListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'layouts');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('depotId', '==', depotId),
        limit(Math.max(1, Math.min(maxResults, 150)))
      )
    );
    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          layout: parseLayout(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((a, b) => b.layout.version - a.layout.version);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getActiveWarehouseDepotLayout(
  workspaceId: string,
  depotId?: string | null
): Promise<WarehouseDepotLayoutListItem | null> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'layouts');
  try {
    const snapshot = await getDocs(
      depotId === undefined
        ? query(collection(db, path), where('status', '==', 'active'), limit(100))
        : query(collection(db, path), where('depotId', '==', depotId), limit(150))
    );
    const active = snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          layout: parseLayout(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .filter(
        (item) =>
          item.layout.status === 'active'
          && (depotId === undefined || item.layout.depotId === depotId)
      )
      .sort((a, b) => b.layout.version - a.layout.version);
    if (depotId !== undefined && active.length > 1) {
      throw new Error('WAREHOUSE_LAYOUT_MULTIPLE_ACTIVE_FOR_DEPOT');
    }
    return active[0] || null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

async function assertLayoutLocationReferences(
  workspaceId: string,
  ug: string,
  depotId: string | null,
  objects: WarehouseDepotLayoutObject[]
): Promise<void> {
  const referencedIds = Array.from(
    new Set(objects.map((item) => item.warehouseLocationId).filter(Boolean) as string[])
  );
  if (!referencedIds.length && !depotId) return;

  const [depots, locations] = await Promise.all([
    listWarehouseDepots(workspaceId, 250),
    listWarehouseLocations(workspaceId, 500),
  ]);
  const depotById = new Map(depots.map((item) => [item.depot.id, item.depot]));
  const locationById = new Map(locations.map((item) => [item.location.id, item.location]));

  if (depotId) {
    const depot = depotById.get(depotId);
    if (!depot || depot.status !== 'active' || depot.ug !== ug) {
      throw new Error('WAREHOUSE_LAYOUT_DEPOT_INVALID');
    }
  }

  for (const locationId of referencedIds) {
    const location = locationById.get(locationId);
    if (!location || location.status !== 'active' || location.ug !== ug) {
      throw new Error('WAREHOUSE_LAYOUT_LOCATION_INVALID');
    }
    if (depotId && location.depotId !== depotId) {
      throw new Error('WAREHOUSE_LAYOUT_LOCATION_DEPOT_MISMATCH');
    }
  }
}

export async function saveWarehouseDepotLayoutVersion(
  workspaceId: string,
  input: SaveWarehouseDepotLayoutVersionInput
): Promise<WarehouseDepotLayout> {
  const scope = currentScope(workspaceId);
  await assertLayoutLocationReferences(
    scope.workspaceId,
    scope.ug,
    input.depotId,
    input.objects
  );

  const active = await getActiveWarehouseDepotLayout(scope.workspaceId, input.depotId);
  const baseLayoutId = input.baseLayoutId || active?.layout.id || null;
  const baseVersion = input.expectedVersion ?? active?.layout.version ?? null;

  if (baseLayoutId && (!active || active.layout.id !== baseLayoutId)) {
    throw new Error('WAREHOUSE_LAYOUT_BASE_NOT_ACTIVE');
  }
  if (baseVersion !== null && (!active || active.layout.version !== baseVersion)) {
    throw new Error('WAREHOUSE_LAYOUT_VERSION_CONFLICT');
  }

  const id = createWarehouseDepotLayoutId();
  const version = active ? active.layout.version + 1 : 1;
  const candidate = validateWarehouseDepotLayout(
    {
      schemaVersion: 'warehouse_depot_layout_v1',
      id,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      name: input.name,
      depotId: input.depotId,
      logicalWidth: input.logicalWidth,
      logicalHeight: input.logicalHeight,
      objects: input.objects,
      version,
      status: 'active',
      previousVersionId: active?.layout.id || null,
      createdBy: scope.uid,
      updatedBy: scope.uid,
    },
    { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
  );
  if (!candidate.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_DEPOT_LAYOUT: '
      + candidate.issues.map((item) => item.message).join('; ')
    );
  }

  const nextPath = warehouseDocumentPath(scope.workspaceId, 'layouts', candidate.data.id);
  const previousPath = active
    ? warehouseDocumentPath(scope.workspaceId, 'layouts', active.layout.id)
    : null;

  try {
    await runTransaction(db, async (transaction) => {
      if (previousPath && active) {
        const previousRef = doc(db, previousPath);
        const previousSnapshot = await transaction.get(previousRef);
        if (!previousSnapshot.exists()) throw new Error('WAREHOUSE_LAYOUT_BASE_NOT_FOUND');
        const previous = parseLayout(
          scope.workspaceId,
          previousSnapshot.id,
          previousSnapshot.data() as Record<string, unknown>
        );
        if (previous.status !== 'active' || previous.version !== active.layout.version) {
          throw new Error('WAREHOUSE_LAYOUT_VERSION_CONFLICT');
        }
        transaction.update(previousRef, {
          status: 'archived',
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(doc(db, nextPath), {
        ...candidate.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return candidate.data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, nextPath);
    throw error;
  }
}

export async function getWarehouseDepotLayout(
  workspaceId: string,
  layoutId: string
): Promise<WarehouseDepotLayoutListItem | null> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'layouts', layoutId);
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Record<string, unknown>;
    return {
      layout: parseLayout(scope.workspaceId, snapshot.id, data),
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}
