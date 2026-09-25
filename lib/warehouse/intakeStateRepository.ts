import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  operationalCollectionRef,
} from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { Empenho, Invoice } from '../types';
import {
  createWarehouseItemIntakeId,
  validateWarehouseItemIntake,
  WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,
  type WarehouseItemIntake,
} from './intake';
import { getWarehouseInvoiceIntakeCutoff } from './intakeRepository';
import {
  calculateWarehouseItemIntakePendingQuantity,
  deriveWarehouseItemIntakeStatus,
  validateWarehouseItemIntakeState,
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
  type WarehouseItemIntakeEffectiveStatus,
  type WarehouseItemIntakeReconciliationReason,
  type WarehouseItemIntakeState,
} from './intakeState';
import { listWarehouseMovements } from './ledgerRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

export const WAREHOUSE_INTAKE_QUEUE_EMPENHOS_LIMIT = 250;
export const WAREHOUSE_INTAKE_QUEUE_INVOICES_LIMIT = 300;
export const WAREHOUSE_INTAKE_QUEUE_STATES_LIMIT = 500;
export const WAREHOUSE_INTAKE_QUEUE_LEGACY_MOVEMENTS_LIMIT = 250;

interface BoundedResult<T> {
  items: T[];
  truncated: boolean;
}

type PersistedIntake =
  | { kind: 'V1'; intake: WarehouseItemIntake; createdAt: string | null; updatedAt: string | null }
  | { kind: 'V2'; state: WarehouseItemIntakeState };

export type WarehouseIntakeQueueSource =
  | 'VIRTUAL_PENDING'
  | 'STATE_V2'
  | 'LEGACY_INTAKE_V1'
  | 'LEGACY_INVOICE_PROJECTION';

export interface WarehouseInvoiceIntakeQueueRow {
  key: string;
  stateId: string;
  invoiceRecordKey: string;
  invoiceId: string;
  issueDate: string | null;
  registeredAt: string | null;
  supplier: string;
  empenhoId: string;
  itemId: string;
  itemName: string;
  unitLabel: string;
  materialId: string | null;
  receivedQuantity: number;
  allocatedQuantity: number;
  immediateConsumptionQuantity: number;
  pendingQuantity: number;
  status: WarehouseItemIntakeEffectiveStatus;
  persisted: boolean;
  source: WarehouseIntakeQueueSource;
  reconciliationReason: WarehouseItemIntakeReconciliationReason | null;
  canonicalPresent: boolean;
}

export interface WarehouseInvoiceIntakeQueueContext {
  rows: WarehouseInvoiceIntakeQueueRow[];
  cutoffAt: string | null;
  truncated: boolean;
  reconciliationCoverageLimited: boolean;
}

export interface SaveWarehouseItemIntakeStateInput {
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  materialId?: string | null;
  description: string;
  unitLabel: string;
  supplier: string;
  receivedQuantity: number;
  allocatedQuantity: number;
  immediateConsumptionQuantity: number;
}

function currentScopeForWorkspace(workspaceId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_INTAKE_STATE_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(currentUser.uid);
  const expected = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== expected || !scope.ug) {
    throw new Error('WAREHOUSE_INTAKE_STATE_SCOPE_MISMATCH');
  }

  return {
    workspaceId: expected,
    ug: scope.ug,
    uid: currentUser.uid,
    scope,
  };
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
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  return null;
}

function recordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

function itemKey(invoiceRecordKey: string, itemId: string): string {
  return invoiceRecordKey + '|' + itemId;
}

