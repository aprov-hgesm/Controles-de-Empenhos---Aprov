import {
  collection,
  Timestamp,
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
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';
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

function invalidateWarehouseLocationReadCache(workspaceId: string): void {
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
  const scope = currentScope(workspaceId);
  await assertDepotCodeAvailable(scope.workspaceId, input.code);
  const id = createWarehouseDepotId();
  const result = validateWarehouseDepot({
    schemaVersion: WAREHOUSE_DEPOT_SCHEMA_VERSION,
    id,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    visualType: input.visualType ?? 'STANDARD',
    sizeProfile: input.sizeProfile ?? 'MEDIUM',
    status: 'active',
    createdBy: scope.uid,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!result.ok) {
    throw new Error('WAREHOUSE_INVALID_DEPOT: ' + result.issues.map((item) => item.message).join('; '));
  }

  const path = warehouseDocumentPath(scope.workspaceId, 'depots', result.data.id);
  try {
    await setDoc(doc(db, path), {
      ...result.data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    invalidateWarehouseDepotReadCache(scope.workspaceId);
    return result.data;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateWarehouseDepot(
  workspaceId: string,
  depotId: string,
  input: UpdateWarehouseDepotInput
): Promise<void> {
  const scope = currentScope(workspaceId);
  if (!isValidWarehouseDepotId(depotId)) throw new Error('WAREHOUSE_INVALID_DEPOT_ID');
  const path = warehouseDocumentPath(scope.workspaceId, 'depots', depotId);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) throw new Error('WAREHOUSE_DEPOT_NOT_FOUND');
  const current = parseDepot(scope.workspaceId, depotId, snapshot.data() as Record<string, unknown>);
  const nextCode = input.code ?? current.code;
  const nextStatus = input.status ?? current.status;

  if (
    nextStatus === 'active'
    && (nextCode !== current.code || current.status !== 'active')
  ) {
    await assertDepotCodeAvailable(scope.workspaceId, nextCode, depotId);
  }

  const candidate = validateWarehouseDepot({
    ...current,
    code: nextCode,
    name: input.name ?? current.name,
    description: input.description === undefined ? current.description : input.description,
    visualType: input.visualType ?? current.visualType,
    sizeProfile: input.sizeProfile ?? current.sizeProfile,
    status: nextStatus,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!candidate.ok) throw new Error('WAREHOUSE_INVALID_DEPOT_UPDATE');

  await updateDoc(doc(db, path), {
    code: candidate.data.code,
    name: candidate.data.name,
    description: candidate.data.description,
    visualType: candidate.data.visualType,
    sizeProfile: candidate.data.sizeProfile,
    status: candidate.data.status,
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
  invalidateWarehouseDepotReadCache(scope.workspaceId);
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
  const scope = currentScope(workspaceId);
  const depotId = input.depotId.trim().toLowerCase();
  if (!isValidWarehouseDepotId(depotId)) throw new Error('WAREHOUSE_INVALID_DEPOT_ID');
  const depotPath = warehouseDocumentPath(scope.workspaceId, 'depots', depotId);
  const depotSnapshot = await getDoc(doc(db, depotPath));
  if (!depotSnapshot.exists()) throw new Error('WAREHOUSE_DEPOT_NOT_FOUND');
  const depot = parseDepot(scope.workspaceId, depotId, depotSnapshot.data() as Record<string, unknown>);
  if (depot.status !== 'active') throw new Error('WAREHOUSE_DEPOT_INACTIVE');

  let parentLocationId: string | null = null;
  if (input.kind === 'SUBPOSITION') {
    parentLocationId = (input.parentLocationId || '').trim().toLowerCase();
    if (!isValidWarehouseLocationId(parentLocationId)) throw new Error('WAREHOUSE_INVALID_PARENT_LOCATION_ID');
    const parentPath = warehouseDocumentPath(scope.workspaceId, 'locations', parentLocationId);
    const parentSnapshot = await getDoc(doc(db, parentPath));
    if (!parentSnapshot.exists()) throw new Error('WAREHOUSE_PARENT_LOCATION_NOT_FOUND');
    const parent = parseLocation(scope.workspaceId, parentLocationId, parentSnapshot.data() as Record<string, unknown>);
    if (parent.kind !== 'LOCAL' || parent.depotId !== depotId || parent.status !== 'active') {
      throw new Error('WAREHOUSE_PARENT_LOCATION_INVALID');
    }
  }

  await assertLocationCodeAvailable(scope.workspaceId, {
    kind: input.kind,
    depotId,
    parentLocationId,
    code: input.code,
  });

  const id = createWarehouseLocationId(input.kind);
  const result = validateWarehouseLocation({
    schemaVersion: WAREHOUSE_LOCATION_SCHEMA_VERSION,
    id,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    depotId,
    kind: input.kind,
    parentLocationId,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    status: 'active',
    createdBy: scope.uid,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_LOCATION');

  const path = warehouseDocumentPath(scope.workspaceId, 'locations', result.data.id);
  await setDoc(doc(db, path), {
    ...result.data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateWarehouseLocationReadCache(scope.workspaceId);
  return result.data;
}

export async function updateWarehouseLocation(
  workspaceId: string,
  locationId: string,
  input: UpdateWarehouseLocationInput
): Promise<void> {
  const scope = currentScope(workspaceId);
  if (!isValidWarehouseLocationId(locationId) && !isValidWarehouseSubpositionId(locationId)) {
    throw new Error('WAREHOUSE_INVALID_LOCATION_ID');
  }
  const path = warehouseDocumentPath(scope.workspaceId, 'locations', locationId);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) throw new Error('WAREHOUSE_LOCATION_NOT_FOUND');
  const current = parseLocation(scope.workspaceId, locationId, snapshot.data() as Record<string, unknown>);
  if (input.code !== undefined && input.code !== current.code) {
    await assertLocationCodeAvailable(scope.workspaceId, {
      kind: current.kind,
      depotId: current.depotId,
      parentLocationId: current.parentLocationId,
      code: input.code,
    }, locationId);
  }
  const candidate = validateWarehouseLocation({
    ...current,
    code: input.code ?? current.code,
    name: input.name ?? current.name,
    description: input.description === undefined ? current.description : input.description,
    status: input.status ?? current.status,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!candidate.ok) throw new Error('WAREHOUSE_INVALID_LOCATION_UPDATE');

  await updateDoc(doc(db, path), {
    code: candidate.data.code,
    name: candidate.data.name,
    description: candidate.data.description,
    status: candidate.data.status,
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
  invalidateWarehouseLocationReadCache(scope.workspaceId);
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
  const { createdAt, updatedAt, ...domainData } = data;
  if (!(createdAt instanceof Timestamp) || !(updatedAt instanceof Timestamp)) {
    throw new Error('WAREHOUSE_TRANSFER_LOT_INVALID: invalid Firestore timestamps');
  }
  const result = validateWarehouseLot(
    { ...domainData, id },
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

export async function transferWarehouseStock(
  workspaceId: string,
  input: TransferWarehouseStockInput
): Promise<TransferWarehouseStockResult> {
  const scope = currentScope(workspaceId);
  const from = validateWarehouseStockPosition(input.from);
  const to = validateWarehouseStockPosition(input.to);
  if (!from || !to) throw new Error('WAREHOUSE_TRANSFER_INVALID_POSITION');
  if (
    !isWarehousePhysicalStockPosition(from)
    || !isWarehousePhysicalStockPosition(to)
  ) {
    throw new Error('WAREHOUSE_TRANSFER_REQUIRES_PHYSICAL_POSITION');
  }
  if (warehouseStockPositionsEqual(from, to)) throw new Error('WAREHOUSE_TRANSFER_SAME_POSITION');

  const normalizedQuantity = normalizeWarehouseLocationQuantity(input.quantity);
  if (normalizedQuantity === null || normalizedQuantity <= 0) {
    throw new Error('WAREHOUSE_TRANSFER_INVALID_QUANTITY');
  }

  await Promise.all([
    assertPositionActive(scope.workspaceId, from),
    assertPositionActive(scope.workspaceId, to),
  ]);

  const movementId = await createWarehouseMovementId(scope.workspaceId, input.idempotencyKey);
  const idempotencyKeyHash = movementId.slice(4);
  const fromBalanceId = await createWarehouseLocationBalanceId(scope.workspaceId, input.materialId, from);
  const toBalanceId = await createWarehouseLocationBalanceId(scope.workspaceId, input.materialId, to);

  // Physical transfers never trust caller-specific lot hints. The canonical
  // repository derives lot allocations from the current physical source
  // balance and canonical lot documents.
  let lotAllocations: TransferWarehouseLotAllocation[];
  try {
    lotAllocations = await buildCanonicalWarehouseTransferLotPlan({
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      materialId: input.materialId,
      from,
      quantity: normalizedQuantity,
      fromBalanceId,
    });
  } catch (planningError) {
    // Only deterministic stock/lot-plan rejections qualify for replay lookup.
    // Infrastructure, authentication and malformed legacy data errors must
    // retain their original failure, never be presented as success.
    const planningCode = planningError instanceof Error ? planningError.message : '';
    if (![
      'WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK',
      'WAREHOUSE_TRANSFER_LOT_ATTRIBUTION_EXCEEDS_STOCK',
      'WAREHOUSE_TRANSFER_TOO_MANY_ACTIVE_LOTS',
      'WAREHOUSE_TRANSFER_INVALID_LOT_PLAN',
    ].includes(planningCode)) throw planningError;
    // A completed transfer can make the source balance insufficient for the
    // same request. Consult the canonical movement before reporting failure.
    // No replay can write balances or bypass the full payload comparison.
    const movementPath = warehouseDocumentPath(scope.workspaceId, 'movements', movementId);
    const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', input.materialId);
    const fromPath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', fromBalanceId);
    const toPath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', toBalanceId);
    const replay = await runTransaction(db, async (transaction) => {
      const movementSnapshot = await transaction.get(doc(db, movementPath));
      if (!movementSnapshot.exists()) return null;

      const existing = parseMovement(
        scope.workspaceId,
        movementSnapshot.id,
        movementSnapshot.data() as Record<string, unknown>
      );
      const candidateResult = validateWarehouseMovement({
        schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
        id: movementId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: input.materialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash,
        reversesMovementId: null,
        note: input.note ?? null,
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: scope.uid,
          quantity: normalizedQuantity,
          from,
          to,
          fromBalanceId,
          toBalanceId,
        },
      }, {
        expectedWorkspaceId: scope.workspaceId,
        expectedUg: scope.ug,
        expectedMaterialId: input.materialId,
      });
      if (!candidateResult.ok || !warehouseMovementMatchesReplay(existing, candidateResult.data)) {
        throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
      }
      const [balanceSnapshot, sourceSnapshot, destinationSnapshot] = await Promise.all([
        transaction.get(doc(db, balancePath)),
        transaction.get(doc(db, fromPath)),
        transaction.get(doc(db, toPath)),
      ]);
      if (!balanceSnapshot.exists() || !sourceSnapshot.exists() || !destinationSnapshot.exists()) {
        throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
      }
      return {
        applied: false,
        movement: existing,
        balance: parseBalance(scope.workspaceId, input.materialId, balanceSnapshot.data() as Record<string, unknown>),
        fromBalance: parseLocationBalance(scope.workspaceId, sourceSnapshot.id, sourceSnapshot.data() as Record<string, unknown>),
        toBalance: parseLocationBalance(scope.workspaceId, destinationSnapshot.id, destinationSnapshot.data() as Record<string, unknown>),
      };
    });
    if (replay) return replay;
    throw planningError;
  }
  const relocateLotIds: string[] = [];

  if (
    relocateLotIds.length > 24
    || relocateLotIds.some((lotId) => !isValidWarehouseLotId(lotId))
  ) {
    throw new Error('WAREHOUSE_TRANSFER_INVALID_LOT_RELOCATION');
  }

  const allocationIds = new Set(lotAllocations.map((item) => item.lotId));
  if (
    lotAllocations.length > 24
    || allocationIds.size !== lotAllocations.length
    || relocateLotIds.some((lotId) => allocationIds.has(lotId))
  ) {
    throw new Error('WAREHOUSE_TRANSFER_INVALID_LOT_ALLOCATION');
  }
  const allocatedQuantity = lotAllocations.reduce(
    (total, item) => total + item.quantity,
    0
  );
  if (allocatedQuantity > normalizedQuantity + 0.000001) {
    throw new Error('WAREHOUSE_TRANSFER_LOT_ALLOCATION_EXCEEDS_TRANSFER');
  }

  const splitLotIds = await Promise.all(
    lotAllocations.map((item) =>
      createWarehouseTransferSplitLotId(movementId, item.lotId)
    )
  );

  const materialPath = warehouseDocumentPath(scope.workspaceId, 'materials', input.materialId);
  const movementPath = warehouseDocumentPath(scope.workspaceId, 'movements', movementId);
  const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', input.materialId);
  const fromBalancePath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', fromBalanceId);
  const toBalancePath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', toBalanceId);
  const relocateLotPaths = relocateLotIds.map((lotId) =>
    warehouseDocumentPath(scope.workspaceId, 'lots', lotId)
  );
  const allocationLotPaths = lotAllocations.map((item) =>
    warehouseDocumentPath(scope.workspaceId, 'lots', item.lotId)
  );
  const splitLotPaths = splitLotIds.map((lotId) =>
    warehouseDocumentPath(scope.workspaceId, 'lots', lotId)
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, materialPath);
      const movementRef = doc(db, movementPath);
      const balanceRef = doc(db, balancePath);
      const fromBalanceRef = doc(db, fromBalancePath);
      const toBalanceRef = doc(db, toBalancePath);
      const relocateLotRefs = relocateLotPaths.map((path) => doc(db, path));
      const allocationLotRefs = allocationLotPaths.map((path) => doc(db, path));
      const splitLotRefs = splitLotPaths.map((path) => doc(db, path));

      const [materialSnapshot, movementSnapshot, balanceSnapshot, fromSnapshot, toSnapshot] = await Promise.all([
        transaction.get(materialRef),
        transaction.get(movementRef),
        transaction.get(balanceRef),
        transaction.get(fromBalanceRef),
        transaction.get(toBalanceRef),
      ]);
      const [relocateLotSnapshots, allocationLotSnapshots, splitLotSnapshots] = await Promise.all([
        Promise.all(relocateLotRefs.map((lotRef) => transaction.get(lotRef))),
        Promise.all(allocationLotRefs.map((lotRef) => transaction.get(lotRef))),
        Promise.all(splitLotRefs.map((lotRef) => transaction.get(lotRef))),
      ]);

      if (!materialSnapshot.exists()) throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      if (!balanceSnapshot.exists()) throw new Error('WAREHOUSE_BALANCE_NOT_FOUND');

      const material = parseMaterial(scope.workspaceId, materialSnapshot.id, materialSnapshot.data() as Record<string, unknown>);
      if (material.status !== 'active' || material.ug !== scope.ug) throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
      const currentBalance = parseBalance(scope.workspaceId, balanceSnapshot.id, balanceSnapshot.data() as Record<string, unknown>);

      const source = {
        kind: 'LOCATION_TRANSFER' as const,
        actorUid: scope.uid,
        quantity: normalizedQuantity,
        from,
        to,
        fromBalanceId,
        toBalanceId,
      };

      const candidateResult = validateWarehouseMovement({
        schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
        id: movementId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash,
        reversesMovementId: null,
        note: input.note ?? null,
        source,
      }, {
        expectedWorkspaceId: scope.workspaceId,
        expectedUg: scope.ug,
        expectedMaterialId: material.id,
      });
      if (!candidateResult.ok) throw new Error('WAREHOUSE_INVALID_TRANSFER_MOVEMENT');
      const candidate = candidateResult.data;

      const existingFrom = fromSnapshot.exists()
        ? parseLocationBalance(scope.workspaceId, fromSnapshot.id, fromSnapshot.data() as Record<string, unknown>)
        : null;
      const existingTo = toSnapshot.exists()
        ? parseLocationBalance(scope.workspaceId, toSnapshot.id, toSnapshot.data() as Record<string, unknown>)
        : null;

      if (movementSnapshot.exists()) {
        const existingMovement = parseMovement(scope.workspaceId, movementSnapshot.id, movementSnapshot.data() as Record<string, unknown>);
        if (!warehouseMovementMatchesReplay(existingMovement, candidate)) {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        if (!existingFrom || !existingTo) throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
        return {
          applied: false,
          movement: existingMovement,
          balance: currentBalance,
          fromBalance: existingFrom,
          toBalance: existingTo,
        };
      }

      const available = existingFrom?.quantity ?? 0;
      if (available < normalizedQuantity) throw new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');

      const nextFrom = applyWarehouseLocationDelta(existingFrom, {
        id: fromBalanceId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        position: from,
        quantityDelta: -normalizedQuantity,
        movementId,
      });
      const nextTo = applyWarehouseLocationDelta(existingTo, {
        id: toBalanceId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        position: to,
        quantityDelta: normalizedQuantity,
        movementId,
      });

      relocateLotSnapshots.forEach((lotSnapshot, index) => {
        if (!lotSnapshot.exists()) throw new Error('WAREHOUSE_TRANSFER_LOT_NOT_FOUND');
        const lot = parseTransferLot(
          scope.workspaceId,
          scope.ug,
          material.id,
          lotSnapshot.id,
          lotSnapshot.data() as Record<string, unknown>
        );
        if (
          lot.status !== 'active'
          || lot.quantity <= 0
          || !warehouseStockPositionsEqual(lot.position, from)
        ) {
          throw new Error('WAREHOUSE_TRANSFER_LOT_POSITION_MISMATCH');
        }
        transaction.update(relocateLotRefs[index], {
          position: to,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      });

      lotAllocations.forEach((allocation, index) => {
        const lotSnapshot = allocationLotSnapshots[index];
        if (!lotSnapshot.exists()) throw new Error('WAREHOUSE_TRANSFER_LOT_NOT_FOUND');

        const lot = parseTransferLot(
          scope.workspaceId,
          scope.ug,
          material.id,
          lotSnapshot.id,
          lotSnapshot.data() as Record<string, unknown>
        );
        if (
          lot.status !== 'active'
          || lot.quantity <= 0
          || !warehouseStockPositionsEqual(lot.position, from)
        ) {
          throw new Error('WAREHOUSE_TRANSFER_LOT_POSITION_MISMATCH');
        }
        if (allocation.quantity > lot.quantity + 0.000001) {
          throw new Error('WAREHOUSE_TRANSFER_LOT_INSUFFICIENT_ATTRIBUTION');
        }

        const movesWholeLot = Math.abs(allocation.quantity - lot.quantity) <= 0.000001;
        if (movesWholeLot) {
          if (splitLotSnapshots[index].exists()) {
            throw new Error('WAREHOUSE_TRANSFER_SPLIT_LOT_CONFLICT');
          }
          transaction.update(allocationLotRefs[index], {
            position: to,
            updatedBy: scope.uid,
            updatedAt: serverTimestamp(),
          });
          return;
        }

        if (splitLotSnapshots[index].exists()) {
          throw new Error('WAREHOUSE_TRANSFER_SPLIT_LOT_CONFLICT');
        }

        const nextSourceQuantity = normalizeWarehouseLocationQuantity(
          lot.quantity - allocation.quantity
        );
        if (nextSourceQuantity === null || nextSourceQuantity <= 0) {
          throw new Error('WAREHOUSE_TRANSFER_LOT_SPLIT_INVALID');
        }

        const splitCandidate = validateWarehouseLot(
          {
            schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
            id: splitLotIds[index],
            workspaceId: scope.workspaceId,
            ug: scope.ug,
            materialId: material.id,
            code: lot.code,
            expiresOn: lot.expiresOn,
            quantity: allocation.quantity,
            position: to,
            origin: lot.origin,
            status: 'active',
            createdBy: scope.uid,
            updatedBy: scope.uid,
          },
          {
            expectedWorkspaceId: scope.workspaceId,
            expectedUg: scope.ug,
            expectedMaterialId: material.id,
          }
        );
        if (!splitCandidate.ok) {
          throw new Error('WAREHOUSE_TRANSFER_SPLIT_LOT_INVALID');
        }

        transaction.update(allocationLotRefs[index], {
          quantity: nextSourceQuantity,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
        transaction.set(splitLotRefs[index], {
          ...splitCandidate.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      transaction.set(movementRef, { ...candidate, createdAt: serverTimestamp() });
      transaction.set(fromBalanceRef, { ...nextFrom, updatedAt: serverTimestamp() });
      transaction.set(toBalanceRef, { ...nextTo, updatedAt: serverTimestamp() });

      return {
        applied: true,
        movement: candidate,
        balance: currentBalance,
        fromBalance: nextFrom,
        toBalance: nextTo,
      };
    });
  } catch (error) {
    // F06/SAME-KEY: a losing concurrent transaction can be refused when the
    // Firestore Rules evaluation budget is exceeded. A failure is NOT a replay.
    // Only a fully matching, readable committed movement is authoritative.
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'permission-denied' || code === 'aborted') {
      try {
        const committedSnapshot = await getDoc(doc(db, movementPath));
        if (committedSnapshot.exists()) {
          const committedMovement = parseMovement(
            scope.workspaceId,
            committedSnapshot.id,
            committedSnapshot.data() as Record<string, unknown>
          );
          const candidate = validateWarehouseMovement({
            schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
            id: movementId,
            workspaceId: scope.workspaceId,
            ug: scope.ug,
            materialId: input.materialId,
            type: 'TRANSFER',
            quantityDelta: 0,
            idempotencyKeyHash,
            reversesMovementId: null,
            note: input.note ?? null,
            source: {
              kind: 'LOCATION_TRANSFER',
              actorUid: scope.uid,
              quantity: normalizedQuantity,
              from,
              to,
              fromBalanceId,
              toBalanceId,
            },
          }, {
            expectedWorkspaceId: scope.workspaceId,
            expectedUg: scope.ug,
            expectedMaterialId: input.materialId,
          });
          if (!candidate.ok || !warehouseMovementMatchesReplay(committedMovement, candidate.data)) {
            throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
          }

          // Read-only, bounded proof (one movement + three balance documents).
          // Fresh canonical balances are validated, never written or synthesized.
          const [aggregateSnapshot, sourceSnapshot, destinationSnapshot] = await Promise.all([
            getDoc(doc(db, balancePath)),
            getDoc(doc(db, fromBalancePath)),
            getDoc(doc(db, toBalancePath)),
          ]);
          if (!aggregateSnapshot.exists() || !sourceSnapshot.exists() || !destinationSnapshot.exists()) {
            throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
          }
          const aggregate = parseBalance(
            scope.workspaceId, input.materialId, aggregateSnapshot.data() as Record<string, unknown>
          );
          const source = parseLocationBalance(
            scope.workspaceId, sourceSnapshot.id, sourceSnapshot.data() as Record<string, unknown>
          );
          const destination = parseLocationBalance(
            scope.workspaceId, destinationSnapshot.id, destinationSnapshot.data() as Record<string, unknown>
          );
          if (
            aggregate.ug !== scope.ug
            || source.ug !== scope.ug
            || destination.ug !== scope.ug
            || source.materialId !== input.materialId
            || destination.materialId !== input.materialId
            || !warehouseStockPositionsEqual(source.position, from)
            || !warehouseStockPositionsEqual(destination.position, to)
          ) {
            throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
          }
          return {
            applied: false,
            movement: committedMovement,
            balance: aggregate,
            fromBalance: source,
            toBalance: destination,
          };
        }
      } catch (proofError) {
        // Only explicit canonical mismatches may supersede the original error.
        // Denied reads, missing proofs and transient failures retain the
        // original PERMISSION_DENIED/ABORTED status.
        if (
          proofError instanceof Error
          && (
            proofError.message === 'WAREHOUSE_IDEMPOTENCY_CONFLICT'
            || proofError.message === 'WAREHOUSE_LOCATION_BALANCE_INCONSISTENT'
          )
        ) throw proofError;
      }
    }
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
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
