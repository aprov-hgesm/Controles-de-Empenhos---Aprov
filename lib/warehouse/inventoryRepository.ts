import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  deriveUnassignedQuantity,
  validateWarehouseLocationBalance,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  buildWarehousePositionLabel,
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from './locationRepository';
import {
  applyWarehouseMovementToBalance,
  createWarehouseMovementId,
  normalizeWarehouseQuantity,
  validateWarehouseBalance,
  validateWarehouseMovement,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
  type WarehousePhysicalInventoryMovementSource,
} from './movement';
import { listWarehouseBalances } from './ledgerRepository';
import { listWarehouseMaterials } from './materialRepository';
import { validateWarehouseMaterial, type WarehouseMaterial } from './material';
import {
  calculateWarehouseInventoryDifference,
  createWarehouseInventoryId,
  createWarehouseInventoryItemId,
  isValidWarehouseInventoryId,
  summarizeWarehouseInventoryItems,
  validateWarehouseInventoryItem,
  validateWarehouseInventoryScope,
  validateWarehouseInventorySession,
  warehouseInventoryItemStatusForDifference,
  warehouseInventoryScopeIncludesPosition,
  WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION,
  WAREHOUSE_INVENTORY_SCHEMA_VERSION,
  type WarehouseInventoryItem,
  type WarehouseInventoryReviewSummary,
  type WarehouseInventoryScope,
  type WarehouseInventorySession,
} from './inventory';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

const INVENTORY_PAGE_LIMIT = 500;
const INVENTORY_WRITE_CHUNK = 350;

