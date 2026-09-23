import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  createWarehouseMovementId,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  applyWarehouseMovementToBalance,
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
  type WarehouseEntityStatus,
  type WarehouseLocation,
  type WarehouseLocationBalance,
  type WarehouseLocationKind,
  type WarehouseStockPosition,
} from './location';
import { validateWarehouseBalance } from './movement';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

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
}

export interface UpdateWarehouseDepotInput {
  name?: string;
  description?: string | null;
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
  name?: string;
  description?: string | null;
  status?: WarehouseEntityStatus;
}

export interface TransferWarehouseStockInput {
  materialId: string;
  quantity: number;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  idempotencyKey: string;
  note?: string | null;
}

export interface TransferWarehouseStockResult {
  applied: boolean;
  movement: WarehouseMovement;
  balance: WarehouseBalance;
  fromBalance: WarehouseLocationBalance;
  toBalance: WarehouseLocationBalance;
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
  const result = validateWarehouseMaterial({ ...data, id }, { expectedWorkspaceId: workspaceId });
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
  return result.data;
}

async function assertDepotCodeAvailable(workspaceId: string, code: string): Promise<void> {
  const normalized = normalizeWarehouseLogicalCode(code);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_LOGICAL_CODE');
  const depots = await listWarehouseDepots(workspaceId, 250);
  if (depots.some((item) => item.depot.code === normalized)) {
    throw new Error('WAREHOUSE_DEPOT_CODE_ALREADY_EXISTS');
  }
}

async function assertLocationCodeAvailable(
  workspaceId: string,
  input: { kind: WarehouseLocationKind; depotId: string; parentLocationId: string | null; code: string }
): Promise<void> {
  const normalized = normalizeWarehouseLogicalCode(input.code);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_LOGICAL_CODE');
  const locations = await listWarehouseLocations(workspaceId, 500);
  if (locations.some(({ location }) =>
    location.kind === input.kind
    && location.depotId === input.depotId
    && location.parentLocationId === input.parentLocationId
    && location.code === normalized
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
  try {
    const snapshot = await getDocs(query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 250)))));
    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          depot: parseDepot(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((a, b) => a.depot.code.localeCompare(b.depot.code, 'pt-BR'));
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
  const candidate = validateWarehouseDepot({
    ...current,
    name: input.name ?? current.name,
    description: input.description === undefined ? current.description : input.description,
    status: input.status ?? current.status,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!candidate.ok) throw new Error('WAREHOUSE_INVALID_DEPOT_UPDATE');

  await updateDoc(doc(db, path), {
    name: candidate.data.name,
    description: candidate.data.description,
    status: candidate.data.status,
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
}

export async function listWarehouseLocations(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseLocationListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locations');
  try {
    const snapshot = await getDocs(query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500)))));
    return snapshot.docs
      .map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          location: parseLocation(scope.workspaceId, item.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((a, b) => a.location.code.localeCompare(b.location.code, 'pt-BR'));
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
  const candidate = validateWarehouseLocation({
    ...current,
    name: input.name ?? current.name,
    description: input.description === undefined ? current.description : input.description,
    status: input.status ?? current.status,
    updatedBy: scope.uid,
  }, { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug });
  if (!candidate.ok) throw new Error('WAREHOUSE_INVALID_LOCATION_UPDATE');

  await updateDoc(doc(db, path), {
    name: candidate.data.name,
    description: candidate.data.description,
    status: candidate.data.status,
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
}

export async function listWarehouseLocationBalances(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseLocationBalanceListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'locationBalances');
  try {
    const snapshot = await getDocs(query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500)))));
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
  if (position.kind === 'UNASSIGNED') return;

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

export async function transferWarehouseStock(
  workspaceId: string,
  input: TransferWarehouseStockInput
): Promise<TransferWarehouseStockResult> {
  const scope = currentScope(workspaceId);
  const from = validateWarehouseStockPosition(input.from);
  const to = validateWarehouseStockPosition(input.to);
  if (!from || !to) throw new Error('WAREHOUSE_TRANSFER_INVALID_POSITION');
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

  const materialPath = warehouseDocumentPath(scope.workspaceId, 'materials', input.materialId);
  const movementPath = warehouseDocumentPath(scope.workspaceId, 'movements', movementId);
  const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', input.materialId);
  const fromBalancePath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', fromBalanceId);
  const toBalancePath = warehouseDocumentPath(scope.workspaceId, 'locationBalances', toBalanceId);

  try {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, materialPath);
      const movementRef = doc(db, movementPath);
      const balanceRef = doc(db, balancePath);
      const fromBalanceRef = doc(db, fromBalancePath);
      const toBalanceRef = doc(db, toBalancePath);

      const [materialSnapshot, movementSnapshot, balanceSnapshot, fromSnapshot, toSnapshot] = await Promise.all([
        transaction.get(materialRef),
        transaction.get(movementRef),
        transaction.get(balanceRef),
        transaction.get(fromBalanceRef),
        transaction.get(toBalanceRef),
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

      const fromInitial = from.kind === 'UNASSIGNED' && !existingFrom
        ? currentBalance.quantity
        : 0;
      const available = existingFrom?.quantity ?? fromInitial;
      if (available < normalizedQuantity) throw new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');

      const nextFrom = applyWarehouseLocationDelta(existingFrom, {
        id: fromBalanceId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        position: from,
        quantityDelta: -normalizedQuantity,
        movementId,
        initialQuantity: fromInitial,
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
      const nextBalance = applyWarehouseMovementToBalance(candidate, currentBalance);

      transaction.set(movementRef, { ...candidate, createdAt: serverTimestamp() });
      transaction.set(balanceRef, { ...nextBalance, updatedAt: serverTimestamp() });
      transaction.set(fromBalanceRef, { ...nextFrom, updatedAt: serverTimestamp() });
      transaction.set(toBalanceRef, { ...nextTo, updatedAt: serverTimestamp() });

      return {
        applied: true,
        movement: candidate,
        balance: nextBalance,
        fromBalance: nextFrom,
        toBalance: nextTo,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
}

export function buildWarehousePositionLabel(
  position: WarehouseStockPosition,
  depots: WarehouseDepotListItem[],
  locations: WarehouseLocationListItem[]
): string {
  if (position.kind === 'UNASSIGNED') return 'Sem localização';
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
