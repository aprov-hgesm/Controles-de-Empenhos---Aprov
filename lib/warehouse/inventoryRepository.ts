import { warehouseServerCommand } from './serverCommandClient';
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

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
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
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';
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
  const result = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) =>
      parseItem(scope.workspaceId, inventoryId, item.id, item.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveWarehouseInventoryCount(
  workspaceId:string,inventoryId:string,itemId:string,countedQuantity:number
):Promise<WarehouseInventoryItem> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<WarehouseInventoryItem>(
    scope.workspaceId,'INVENTORY_COUNT',{inventoryId,itemId,countedQuantity}
  );
}
export async function beginWarehouseInventoryReview(
  workspaceId:string,inventoryId:string
):Promise<WarehouseInventoryReviewSummary> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<WarehouseInventoryReviewSummary>(
    scope.workspaceId,'INVENTORY_REVIEW',{inventoryId}
  );
}
export async function reopenWarehouseInventoryCounting(
  workspaceId:string,inventoryId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand(scope.workspaceId,'INVENTORY_REOPEN',{inventoryId});
}
async function beginWarehouseInventoryConfirmation(
  workspaceId:string,inventoryId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand(scope.workspaceId,'INVENTORY_BEGIN_CONFIRM',{inventoryId});
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

/** A confirmação ajusta ledger, saldo físico e lotes exclusivamente no servidor. */
export async function applyWarehouseInventoryAdjustment(
  workspaceId:string,inventoryId:string,itemId:string
):Promise<ApplyWarehouseInventoryAdjustmentResult> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<ApplyWarehouseInventoryAdjustmentResult>(
    scope.workspaceId,'INVENTORY_ADJUST',{inventoryId,itemId}
  );
}

async function markWarehouseInventoryReconciliationRequired(
  workspaceId:string,inventoryId:string,itemId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand(scope.workspaceId,'INVENTORY_STALE',{inventoryId,itemId});
}
async function finishWarehouseInventoryConfirmation(
  workspaceId:string,inventoryId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand(scope.workspaceId,'INVENTORY_FINISH_CONFIRM',{inventoryId});
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
  workspaceId:string,inventoryId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand(scope.workspaceId,'INVENTORY_CANCEL',{inventoryId});
}
export function deriveWarehouseUnlocatedStock(
  materials: readonly WarehouseMaterial[],
  balances: readonly WarehouseBalance[],
  locations: readonly { balance: WarehouseLocationBalance }[]
): WarehouseUnlocatedStock[] {
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

export async function listWarehouseUnlocatedStock(
  workspaceId: string
): Promise<WarehouseUnlocatedStock[]> {
  const scope = currentScope(workspaceId);
  const [materials, balances, locations] = await Promise.all([
    listWarehouseMaterials(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
    listWarehouseLocationBalances(scope.workspaceId, INVENTORY_PAGE_LIMIT),
  ]);
  return deriveWarehouseUnlocatedStock(materials, balances, locations);
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
