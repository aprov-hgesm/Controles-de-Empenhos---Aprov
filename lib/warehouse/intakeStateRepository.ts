import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
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
import { createWarehouseMovementId } from './movement';
import { normalizeWarehouseMaterialId } from './material';
import {
  listWarehouseQueueExcludedInvoiceKeys,
} from './intakeQueueExclusionRepository';
import {
  deactivateWarehouseIntakeQueueCandidates,
  listWarehouseActiveIntakeQueueCandidates,
  syncWarehouseIntakeQueueIndex,
} from './intakeQueueIndexRepository';
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
  pregao: string | null;
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
  pregaoCoverageLimited: boolean;
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
    const bounded = Math.max(1, maxResults);
    const snapshot = await getDocs(
      query(
        operationalCollectionRef(scope, collectionName),
        limit(bounded + 1)
      )
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return {
      items: snapshot.docs.slice(0, bounded).map((entry) => {
        const data = entry.data() as T & { id?: string; recordKey?: string };
        if (collectionName === 'invoices') {
          return { ...data, recordKey: data.recordKey || entry.id } as T;
        }
        return { ...data, id: data.id || entry.id } as T;
      }),
      truncated: snapshot.size > bounded,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

async function listOperationalByIds<T extends { id?: string; recordKey?: string }>(
  workspaceId: string,
  collectionName: 'empenhos' | 'invoices',
  ids: string[]
): Promise<T[]> {
  const { scope } = currentScopeForWorkspace(workspaceId);
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 30) {
    chunks.push(uniqueIds.slice(index, index + 30));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(
          operationalCollectionRef(scope, collectionName),
          where(documentId(), 'in', chunk)
        )
      )
    )
  );
  recordWarehouseDocumentReads(
    workspaceId,
    snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0)
  );
  return snapshots.flatMap((snapshot) =>
    snapshot.docs.map((entry) => {
      const data = entry.data() as T;
      if (collectionName === 'invoices') {
        return {
          ...data,
          recordKey: data.recordKey || entry.id,
        };
      }
      return {
        ...data,
        id: data.id || entry.id,
      };
    })
  );
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
    const bounded = WAREHOUSE_INTAKE_QUEUE_STATES_LIMIT;
    const snapshot = await getDocs(
      query(collection(db, path), limit(bounded + 1))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return {
      items: snapshot.docs.slice(0, bounded).flatMap((entry) => {
        const parsed = parsePersistedIntake(
          scope.workspaceId,
          entry.id,
          entry.data() as Record<string, unknown>
        );
        return parsed ? [parsed] : [];
      }),
      truncated: snapshot.size > bounded,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

async function listPersistedIntakesByIds(
  workspaceId: string,
  stateIds: string[]
): Promise<Map<string, PersistedIntake>> {
  const scope = currentScopeForWorkspace(workspaceId);
  const uniqueIds = Array.from(new Set(stateIds.map((id) => id.trim()).filter(Boolean)));
  const path = warehouseDomainPath(scope.workspaceId, 'intakes');
  const records = new Map<string, PersistedIntake>();
  if (uniqueIds.length === 0) return records;

  try {
    for (let index = 0; index < uniqueIds.length; index += 30) {
      const ids = uniqueIds.slice(index, index + 30);
      const snapshot = await getDocs(
        query(
          collection(db, path),
          where(documentId(), 'in', ids)
        )
      );
      recordWarehouseDocumentReads(workspaceId, snapshot.size);
      for (const entry of snapshot.docs) {
        const parsed = parsePersistedIntake(
          scope.workspaceId,
          entry.id,
          entry.data() as Record<string, unknown>
        );
        if (parsed) records.set(entry.id, parsed);
      }
    }
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

interface WarehouseCandidateInvoiceMovementEvidence {
  id: string;
  invoiceRecordKey: string;
  itemIds: string[];
}

interface WarehouseCandidateMovementEvidenceResult {
  byInvoiceRecordKey: Map<string, WarehouseCandidateInvoiceMovementEvidence[]>;
  coverageLimitedInvoiceKeys: Set<string>;
}

async function listCandidateInvoiceMovementEvidence(
  workspaceId: string,
  invoiceRecordKeys: string[]
): Promise<WarehouseCandidateMovementEvidenceResult> {
  const scope = currentScopeForWorkspace(workspaceId);
  const uniqueKeys = Array.from(
    new Set(invoiceRecordKeys.map((key) => key.trim()).filter(Boolean))
  );
  const byInvoiceRecordKey =
    new Map<string, WarehouseCandidateInvoiceMovementEvidence[]>();
  const coverageLimitedInvoiceKeys = new Set<string>();
  if (uniqueKeys.length === 0) {
    return { byInvoiceRecordKey, coverageLimitedInvoiceKeys };
  }

  const path = warehouseDomainPath(scope.workspaceId, 'movements');
  const perInvoiceLimit = 51;

  try {
    for (let index = 0; index < uniqueKeys.length; index += 10) {
      const keys = uniqueKeys.slice(index, index + 10);
      const snapshots = await Promise.all(
        keys.map(async (invoiceRecordKey) => ({
          invoiceRecordKey,
          snapshot: await getDocs(
            query(
              collection(db, path),
              where('source.invoiceRecordKey', '==', invoiceRecordKey),
              limit(perInvoiceLimit)
            )
          ),
        }))
      );

      for (const { invoiceRecordKey, snapshot } of snapshots) {
        recordWarehouseDocumentReads(workspaceId, snapshot.size);
        if (snapshot.size >= perInvoiceLimit) {
          coverageLimitedInvoiceKeys.add(invoiceRecordKey);
        }

        for (const entry of snapshot.docs) {
          const data = entry.data() as Record<string, unknown>;
          const source =
            data.source && typeof data.source === 'object' && !Array.isArray(data.source)
              ? data.source as Record<string, unknown>
              : null;
          if (
            !source
            || source.kind !== 'INVOICE'
            || source.invoiceRecordKey !== invoiceRecordKey
            || !Array.isArray(source.itemIds)
          ) {
            continue;
          }

          const itemIds = source.itemIds.filter(
            (itemId): itemId is string => typeof itemId === 'string'
          );
          const current = byInvoiceRecordKey.get(invoiceRecordKey) || [];
          current.push({
            id: entry.id,
            invoiceRecordKey,
            itemIds,
          });
          byInvoiceRecordKey.set(invoiceRecordKey, current);
        }
      }
    }

    return { byInvoiceRecordKey, coverageLimitedInvoiceKeys };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function orphanRowFromPersisted(
  persisted: PersistedIntake
): WarehouseInvoiceIntakeQueueRow {
  if (persisted.kind === 'V2') {
    return {
      key: itemKey(persisted.state.invoiceRecordKey, persisted.state.itemId),
      stateId: persisted.state.id,
      invoiceRecordKey: persisted.state.invoiceRecordKey,
      invoiceId: persisted.state.invoiceId,
      issueDate: null,
      registeredAt: null,
      supplier: persisted.state.supplier,
      empenhoId: persisted.state.empenhoId,
      pregao: null,
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
    };
  }

  const allocatedQuantity =
    persisted.intake.mode === 'ALLOCATED' ? persisted.intake.quantity : 0;
  const immediateConsumptionQuantity =
    persisted.intake.mode === 'IMMEDIATE_CONSUMPTION'
      ? persisted.intake.quantity
      : 0;

  return {
    key: itemKey(persisted.intake.invoiceRecordKey, persisted.intake.itemId),
    stateId: persisted.intake.id,
    invoiceRecordKey: persisted.intake.invoiceRecordKey,
    invoiceId: persisted.intake.invoiceId,
    issueDate: null,
    registeredAt: null,
    supplier: 'Fornecedor indisponível na fonte canônica',
    empenhoId: persisted.intake.empenhoId,
    pregao: null,
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
  };
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
    normalizeWarehouseMaterialId(empenhoMaterialId)
    || normalizeWarehouseMaterialId(invoiceMaterialId)
    || normalizeWarehouseMaterialId(persistedMaterialId)
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

  const cutoffAt = await getWarehouseInvoiceIntakeCutoff(workspaceId);
  const discovery = await syncWarehouseIntakeQueueIndex(
    workspaceId,
    cutoffAt
  );
  const candidatesResult =
    await listWarehouseActiveIntakeQueueCandidates(workspaceId);

  const invoices = await listOperationalByIds<Invoice>(
    workspaceId,
    'invoices',
    candidatesResult.items.map((candidate) => candidate.invoiceRecordKey)
  );
  const invoiceByRecordKey = new Map(
    invoices.map((invoice) => [recordKey(invoice), invoice])
  );

  const persistedByStateId = await listPersistedIntakesByIds(
    workspaceId,
    candidatesResult.items.map((candidate) => candidate.id)
  );

  const excludedInvoiceKeys = await listWarehouseQueueExcludedInvoiceKeys(
    workspaceId,
    candidatesResult.items.map((candidate) => candidate.invoiceRecordKey)
  );

  const eligibleInvoices = invoices.filter((invoice) => {
    if (!cutoffAt) return true;
    const registered = Date.parse(invoice.registeredAt || '');
    return Number.isFinite(registered)
      && registered >= Date.parse(cutoffAt);
  });
  const eligibleInvoiceKeys = new Set(
    eligibleInvoices.map((invoice) => recordKey(invoice))
  );

  const virtualInvoiceKeys = candidatesResult.items
    .filter((candidate) =>
      !persistedByStateId.has(candidate.id)
      && eligibleInvoiceKeys.has(candidate.invoiceRecordKey)
      && !excludedInvoiceKeys.has(candidate.invoiceRecordKey)
    )
    .map((candidate) => candidate.invoiceRecordKey);

  const movementEvidence = await listCandidateInvoiceMovementEvidence(
    workspaceId,
    virtualInvoiceKeys
  );

  const empenhos = await listOperationalByIds<Empenho>(
    workspaceId,
    'empenhos',
    eligibleInvoices.map((invoice) => invoice.empenhoId)
  );
  const empenhoById = new Map(
    empenhos.map((empenho) => [empenho.id, empenho])
  );

  const rows: WarehouseInvoiceIntakeQueueRow[] = [];
  const deactivateStateIds: string[] = [];

  for (const candidate of candidatesResult.items) {
    if (
      excludedInvoiceKeys.has(candidate.invoiceRecordKey)
      || !eligibleInvoiceKeys.has(candidate.invoiceRecordKey)
    ) {
      deactivateStateIds.push(candidate.id);
      continue;
    }

    const persisted = persistedByStateId.get(candidate.id);
    const invoice = invoiceByRecordKey.get(candidate.invoiceRecordKey);
    if (!invoice) {
      if (persisted) {
        rows.push(orphanRowFromPersisted(persisted));
      } else {
        deactivateStateIds.push(candidate.id);
      }
      continue;
    }

    const invoiceItem = invoice.items.find(
      (item) => item.itemId === candidate.itemId
    );
    if (!invoiceItem) {
      if (persisted) {
        rows.push(orphanRowFromPersisted(persisted));
      } else {
        deactivateStateIds.push(candidate.id);
      }
      continue;
    }

    const empenho = empenhoById.get(invoice.empenhoId) || null;
    const empenhoItem =
      empenho?.items.find((item) => item.id === invoiceItem.itemId) || null;
    const quantities = quantitiesFromPersisted(
      invoiceItem.quantity,
      persisted
    );
    const canonicalChanged =
      quantities.storedReceivedQuantity !== null
      && Math.abs(
        quantities.storedReceivedQuantity - invoiceItem.quantity
      ) > 0.000001;

    const expectedV2EntryMovementId = persisted
      ? null
      : await createWarehouseMovementId(
          workspaceId,
          [
            'adm-intake-v2',
            candidate.id,
            'invoice-entry',
          ].join(':').slice(0, 240)
        );
    const invoiceMovements =
      movementEvidence.byInvoiceRecordKey.get(candidate.invoiceRecordKey) || [];
    const legacyProjection =
      !persisted
      && (
        movementEvidence.coverageLimitedInvoiceKeys.has(
          candidate.invoiceRecordKey
        )
        || invoiceMovements.some(
          (movement) =>
            movement.id !== expectedV2EntryMovementId
            && movement.itemIds.includes(candidate.itemId)
        )
      );

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

    if (baseStatus === 'PROCESSED' && !reconciliationReason) {
      deactivateStateIds.push(candidate.id);
      continue;
    }

    rows.push({
      key: itemKey(candidate.invoiceRecordKey, candidate.itemId),
      stateId: candidate.id,
      invoiceRecordKey: candidate.invoiceRecordKey,
      invoiceId: invoice.id,
      issueDate: invoice.issueDate || null,
      registeredAt: invoice.registeredAt || null,
      supplier:
        invoice.supplier
        || empenho?.supplier
        || 'Fornecedor não informado',
      empenhoId: invoice.empenhoId,
      pregao: empenho?.pregao || null,
      itemId: candidate.itemId,
      itemName:
        empenhoItem?.name
        || (persisted?.kind === 'V2'
          ? persisted.state.description
          : persisted?.kind === 'V1'
            ? persisted.intake.description
            : 'Item ' + candidate.itemId),
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
        ? 'RECONCILIATION_REQUIRED'
        : baseStatus,
      persisted: Boolean(persisted),
      source: persisted?.kind === 'V2'
        ? 'STATE_V2'
        : persisted?.kind === 'V1'
          ? 'LEGACY_INTAKE_V1'
          : legacyProjection
            ? 'LEGACY_INVOICE_PROJECTION'
            : 'VIRTUAL_PENDING',
      reconciliationReason,
      canonicalPresent: true,
    });
  }

  if (deactivateStateIds.length > 0) {
    await deactivateWarehouseIntakeQueueCandidates(
      workspaceId,
      deactivateStateIds
    );
  }

  rows.sort((left, right) =>
    (right.registeredAt || right.issueDate || '').localeCompare(
      left.registeredAt || left.issueDate || ''
    )
  );

  const movementCoverageLimited =
    movementEvidence.coverageLimitedInvoiceKeys.size > 0;

  return {
    rows,
    cutoffAt,
    truncated:
      candidatesResult.truncated
      || !discovery.discoveryComplete
      || movementCoverageLimited,
    reconciliationCoverageLimited: movementCoverageLimited,
    pregaoCoverageLimited:
      candidatesResult.truncated || !discovery.discoveryComplete,
  };
}

export async function loadWarehouseInvoiceIntakeHistory(
  workspaceId: string
): Promise<WarehouseInvoiceIntakeQueueContext> {
  currentScopeForWorkspace(workspaceId);

  const [
    invoicesResult,
    persistedResult,
    movementRecords,
    cutoffAt,
  ] = await Promise.all([
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

  const empenhos = await listOperationalByIds<Empenho>(
    workspaceId,
    'empenhos',
    invoicesResult.items.map((invoice) => invoice.empenhoId)
  );
  const empenhoById = new Map(
    empenhos.map((empenho) => [empenho.id, empenho])
  );
  const persistedByKey = new Map(
    persistedResult.items.map((record) => [persistedKey(record), record])
  );

  const invoiceMovementsByKey = new Map<string, typeof movementRecords>();
  for (const record of movementRecords) {
    const source = record.movement.source;
    if (source?.kind !== 'INVOICE') continue;
    for (const sourceItemId of source.itemIds) {
      const key = itemKey(source.invoiceRecordKey, sourceItemId);
      const existing = invoiceMovementsByKey.get(key) || [];
      existing.push(record);
      invoiceMovementsByKey.set(key, existing);
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
  const eligibleInvoicesBeforeExclusions = invoicesResult.items
    .filter((invoice) => {
      if (!Number.isFinite(cutoffMs)) return true;
      const registered = Date.parse(invoice.registeredAt || '');
      return Number.isFinite(registered) && registered >= cutoffMs;
    });

  const excludedInvoiceKeys = await listWarehouseQueueExcludedInvoiceKeys(
    workspaceId,
    eligibleInvoicesBeforeExclusions.map((invoice) => recordKey(invoice))
  );

  const eligibleInvoices = eligibleInvoicesBeforeExclusions
    .filter((invoice) => !excludedInvoiceKeys.has(recordKey(invoice)))
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
        const stateId = persisted
          ? persistedStateId(persisted)
          : await createWarehouseItemIntakeId(
            workspaceId,
            invoiceKey,
            invoiceItem.itemId
          );
        const expectedV2EntryMovementId = persisted
          ? null
          : await createWarehouseMovementId(
            workspaceId,
            [
              'adm-intake-v2',
              stateId,
              'invoice-entry',
            ].join(':').slice(0, 240)
          );
        const invoiceMovements = invoiceMovementsByKey.get(key) || [];
        const legacyProjection =
          !persisted
          && invoiceMovements.some(
            (record) => record.movement.id !== expectedV2EntryMovementId
          );
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
          stateId,
          invoiceRecordKey: invoiceKey,
          invoiceId: invoice.id,
          issueDate: invoice.issueDate || null,
          registeredAt: invoice.registeredAt || null,
          supplier: invoice.supplier || empenho?.supplier || 'Fornecedor não informado',
          empenhoId: invoice.empenhoId,
          pregao: empenho?.pregao || null,
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

  let resolvedCanonicalRows: WarehouseInvoiceIntakeQueueRow[] = canonicalRows;
  if (persistedResult.truncated) {
    const unresolvedRows = canonicalRows.filter((row) => !row.persisted);
    if (unresolvedRows.length > 0) {
      const refreshedRows = await refreshWarehouseInvoiceIntakeQueueRows(
        workspaceId,
        unresolvedRows
      );
      const refreshedByStateId = new Map(
        refreshedRows.map((row) => [row.stateId, row])
      );
      resolvedCanonicalRows = canonicalRows.map(
        (row) => refreshedByStateId.get(row.stateId) || row
      );
    }
  }

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
          pregao: null,
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
        pregao: null,
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
    invoicesResult.truncated
    || persistedResult.truncated
    || movementRecords.length >= WAREHOUSE_INTAKE_QUEUE_LEGACY_MOVEMENTS_LIMIT;

  return {
    rows: [...resolvedCanonicalRows, ...orphanRows],
    cutoffAt,
    truncated,
    reconciliationCoverageLimited:
      movementRecords.length >= WAREHOUSE_INTAKE_QUEUE_LEGACY_MOVEMENTS_LIMIT,
    pregaoCoverageLimited: invoicesResult.truncated,
  };
}

export async function refreshWarehouseInvoiceIntakeQueueRows(
  workspaceId: string,
  rows: WarehouseInvoiceIntakeQueueRow[]
): Promise<WarehouseInvoiceIntakeQueueRow[]> {
  const scope = currentScopeForWorkspace(workspaceId);
  if (rows.length === 0) return [];

  const path = warehouseDomainPath(scope.workspaceId, 'intakes');
  const uniqueIds = Array.from(new Set(rows.map((row) => row.stateId)));
  const persistedById = new Map<string, PersistedIntake>();

  try {
    for (let index = 0; index < uniqueIds.length; index += 30) {
      const ids = uniqueIds.slice(index, index + 30);
      const snapshot = await getDocs(
        query(
          collection(db, path),
          where(documentId(), 'in', ids)
        )
      );
      recordWarehouseDocumentReads(workspaceId, snapshot.size);

      for (const entry of snapshot.docs) {
        const parsed = parsePersistedIntake(
          scope.workspaceId,
          entry.id,
          entry.data() as Record<string, unknown>
        );
        if (parsed) persistedById.set(entry.id, parsed);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }

  return rows.map((row) => {
    const persisted = persistedById.get(row.stateId);
    if (!persisted) {
      if (!row.persisted) return row;
      return {
        ...row,
        allocatedQuantity: 0,
        immediateConsumptionQuantity: 0,
        pendingQuantity: row.receivedQuantity,
        status: 'PENDING',
        persisted: false,
        source: 'VIRTUAL_PENDING',
        reconciliationReason: null,
      };
    }

    const quantities = quantitiesFromPersisted(
      row.receivedQuantity,
      persisted
    );
    const canonicalChanged =
      quantities.storedReceivedQuantity !== null
      && Math.abs(
        quantities.storedReceivedQuantity - row.receivedQuantity
      ) > 0.000001;

    const persistedMaterialId = persisted.kind === 'V2'
      ? persisted.state.materialId
      : persisted.intake.materialId;

    return {
      ...row,
      materialId: row.materialId || persistedMaterialId || null,
      allocatedQuantity: quantities.allocatedQuantity,
      immediateConsumptionQuantity:
        quantities.immediateConsumptionQuantity,
      pendingQuantity: quantities.pendingQuantity,
      status: canonicalChanged
        ? 'RECONCILIATION_REQUIRED'
        : deriveWarehouseItemIntakeStatus(
          row.receivedQuantity,
          quantities.allocatedQuantity,
          quantities.immediateConsumptionQuantity
        ),
      persisted: true,
      source: persisted.kind === 'V2'
        ? 'STATE_V2'
        : 'LEGACY_INTAKE_V1',
      reconciliationReason: canonicalChanged
        ? 'CANONICAL_QUANTITY_CHANGED'
        : null,
    };
  });
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
