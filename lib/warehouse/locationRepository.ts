import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';
import { warehouseServerCommand } from './serverCommandClient';
import {
  WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
  createWorkspaceMemoryReadCache,
} from './memoryReadCache';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  createWarehouseMovementId,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  type WarehouseBalance,
  type WarehouseMovement,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
} from './movement';
import { validateWarehouseMaterial, type WarehouseMaterial } from './material';
import {
  WAREHOUSE_DEPOT_SCHEMA_VERSION,
  WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
  WAREHOUSE_LOCATION_SCHEMA_VERSION,
  applyWarehouseLocationDelta,
  createWarehouseDepotId,
  createWarehouseLocationBalanceId,
  createWarehouseLocationId,
  isValidWarehouseDepotId,
  isValidWarehouseLocationId,
  isValidWarehouseSubpositionId,
  normalizeWarehouseLogicalCode,
  normalizeWarehouseLocationQuantity,
  validateWarehouseDepot,
  validateWarehouseLocation,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  warehouseStockPositionsEqual,
  type WarehouseDepot,
  type WarehouseDepotSizeProfile,
  type WarehouseDepotVisualType,
  type WarehouseEntityStatus,
  type WarehouseLocation,
  type WarehouseLocationBalance,
  type WarehouseLocationKind,
  type WarehouseStockPosition,
} from './location';
import { validateWarehouseBalance } from './movement';
import {
  WAREHOUSE_LOT_SCHEMA_VERSION,
  isValidWarehouseLotId,
  validateWarehouseLot,
  type WarehouseLot,
} from './lot';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';
import {
  isWarehousePhysicalStockPosition,
  planWarehouseTransferLots,
} from './transfer';

