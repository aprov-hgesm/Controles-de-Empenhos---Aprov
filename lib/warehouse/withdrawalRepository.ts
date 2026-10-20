import { applyWarehouseImmediateConsumptionFast } from './intakeActionClient';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';
import { warehouseServerCommand } from './serverCommandClient';
import {
  WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
  createWorkspaceMemoryReadCache,
} from './memoryReadCache';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import {
  ensureWarehouseIntakeEntryContext,
  type WarehouseIntakeEntryInput,
} from './intakeAllocationRepository';
import {
  calculateWarehouseItemIntakePendingQuantity,
  deriveWarehouseItemIntakeStatus,
  validateWarehouseItemIntakeState,
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
  type WarehouseItemIntakeEffectiveStatus,
  type WarehouseItemIntakeState,
} from './intakeState';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  applyWarehouseMovementToBalance,
  createWarehouseMovementId,
  normalizeWarehouseQuantity,
  validateWarehouseBalance,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
} from './movement';
import { normalizeWarehouseMaterialId, validateWarehouseMaterial, type WarehouseMaterial } from './material';
import type { WarehouseLot } from './lot';
import { getWarehouseLot } from './lotRepository';
import {
  applyWarehouseExpressOutbound,
} from './outboundRepository';
import { registerWarehouseManualEntry } from './manualEntryRepository';
import {
  warehouseDocumentPath,
  warehouseDomainPath,
} from './namespace';
import {
  createWarehouseDestinationId,
  isWarehouseDestinationId,
  isWarehouseWithdrawalId,
  isWarehouseWithdrawalLineId,
  normalizeWarehouseDestinationName,
  normalizeWarehouseWithdrawnBy,
  WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
  WAREHOUSE_DESTINATION_SCHEMA_VERSION,
  WAREHOUSE_WITHDRAWAL_MAX_LINES,
  WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
  type WarehouseConsumptionRecord,
  type WarehouseConsumptionReportQuery,
  type WarehouseConsumptionReportResult,
  type WarehouseDestination,
  type WarehouseDestinationListItem,
  type WarehouseMaterialWithdrawal,
  type WarehouseSiscofisOperationalStatus,
  type WarehouseWithdrawalLineInput,
} from './withdrawal';

const EPSILON = 0.000001;

const destinationListReadCache = createWorkspaceMemoryReadCache<WarehouseDestinationListItem[]>({
  ttlMs: WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
});

function invalidateWarehouseDestinationReadCache(workspaceId: string): void {
  destinationListReadCache.invalidate(workspaceId);
}

export interface CreateWarehouseDestinationInput {
  name: string;
}

export interface FinalizeWarehouseMaterialWithdrawalInput {
  withdrawalId: string;
  destinationId: string;
  withdrawnBy: string;
  lines: WarehouseWithdrawalLineInput[];
}

export interface FinalizeWarehouseMaterialWithdrawalResult {
  withdrawal: WarehouseMaterialWithdrawal;
  movementIds: string[];
}

export interface ApplyWarehouseImmediateConsumptionInput
  extends WarehouseIntakeEntryInput {
  expectedAllocatedQuantity: number;
  expectedImmediateConsumptionQuantity: number;
  effectiveStatus: WarehouseItemIntakeEffectiveStatus;
  quantity: number;
  destinationId: string;
  withdrawnBy: string;
  operationId: string;
}

export interface ApplyWarehouseImmediateConsumptionResult {
  applied: boolean;
  intake: WarehouseItemIntakeState;
  movementId: string | null;
  consumptionId: string;
}

export interface ReturnWarehouseStockOutboundInput {
  consumptionId: string;
  quantity: number;
  reason: string;
  operationId: string;
}

export interface ReturnWarehouseStockOutboundResult {
  movement: WarehouseMovement;
  consumption: WarehouseConsumptionRecord;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
  lot: WarehouseLot | null;
  warnings: string[];
}

const WAREHOUSE_OUTBOUND_RETURN_SCHEMA_VERSION =
  'warehouse_outbound_return_v1' as const;