export interface WarehouseInventorySessionRecord {
  session: WarehouseInventorySession;
  referenceCapturedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  confirmationStartedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface WarehouseInventoryItemRecord {
  item: WarehouseInventoryItem;
  countedAt: string | null;
  adjustedAt: string | null;
}

export interface WarehouseUnlocatedStock {
  material: WarehouseMaterial;
  quantity: number;
}

export interface StartWarehouseInventoryInput {
  scope: WarehouseInventoryScope;
}

export interface ApplyWarehouseInventoryAdjustmentResult {
  applied: boolean;
  movement: WarehouseMovement;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
}

function currentScope(workspaceId: string): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_INVENTORY_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_INVENTORY_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
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

function inventorySessionPath(workspaceId: string, inventoryId: string): string {
  if (!isValidWarehouseInventoryId(inventoryId)) throw new Error('WAREHOUSE_INVENTORY_INVALID_ID');
  return warehouseDocumentPath(workspaceId, 'inventories', inventoryId);
}

function inventoryItemsPath(workspaceId: string, inventoryId: string): string {
  return inventorySessionPath(workspaceId, inventoryId) + '/items';
}

function inventoryItemPath(workspaceId: string, inventoryId: string, itemId: string): string {
  if (!/^invit_[a-f0-9]{64}$/.test(itemId)) throw new Error('WAREHOUSE_INVENTORY_INVALID_ITEM_ID');
  return inventoryItemsPath(workspaceId, inventoryId) + '/' + itemId;
}

function parseSession(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseInventorySessionRecord {
  const parsed = validateWarehouseInventorySession(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      scope: data.scope,
      status: data.status,
      itemCount: data.itemCount,
      openedBy: data.openedBy,
      reviewedBy: data.reviewedBy ?? null,
      confirmationStartedBy: data.confirmationStartedBy ?? null,
      confirmedBy: data.confirmedBy ?? null,
      cancelledBy: data.cancelledBy ?? null,
      reviewSummary: data.reviewSummary ?? null,
      staleItemId: data.staleItemId ?? null,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_INVENTORY_SESSION');
  return {
    session: parsed.data,
    referenceCapturedAt: timestampToIso(data.referenceCapturedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    reviewedAt: timestampToIso(data.reviewedAt),
    confirmationStartedAt: timestampToIso(data.confirmationStartedAt),
    confirmedAt: timestampToIso(data.confirmedAt),
    cancelledAt: timestampToIso(data.cancelledAt),
  };
}

function parseItem(
  workspaceId: string,
  inventoryId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseInventoryItemRecord {
  const parsed = validateWarehouseInventoryItem(
    {
      schemaVersion: data.schemaVersion,
      id,
      inventoryId: data.inventoryId,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      position: data.position,
      locationBalanceId: data.locationBalanceId,
      expectedQuantity: data.expectedQuantity,
      expectedBalanceRevision: data.expectedBalanceRevision,
      expectedBalanceLastMovementId: data.expectedBalanceLastMovementId,
      expectedLocationRevision: data.expectedLocationRevision,
      expectedLocationLastMovementId: data.expectedLocationLastMovementId,
      countedQuantity: data.countedQuantity ?? null,
      difference: data.difference ?? null,
      status: data.status,
      countedBy: data.countedBy ?? null,
      adjustmentMovementId: data.adjustmentMovementId ?? null,
      adjustedBy: data.adjustedBy ?? null,
    },
    { expectedWorkspaceId: workspaceId, expectedInventoryId: inventoryId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_INVENTORY_ITEM');
  return {
    item: parsed.data,
    countedAt: timestampToIso(data.countedAt),
    adjustedAt: timestampToIso(data.adjustedAt),
  };
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

function parseMaterial(workspaceId: string, id: string, data: Record<string, unknown>): WarehouseMaterial {
  const result = validateWarehouseMaterial({ ...data, id }, { expectedWorkspaceId: workspaceId });
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
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

function validateScopeAgainstStructure(
  inventoryScope: WarehouseInventoryScope,
  depots: WarehouseDepotListItem[],
  locations: WarehouseLocationListItem[]
): void {
  if (inventoryScope.kind === 'TOTAL') return;
  const depot = depots.find((item) => item.depot.id === inventoryScope.depotId)?.depot;
  if (!depot || depot.status !== 'active') throw new Error('WAREHOUSE_INVENTORY_DEPOT_INVALID');
  if (inventoryScope.kind === 'DEPOT') return;

  const location = locations.find((item) => item.location.id === inventoryScope.locationId)?.location;
  if (!location || location.status !== 'active' || location.kind !== 'LOCAL' || location.depotId !== depot.id) {
    throw new Error('WAREHOUSE_INVENTORY_LOCATION_INVALID');
  }
  if (inventoryScope.kind === 'LOCATION') return;

  const subposition = locations.find((item) => item.location.id === inventoryScope.subpositionId)?.location;
  if (
    !subposition
    || subposition.status !== 'active'
    || subposition.kind !== 'SUBPOSITION'
    || subposition.depotId !== depot.id
    || subposition.parentLocationId !== location.id
  ) {
    throw new Error('WAREHOUSE_INVENTORY_SUBPOSITION_INVALID');
  }
}

function assertProjectionConsistency(
  balances: WarehouseBalance[],
  locationBalances: WarehouseLocationBalance[]
): void {
  const byMaterial = new Map<string, WarehouseLocationBalance[]>();
  for (const item of locationBalances) {
    const current = byMaterial.get(item.materialId) || [];
    current.push(item);
    byMaterial.set(item.materialId, current);
  }

  for (const balance of balances) {
    const total = (byMaterial.get(balance.materialId) || [])
      .reduce((sum, item) => sum + item.quantity, 0);
    if (Math.abs(total - balance.quantity) > 0.000001) {
      throw new Error('WAREHOUSE_INVENTORY_PROJECTION_INCONSISTENT');
    }
  }
}

export async function startWarehouseInventory(
  workspaceId: string,
  input: StartWarehouseInventoryInput
): Promise<WarehouseInventorySessionRecord> {
  const scope = currentScope(workspaceId);
  const inventoryScope = validateWarehouseInventoryScope(input.scope);
  if (!inventoryScope) throw new Error('WAREHOUSE_INVENTORY_INVALID_SCOPE');

  const [materials, balances, locationRecords, depots, locations] = await Promise.all([
    listWarehouseMaterials(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseLocationBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseDepots(scope.workspaceId, 250),
    listWarehouseLocations(scope.workspaceId, INVENTORY_PAGE_LIMIT),
  ]);

  if (
    materials.length >= INVENTORY_PAGE_LIMIT
    || balances.length >= INVENTORY_PAGE_LIMIT
    || locationRecords.length >= INVENTORY_PAGE_LIMIT
    || locations.length >= INVENTORY_PAGE_LIMIT
  ) {
    throw new Error('WAREHOUSE_INVENTORY_SCOPE_TOO_LARGE');
  }

  validateScopeAgainstStructure(inventoryScope, depots, locations);
  const locationBalances = locationRecords.map((record) => record.balance);

  const materialById = new Map(materials.map((material) => [material.id, material]));
  const balanceByMaterial = new Map(balances.map((balance) => [balance.materialId, balance]));
  const selected = locationBalances.filter((balance) =>
    balance.quantity > 0
    && warehouseInventoryScopeIncludesPosition(inventoryScope, balance.position)
    && materialById.get(balance.materialId)?.status === 'active'
  );

  if (selected.length === 0) throw new Error('WAREHOUSE_INVENTORY_SCOPE_EMPTY');

  // Inventário parcial não deve ser bloqueado por lacunas históricas de materiais
  // fora do escopo. A coerência continua obrigatória para cada material efetivamente
  // inventariado, somando todas as suas posições oficiais.
  const selectedMaterialIds = new Set(selected.map((balance) => balance.materialId));
  assertProjectionConsistency(
    balances.filter((balance) => selectedMaterialIds.has(balance.materialId)),
    locationBalances.filter((balance) => selectedMaterialIds.has(balance.materialId))
  );
  if (selected.length > 1200) throw new Error('WAREHOUSE_INVENTORY_SCOPE_TOO_LARGE');

  const inventoryId = createWarehouseInventoryId();
  const sessionPath = inventorySessionPath(scope.workspaceId, inventoryId);
  const baseSession = {
    schemaVersion: WAREHOUSE_INVENTORY_SCHEMA_VERSION,
    id: inventoryId,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    scope: inventoryScope,
    status: 'OPENING' as const,
    itemCount: selected.length,
    openedBy: scope.uid,
    reviewedBy: null,
    confirmationStartedBy: null,
    confirmedBy: null,
    cancelledBy: null,
    reviewSummary: null,
    staleItemId: null,
  };

  await setDoc(doc(db, sessionPath), {
    ...baseSession,
    referenceCapturedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedAt: null,
    confirmationStartedAt: null,
    confirmedAt: null,
    cancelledAt: null,
  });

  try {
    const itemWrites: Array<{ id: string; data: WarehouseInventoryItem }> = [];
    for (const positionBalance of selected) {
      const aggregate = balanceByMaterial.get(positionBalance.materialId);
      if (!aggregate) throw new Error('WAREHOUSE_INVENTORY_BALANCE_NOT_FOUND');
      if (aggregate.ug !== scope.ug || positionBalance.ug !== scope.ug) {
        throw new Error('WAREHOUSE_INVENTORY_UG_MISMATCH');
      }
      const itemId = await createWarehouseInventoryItemId(
        inventoryId,
        positionBalance.materialId,
        positionBalance.position
      );
      itemWrites.push({
        id: itemId,
        data: {
          schemaVersion: WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION,
          id: itemId,
          inventoryId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: positionBalance.materialId,
          position: positionBalance.position,
          locationBalanceId: positionBalance.id,
          expectedQuantity: positionBalance.quantity,
          expectedBalanceRevision: aggregate.revision,
          expectedBalanceLastMovementId: aggregate.lastMovementId,
          expectedLocationRevision: positionBalance.revision,
          expectedLocationLastMovementId: positionBalance.lastMovementId,
          countedQuantity: null,
          difference: null,
          status: 'PENDING',
          countedBy: null,
          adjustmentMovementId: null,
          adjustedBy: null,
        },
      });
    }

    for (let start = 0; start < itemWrites.length; start += INVENTORY_WRITE_CHUNK) {
      const batch = writeBatch(db);
      for (const entry of itemWrites.slice(start, start + INVENTORY_WRITE_CHUNK)) {
        batch.set(doc(db, inventoryItemPath(scope.workspaceId, inventoryId, entry.id)), {
          ...entry.data,
          countedAt: null,
          adjustedAt: null,
        });
      }
      await batch.commit();
    }

    await updateDoc(doc(db, sessionPath), {
      status: 'COUNTING',
      updatedAt: serverTimestamp(),
    });

    return {
      session: { ...baseSession, status: 'COUNTING' },
      referenceCapturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: null,
      confirmationStartedAt: null,
      confirmedAt: null,
      cancelledAt: null,
    };
  } catch (error) {
    await updateDoc(doc(db, sessionPath), {
      status: 'CANCELLED',
      cancelledBy: scope.uid,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
    throw error;
  }
}

export async function listWarehouseInventorySessions(
  workspaceId: string,
  maxResults = 24
): Promise<WarehouseInventorySessionRecord[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'inventories');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        orderBy('createdAt', 'desc'),
        limit(Math.max(1, Math.min(maxResults, 60)))
      )
    );
    return snapshot.docs.map((item) =>
      parseSession(scope.workspaceId, item.id, item.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseInventoryItems(
  workspaceId: string,
  inventoryId: string,
  maxResults = INVENTORY_PAGE_LIMIT
): Promise<WarehouseInventoryItemRecord[]> {
  const scope = currentScope(workspaceId);
  const path = inventoryItemsPath(scope.workspaceId, inventoryId);
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, INVENTORY_PAGE_LIMIT))))
    );
    return snapshot.docs.map((item) =>
      parseItem(scope.workspaceId, inventoryId, item.id, item.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveWarehouseInventoryCount(
  workspaceId: string,
  inventoryId: string,
  itemId: string,
  countedQuantity: number
): Promise<WarehouseInventoryItem> {
  const scope = currentScope(workspaceId);
  const normalizedCount = normalizeWarehouseQuantity(countedQuantity);
  if (normalizedCount === null || normalizedCount < 0) {
    throw new Error('WAREHOUSE_INVENTORY_INVALID_COUNT');
  }

  const sessionPath = inventorySessionPath(scope.workspaceId, inventoryId);
  const itemPath = inventoryItemPath(scope.workspaceId, inventoryId, itemId);

  return runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, sessionPath);
    const itemRef = doc(db, itemPath);
    const [sessionSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(itemRef),
    ]);
    if (!sessionSnapshot.exists() || !itemSnapshot.exists()) {
      throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    }
    const session = parseSession(
      scope.workspaceId,
      sessionSnapshot.id,
      sessionSnapshot.data() as Record<string, unknown>
    ).session;
    const current = parseItem(
      scope.workspaceId,
      inventoryId,
      itemSnapshot.id,
      itemSnapshot.data() as Record<string, unknown>
    ).item;

    if (session.status !== 'COUNTING') throw new Error('WAREHOUSE_INVENTORY_NOT_COUNTING');
    if (current.status === 'ADJUSTED') throw new Error('WAREHOUSE_INVENTORY_ITEM_ALREADY_ADJUSTED');

    const difference = calculateWarehouseInventoryDifference(
      current.expectedQuantity,
      normalizedCount
    );
    const next: WarehouseInventoryItem = {
      ...current,
      countedQuantity: normalizedCount,
      difference,
      status: warehouseInventoryItemStatusForDifference(normalizedCount, difference),
      countedBy: scope.uid,
      adjustmentMovementId: null,
      adjustedBy: null,
    };

    transaction.update(itemRef, {
      countedQuantity: next.countedQuantity,
      difference: next.difference,
      status: next.status,
      countedBy: scope.uid,
      countedAt: serverTimestamp(),
      adjustmentMovementId: null,
      adjustedBy: null,
      adjustedAt: null,
    });
    return next;
  });
}

export async function beginWarehouseInventoryReview(
  workspaceId: string,
  inventoryId: string
): Promise<WarehouseInventoryReviewSummary> {
  const scope = currentScope(workspaceId);
  const records = await listWarehouseInventoryItems(scope.workspaceId, inventoryId);
  if (records.length === 0) throw new Error('WAREHOUSE_INVENTORY_EMPTY');
  const items = records.map((record) => record.item);
  if (items.some((item) => item.status === 'PENDING' || item.status === 'STALE')) {
    throw new Error('WAREHOUSE_INVENTORY_COUNT_INCOMPLETE');
  }
  const summary = summarizeWarehouseInventoryItems(items);
  const path = inventorySessionPath(scope.workspaceId, inventoryId);

  await runTransaction(db, async (transaction) => {
    const ref = doc(db, path);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      snapshot.data() as Record<string, unknown>
    ).session;
    if (session.status !== 'COUNTING') throw new Error('WAREHOUSE_INVENTORY_NOT_COUNTING');
    transaction.update(ref, {
      status: 'REVIEW',
      reviewedBy: scope.uid,
      reviewSummary: summary,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      staleItemId: null,
    });
  });

  return summary;
}

export async function reopenWarehouseInventoryCounting(
  workspaceId: string,
  inventoryId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = inventorySessionPath(scope.workspaceId, inventoryId);
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, path);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      snapshot.data() as Record<string, unknown>
    ).session;
    if (session.status !== 'REVIEW') throw new Error('WAREHOUSE_INVENTORY_NOT_IN_REVIEW');
    transaction.update(ref, {
      status: 'COUNTING',
      reviewedBy: null,
      reviewSummary: null,
      reviewedAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

async function beginWarehouseInventoryConfirmation(
  workspaceId: string,
  inventoryId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = inventorySessionPath(scope.workspaceId, inventoryId);
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, path);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      snapshot.data() as Record<string, unknown>
    ).session;
    if (session.status === 'CONFIRMING') return;
    if (session.status !== 'REVIEW') throw new Error('WAREHOUSE_INVENTORY_NOT_IN_REVIEW');
    transaction.update(ref, {
      status: 'CONFIRMING',
      confirmationStartedBy: scope.uid,
      confirmationStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
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

export async function applyWarehouseInventoryAdjustment(
  workspaceId: string,
  inventoryId: string,
  itemId: string
): Promise<ApplyWarehouseInventoryAdjustmentResult> {
  const scope = currentScope(workspaceId);
  const idempotencyKey = 'phase10:inventory:' + inventoryId + ':' + itemId;
  const movementId = await createWarehouseMovementId(scope.workspaceId, idempotencyKey);
  const idempotencyKeyHash = movementId.slice('mov_'.length);

  const sessionPath = inventorySessionPath(scope.workspaceId, inventoryId);
  const itemPath = inventoryItemPath(scope.workspaceId, inventoryId, itemId);
  const movementPath = warehouseDocumentPath(scope.workspaceId, 'movements', movementId);

  try {
    return await runTransaction(db, async (transaction) => {
      const sessionRef = doc(db, sessionPath);
      const itemRef = doc(db, itemPath);
      const movementRef = doc(db, movementPath);
      const [sessionSnapshot, itemSnapshot, existingMovementSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(itemRef),
        transaction.get(movementRef),
      ]);

      if (!sessionSnapshot.exists() || !itemSnapshot.exists()) {
        throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
      }
      const session = parseSession(
        scope.workspaceId,
        inventoryId,
        sessionSnapshot.data() as Record<string, unknown>
      ).session;
      const item = parseItem(
        scope.workspaceId,
        inventoryId,
        itemId,
        itemSnapshot.data() as Record<string, unknown>
      ).item;

      if (session.status !== 'CONFIRMING') throw new Error('WAREHOUSE_INVENTORY_NOT_CONFIRMING');
      if (item.status === 'MATCHED') throw new Error('WAREHOUSE_INVENTORY_ZERO_DIFFERENCE');
      if (item.status === 'STALE') throw new Error('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      if (item.countedQuantity === null || item.difference === null || item.difference === 0) {
        throw new Error('WAREHOUSE_INVENTORY_INVALID_DIVERGENCE');
      }

      const materialPath = warehouseDocumentPath(scope.workspaceId, 'materials', item.materialId);
      const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', item.materialId);
      const locationPath = warehouseDocumentPath(
        scope.workspaceId,
        'locationBalances',
        item.locationBalanceId
      );
      const materialRef = doc(db, materialPath);
      const balanceRef = doc(db, balancePath);
      const locationRef = doc(db, locationPath);
      const [materialSnapshot, balanceSnapshot, locationSnapshot] = await Promise.all([
        transaction.get(materialRef),
        transaction.get(balanceRef),
        transaction.get(locationRef),
      ]);
      if (!materialSnapshot.exists() || !balanceSnapshot.exists() || !locationSnapshot.exists()) {
        throw new Error('WAREHOUSE_INVENTORY_REFERENCE_MISSING');
      }

      const material = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      const balance = parseBalance(
        scope.workspaceId,
        balanceSnapshot.id,
        balanceSnapshot.data() as Record<string, unknown>
      );
      const locationBalance = parseLocationBalance(
        scope.workspaceId,
        locationSnapshot.id,
        locationSnapshot.data() as Record<string, unknown>
      );

      if (material.ug !== scope.ug || balance.ug !== scope.ug || locationBalance.ug !== scope.ug) {
        throw new Error('WAREHOUSE_INVENTORY_UG_MISMATCH');
      }
      if (
        locationBalance.materialId !== item.materialId
        || locationBalance.id !== item.locationBalanceId
        || locationBalance.revision !== item.expectedLocationRevision
        || locationBalance.lastMovementId !== item.expectedLocationLastMovementId
      ) {
        throw new Error('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      }

      const source: WarehousePhysicalInventoryMovementSource = {
        kind: 'PHYSICAL_INVENTORY',
        actorUid: scope.uid,
        inventoryId,
        inventoryItemId: itemId,
        expectedQuantity: item.expectedQuantity,
        countedQuantity: item.countedQuantity,
        position: item.position,
        locationBalanceId: item.locationBalanceId,
        expectedLocationRevision: item.expectedLocationRevision,
        expectedLocationLastMovementId: item.expectedLocationLastMovementId,
      };

      const candidateResult = validateWarehouseMovement(
        {
          schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
          id: movementId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: item.materialId,
          type: 'INVENTORY_ADJUSTMENT',
          quantityDelta: item.difference,
          idempotencyKeyHash,
          reversesMovementId: null,
          note: 'Ajuste confirmado no inventário físico ' + inventoryId,
          source,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
          expectedMaterialId: item.materialId,
        }
      );
      if (!candidateResult.ok) throw new Error('WAREHOUSE_INVENTORY_MOVEMENT_INVALID');
      const candidate = candidateResult.data;

      if (existingMovementSnapshot.exists()) {
        const existing = parseMovement(
          scope.workspaceId,
          existingMovementSnapshot.id,
          existingMovementSnapshot.data() as Record<string, unknown>
        );
        if (
          existing.type !== 'INVENTORY_ADJUSTMENT'
          || existing.materialId !== candidate.materialId
          || JSON.stringify(existing.source) !== JSON.stringify(candidate.source)
        ) {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        if (item.status !== 'ADJUSTED' || item.adjustmentMovementId !== existing.id) {
          throw new Error('WAREHOUSE_INVENTORY_ADJUSTMENT_INCONSISTENT');
        }
        return {
          applied: false,
          movement: existing,
          balance,
          locationBalance,
        };
      }

      if (item.status !== 'DIVERGENT') throw new Error('WAREHOUSE_INVENTORY_ITEM_NOT_DIVERGENT');

      const nextBalance = applyWarehouseMovementToBalance(candidate, balance);
      const nextLocationBalance = applyWarehouseLocationDelta(locationBalance, {
        id: locationBalance.id,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: item.materialId,
        position: item.position,
        quantityDelta: item.difference,
        movementId,
      });
      if (nextBalance.quantity < 0 || nextLocationBalance.quantity < 0) {
        throw new Error('WAREHOUSE_INVENTORY_NEGATIVE_STOCK');
      }

      transaction.set(movementRef, {
        ...candidate,
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        ...nextBalance,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationRef, {
        ...nextLocationBalance,
        updatedAt: serverTimestamp(),
      });
      transaction.update(itemRef, {
        status: 'ADJUSTED',
        adjustmentMovementId: movementId,
        adjustedBy: scope.uid,
        adjustedAt: serverTimestamp(),
      });

      return {
        applied: true,
        movement: candidate,
        balance: nextBalance,
        locationBalance: nextLocationBalance,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
}

async function markWarehouseInventoryReconciliationRequired(
  workspaceId: string,
  inventoryId: string,
  itemId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const sessionPath = inventorySessionPath(scope.workspaceId, inventoryId);
  const itemPath = inventoryItemPath(scope.workspaceId, inventoryId, itemId);
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, sessionPath);
    const itemRef = doc(db, itemPath);
    const [sessionSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(itemRef),
    ]);
    if (!sessionSnapshot.exists() || !itemSnapshot.exists()) return;
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      sessionSnapshot.data() as Record<string, unknown>
    ).session;
    const item = parseItem(
      scope.workspaceId,
      inventoryId,
      itemId,
      itemSnapshot.data() as Record<string, unknown>
    ).item;
    if (session.status !== 'CONFIRMING' || item.status === 'ADJUSTED') return;
    transaction.update(itemRef, { status: 'STALE' });
    transaction.update(sessionRef, {
      status: 'RECONCILIATION_REQUIRED',
      staleItemId: itemId,
      updatedAt: serverTimestamp(),
    });
  });
}

async function finishWarehouseInventoryConfirmation(
  workspaceId: string,
  inventoryId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const items = await listWarehouseInventoryItems(scope.workspaceId, inventoryId);
  if (
    items.some(({ item }) =>
      item.status === 'PENDING'
      || item.status === 'DIVERGENT'
      || item.status === 'STALE'
    )
  ) {
    throw new Error('WAREHOUSE_INVENTORY_CONFIRMATION_INCOMPLETE');
  }

  const path = inventorySessionPath(scope.workspaceId, inventoryId);
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, path);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      snapshot.data() as Record<string, unknown>
    ).session;
    if (session.status !== 'CONFIRMING') throw new Error('WAREHOUSE_INVENTORY_NOT_CONFIRMING');
    transaction.update(ref, {
      status: 'CONFIRMED',
      confirmedBy: scope.uid,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      staleItemId: null,
    });
  });
}

export async function confirmWarehouseInventory(
  workspaceId: string,
  inventoryId: string
): Promise<{ adjusted: number; matched: number }> {
  const scope = currentScope(workspaceId);
  await beginWarehouseInventoryConfirmation(scope.workspaceId, inventoryId);
  const records = await listWarehouseInventoryItems(scope.workspaceId, inventoryId);
  let adjusted = records.filter(({ item }) => item.status === 'ADJUSTED').length;
  let matched = records.filter(({ item }) => item.status === 'MATCHED').length;

  for (const record of records) {
    const item = record.item;
    if (item.status !== 'DIVERGENT') continue;
    try {
      const result = await applyWarehouseInventoryAdjustment(
        scope.workspaceId,
        inventoryId,
        item.id
      );
      if (result.applied) adjusted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE')) {
        await markWarehouseInventoryReconciliationRequired(
          scope.workspaceId,
          inventoryId,
          item.id
        );
      }
      throw error;
    }
  }

  await finishWarehouseInventoryConfirmation(scope.workspaceId, inventoryId);
  return { adjusted, matched };
}

export async function cancelWarehouseInventory(
  workspaceId: string,
  inventoryId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = inventorySessionPath(scope.workspaceId, inventoryId);
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, path);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const session = parseSession(
      scope.workspaceId,
      inventoryId,
      snapshot.data() as Record<string, unknown>
    ).session;
    if (session.status === 'CONFIRMED' || session.status === 'CANCELLED') {
      throw new Error('WAREHOUSE_INVENTORY_FINALIZED');
    }
    if (session.status === 'CONFIRMING') {
      throw new Error('WAREHOUSE_INVENTORY_CONFIRMATION_IN_PROGRESS');
    }
    transaction.update(ref, {
      status: 'CANCELLED',
      cancelledBy: scope.uid,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function listWarehouseUnlocatedStock(
  workspaceId: string
): Promise<WarehouseUnlocatedStock[]> {
  const scope = currentScope(workspaceId);
  const [materials, balances, locations] = await Promise.all([
    listWarehouseMaterials(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseLocationBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
  ]);
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const physicalByMaterial = new Map<string, WarehouseLocationBalance[]>();
  for (const record of locations) {
    const current = physicalByMaterial.get(record.balance.materialId) || [];
    current.push(record.balance);
    physicalByMaterial.set(record.balance.materialId, current);
  }

  return balances
    .map((balance) => {
      const material = materialById.get(balance.materialId);
      if (!material || material.status !== 'active') return null;
      const unassigned = deriveUnassignedQuantity(
        balance.quantity,
        (physicalByMaterial.get(balance.materialId) || [])
          .filter((entry) => entry.position.kind !== 'UNASSIGNED')
      );
      return unassigned > 0.000001
        ? { material, quantity: unassigned }
        : null;
    })
    .filter((item): item is WarehouseUnlocatedStock => Boolean(item))
    .sort((a, b) => b.quantity - a.quantity);
}

export function warehouseInventoryScopeLabel(
  inventoryScope: WarehouseInventoryScope,
  depots: WarehouseDepotListItem[],
  locations: WarehouseLocationListItem[]
): string {
  if (inventoryScope.kind === 'TOTAL') return 'Inventário total';
  const depot = depots.find((item) => item.depot.id === inventoryScope.depotId)?.depot;
  if (inventoryScope.kind === 'DEPOT') return depot?.name || inventoryScope.depotId;
  const local = locations.find((item) => item.location.id === inventoryScope.locationId)?.location;
  if (inventoryScope.kind === 'LOCATION') {
    return [depot?.name || inventoryScope.depotId, local?.name || inventoryScope.locationId].join(' → ');
  }
  const sub = locations.find((item) => item.location.id === inventoryScope.subpositionId)?.location;
  return [
    depot?.name || inventoryScope.depotId,
    local?.name || inventoryScope.locationId,
    sub?.name || inventoryScope.subpositionId,
  ].join(' → ');
}

export function warehouseInventoryPositionLabel(
  position: WarehouseStockPosition,
  depots: WarehouseDepotListItem[],
  locations: WarehouseLocationListItem[]
): string {
  return buildWarehousePositionLabel(position, depots, locations);
}