async function listOperationalBounded<T>(
  workspaceId: string,
  collectionName: 'empenhos' | 'invoices',
  maxResults: number
): Promise<BoundedResult<T>> {
  const { scope } = currentScopeForWorkspace(workspaceId);
  const path = getOperationalCollectionPath(scope, collectionName);

  try {
    const snapshot = await getDocs(
      query(operationalCollectionRef(scope, collectionName), limit(maxResults))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return {
      items: snapshot.docs.map((entry) => {
        const data = entry.data() as T & { id?: string; recordKey?: string };
        if (collectionName === 'invoices') {
          return { ...data, recordKey: data.recordKey || entry.id } as T;
        }
        return { ...data, id: data.id || entry.id } as T;
      }),
      truncated: snapshot.size >= maxResults,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function parsePersistedIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): PersistedIntake | null {
  if (data.schemaVersion === WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
    const result = validateWarehouseItemIntake(
      { ...data, id },
      { expectedWorkspaceId: workspaceId }
    );
    if (!result.ok) {
      throw new Error(
        'WAREHOUSE_INVALID_LEGACY_ITEM_INTAKE: '
        + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
      );
    }
    return {
      kind: 'V1',
      intake: result.data,
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    };
  }

  if (data.schemaVersion === WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
    const result = validateWarehouseItemIntakeState(
      {
        ...data,
        id,
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      },
      { expectedWorkspaceId: workspaceId }
    );
    if (!result.ok) {
      throw new Error(
        'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
        + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
      );
    }
    return { kind: 'V2', state: result.data };
  }

  return null;
}

async function listPersistedIntakes(
  workspaceId: string
): Promise<BoundedResult<PersistedIntake>> {
  const scope = currentScopeForWorkspace(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'intakes');

  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(WAREHOUSE_INTAKE_QUEUE_STATES_LIMIT))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return {
      items: snapshot.docs.flatMap((entry) => {
        const parsed = parsePersistedIntake(
          scope.workspaceId,
          entry.id,
          entry.data() as Record<string, unknown>
        );
        return parsed ? [parsed] : [];
      }),
      truncated: snapshot.size >= WAREHOUSE_INTAKE_QUEUE_STATES_LIMIT,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function persistedKey(record: PersistedIntake): string {
  return record.kind === 'V2'
    ? itemKey(record.state.invoiceRecordKey, record.state.itemId)
    : itemKey(record.intake.invoiceRecordKey, record.intake.itemId);
}

function persistedStateId(record: PersistedIntake): string {
  return record.kind === 'V2' ? record.state.id : record.intake.id;
}

function materialFrom(
  invoiceMaterialId: string | undefined,
  empenhoMaterialId: string | undefined,
  persisted: PersistedIntake | undefined
): string | null {
  const persistedMaterialId = persisted?.kind === 'V2'
    ? persisted.state.materialId
    : persisted?.kind === 'V1'
      ? persisted.intake.materialId
      : null;

  return (
    empenhoMaterialId?.trim().toLowerCase()
    || invoiceMaterialId?.trim().toLowerCase()
    || persistedMaterialId
    || null
  );
}

function quantitiesFromPersisted(
  receivedQuantity: number,
  persisted: PersistedIntake | undefined
): {
  allocatedQuantity: number;
  immediateConsumptionQuantity: number;
  pendingQuantity: number;
  storedReceivedQuantity: number | null;
} {
  if (!persisted) {
    return {
      allocatedQuantity: 0,
      immediateConsumptionQuantity: 0,
      pendingQuantity: receivedQuantity,
      storedReceivedQuantity: null,
    };
  }

  if (persisted.kind === 'V2') {
    const allocatedQuantity = persisted.state.allocatedQuantity;
    const immediateConsumptionQuantity = persisted.state.immediateConsumptionQuantity;
    return {
      allocatedQuantity,
      immediateConsumptionQuantity,
      pendingQuantity: Math.max(
        0,
        calculateWarehouseItemIntakePendingQuantity(
          receivedQuantity,
          allocatedQuantity,
          immediateConsumptionQuantity
        )
      ),
      storedReceivedQuantity: persisted.state.receivedQuantity,
    };
  }

  const allocatedQuantity =
    persisted.intake.mode === 'ALLOCATED' ? persisted.intake.quantity : 0;
  const immediateConsumptionQuantity =
    persisted.intake.mode === 'IMMEDIATE_CONSUMPTION'
      ? persisted.intake.quantity
      : 0;

  return {
    allocatedQuantity,
    immediateConsumptionQuantity,
    pendingQuantity: Math.max(
      0,
      calculateWarehouseItemIntakePendingQuantity(
        receivedQuantity,
        allocatedQuantity,
        immediateConsumptionQuantity
      )
    ),
    storedReceivedQuantity: persisted.intake.quantity,
  };
}

export async function loadWarehouseInvoiceIntakeQueue(
  workspaceId: string
): Promise<WarehouseInvoiceIntakeQueueContext> {
  currentScopeForWorkspace(workspaceId);

  const [
    empenhosResult,
    invoicesResult,
    persistedResult,
    movementRecords,
    cutoffAt,
  ] = await Promise.all([
    listOperationalBounded<Empenho>(
      workspaceId,
      'empenhos',
      WAREHOUSE_INTAKE_QUEUE_EMPENHOS_LIMIT
    ),
    listOperationalBounded<Invoice>(
      workspaceId,
      'invoices',
      WAREHOUSE_INTAKE_QUEUE_INVOICES_LIMIT
    ),
    listPersistedIntakes(workspaceId),
    listWarehouseMovements(
      workspaceId,
      WAREHOUSE_INTAKE_QUEUE_LEGACY_MOVEMENTS_LIMIT
    ),
    getWarehouseInvoiceIntakeCutoff(workspaceId),
  ]);

  const empenhoById = new Map(
    empenhosResult.items.map((empenho) => [empenho.id, empenho])
  );
  const persistedByKey = new Map(
    persistedResult.items.map((record) => [persistedKey(record), record])
  );

  const legacyMovementKeys = new Set<string>();
  for (const record of movementRecords) {
    const source = record.movement.source;
    if (source?.kind !== 'INVOICE') continue;
    for (const sourceItemId of source.itemIds) {
      legacyMovementKeys.add(itemKey(source.invoiceRecordKey, sourceItemId));
    }
  }

  const allCanonicalKeys = new Set<string>();
  for (const invoice of invoicesResult.items) {
    const invoiceKey = recordKey(invoice);
    for (const invoiceItem of invoice.items) {
      allCanonicalKeys.add(itemKey(invoiceKey, invoiceItem.itemId));
    }
  }

  const cutoffMs = cutoffAt ? Date.parse(cutoffAt) : NaN;
  const eligibleInvoices = invoicesResult.items
    .filter((invoice) => {
      if (!Number.isFinite(cutoffMs)) return true;
      const registered = Date.parse(invoice.registeredAt || '');
      return Number.isFinite(registered) && registered >= cutoffMs;
    })
    .slice()
    .sort((left, right) =>
      (right.registeredAt || right.issueDate || '').localeCompare(
        left.registeredAt || left.issueDate || ''
      )
    );

  const canonicalRows = await Promise.all(
    eligibleInvoices.flatMap((invoice) => {
      const invoiceKey = recordKey(invoice);
      const empenho = empenhoById.get(invoice.empenhoId) || null;

      return invoice.items.map(async (invoiceItem) => {
        const key = itemKey(invoiceKey, invoiceItem.itemId);
        const persisted = persistedByKey.get(key);
        const empenhoItem =
          empenho?.items.find((candidate) => candidate.id === invoiceItem.itemId)
          || null;
        const quantities = quantitiesFromPersisted(
          invoiceItem.quantity,
          persisted
        );
        const canonicalChanged =
          quantities.storedReceivedQuantity !== null
          && Math.abs(
            quantities.storedReceivedQuantity - invoiceItem.quantity
          ) > 0.000001;
        const legacyProjection =
          !persisted && legacyMovementKeys.has(key);
        const reconciliationReason: WarehouseItemIntakeReconciliationReason | null =
          canonicalChanged
            ? 'CANONICAL_QUANTITY_CHANGED'
            : legacyProjection
              ? 'LEGACY_INVOICE_PROJECTION'
              : null;

        const baseStatus = deriveWarehouseItemIntakeStatus(
          invoiceItem.quantity,
          quantities.allocatedQuantity,
          quantities.immediateConsumptionQuantity
        );

        return {
          key,
          stateId: persisted
            ? persistedStateId(persisted)
            : await createWarehouseItemIntakeId(
              workspaceId,
              invoiceKey,
              invoiceItem.itemId
            ),
          invoiceRecordKey: invoiceKey,
          invoiceId: invoice.id,
          issueDate: invoice.issueDate || null,
          registeredAt: invoice.registeredAt || null,
          supplier: invoice.supplier || empenho?.supplier || 'Fornecedor não informado',
          empenhoId: invoice.empenhoId,
          itemId: invoiceItem.itemId,
          itemName:
            empenhoItem?.name
            || (persisted?.kind === 'V2'
              ? persisted.state.description
              : persisted?.kind === 'V1'
                ? persisted.intake.description
                : 'Item ' + invoiceItem.itemId),
          unitLabel:
            empenhoItem?.unit
            || (persisted?.kind === 'V2'
              ? persisted.state.unitLabel
              : persisted?.kind === 'V1'
                ? persisted.intake.unitLabel
                : ''),
          materialId: materialFrom(
            invoiceItem.warehouseMaterialId,
            empenhoItem?.warehouseMaterialId,
            persisted
          ),
          receivedQuantity: invoiceItem.quantity,
          allocatedQuantity: quantities.allocatedQuantity,
          immediateConsumptionQuantity:
            quantities.immediateConsumptionQuantity,
          pendingQuantity: quantities.pendingQuantity,
          status: reconciliationReason
            ? 'RECONCILIATION_REQUIRED' as const
            : baseStatus,
          persisted: Boolean(persisted),
          source: persisted?.kind === 'V2'
            ? 'STATE_V2' as const
            : persisted?.kind === 'V1'
              ? 'LEGACY_INTAKE_V1' as const
              : legacyProjection
                ? 'LEGACY_INVOICE_PROJECTION' as const
                : 'VIRTUAL_PENDING' as const,
          reconciliationReason,
          canonicalPresent: true,
        } satisfies WarehouseInvoiceIntakeQueueRow;
      });
    })
  );

  const orphanRows: WarehouseInvoiceIntakeQueueRow[] = [];
  if (!invoicesResult.truncated) {
    for (const persisted of persistedResult.items) {
      const key = persistedKey(persisted);
      if (allCanonicalKeys.has(key)) continue;

      if (persisted.kind === 'V2') {
        orphanRows.push({
          key,
          stateId: persisted.state.id,
          invoiceRecordKey: persisted.state.invoiceRecordKey,
          invoiceId: persisted.state.invoiceId,
          issueDate: null,
          registeredAt: null,
          supplier: persisted.state.supplier,
          empenhoId: persisted.state.empenhoId,
          itemId: persisted.state.itemId,
          itemName: persisted.state.description,
          unitLabel: persisted.state.unitLabel,
          materialId: persisted.state.materialId,
          receivedQuantity: persisted.state.receivedQuantity,
          allocatedQuantity: persisted.state.allocatedQuantity,
          immediateConsumptionQuantity:
            persisted.state.immediateConsumptionQuantity,
          pendingQuantity: persisted.state.pendingQuantity,
          status: 'RECONCILIATION_REQUIRED',
          persisted: true,
          source: 'STATE_V2',
          reconciliationReason: 'CANONICAL_SOURCE_MISSING',
          canonicalPresent: false,
        });
        continue;
      }

      const allocatedQuantity =
        persisted.intake.mode === 'ALLOCATED'
          ? persisted.intake.quantity
          : 0;
      const immediateConsumptionQuantity =
        persisted.intake.mode === 'IMMEDIATE_CONSUMPTION'
          ? persisted.intake.quantity
          : 0;

      orphanRows.push({
        key,
        stateId: persisted.intake.id,
        invoiceRecordKey: persisted.intake.invoiceRecordKey,
        invoiceId: persisted.intake.invoiceId,
        issueDate: null,
        registeredAt: null,
        supplier: 'Fornecedor indisponível na fonte canônica',
        empenhoId: persisted.intake.empenhoId,
        itemId: persisted.intake.itemId,
        itemName: persisted.intake.description,
        unitLabel: persisted.intake.unitLabel,
        materialId: persisted.intake.materialId,
        receivedQuantity: persisted.intake.quantity,
        allocatedQuantity,
        immediateConsumptionQuantity,
        pendingQuantity: Math.max(
          0,
          calculateWarehouseItemIntakePendingQuantity(
            persisted.intake.quantity,
            allocatedQuantity,
            immediateConsumptionQuantity
          )
        ),
        status: 'RECONCILIATION_REQUIRED',
        persisted: true,
        source: 'LEGACY_INTAKE_V1',
        reconciliationReason: 'CANONICAL_SOURCE_MISSING',
        canonicalPresent: false,
      });
    }
  }

  const truncated =
    empenhosResult.truncated
    || invoicesResult.truncated
    || persistedResult.truncated
    || movementRecords.length >= WAREHOUSE_INTAKE_QUEUE_LEGACY_MOVEMENTS_LIMIT;

  return {
    rows: [...canonicalRows, ...orphanRows],
    cutoffAt,
    truncated,
    reconciliationCoverageLimited: invoicesResult.truncated,
  };
}

export async function saveWarehouseItemIntakeState(
  workspaceId: string,
  input: SaveWarehouseItemIntakeStateInput
): Promise<WarehouseItemIntakeState> {
  const scope = currentScopeForWorkspace(workspaceId);
  const stateId = await createWarehouseItemIntakeId(
    scope.workspaceId,
    input.invoiceRecordKey,
    input.itemId
  );
  const path = warehouseDocumentPath(scope.workspaceId, 'intakes', stateId);
  const reference = doc(db, path);

  const receivedQuantity = input.receivedQuantity;
  const allocatedQuantity = input.allocatedQuantity;
  const immediateConsumptionQuantity = input.immediateConsumptionQuantity;
  const pendingQuantity = calculateWarehouseItemIntakePendingQuantity(
    receivedQuantity,
    allocatedQuantity,
    immediateConsumptionQuantity
  );
  const nowIso = new Date().toISOString();

  const initialCandidate: WarehouseItemIntakeState = {
    schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
    id: stateId,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    invoiceRecordKey: input.invoiceRecordKey.trim(),
    invoiceId: input.invoiceId.trim(),
    empenhoId: input.empenhoId.trim(),
    itemId: input.itemId.trim(),
    materialId: input.materialId?.trim().toLowerCase() || null,
    description: input.description.trim(),
    unitLabel: input.unitLabel.trim(),
    supplier: input.supplier.trim(),
    receivedQuantity,
    allocatedQuantity,
    immediateConsumptionQuantity,
    pendingQuantity,
    status: deriveWarehouseItemIntakeStatus(
      receivedQuantity,
      allocatedQuantity,
      immediateConsumptionQuantity
    ),
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: scope.uid,
    updatedBy: scope.uid,
  };

  const initialValidation = validateWarehouseItemIntakeState(
    initialCandidate,
    { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
  );
  if (!initialValidation.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
      + initialValidation.issues
        .map((issue) => issue.path + ': ' + issue.message)
        .join('; ')
    );
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);

      if (!snapshot.exists()) {
        transaction.set(reference, {
          ...initialValidation.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return initialValidation.data;
      }

      const raw = snapshot.data() as Record<string, unknown>;
      if (raw.schemaVersion === WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED');
      }
      if (raw.schemaVersion !== WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_UNKNOWN_SCHEMA');
      }

      const parsed = validateWarehouseItemIntakeState(
        {
          ...raw,
          id: snapshot.id,
          createdAt: timestampToIso(raw.createdAt),
          updatedAt: timestampToIso(raw.updatedAt),
        },
        { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
      );
      if (!parsed.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
          + parsed.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
        );
      }

      const current = parsed.data;
      if (
        current.invoiceRecordKey !== initialValidation.data.invoiceRecordKey
        || current.invoiceId !== initialValidation.data.invoiceId
        || current.empenhoId !== initialValidation.data.empenhoId
        || current.itemId !== initialValidation.data.itemId
        || Math.abs(
          current.receivedQuantity - initialValidation.data.receivedQuantity
        ) > 0.000001
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
      }

      if (
        allocatedQuantity + 0.000001 < current.allocatedQuantity
        || immediateConsumptionQuantity + 0.000001
          < current.immediateConsumptionQuantity
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_PROGRESS_CANNOT_DECREASE');
      }

      const nextMaterialId =
        current.materialId || initialValidation.data.materialId;
      if (
        current.materialId
        && initialValidation.data.materialId
        && current.materialId !== initialValidation.data.materialId
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_MATERIAL_CONFLICT');
      }

      const nextPendingQuantity =
        calculateWarehouseItemIntakePendingQuantity(
          current.receivedQuantity,
          allocatedQuantity,
          immediateConsumptionQuantity
        );
      const next: WarehouseItemIntakeState = {
        ...current,
        materialId: nextMaterialId,
        allocatedQuantity,
        immediateConsumptionQuantity,
        pendingQuantity: nextPendingQuantity,
        status: deriveWarehouseItemIntakeStatus(
          current.receivedQuantity,
          allocatedQuantity,
          immediateConsumptionQuantity
        ),
        updatedAt: nowIso,
        updatedBy: scope.uid,
      };

      const validation = validateWarehouseItemIntakeState(
        next,
        { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
      );
      if (!validation.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
          + validation.issues
            .map((issue) => issue.path + ': ' + issue.message)
            .join('; ')
        );
      }

      transaction.update(reference, {
        materialId: validation.data.materialId,
        allocatedQuantity: validation.data.allocatedQuantity,
        immediateConsumptionQuantity:
          validation.data.immediateConsumptionQuantity,
        pendingQuantity: validation.data.pendingQuantity,
        status: validation.data.status,
        updatedBy: scope.uid,
        updatedAt: serverTimestamp(),
      });

      return validation.data;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