interface WarehouseOutboundReturnSummary {
  schemaVersion: typeof WAREHOUSE_OUTBOUND_RETURN_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  consumptionId: string;
  materialId: string;
  originalQuantity: number;
  returnedQuantity: number;
  pendingOperationId: string | null;
  pendingQuantity: number | null;
  pendingReason: string | null;
  pendingBy: string | null;
  lastReturnOperationId: string | null;
  lastReturnMovementId: string | null;
  lastReturnAt: string | null;
  lastReturnBy: string | null;
  lastReturnReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function currentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_WITHDRAWAL_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  const normalized = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== normalized || !scope.ug) {
    throw new Error('WAREHOUSE_WITHDRAWAL_SCOPE_MISMATCH');
  }
  return { workspaceId: normalized, ug: scope.ug, uid: user.uid };
}

function timestampToIso(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function normalizeOperationId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(normalized)) {
    throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_INVALID_OPERATION_ID');
  }
  return normalized;
}

async function stableHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function createConsumptionId(
  workspaceId: string,
  identity: string
): Promise<string> {
  return 'cons_' + await stableHex(workspaceId + '\n' + identity);
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

function parseMovement(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMovement {
  const result = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id,
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

function parseIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseItemIntakeState {
  const result = validateWarehouseItemIntakeState(
    {
      ...data,
      id,
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_ITEM_INTAKE_STATE');
  return result.data;
}

function parseDestination(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseDestination {
  const name = typeof data.name === 'string'
    ? normalizeWarehouseDestinationName(data.name)
    : '';
  const status = data.status;
  if (
    data.schemaVersion !== WAREHOUSE_DESTINATION_SCHEMA_VERSION
    || !isWarehouseDestinationId(id)
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || !name
    || (status !== 'active' && status !== 'inactive')
    || typeof data.createdBy !== 'string'
    || !data.createdBy
    || typeof data.updatedBy !== 'string'
    || !data.updatedBy
  ) {
    throw new Error('WAREHOUSE_INVALID_DESTINATION');
  }
  return {
    schemaVersion: WAREHOUSE_DESTINATION_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: data.ug,
    name,
    status,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}

function parseWithdrawal(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterialWithdrawal {
  if (
    data.schemaVersion !== WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION
    || !isWarehouseWithdrawalId(id)
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || !isWarehouseDestinationId(data.destinationId)
    || typeof data.destinationName !== 'string'
    || !normalizeWarehouseDestinationName(data.destinationName)
    || typeof data.withdrawnBy !== 'string'
    || !normalizeWarehouseWithdrawnBy(data.withdrawnBy)
    || typeof data.payloadHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(data.payloadHash)
    || typeof data.expectedLineCount !== 'number'
    || !Number.isSafeInteger(data.expectedLineCount)
    || data.expectedLineCount < 1
    || data.expectedLineCount > WAREHOUSE_WITHDRAWAL_MAX_LINES
    || typeof data.appliedLineCount !== 'number'
    || !Number.isSafeInteger(data.appliedLineCount)
    || data.appliedLineCount < 0
    || data.appliedLineCount > data.expectedLineCount
    || !['FINALIZING', 'PARTIALLY_APPLIED', 'FINALIZED'].includes(String(data.status))
    || typeof data.createdBy !== 'string'
    || !data.createdBy
  ) {
    throw new Error('WAREHOUSE_INVALID_WITHDRAWAL');
  }

  return {
    schemaVersion: WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: data.ug,
    destinationId: data.destinationId as string,
    destinationName: normalizeWarehouseDestinationName(data.destinationName as string),
    withdrawnBy: normalizeWarehouseWithdrawnBy(data.withdrawnBy as string),
    payloadHash: data.payloadHash as string,
    expectedLineCount: data.expectedLineCount as number,
    appliedLineCount: data.appliedLineCount as number,
    status: data.status as WarehouseMaterialWithdrawal['status'],
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    finalizedAt: timestampToIso(data.finalizedAt),
  };
}

function parseConsumption(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseConsumptionRecord {
  const quantity = normalizeWarehouseQuantity(data.quantity);
  const requestedQuantity = normalizeWarehouseQuantity(data.requestedQuantity);
  const origin = data.origin;
  const siscofisStatus = data.siscofisStatus;
  const returnedQuantity = data.returnedQuantity === undefined
    ? 0
    : normalizeWarehouseQuantity(data.returnedQuantity);
  if (
    data.schemaVersion !== WAREHOUSE_CONSUMPTION_SCHEMA_VERSION
    || !/^cons_[a-f0-9]{64}$/.test(id)
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || !['STOCK_OUTBOUND', 'IMMEDIATE_CONSUMPTION'].includes(String(origin))
    || !(
      (
        origin === 'STOCK_OUTBOUND'
        && typeof data.materialId === 'string'
        && /^mat_[a-f0-9]{32}$/.test(data.materialId)
      )
      || (
        origin === 'IMMEDIATE_CONSUMPTION'
        && (
          data.materialId == null
          || (
            typeof data.materialId === 'string'
            && /^mat_[a-f0-9]{32}$/.test(data.materialId)
          )
        )
      )
    )
    || typeof data.materialDescription !== 'string'
    || !data.materialDescription.trim()
    || typeof data.unitLabel !== 'string'
    || !data.unitLabel.trim()
    || quantity === null
    || quantity <= 0
    || requestedQuantity === null
    || requestedQuantity <= 0
    || typeof data.presentationLabel !== 'string'
    || !data.presentationLabel.trim()
    || !isWarehouseDestinationId(data.destinationId)
    || typeof data.destinationName !== 'string'
    || !normalizeWarehouseDestinationName(data.destinationName)
    || typeof data.withdrawnBy !== 'string'
    || !normalizeWarehouseWithdrawnBy(data.withdrawnBy)
    || typeof data.operatorUid !== 'string'
    || !data.operatorUid
    || !(
      (
        origin === 'STOCK_OUTBOUND'
        && typeof data.movementId === 'string'
        && /^mov_[a-f0-9]{64}$/.test(data.movementId)
      )
      || (
        origin === 'IMMEDIATE_CONSUMPTION'
        && (
          data.movementId == null
          || (
            typeof data.movementId === 'string'
            && /^mov_[a-f0-9]{64}$/.test(data.movementId)
          )
        )
      )
    )
    || !['PENDING', 'PREPARED', 'POSTED'].includes(String(siscofisStatus))
    || returnedQuantity === null
    || returnedQuantity < 0
    || (origin === 'STOCK_OUTBOUND' && returnedQuantity > quantity)
    || (origin === 'IMMEDIATE_CONSUMPTION' && returnedQuantity !== 0)
  ) {
    throw new Error('WAREHOUSE_INVALID_CONSUMPTION_RECORD');
  }
  return {
    schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: data.ug,
    origin: origin as WarehouseConsumptionRecord['origin'],
    materialId: typeof data.materialId === 'string' ? data.materialId : null,
    materialDescription: data.materialDescription,
    unitLabel: data.unitLabel,
    quantity,
    requestedQuantity,
    presentationLabel: data.presentationLabel,
    destinationId: data.destinationId as string,
    destinationName: normalizeWarehouseDestinationName(data.destinationName as string),
    withdrawnBy: normalizeWarehouseWithdrawnBy(data.withdrawnBy as string),
    operatorUid: data.operatorUid,
    movementId: typeof data.movementId === 'string' ? data.movementId : null,
    withdrawalId: typeof data.withdrawalId === 'string' ? data.withdrawalId : null,
    lineId: typeof data.lineId === 'string' ? data.lineId : null,
    intakeId: typeof data.intakeId === 'string' ? data.intakeId : null,
    invoiceRecordKey:
      typeof data.invoiceRecordKey === 'string' ? data.invoiceRecordKey : null,
    barcode: typeof data.barcode === 'string' ? data.barcode : null,
    lotCode: typeof data.lotCode === 'string' ? data.lotCode : null,
    positionLabel:
      typeof data.positionLabel === 'string' ? data.positionLabel : '—',
    siscofisStatus:
      siscofisStatus as WarehouseSiscofisOperationalStatus,
    occurredAt: timestampToIso(data.occurredAt),
    updatedAt: timestampToIso(data.updatedAt),
    siscofisUpdatedBy:
      typeof data.siscofisUpdatedBy === 'string' ? data.siscofisUpdatedBy : null,
    siscofisUpdatedAt: timestampToIso(data.siscofisUpdatedAt),
    returnedQuantity,
    lastReturnMovementId:
      typeof data.lastReturnMovementId === 'string' ? data.lastReturnMovementId : null,
    lastReturnAt: timestampToIso(data.lastReturnAt),
    lastReturnBy:
      typeof data.lastReturnBy === 'string' ? data.lastReturnBy : null,
    lastReturnReason:
      typeof data.lastReturnReason === 'string' ? data.lastReturnReason : null,
    legacy: false,
  };
}

function parseOutboundReturnSummary(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseOutboundReturnSummary {
  const originalQuantity = normalizeWarehouseQuantity(data.originalQuantity);
  const returnedQuantity = normalizeWarehouseQuantity(data.returnedQuantity);
  const pendingQuantity = data.pendingQuantity == null
    ? null
    : normalizeWarehouseQuantity(data.pendingQuantity);

  if (
    data.schemaVersion !== WAREHOUSE_OUTBOUND_RETURN_SCHEMA_VERSION
    || !/^cons_[a-f0-9]{64}$/.test(id)
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || data.consumptionId !== id
    || typeof data.materialId !== 'string'
    || !/^mat_[a-f0-9]{32}$/.test(data.materialId)
    || originalQuantity === null
    || originalQuantity <= 0
    || returnedQuantity === null
    || returnedQuantity < 0
    || returnedQuantity > originalQuantity
    || (pendingQuantity !== null && pendingQuantity <= 0)
  ) {
    throw new Error('WAREHOUSE_INVALID_OUTBOUND_RETURN_SUMMARY');
  }

  return {
    schemaVersion: WAREHOUSE_OUTBOUND_RETURN_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: data.ug,
    consumptionId: id,
    materialId: data.materialId,
    originalQuantity,
    returnedQuantity,
    pendingOperationId:
      typeof data.pendingOperationId === 'string' ? data.pendingOperationId : null,
    pendingQuantity,
    pendingReason:
      typeof data.pendingReason === 'string' ? data.pendingReason : null,
    pendingBy:
      typeof data.pendingBy === 'string' ? data.pendingBy : null,
    lastReturnOperationId:
      typeof data.lastReturnOperationId === 'string'
        ? data.lastReturnOperationId
        : null,
    lastReturnMovementId:
      typeof data.lastReturnMovementId === 'string'
        ? data.lastReturnMovementId
        : null,
    lastReturnAt: timestampToIso(data.lastReturnAt),
    lastReturnBy:
      typeof data.lastReturnBy === 'string' ? data.lastReturnBy : null,
    lastReturnReason:
      typeof data.lastReturnReason === 'string' ? data.lastReturnReason : null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function listWarehouseOutboundReturnSummaries(
  workspaceId: string,
  consumptionIds: string[]
): Promise<Map<string, WarehouseOutboundReturnSummary>> {
  const ids = Array.from(
    new Set(
      consumptionIds.filter((id) => /^cons_[a-f0-9]{64}$/.test(id))
    )
  );
  const result = new Map<string, WarehouseOutboundReturnSummary>();
  if (!ids.length) return result;

  const path = warehouseDomainPath(workspaceId, 'outboundReturns');
  for (let index = 0; index < ids.length; index += 30) {
    const chunk = ids.slice(index, index + 30);
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where(documentId(), 'in', chunk)
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    for (const entry of snapshot.docs) {
      const summary = parseOutboundReturnSummary(
        workspaceId,
        entry.id,
        entry.data() as Record<string, unknown>
      );
      result.set(summary.consumptionId, summary);
    }
  }
  return result;
}

async function loadWarehouseDestinationsFromFirestore(
  workspaceId: string,
  maxResults: number
): Promise<WarehouseDestinationListItem[]> {
  const path = warehouseDomainPath(workspaceId, 'destinations');
  const snapshot = await getDocs(
    query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 250))))
  );
  recordWarehouseDocumentReads(workspaceId, snapshot.size);
  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as Record<string, unknown>;
      return {
        destination: parseDestination(workspaceId, entry.id, data),
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    })
    .sort((left, right) =>
      left.destination.name.localeCompare(right.destination.name, 'pt-BR')
    );
}

async function requireActiveDestination(
  workspaceId: string,
  destinationId: string
): Promise<WarehouseDestination> {
  if (!isWarehouseDestinationId(destinationId)) {
    throw new Error('WAREHOUSE_DESTINATION_INVALID');
  }
  const path = warehouseDocumentPath(workspaceId, 'destinations', destinationId);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) throw new Error('WAREHOUSE_DESTINATION_NOT_FOUND');
  const destination = parseDestination(
    workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
  if (destination.status !== 'active') {
    throw new Error('WAREHOUSE_DESTINATION_INACTIVE');
  }
  return destination;
}

export async function listWarehouseDestinations(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseDestinationListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'destinations');
  const bounded = Math.max(1, Math.min(maxResults, 250));
  try {
    return await loadWarehouseDestinationsFromFirestore(scope.workspaceId, bounded);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function listWarehouseDestinationsCached(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseDestinationListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'destinations');
  const bounded = Math.max(1, Math.min(maxResults, 250));
  try {
    const cached = await destinationListReadCache.read(
      scope.workspaceId,
      'list:' + bounded,
      () => loadWarehouseDestinationsFromFirestore(scope.workspaceId, bounded)
    );
    return cached.slice();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/** Destinos mutáveis são responsabilidade do servidor R2. */
export async function createWarehouseDestination(
  workspaceId: string,
  input: CreateWarehouseDestinationInput
): Promise<WarehouseDestination> {
  const result=await warehouseServerCommand<WarehouseDestination>(
    workspaceId,'DESTINATION_CREATE',input
  );
  invalidateWarehouseDestinationReadCache(workspaceId);
  return result;
}

export async function setWarehouseDestinationStatus(
  workspaceId: string,
  destinationId: string,
  status: 'active' | 'inactive'
): Promise<void> {
  await warehouseServerCommand<{ok:true}>(workspaceId,'DESTINATION_STATUS',{
    destinationId,status,
  });
  invalidateWarehouseDestinationReadCache(workspaceId);
}

/** Retirada e históricos de consumo são exclusivamente persistidos pelo servidor R2. */
export async function finalizeWarehouseMaterialWithdrawal(
  workspaceId:string,input:FinalizeWarehouseMaterialWithdrawalInput
):Promise<FinalizeWarehouseMaterialWithdrawalResult> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<FinalizeWarehouseMaterialWithdrawalResult>(
    scope.workspaceId,'WITHDRAWAL_FINALIZE',input
  );
}

export async function returnWarehouseStockOutbound(
  workspaceId:string,input:ReturnWarehouseStockOutboundInput
):Promise<ReturnWarehouseStockOutboundResult> {
  const scope=currentScope(workspaceId);
  return warehouseServerCommand<ReturnWarehouseStockOutboundResult>(
    scope.workspaceId,'STOCK_RETURN',input
  );
}

/** Consumo imediato é persistido exclusivamente pelo intake-action no servidor. */
export async function applyWarehouseImmediateConsumption(
  workspaceId:string,input:ApplyWarehouseImmediateConsumptionInput
):Promise<ApplyWarehouseImmediateConsumptionResult> {
  const scope=currentScope(workspaceId);
  return applyWarehouseImmediateConsumptionFast(scope.workspaceId,input);
}

export async function listWarehouseConsumptionReport(
  workspaceId: string,
  input: WarehouseConsumptionReportQuery
): Promise<WarehouseConsumptionReportResult> {
  const scope = currentScope(workspaceId);
  const maxResults = Math.max(1, Math.min(input.maxResults || 250, 250));
  if (
    !Number.isFinite(input.startAt.getTime())
    || !Number.isFinite(input.endAt.getTime())
    || input.endAt.getTime() < input.startAt.getTime()
  ) {
    throw new Error('WAREHOUSE_CONSUMPTION_INVALID_PERIOD');
  }
  const path = warehouseDomainPath(scope.workspaceId, 'consumptions');
  const snapshot = await getDocs(
    query(
      collection(db, path),
      where('occurredAt', '>=', input.startAt),
      where('occurredAt', '<=', input.endAt),
      orderBy('occurredAt', 'desc'),
      limit(maxResults)
    )
  );
  recordWarehouseDocumentReads(workspaceId, snapshot.size);
  const records = snapshot.docs.map((entry) =>
    parseConsumption(
      scope.workspaceId,
      entry.id,
      entry.data() as Record<string, unknown>
    )
  );
  const truncated = snapshot.size >= maxResults;
  let legacyCoverageLimited = false;

  if (input.includeLegacy !== false && !truncated) {
    const movementPath = warehouseDomainPath(scope.workspaceId, 'movements');
    const movementSnapshot = await getDocs(
      query(
        collection(db, movementPath),
        where('createdAt', '>=', input.startAt),
        where('createdAt', '<=', input.endAt),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
    );
    recordWarehouseDocumentReads(workspaceId, movementSnapshot.size);
    legacyCoverageLimited = movementSnapshot.size >= 100;
    const projectedMovementIds = new Set(
      records.map((record) => record.movementId)
    );
    for (const entry of movementSnapshot.docs) {
      if (projectedMovementIds.has(entry.id)) continue;
      const data = entry.data() as Record<string, unknown>;
      const movement = parseMovement(scope.workspaceId, entry.id, data);
      if (
        movement.type !== 'OUTBOUND'
        || movement.source?.kind !== 'EXPRESS_OUTBOUND'
      ) {
        continue;
      }
      const source = movement.source;
      records.push({
        schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
        id: 'legacy_' + movement.id,
        workspaceId: scope.workspaceId,
        ug: movement.ug,
        origin: 'STOCK_OUTBOUND',
        materialId: movement.materialId,
        materialDescription: 'Material ' + movement.materialId,
        unitLabel: source.presentation.label || source.presentation.code,
        quantity: source.quantity,
        requestedQuantity: source.requestedQuantity,
        presentationLabel:
          source.presentation.label || source.presentation.code,
        destinationId: 'legacy',
        destinationName: 'Não registrado (legado)',
        withdrawnBy: 'Não registrado (legado)',
        operatorUid: source.actorUid,
        movementId: movement.id,
        withdrawalId: null,
        lineId: null,
        intakeId: null,
        invoiceRecordKey: null,
        barcode: source.barcode,
        lotCode: source.lotCode,
        positionLabel: 'Posição registrada no movimento legado',
        siscofisStatus: 'PENDING',
        occurredAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.createdAt),
        siscofisUpdatedBy: null,
        siscofisUpdatedAt: null,
        returnedQuantity: 0,
        lastReturnMovementId: null,
        lastReturnAt: null,
        lastReturnBy: null,
        lastReturnReason: null,
        legacy: true,
      });
    }
    records.sort((left, right) =>
      (right.occurredAt || '').localeCompare(left.occurredAt || '')
    );
  }

  const returnSummaries = await listWarehouseOutboundReturnSummaries(
    scope.workspaceId,
    records
      .filter((record) => record.origin === 'STOCK_OUTBOUND' && !record.legacy)
      .map((record) => record.id)
  );

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const summary = returnSummaries.get(record.id);
    if (!summary) continue;
    records[index] = {
      ...record,
      returnedQuantity: Math.max(
        record.returnedQuantity,
        summary.returnedQuantity
      ),
      lastReturnMovementId:
        summary.lastReturnMovementId || record.lastReturnMovementId,
      lastReturnAt: summary.lastReturnAt || record.lastReturnAt,
      lastReturnBy: summary.lastReturnBy || record.lastReturnBy,
      lastReturnReason: summary.lastReturnReason || record.lastReturnReason,
    };
  }

  return { records, truncated, legacyCoverageLimited };
}

export async function setWarehouseConsumptionSiscofisStatus(
  workspaceId: string,
  consumptionId: string,
  status: WarehouseSiscofisOperationalStatus
): Promise<void> {
  const scope = currentScope(workspaceId);
  if (!/^cons_[a-f0-9]{64}$/.test(consumptionId)) {
    throw new Error('WAREHOUSE_CONSUMPTION_INVALID_ID');
  }
  if (!['PENDING', 'PREPARED', 'POSTED'].includes(status)) {
    throw new Error('WAREHOUSE_CONSUMPTION_INVALID_SISCOFIS_STATUS');
  }
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'consumptions',
    consumptionId
  );
  await updateDoc(doc(db, path), {
    siscofisStatus: status,
    updatedAt: serverTimestamp(),
    siscofisUpdatedBy: scope.uid,
    siscofisUpdatedAt: serverTimestamp(),
  });
}