export interface WarehouseDepotListItem {
  depot: WarehouseDepot;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WarehouseLocationListItem {
  location: WarehouseLocation;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WarehouseLocationBalanceListItem {
  balance: WarehouseLocationBalance;
  updatedAt: string | null;
}

export interface CreateWarehouseDepotInput {
  code: string;
  name: string;
  description?: string | null;
  visualType?: WarehouseDepotVisualType;
  sizeProfile?: WarehouseDepotSizeProfile;
}

export interface UpdateWarehouseDepotInput {
  code?: string;
  name?: string;
  description?: string | null;
  visualType?: WarehouseDepotVisualType;
  sizeProfile?: WarehouseDepotSizeProfile;
  status?: WarehouseEntityStatus;
}

export interface CreateWarehouseLocationInput {
  kind: WarehouseLocationKind;
  depotId: string;
  parentLocationId?: string | null;
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateWarehouseLocationInput {
  code?: string;
  name?: string;
  description?: string | null;
  status?: WarehouseEntityStatus;
}

export interface TransferWarehouseLotAllocation {
  lotId: string;
  quantity: number;
}

export interface TransferWarehouseStockInput {
  materialId: string;
  quantity: number;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  idempotencyKey: string;
  note?: string | null;
  /**
   * Compatibilidade com o fluxo integral legado: move o documento inteiro do
   * lote para o destino.
   */
  relocateLotIds?: string[];
  /**
   * Parcelas de lotes que acompanham a transferência física. Quando a parcela
   * é menor que o lote, o lote é dividido atomicamente: a origem perde a
   * quantidade e um novo documento no destino preserva código, validade e
   * origem logística.
   */
  lotAllocations?: TransferWarehouseLotAllocation[];
}

export interface TransferWarehouseStockResult {
  applied: boolean;
  movement: WarehouseMovement;
  balance: WarehouseBalance;
  fromBalance: WarehouseLocationBalance;
  toBalance: WarehouseLocationBalance;
}

const depotListReadCache = createWorkspaceMemoryReadCache<WarehouseDepotListItem[]>({
  ttlMs: WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
});
const depotItemReadCache = createWorkspaceMemoryReadCache<WarehouseDepotListItem | null>({
  ttlMs: WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
});
const locationListReadCache = createWorkspaceMemoryReadCache<WarehouseLocationListItem[]>({
  ttlMs: WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
});
const locationItemReadCache = createWorkspaceMemoryReadCache<WarehouseLocationListItem | null>({
  ttlMs: WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
});

function invalidateWarehouseDepotReadCache(workspaceId: string): void {
  depotListReadCache.invalidate(workspaceId);
  depotItemReadCache.invalidate(workspaceId);
}

export function invalidateWarehouseLocationReadCache(workspaceId: string): void {
  locationListReadCache.invalidate(workspaceId);
  locationItemReadCache.invalidate(workspaceId);
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
  if (!user) throw new Error('WAREHOUSE_LOCATION_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_LOCATION_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

function parseDepot(workspaceId: string, id: string, data: Record<string, unknown>): WarehouseDepot {
  const result = validateWarehouseDepot(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      visualType: data.visualType ?? 'STANDARD',
      sizeProfile: data.sizeProfile ?? 'MEDIUM',
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error('WAREHOUSE_INVALID_DEPOT: ' + result.issues.map((item) => item.path + ': ' + item.message).join('; '));
  }
  return result.data;
}

function parseLocation(workspaceId: string, id: string, data: Record<string, unknown>): WarehouseLocation {
  const result = validateWarehouseLocation(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      depotId: data.depotId,
      kind: data.kind,
      parentLocationId: data.parentLocationId ?? null,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error('WAREHOUSE_INVALID_LOCATION: ' + result.issues.map((item) => item.path + ': ' + item.message).join('; '));
  }
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
  if (!result.ok) {
    throw new Error('WAREHOUSE_INVALID_LOCATION_BALANCE: ' + result.issues.map((item) => item.path + ': ' + item.message).join('; '));
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
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok) {
    throw new Error('WAREHOUSE_INVALID_BALANCE');
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
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MOVEMENT');
  return result.data;
}

function parseMaterial(workspaceId: string, id: string, data: Record<string, unknown>): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
  return result.data;
}

function boundedDepotLimit(maxResults: number): number {
  return Math.max(1, Math.min(maxResults, 250));
}

function boundedLocationLimit(maxResults: number): number {
  return Math.max(1, Math.min(maxResults, 500));
}

async function loadWarehouseDepotsFromFirestore(
  workspaceId: string,
  maxResults: number
): Promise<WarehouseDepotListItem[]> {
  const path = warehouseDomainPath(workspaceId, 'depots');
  const snapshot = await getDocs(
    query(collection(db, path), limit(boundedDepotLimit(maxResults)))
  );
  recordWarehouseDocumentReads(workspaceId, snapshot.size);
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        depot: parseDepot(workspaceId, item.id, data),
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    })
    .sort((a, b) => a.depot.code.localeCompare(b.depot.code, 'pt-BR'));
}

async function loadWarehouseLocationsFromFirestore(
  workspaceId: string,
  maxResults: number
): Promise<WarehouseLocationListItem[]> {
  const path = warehouseDomainPath(workspaceId, 'locations');
  const snapshot = await getDocs(
    query(collection(db, path), limit(boundedLocationLimit(maxResults)))
  );
  recordWarehouseDocumentReads(workspaceId, snapshot.size);
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        location: parseLocation(workspaceId, item.id, data),
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    })
    .sort((a, b) => a.location.code.localeCompare(b.location.code, 'pt-BR'));
}

async function loadWarehouseDepotFromFirestore(
  workspaceId: string,
  depotId: string
): Promise<WarehouseDepotListItem | null> {
  const path = warehouseDocumentPath(workspaceId, 'depots', depotId);
  const snapshot = await getDoc(doc(db, path));
  recordWarehouseDocumentReads(workspaceId, 1);
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    depot: parseDepot(workspaceId, snapshot.id, data),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function loadWarehouseLocationFromFirestore(
  workspaceId: string,
  locationId: string
): Promise<WarehouseLocationListItem | null> {
  const path = warehouseDocumentPath(workspaceId, 'locations', locationId);
  const snapshot = await getDoc(doc(db, path));
  recordWarehouseDocumentReads(workspaceId, 1);
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    location: parseLocation(workspaceId, snapshot.id, data),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function assertDepotCodeAvailable(workspaceId: string, code: string, ignoreDepotId?: string): Promise<void> {
  const normalized = normalizeWarehouseLogicalCode(code);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_LOGICAL_CODE');
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'depots');
  let depots: WarehouseDepotListItem[];
  try {
    depots = await loadWarehouseDepotsFromFirestore(scope.workspaceId, 250);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
  if (depots.some((item) =>
    item.depot.status === 'active'
    && item.depot.code === normalized
    && item.depot.id !== ignoreDepotId
  )) {
    throw new Error('WAREHOUSE_DEPOT_CODE_ALREADY_EXISTS');
  }
}

async function assertLocationCodeAvailable(
  workspaceId: string,
  input: { kind: WarehouseLocationKind; depotId: string; parentLocationId: string | null; code: string },
  ignoreLocationId?: string
): Promise<void> {
  const normalized = normalizeWarehouseLogicalCode(input.code);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_LOGICAL_CODE');
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locations');
  let locations: WarehouseLocationListItem[];
  try {
    locations = await loadWarehouseLocationsFromFirestore(scope.workspaceId, 500);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
  if (locations.some(({ location }) =>
    location.kind === input.kind
    && location.depotId === input.depotId
    && location.parentLocationId === input.parentLocationId
    && location.code === normalized
    && location.id !== ignoreLocationId
  )) {
    throw new Error('WAREHOUSE_LOCATION_CODE_ALREADY_EXISTS');
  }
}

export async function listWarehouseDepotsStrict(workspaceId: string, maxResults = 250): Promise<WarehouseDepotListItem[]> {
  const scope = currentScope(workspaceId);
  return loadWarehouseDepotsFromFirestore(scope.workspaceId, boundedDepotLimit(maxResults));
}

export async function listWarehouseLocationsStrict(workspaceId: string, maxResults = 500): Promise<WarehouseLocationListItem[]> {
  const scope = currentScope(workspaceId);
  return loadWarehouseLocationsFromFirestore(scope.workspaceId, boundedLocationLimit(maxResults));
}

export async function listWarehouseDepots(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseDepotListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'depots');
  const bounded = boundedDepotLimit(maxResults);
  try {
    return await loadWarehouseDepotsFromFirestore(scope.workspaceId, bounded);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseDepotsCached(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseDepotListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'depots');
  const bounded = boundedDepotLimit(maxResults);
  try {
    const cached = await depotListReadCache.read(
      scope.workspaceId,
      'list:' + bounded,
      () => loadWarehouseDepotsFromFirestore(scope.workspaceId, bounded)
    );
    return cached.slice();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function createWarehouseDepot(
  workspaceId: string,
  input: CreateWarehouseDepotInput
): Promise<WarehouseDepot> {
  const result=await warehouseServerCommand<WarehouseDepot>(
    workspaceId,'STRUCTURE',{kind:'DEPOT_CREATE',input}
  );
  invalidateWarehouseDepotReadCache(workspaceId);
  return result;
}
export async function updateWarehouseDepot(
  workspaceId: string,
  depotId: string,
  input: UpdateWarehouseDepotInput
): Promise<void> {
  await warehouseServerCommand<{ok:true}>(
    workspaceId,'STRUCTURE',{kind:'DEPOT_UPDATE',depotId,input}
  );
  invalidateWarehouseDepotReadCache(workspaceId);
}
export async function listWarehouseLocations(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseLocationListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locations');
  const bounded = boundedLocationLimit(maxResults);
  try {
    return await loadWarehouseLocationsFromFirestore(scope.workspaceId, bounded);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseLocationsCached(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseLocationListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locations');
  const bounded = boundedLocationLimit(maxResults);
  try {
    const cached = await locationListReadCache.read(
      scope.workspaceId,
      'list:' + bounded,
      () => loadWarehouseLocationsFromFirestore(scope.workspaceId, bounded)
    );
    return cached.slice();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function createWarehouseLocation(
  workspaceId: string,
  input: CreateWarehouseLocationInput
): Promise<WarehouseLocation> {
  const result=await warehouseServerCommand<WarehouseLocation>(
    workspaceId,'STRUCTURE',{kind:'LOCATION_CREATE',input}
  );
  invalidateWarehouseLocationReadCache(workspaceId);
  return result;
}
export async function updateWarehouseLocation(
  workspaceId: string,
  locationId: string,
  input: UpdateWarehouseLocationInput
): Promise<void> {
  await warehouseServerCommand<{ok:true}>(
    workspaceId,'STRUCTURE',{kind:'LOCATION_UPDATE',locationId,input}
  );
  invalidateWarehouseLocationReadCache(workspaceId);
}
export async function getWarehouseDepot(
  workspaceId: string,
  depotId: string
): Promise<WarehouseDepotListItem | null> {
  const scope = currentScope(workspaceId);
  if (!isValidWarehouseDepotId(depotId)) return null;
  const path = warehouseDocumentPath(scope.workspaceId, 'depots', depotId);
  try {
    return await loadWarehouseDepotFromFirestore(scope.workspaceId, depotId);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getWarehouseDepotByCode(
  workspaceId: string,
  code: string
): Promise<WarehouseDepotListItem | null> {
  const scope = currentScope(workspaceId);
  const normalized = normalizeWarehouseLogicalCode(code);
  if (!normalized) return null;
  const path = warehouseDomainPath(scope.workspaceId, 'depots');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('code', '==', normalized),
        limit(5)
      )
    );
    recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);
    const matches = snapshot.docs
      .map((item) => ({
        depot: parseDepot(
          scope.workspaceId,
          item.id,
          item.data() as Record<string, unknown>
        ),
        createdAt: timestampToIso((item.data() as Record<string, unknown>).createdAt),
        updatedAt: timestampToIso((item.data() as Record<string, unknown>).updatedAt),
      }))
      .filter((item) => item.depot.status === 'active');

    return matches.length === 1 ? matches[0] : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export async function getWarehouseDepotCached(
  workspaceId: string,
  depotId: string
): Promise<WarehouseDepotListItem | null> {
  const scope = currentScope(workspaceId);
  if (!isValidWarehouseDepotId(depotId)) return null;
  const path = warehouseDocumentPath(scope.workspaceId, 'depots', depotId);
  try {
    return await depotItemReadCache.read(
      scope.workspaceId,
      'item:' + depotId,
      () => loadWarehouseDepotFromFirestore(scope.workspaceId, depotId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getWarehouseLocation(
  workspaceId: string,
  locationId: string
): Promise<WarehouseLocationListItem | null> {
  const scope = currentScope(workspaceId);
  if (
    !isValidWarehouseLocationId(locationId)
    && !isValidWarehouseSubpositionId(locationId)
  ) return null;
  const path = warehouseDocumentPath(scope.workspaceId, 'locations', locationId);
  try {
    return await loadWarehouseLocationFromFirestore(scope.workspaceId, locationId);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getWarehouseLocationByCode(
  workspaceId: string,
  input: {
    depotId: string;
    kind: WarehouseLocationKind;
    parentLocationId: string | null;
    code: string;
  }
): Promise<WarehouseLocationListItem | null> {
  const scope = currentScope(workspaceId);
  const normalized = normalizeWarehouseLogicalCode(input.code);
  if (!normalized || !isValidWarehouseDepotId(input.depotId)) return null;
  const path = warehouseDomainPath(scope.workspaceId, 'locations');

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('code', '==', normalized),
        limit(20)
      )
    );
    recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);

    const matches = snapshot.docs
      .map((item) => ({
        location: parseLocation(
          scope.workspaceId,
          item.id,
          item.data() as Record<string, unknown>
        ),
        createdAt: timestampToIso((item.data() as Record<string, unknown>).createdAt),
        updatedAt: timestampToIso((item.data() as Record<string, unknown>).updatedAt),
      }))
      .filter(({ location }) =>
        location.status === 'active'
        && location.depotId === input.depotId
        && location.kind === input.kind
        && location.parentLocationId === input.parentLocationId
      );

    return matches.length === 1 ? matches[0] : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export async function getWarehouseLocationCached(
  workspaceId: string,
  locationId: string
): Promise<WarehouseLocationListItem | null> {
  const scope = currentScope(workspaceId);
  if (
    !isValidWarehouseLocationId(locationId)
    && !isValidWarehouseSubpositionId(locationId)
  ) return null;
  const path = warehouseDocumentPath(scope.workspaceId, 'locations', locationId);
  try {
    return await locationItemReadCache.read(
      scope.workspaceId,
      'item:' + locationId,
      () => loadWarehouseLocationFromFirestore(scope.workspaceId, locationId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function listWarehouseLocationBalances(
  workspaceId: string,
  maxResults = 500,
  materialId?: string
): Promise<WarehouseLocationBalanceListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locationBalances');
  try {
    const base = collection(db, path);
    const bounded = Math.max(1, Math.min(maxResults, 500));
    const snapshot = materialId
      ? await getDocs(query(base, where('materialId', '==', materialId), limit(bounded)))
      : await getDocs(query(base, limit(bounded)));
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        balance: parseLocationBalance(scope.workspaceId, item.id, data),
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehousePositiveLocationBalances(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseLocationBalanceListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locationBalances');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('quantity', '>', 0),
        limit(Math.max(1, Math.min(maxResults, 500)))
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        balance: parseLocationBalance(scope.workspaceId, item.id, data),
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

async function assertPositionActive(
  workspaceId: string,
  position: WarehouseStockPosition
): Promise<void> {
  if (!isWarehousePhysicalStockPosition(position)) {
    throw new Error('WAREHOUSE_TRANSFER_REQUIRES_PHYSICAL_POSITION');
  }

  const depotPath = warehouseDocumentPath(workspaceId, 'depots', position.depotId);
  const locationPath = warehouseDocumentPath(workspaceId, 'locations', position.locationId);
  const [depotSnapshot, locationSnapshot] = await Promise.all([
    getDoc(doc(db, depotPath)),
    getDoc(doc(db, locationPath)),
  ]);
  if (!depotSnapshot.exists() || !locationSnapshot.exists()) throw new Error('WAREHOUSE_POSITION_NOT_FOUND');
  const depot = parseDepot(workspaceId, position.depotId, depotSnapshot.data() as Record<string, unknown>);
  const location = parseLocation(workspaceId, position.locationId, locationSnapshot.data() as Record<string, unknown>);
  if (depot.status !== 'active' || location.status !== 'active' || location.kind !== 'LOCAL' || location.depotId !== depot.id) {
    throw new Error('WAREHOUSE_POSITION_INACTIVE');
  }

  if (position.kind === 'SUBPOSITION') {
    const subPath = warehouseDocumentPath(workspaceId, 'locations', position.subpositionId);
    const subSnapshot = await getDoc(doc(db, subPath));
    if (!subSnapshot.exists()) throw new Error('WAREHOUSE_SUBPOSITION_NOT_FOUND');
    const sub = parseLocation(workspaceId, position.subpositionId, subSnapshot.data() as Record<string, unknown>);
    if (sub.status !== 'active' || sub.kind !== 'SUBPOSITION' || sub.depotId !== depot.id || sub.parentLocationId !== location.id) {
      throw new Error('WAREHOUSE_SUBPOSITION_INACTIVE');
    }
  }
}

async function createWarehouseTransferSplitLotId(
  movementId: string,
  sourceLotId: string
): Promise<string> {
  const payload = new TextEncoder().encode(
    movementId + '\n' + sourceLotId + '\nLOT_SPLIT'
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'lot_' + hash.slice(0, 32);
}

function parseTransferLot(
  workspaceId: string,
  ug: string,
  materialId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const result = validateWarehouseLot(
    { ...data, id },
    {
      expectedWorkspaceId: workspaceId,
      expectedUg: ug,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_TRANSFER_LOT_INVALID: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

const WAREHOUSE_TRANSFER_LOT_QUERY_MAX_RESULTS = 500;

async function buildCanonicalWarehouseTransferLotPlan(input: {
  workspaceId: string;
  ug: string;
  materialId: string;
  from: WarehouseStockPosition;
  quantity: number;
  fromBalanceId: string;
}): Promise<TransferWarehouseLotAllocation[]> {
  if (!isWarehousePhysicalStockPosition(input.from)) {
    throw new Error('WAREHOUSE_TRANSFER_REQUIRES_PHYSICAL_POSITION');
  }

  const fromBalancePath = warehouseDocumentPath(
    input.workspaceId,
    'locationBalances',
    input.fromBalanceId
  );
  const lotsPath = warehouseDomainPath(input.workspaceId, 'lots');
  const [fromSnapshot, lotSnapshot] = await Promise.all([
    getDoc(doc(db, fromBalancePath)),
    getDocs(
      query(
        collection(db, lotsPath),
        where('materialId', '==', input.materialId),
        limit(WAREHOUSE_TRANSFER_LOT_QUERY_MAX_RESULTS + 1)
      )
    ),
  ]);
  recordWarehouseDocumentReads(
    input.workspaceId,
    1 + lotSnapshot.size
  );

  if (!fromSnapshot.exists()) {
    throw new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');
  }
  if (lotSnapshot.size > WAREHOUSE_TRANSFER_LOT_QUERY_MAX_RESULTS) {
    throw new Error('WAREHOUSE_TRANSFER_LOTS_SATURATED');
  }

  const fromBalance = parseLocationBalance(
    input.workspaceId,
    fromSnapshot.id,
    fromSnapshot.data() as Record<string, unknown>
  );
  if (
    fromBalance.ug !== input.ug
    || fromBalance.materialId !== input.materialId
    || !warehouseStockPositionsEqual(fromBalance.position, input.from)
  ) {
    throw new Error('WAREHOUSE_TRANSFER_SOURCE_BALANCE_MISMATCH');
  }

  const lots = lotSnapshot.docs.map((item) =>
    parseTransferLot(
      input.workspaceId,
      input.ug,
      input.materialId,
      item.id,
      item.data() as Record<string, unknown>
    )
  );
  const plan = planWarehouseTransferLots({
    materialId: input.materialId,
    source: input.from,
    quantity: input.quantity,
    availableQuantity: fromBalance.quantity,
    lots,
  });
  if (plan.ok) return plan.lotAllocations;

  if (plan.error === 'INSUFFICIENT_STOCK') {
    throw new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');
  }
  if (plan.error === 'LOT_ATTRIBUTION_EXCEEDS_STOCK') {
    throw new Error('WAREHOUSE_TRANSFER_LOT_ATTRIBUTION_EXCEEDS_STOCK');
  }
  if (plan.error === 'TOO_MANY_ACTIVE_LOTS') {
    throw new Error('WAREHOUSE_TRANSFER_TOO_MANY_ACTIVE_LOTS');
  }
  throw new Error('WAREHOUSE_TRANSFER_INVALID_LOT_PLAN');
}

/**
 * Operação crítica migrada: movimentação, saldos e atribuição de lotes
 * são calculados exclusivamente no servidor confiável.
 */
export async function transferWarehouseStock(
  workspaceId: string,
  input: TransferWarehouseStockInput
): Promise<TransferWarehouseStockResult> {
  // Dados auxiliares de lotes do navegador são intencionalmente descartados.
  const {lotAllocations: _ignoredAllocations, relocateLotIds: _ignoredRelocations, ...command} = input;
  const result = await warehouseServerCommand<TransferWarehouseStockResult>(
    workspaceId, 'TRANSFER', command
  );
  invalidateWarehouseLocationReadCache(workspaceId);
  return result;
}

export function buildWarehousePositionLabel(
  position: WarehouseStockPosition,
  depots: WarehouseDepotListItem[],
  locations: WarehouseLocationListItem[]
): string {
  if (position.kind === 'UNASSIGNED') return 'Reconciliação necessária';
  const depot = depots.find((item) => item.depot.id === position.depotId)?.depot;
  const local = locations.find((item) => item.location.id === position.locationId)?.location;
  const base = [depot?.code || position.depotId, local?.code || position.locationId].join(' → ');
  if (position.kind === 'LOCATION') return base;
  const sub = locations.find((item) => item.location.id === position.subpositionId)?.location;
  return base + ' → ' + (sub?.code || position.subpositionId);
}

export function groupWarehouseLocationsByDepot(
  locations: WarehouseLocationListItem[]
): Map<string, WarehouseLocationListItem[]> {
  const grouped = new Map<string, WarehouseLocationListItem[]>();
  for (const item of locations) {
    const current = grouped.get(item.location.depotId) || [];
    current.push(item);
    grouped.set(item.location.depotId, current);
  }
  return grouped;
}

export function createWarehouseTransferIdempotencyKey(): string {
  return 'phase6:transfer:' + crypto.randomUUID();
}

export function warehouseLocationBalanceIdentity(balance: WarehouseLocationBalance): string {
  return balance.materialId + '|' + warehouseStockPositionKey(balance.position);
}

export async function archiveWarehouseStructure(
  workspaceId: string,
  target: { kind: 'DEPOT' | WarehouseLocationKind; id: string; mode?: 'DELETE'; confirmCode?: string }
): Promise<void> {
  await warehouseServerCommand<{ok:true}>(workspaceId,'STRUCTURE_ARCHIVE',target);
  invalidateWarehouseDepotReadCache(workspaceId);
  invalidateWarehouseLocationReadCache(workspaceId);
}
