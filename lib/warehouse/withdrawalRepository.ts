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
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
import { validateWarehouseMaterial, type WarehouseMaterial } from './material';
import {
  applyWarehouseExpressOutbound,
} from './outboundRepository';
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
  movementId: string;
  consumptionId: string;
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
  if (
    data.schemaVersion !== WAREHOUSE_CONSUMPTION_SCHEMA_VERSION
    || !/^cons_[a-f0-9]{64}$/.test(id)
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || !['STOCK_OUTBOUND', 'IMMEDIATE_CONSUMPTION'].includes(String(origin))
    || typeof data.materialId !== 'string'
    || !/^mat_[a-f0-9]{32}$/.test(data.materialId)
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
    || typeof data.movementId !== 'string'
    || !/^mov_[a-f0-9]{64}$/.test(data.movementId)
    || !['PENDING', 'PREPARED', 'POSTED'].includes(String(siscofisStatus))
  ) {
    throw new Error('WAREHOUSE_INVALID_CONSUMPTION_RECORD');
  }
  return {
    schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: data.ug,
    origin: origin as WarehouseConsumptionRecord['origin'],
    materialId: data.materialId,
    materialDescription: data.materialDescription,
    unitLabel: data.unitLabel,
    quantity,
    requestedQuantity,
    presentationLabel: data.presentationLabel,
    destinationId: data.destinationId as string,
    destinationName: normalizeWarehouseDestinationName(data.destinationName as string),
    withdrawnBy: normalizeWarehouseWithdrawnBy(data.withdrawnBy as string),
    operatorUid: data.operatorUid,
    movementId: data.movementId,
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
    legacy: false,
  };
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
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 250))))
    );
    return snapshot.docs
      .map((entry) => {
        const data = entry.data() as Record<string, unknown>;
        return {
          destination: parseDestination(scope.workspaceId, entry.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((left, right) =>
        left.destination.name.localeCompare(right.destination.name, 'pt-BR')
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function createWarehouseDestination(
  workspaceId: string,
  input: CreateWarehouseDestinationInput
): Promise<WarehouseDestination> {
  const scope = currentScope(workspaceId);
  const name = normalizeWarehouseDestinationName(input.name);
  if (!name) throw new Error('WAREHOUSE_DESTINATION_NAME_REQUIRED');
  const id = createWarehouseDestinationId();
  const path = warehouseDocumentPath(scope.workspaceId, 'destinations', id);
  const candidate: WarehouseDestination = {
    schemaVersion: WAREHOUSE_DESTINATION_SCHEMA_VERSION,
    id,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    name,
    status: 'active',
    createdBy: scope.uid,
    updatedBy: scope.uid,
  };
  try {
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, path);
      const existing = await transaction.get(reference);
      if (existing.exists()) throw new Error('WAREHOUSE_DESTINATION_ID_CONFLICT');
      transaction.set(reference, {
        ...candidate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return candidate;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function setWarehouseDestinationStatus(
  workspaceId: string,
  destinationId: string,
  status: 'active' | 'inactive'
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'destinations',
    destinationId
  );
  try {
    await updateDoc(doc(db, path), {
      status,
      updatedBy: scope.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

async function createWithdrawalPayloadHash(
  input: FinalizeWarehouseMaterialWithdrawalInput
): Promise<string> {
  const payload = input.lines.map((line) => ({
    lineId: line.lineId,
    materialId: line.materialId,
    requestedQuantity: normalizeWarehouseQuantity(line.requestedQuantity),
    baseQuantity: normalizeWarehouseQuantity(line.baseQuantity),
    presentation: line.presentation,
    position: line.position,
    barcodeId: line.barcodeAssociation?.id || null,
    barcode: line.barcode || null,
    lotId: line.lotId,
  }));
  return stableHex(JSON.stringify(payload));
}

async function ensureWithdrawalHeader(
  workspaceId: string,
  input: FinalizeWarehouseMaterialWithdrawalInput,
  destination: WarehouseDestination
): Promise<WarehouseMaterialWithdrawal> {
  const scope = currentScope(workspaceId);
  if (!isWarehouseWithdrawalId(input.withdrawalId)) {
    throw new Error('WAREHOUSE_WITHDRAWAL_INVALID_ID');
  }
  if (
    input.lines.length < 1
    || input.lines.length > WAREHOUSE_WITHDRAWAL_MAX_LINES
  ) {
    throw new Error('WAREHOUSE_WITHDRAWAL_LINE_LIMIT');
  }
  const withdrawnBy = normalizeWarehouseWithdrawnBy(input.withdrawnBy);
  if (!withdrawnBy) throw new Error('WAREHOUSE_WITHDRAWN_BY_REQUIRED');
  const payloadHash = await createWithdrawalPayloadHash(input);
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'withdrawals',
    input.withdrawalId
  );
  return runTransaction(db, async (transaction) => {
    const reference = doc(db, path);
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      const existing = parseWithdrawal(
        scope.workspaceId,
        snapshot.id,
        snapshot.data() as Record<string, unknown>
      );
      if (
        existing.destinationId !== destination.id
        || existing.destinationName !== destination.name
        || existing.withdrawnBy !== withdrawnBy
        || existing.payloadHash !== payloadHash
        || existing.expectedLineCount !== input.lines.length
      ) {
        throw new Error('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    const nowIso = new Date().toISOString();
    const created: WarehouseMaterialWithdrawal = {
      schemaVersion: WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
      id: input.withdrawalId,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      destinationId: destination.id,
      destinationName: destination.name,
      withdrawnBy,
      payloadHash,
      expectedLineCount: input.lines.length,
      appliedLineCount: 0,
      status: 'FINALIZING',
      createdBy: scope.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      finalizedAt: null,
    };
    transaction.set(reference, {
      ...created,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      finalizedAt: null,
    });
    return created;
  });
}

async function setWithdrawalProgress(
  workspaceId: string,
  withdrawalId: string,
  appliedLineCount: number,
  final: boolean
): Promise<WarehouseMaterialWithdrawal> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'withdrawals',
    withdrawalId
  );
  return runTransaction(db, async (transaction) => {
    const reference = doc(db, path);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('WAREHOUSE_WITHDRAWAL_NOT_FOUND');
    const current = parseWithdrawal(
      scope.workspaceId,
      snapshot.id,
      snapshot.data() as Record<string, unknown>
    );
    if (current.status === 'FINALIZED') return current;
    const nextApplied = Math.max(current.appliedLineCount, appliedLineCount);
    if (nextApplied > current.expectedLineCount) {
      throw new Error('WAREHOUSE_WITHDRAWAL_PROGRESS_INVALID');
    }
    if (final && nextApplied !== current.expectedLineCount) {
      throw new Error('WAREHOUSE_WITHDRAWAL_INCOMPLETE');
    }
    const status = final
      ? 'FINALIZED'
      : nextApplied > 0
        ? 'PARTIALLY_APPLIED'
        : 'FINALIZING';
    transaction.update(reference, {
      appliedLineCount: nextApplied,
      status,
      updatedAt: serverTimestamp(),
      finalizedAt: final ? serverTimestamp() : null,
    });
    return {
      ...current,
      appliedLineCount: nextApplied,
      status,
      updatedAt: new Date().toISOString(),
      finalizedAt: final ? new Date().toISOString() : null,
    };
  });
}

async function recordStockConsumption(input: {
  workspaceId: string;
  withdrawal: WarehouseMaterialWithdrawal;
  line: WarehouseWithdrawalLineInput;
  movement: WarehouseMovement;
}): Promise<string> {
  const scope = currentScope(input.workspaceId);
  const consumptionId = await createConsumptionId(
    scope.workspaceId,
    'stock:' + input.withdrawal.id + ':' + input.line.lineId
  );
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'consumptions',
    consumptionId
  );
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, path);
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      const existing = parseConsumption(
        scope.workspaceId,
        snapshot.id,
        snapshot.data() as Record<string, unknown>
      );
      if (
        existing.movementId !== input.movement.id
        || existing.withdrawalId !== input.withdrawal.id
        || existing.lineId !== input.line.lineId
      ) {
        throw new Error('WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT');
      }
      return;
    }
    transaction.set(reference, {
      schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
      id: consumptionId,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      origin: 'STOCK_OUTBOUND',
      materialId: input.line.materialId,
      materialDescription: input.line.materialDescription,
      unitLabel: input.line.unitLabel,
      quantity: input.line.baseQuantity,
      requestedQuantity: input.line.requestedQuantity,
      presentationLabel: input.line.presentationLabel,
      destinationId: input.withdrawal.destinationId,
      destinationName: input.withdrawal.destinationName,
      withdrawnBy: input.withdrawal.withdrawnBy,
      operatorUid: scope.uid,
      movementId: input.movement.id,
      withdrawalId: input.withdrawal.id,
      lineId: input.line.lineId,
      intakeId: null,
      invoiceRecordKey: null,
      barcode: input.line.barcode,
      lotCode: input.line.lotCode,
      positionLabel: input.line.positionLabel,
      siscofisStatus: 'PENDING',
      occurredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      siscofisUpdatedBy: null,
      siscofisUpdatedAt: null,
    });
  });
  return consumptionId;
}

export async function finalizeWarehouseMaterialWithdrawal(
  workspaceId: string,
  input: FinalizeWarehouseMaterialWithdrawalInput
): Promise<FinalizeWarehouseMaterialWithdrawalResult> {
  const scope = currentScope(workspaceId);
  if (
    input.lines.some((line) =>
      !isWarehouseWithdrawalLineId(line.lineId)
      || line.materialId.length === 0
      || !Number.isFinite(line.requestedQuantity)
      || line.requestedQuantity <= 0
      || !Number.isFinite(line.baseQuantity)
      || line.baseQuantity <= 0
    )
  ) {
    throw new Error('WAREHOUSE_WITHDRAWAL_INVALID_LINE');
  }
  const uniqueLineIds = new Set(input.lines.map((line) => line.lineId));
  if (uniqueLineIds.size !== input.lines.length) {
    throw new Error('WAREHOUSE_WITHDRAWAL_DUPLICATE_LINE_ID');
  }

  const destination = await requireActiveDestination(
    scope.workspaceId,
    input.destinationId
  );
  let withdrawal = await ensureWithdrawalHeader(
    scope.workspaceId,
    input,
    destination
  );
  if (withdrawal.status === 'FINALIZED') {
    return { withdrawal, movementIds: [] };
  }

  const movementIds: string[] = [];
  let completed = withdrawal.appliedLineCount;
  try {
    for (let index = 0; index < input.lines.length; index += 1) {
      const line = input.lines[index];
      const result = await applyWarehouseExpressOutbound(scope.workspaceId, {
        materialId: line.materialId,
        requestedQuantity: line.requestedQuantity,
        presentation: line.presentation,
        position: line.position,
        barcodeAssociation: line.barcodeAssociation,
        lotId: line.lotId,
        idempotencyKey:
          'material-withdrawal:' + input.withdrawalId + ':' + line.lineId,
        note: 'Saída de Material · ' + input.withdrawalId + ' · ' + line.lineId,
      });
      movementIds.push(result.movement.id);
      await recordStockConsumption({
        workspaceId: scope.workspaceId,
        withdrawal,
        line: {
          ...line,
          baseQuantity: result.plan.baseQuantity,
        },
        movement: result.movement,
      });
      completed = Math.max(completed, index + 1);
      withdrawal = await setWithdrawalProgress(
        scope.workspaceId,
        input.withdrawalId,
        completed,
        false
      );
    }
    withdrawal = await setWithdrawalProgress(
      scope.workspaceId,
      input.withdrawalId,
      input.lines.length,
      true
    );
    return { withdrawal, movementIds };
  } catch (error) {
    if (completed > 0) {
      try {
        withdrawal = await setWithdrawalProgress(
          scope.workspaceId,
          input.withdrawalId,
          completed,
          false
        );
      } catch {
        // A retirada continua não finalizada; o retry usa as mesmas identidades.
      }
    }
    throw error;
  }
}

export async function applyWarehouseImmediateConsumption(
  workspaceId: string,
  input: ApplyWarehouseImmediateConsumptionInput
): Promise<ApplyWarehouseImmediateConsumptionResult> {
  const scope = currentScope(workspaceId);
  if (
    input.effectiveStatus === 'RECONCILIATION_REQUIRED'
    || input.effectiveStatus === 'PROCESSED'
  ) {
    throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
  }
  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_INVALID_QUANTITY');
  }
  const receivedQuantity = normalizeWarehouseQuantity(input.receivedQuantity);
  if (receivedQuantity === null || receivedQuantity <= 0) {
    throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_INVALID_RECEIVED_QUANTITY');
  }
  const withdrawnBy = normalizeWarehouseWithdrawnBy(input.withdrawnBy);
  if (!withdrawnBy) throw new Error('WAREHOUSE_WITHDRAWN_BY_REQUIRED');
  const operationId = normalizeOperationId(input.operationId);
  const destination = await requireActiveDestination(
    scope.workspaceId,
    input.destinationId
  );

  const entryContext = await ensureWarehouseIntakeEntryContext(
    scope.workspaceId,
    input
  );
  const material = entryContext.material;
  const entryMovement = entryContext.entryMovement;

  const unassigned: WarehouseStockPosition = { kind: 'UNASSIGNED' };
  const locationBalanceId = await createWarehouseLocationBalanceId(
    scope.workspaceId,
    material.id,
    unassigned
  );
  const idempotencyKey = (
    'adm-intake-v2:' + input.intakeId + ':immediate:' + operationId
  ).slice(0, 240);
  const movementId = await createWarehouseMovementId(
    scope.workspaceId,
    idempotencyKey
  );
  const consumptionId = await createConsumptionId(
    scope.workspaceId,
    'immediate:' + input.intakeId + ':' + operationId
  );

  const intakePath = warehouseDocumentPath(
    scope.workspaceId,
    'intakes',
    input.intakeId
  );
  const movementPath = warehouseDocumentPath(
    scope.workspaceId,
    'movements',
    movementId
  );
  const consumptionPath = warehouseDocumentPath(
    scope.workspaceId,
    'consumptions',
    consumptionId
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const intakeRef = doc(db, intakePath);
      const materialRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'materials', material.id)
      );
      const balanceRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'balances', material.id)
      );
      const locationBalanceRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'locationBalances',
          locationBalanceId
        )
      );
      const entryMovementRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'movements',
          entryMovement.id
        )
      );
      const movementRef = doc(db, movementPath);
      const destinationRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'destinations',
          destination.id
        )
      );
      const consumptionRef = doc(db, consumptionPath);

      const [
        intakeSnapshot,
        materialSnapshot,
        balanceSnapshot,
        locationBalanceSnapshot,
        storedEntrySnapshot,
        movementSnapshot,
        destinationSnapshot,
        consumptionSnapshot,
      ] = await Promise.all([
        transaction.get(intakeRef),
        transaction.get(materialRef),
        transaction.get(balanceRef),
        transaction.get(locationBalanceRef),
        transaction.get(entryMovementRef),
        transaction.get(movementRef),
        transaction.get(destinationRef),
        transaction.get(consumptionRef),
      ]);

      if (!materialSnapshot.exists() || !balanceSnapshot.exists()) {
        throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_STOCK_MISSING');
      }
      const liveMaterial = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      const currentBalance = parseBalance(
        scope.workspaceId,
        liveMaterial.id,
        balanceSnapshot.data() as Record<string, unknown>
      );
      if (
        liveMaterial.id !== material.id
        || liveMaterial.ug !== scope.ug
        || liveMaterial.status !== 'active'
      ) {
        throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
      }
      if (!locationBalanceSnapshot.exists()) {
        throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
      }
      const currentLocation = parseLocationBalance(
        scope.workspaceId,
        locationBalanceSnapshot.id,
        locationBalanceSnapshot.data() as Record<string, unknown>
      );

      if (!storedEntrySnapshot.exists()) {
        throw new Error('WAREHOUSE_INTAKE_ENTRY_MOVEMENT_MISSING');
      }
      const storedEntry = parseMovement(
        scope.workspaceId,
        storedEntrySnapshot.id,
        storedEntrySnapshot.data() as Record<string, unknown>
      );
      if (
        storedEntry.id !== entryMovement.id
        || storedEntry.type !== 'INVOICE_ENTRY'
        || storedEntry.materialId !== material.id
        || Math.abs(storedEntry.quantityDelta - receivedQuantity) > EPSILON
        || storedEntry.source?.kind !== 'INVOICE'
        || storedEntry.source.invoiceRecordKey !== input.invoiceRecordKey
        || !storedEntry.source.itemIds.includes(input.itemId)
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
      }

      if (!destinationSnapshot.exists()) {
        throw new Error('WAREHOUSE_DESTINATION_NOT_FOUND');
      }
      const liveDestination = parseDestination(
        scope.workspaceId,
        destinationSnapshot.id,
        destinationSnapshot.data() as Record<string, unknown>
      );
      if (
        liveDestination.status !== 'active'
        || liveDestination.id !== destination.id
      ) {
        throw new Error('WAREHOUSE_DESTINATION_INACTIVE');
      }

      const source = {
        kind: 'EXPRESS_OUTBOUND' as const,
        interface: 'MANUAL_SEARCH' as const,
        actorUid: scope.uid,
        requestedQuantity: quantity,
        quantity,
        presentation: material.unit,
        factorToBaseUnit: 1,
        barcodeId: null,
        barcode: null,
        position: unassigned,
        locationBalanceId,
        lotId: null,
        lotCode: null,
      };
      const candidateResult = validateWarehouseMovement(
        {
          schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
          id: movementId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          type: 'OUTBOUND',
          quantityDelta: -quantity,
          idempotencyKeyHash: movementId.slice('mov_'.length),
          reversesMovementId: null,
          note:
            'Consumo imediato intake v2 · '
            + input.intakeId
            + ' · '
            + operationId,
          source,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
          expectedMaterialId: material.id,
        }
      );
      if (!candidateResult.ok) {
        throw new Error('WAREHOUSE_INVALID_IMMEDIATE_CONSUMPTION_MOVEMENT');
      }
      const movement = candidateResult.data;

      const currentIntake = intakeSnapshot.exists()
        ? parseIntake(
            scope.workspaceId,
            intakeSnapshot.id,
            intakeSnapshot.data() as Record<string, unknown>
          )
        : null;
      const currentAllocated = currentIntake?.allocatedQuantity || 0;
      const currentImmediate =
        currentIntake?.immediateConsumptionQuantity || 0;

      if (movementSnapshot.exists()) {
        const existingMovement = parseMovement(
          scope.workspaceId,
          movementSnapshot.id,
          movementSnapshot.data() as Record<string, unknown>
        );
        if (!warehouseMovementMatchesReplay(existingMovement, movement)) {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        if (!currentIntake || !consumptionSnapshot.exists()) {
          throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_LEDGER_MISMATCH');
        }
        const existingConsumption = parseConsumption(
          scope.workspaceId,
          consumptionSnapshot.id,
          consumptionSnapshot.data() as Record<string, unknown>
        );
        if (
          existingConsumption.movementId !== existingMovement.id
          || existingConsumption.intakeId !== input.intakeId
          || existingConsumption.destinationId !== destination.id
          || existingConsumption.withdrawnBy !== withdrawnBy
        ) {
          throw new Error('WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT');
        }
        return {
          applied: false,
          intake: currentIntake,
          movementId: existingMovement.id,
          consumptionId: existingConsumption.id,
        };
      }

      if (
        Math.abs(currentAllocated - input.expectedAllocatedQuantity) > EPSILON
        || Math.abs(
          currentImmediate - input.expectedImmediateConsumptionQuantity
        ) > EPSILON
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION');
      }
      const pending = calculateWarehouseItemIntakePendingQuantity(
        receivedQuantity,
        currentAllocated,
        currentImmediate
      );
      if (quantity > pending + EPSILON) {
        throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_EXCEEDS_PENDING');
      }
      if (
        currentBalance.quantity + EPSILON < quantity
        || currentLocation.quantity + EPSILON < quantity
      ) {
        throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_STOCK_MISMATCH');
      }

      const nextBalance = applyWarehouseMovementToBalance(
        movement,
        currentBalance
      );
      const nextLocation = applyWarehouseLocationDelta(
        currentLocation,
        {
          id: locationBalanceId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          position: unassigned,
          quantityDelta: -quantity,
          movementId,
        }
      );
      const nextImmediate = normalizeWarehouseQuantity(
        currentImmediate + quantity
      );
      if (nextImmediate === null) {
        throw new Error('WAREHOUSE_IMMEDIATE_CONSUMPTION_INVALID_QUANTITY');
      }
      const nextPending = calculateWarehouseItemIntakePendingQuantity(
        receivedQuantity,
        currentAllocated,
        nextImmediate
      );
      const nowIso = new Date().toISOString();
      const intakeCandidate = validateWarehouseItemIntakeState(
        {
          schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
          id: input.intakeId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          invoiceRecordKey: input.invoiceRecordKey,
          invoiceId: input.invoiceId,
          empenhoId: input.empenhoId,
          itemId: input.itemId,
          materialId: material.id,
          description: currentIntake?.description || input.description,
          unitLabel: currentIntake?.unitLabel || input.unitLabel,
          supplier: currentIntake?.supplier || input.supplier,
          receivedQuantity,
          allocatedQuantity: currentAllocated,
          immediateConsumptionQuantity: nextImmediate,
          pendingQuantity: nextPending,
          status: deriveWarehouseItemIntakeStatus(
            receivedQuantity,
            currentAllocated,
            nextImmediate
          ),
          createdAt: currentIntake?.createdAt || nowIso,
          updatedAt: nowIso,
          createdBy: currentIntake?.createdBy || scope.uid,
          updatedBy: scope.uid,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
        }
      );
      if (!intakeCandidate.ok) {
        throw new Error('WAREHOUSE_INVALID_ITEM_INTAKE_STATE');
      }

      transaction.set(movementRef, {
        ...movement,
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        ...nextBalance,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationBalanceRef, {
        ...nextLocation,
        updatedAt: serverTimestamp(),
      });

      if (currentIntake) {
        transaction.update(intakeRef, {
          materialId: intakeCandidate.data.materialId,
          allocatedQuantity: intakeCandidate.data.allocatedQuantity,
          immediateConsumptionQuantity:
            intakeCandidate.data.immediateConsumptionQuantity,
          pendingQuantity: intakeCandidate.data.pendingQuantity,
          status: intakeCandidate.data.status,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(intakeRef, {
          ...intakeCandidate.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(consumptionRef, {
        schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
        id: consumptionId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        origin: 'IMMEDIATE_CONSUMPTION',
        materialId: material.id,
        materialDescription: input.description.trim(),
        unitLabel: input.unitLabel.trim(),
        quantity,
        requestedQuantity: quantity,
        presentationLabel: input.unitLabel.trim(),
        destinationId: destination.id,
        destinationName: destination.name,
        withdrawnBy,
        operatorUid: scope.uid,
        movementId,
        withdrawalId: null,
        lineId: null,
        intakeId: input.intakeId,
        invoiceRecordKey: input.invoiceRecordKey,
        barcode: null,
        lotCode: null,
        positionLabel: 'Sem localização · consumo imediato',
        siscofisStatus: 'PENDING',
        occurredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        siscofisUpdatedBy: null,
        siscofisUpdatedAt: null,
      });

      return {
        applied: true,
        intake: intakeCandidate.data,
        movementId,
        consumptionId,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
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
        legacy: true,
      });
    }
    records.sort((left, right) =>
      (right.occurredAt || '').localeCompare(left.occurredAt || '')
    );
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
