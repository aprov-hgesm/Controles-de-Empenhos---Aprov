import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

import {
  auth,
  warehouseDb as db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  getCurrentOperationalScope,
  operationalCollectionRef,
} from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { Invoice } from '../types';
import {
  createWarehouseItemIntakeId,
  WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,
} from './intake';
import { listWarehouseQueueExcludedInvoiceKeys } from './intakeQueueExclusionRepository';
import { WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION } from './intakeState';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import { recordWarehouseDocumentReads } from './telemetry';

export const WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION =
  'warehouse_intake_queue_index_v1' as const;
export const WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION =
  'warehouse_intake_queue_candidate_v1' as const;

const INDEX_STATE_ID = 'state';
const DISCOVERY_PAGE_SIZE = 200;
const ACTIVE_PAGE_SIZE = 250;
const ACTIVE_MAX_PAGES = 20;
const WATERMARK_OVERLAP_MS = 5 * 60 * 1000;

export interface WarehouseIntakeQueueCandidate {
  schemaVersion: typeof WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  registeredAt: string | null;
  active: true;
}

export interface WarehouseIntakeQueueIndexSyncResult {
  bootstrapPerformed: boolean;
  invoiceReads: number;
  intakeReads: number;
  candidateWrites: number;
  discoveryComplete: boolean;
}

export interface WarehouseIntakeQueueCandidateResult {
  items: WarehouseIntakeQueueCandidate[];
  truncated: boolean;
  pages: number;
}

interface QueueIndexState {
  schemaVersion: typeof WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION;
  workspaceId: string;
  ug: string;
  cutoffAt: string | null;
  bootstrapComplete: boolean;
  watermarkRegisteredAt: string | null;
}

interface DiscoveryResult {
  invoiceReads: number;
  intakeReads: number;
  candidateWrites: number;
  maxRegisteredAt: string | null;
}

function currentScopeForWorkspace(workspaceId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_INTAKE_QUEUE_INDEX_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(currentUser.uid);
  const expected = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== expected || !scope.ug) {
    throw new Error('WAREHOUSE_INTAKE_QUEUE_INDEX_SCOPE_MISMATCH');
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
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function recordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

function rewindWatermark(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(Date.parse(value) - WATERMARK_OVERLAP_MS).toISOString();
}

function parseIndexState(
  workspaceId: string,
  ug: string,
  data: Record<string, unknown>
): QueueIndexState | null {
  if (
    data.schemaVersion !== WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION
    || data.workspaceId !== workspaceId
    || data.ug !== ug
    || typeof data.bootstrapComplete !== 'boolean'
  ) {
    return null;
  }

  const cutoffAt =
    typeof data.cutoffAt === 'string' && Number.isFinite(Date.parse(data.cutoffAt))
      ? data.cutoffAt
      : null;
  const watermarkRegisteredAt =
    typeof data.watermarkRegisteredAt === 'string'
    && Number.isFinite(Date.parse(data.watermarkRegisteredAt))
      ? data.watermarkRegisteredAt
      : null;

  return {
    schemaVersion: WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION,
    workspaceId,
    ug,
    cutoffAt,
    bootstrapComplete: data.bootstrapComplete,
    watermarkRegisteredAt,
  };
}

async function loadIndexState(
  workspaceId: string
): Promise<QueueIndexState | null> {
  const scope = currentScopeForWorkspace(workspaceId);
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'intakeQueueIndex',
    INDEX_STATE_ID
  );

  try {
    const snapshot = await getDoc(doc(db, path));
    recordWarehouseDocumentReads(workspaceId, snapshot.exists() ? 1 : 0);
    if (!snapshot.exists()) return null;
    return parseIndexState(
      scope.workspaceId,
      scope.ug,
      snapshot.data() as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

async function loadPersistedSchemasByIds(
  workspaceId: string,
  stateIds: string[]
): Promise<{
  records: Map<string, Record<string, unknown>>;
  reads: number;
}> {
  const scope = currentScopeForWorkspace(workspaceId);
  const uniqueIds = Array.from(new Set(stateIds.filter(Boolean)));
  const path = warehouseDomainPath(scope.workspaceId, 'intakes');
  const records = new Map<string, Record<string, unknown>>();
  let reads = 0;

  try {
    for (let index = 0; index < uniqueIds.length; index += 30) {
      const ids = uniqueIds.slice(index, index + 30);
      const snapshot = await getDocs(
        query(
          collection(db, path),
          where(documentId(), 'in', ids)
        )
      );
      reads += snapshot.size;
      recordWarehouseDocumentReads(workspaceId, snapshot.size);
      for (const entry of snapshot.docs) {
        records.set(entry.id, entry.data() as Record<string, unknown>);
      }
    }
    return { records, reads };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function persistedStateStillActionable(
  record: Record<string, unknown> | undefined
): boolean {
  if (!record) return true;
  if (record.schemaVersion === WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
    return false;
  }
  if (record.schemaVersion !== WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
    return true;
  }
  if (record.status === 'PROCESSED') return false;
  return typeof record.pendingQuantity !== 'number' || record.pendingQuantity > 0.000001;
}

async function indexInvoicePage(
  workspaceId: string,
  invoices: Invoice[]
): Promise<{ intakeReads: number; candidateWrites: number }> {
  const scope = currentScopeForWorkspace(workspaceId);
  if (invoices.length === 0) {
    return { intakeReads: 0, candidateWrites: 0 };
  }

  const prepared = (
    await Promise.all(
      invoices.flatMap((invoice) => {
        const invoiceRecordKey = recordKey(invoice);
        if (!invoiceRecordKey) return [];
        return invoice.items.map(async (item) => ({
          invoice,
          item,
          stateId: await createWarehouseItemIntakeId(
            scope.workspaceId,
            invoiceRecordKey,
            item.itemId
          ),
        }));
      })
    )
  ).flat();

  const persisted = await loadPersistedSchemasByIds(
    workspaceId,
    prepared.map((entry) => entry.stateId)
  );
  const excludedInvoiceKeys = await listWarehouseQueueExcludedInvoiceKeys(
    workspaceId,
    invoices.map(recordKey)
  );

  const candidates = prepared.filter((entry) =>
    !excludedInvoiceKeys.has(recordKey(entry.invoice))
    && persistedStateStillActionable(persisted.records.get(entry.stateId))
  );

  const path = warehouseDomainPath(scope.workspaceId, 'intakeQueueIndex');
  let candidateWrites = 0;
  try {
    for (let index = 0; index < candidates.length; index += 400) {
      const batch = writeBatch(db);
      const chunk = candidates.slice(index, index + 400);
      for (const entry of chunk) {
        const invoiceRecordKey = recordKey(entry.invoice);
        batch.set(doc(db, path, entry.stateId), {
          schemaVersion: WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION,
          id: entry.stateId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          invoiceRecordKey,
          invoiceId: entry.invoice.id,
          empenhoId: entry.invoice.empenhoId,
          itemId: entry.item.itemId,
          registeredAt: timestampToIso(entry.invoice.registeredAt),
          active: true,
          deactivatedAt: null,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      candidateWrites += chunk.length;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }

  return {
    intakeReads: persisted.reads,
    candidateWrites,
  };
}

async function discoverInvoices(
  workspaceId: string,
  options: {
    cutoffAt: string | null;
    watermarkRegisteredAt: string | null;
    bootstrap: boolean;
  }
): Promise<DiscoveryResult> {
  const scope = currentScopeForWorkspace(workspaceId);
  const collectionRef = operationalCollectionRef(scope.scope, 'invoices');
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let invoiceReads = 0;
  let intakeReads = 0;
  let candidateWrites = 0;
  let maxRegisteredAt: string | null = null;

  while (true) {
    const constraints: QueryConstraint[] = [];
    if (options.bootstrap) {
      if (options.cutoffAt) {
        constraints.push(
          where('registeredAt', '>=', options.cutoffAt),
          orderBy('registeredAt', 'asc')
        );
      } else {
        constraints.push(orderBy(documentId(), 'asc'));
      }
    } else if (options.watermarkRegisteredAt) {
      constraints.push(
        where('registeredAt', '>=', options.watermarkRegisteredAt),
        orderBy('registeredAt', 'asc')
      );
    } else {
      constraints.push(orderBy('registeredAt', 'asc'));
    }

    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(DISCOVERY_PAGE_SIZE));

    const snapshot = await getDocs(query(collectionRef, ...constraints));
    invoiceReads += snapshot.size;
    recordWarehouseDocumentReads(workspaceId, snapshot.size);

    const invoices = snapshot.docs.map((entry) => {
      const data = entry.data() as Invoice;
      return {
        ...data,
        recordKey: data.recordKey || entry.id,
      };
    });

    const eligibleInvoices = options.cutoffAt
      ? invoices.filter((invoice) => {
          const registeredAt = Date.parse(invoice.registeredAt || '');
          return Number.isFinite(registeredAt)
            && registeredAt >= Date.parse(options.cutoffAt as string);
        })
      : invoices;

    const indexed = await indexInvoicePage(workspaceId, eligibleInvoices);
    intakeReads += indexed.intakeReads;
    candidateWrites += indexed.candidateWrites;

    for (const invoice of invoices) {
      const registeredAt = timestampToIso(invoice.registeredAt);
      if (
        registeredAt
        && (!maxRegisteredAt || registeredAt.localeCompare(maxRegisteredAt) > 0)
      ) {
        maxRegisteredAt = registeredAt;
      }
    }

    if (snapshot.size < DISCOVERY_PAGE_SIZE) break;
    cursor = snapshot.docs.at(-1) || null;
    if (!cursor) break;
  }

  return {
    invoiceReads,
    intakeReads,
    candidateWrites,
    maxRegisteredAt,
  };
}

async function saveIndexState(
  workspaceId: string,
  input: {
    cutoffAt: string | null;
    watermarkRegisteredAt: string | null;
  }
): Promise<void> {
  const scope = currentScopeForWorkspace(workspaceId);
  const path = warehouseDocumentPath(
    scope.workspaceId,
    'intakeQueueIndex',
    INDEX_STATE_ID
  );

  try {
    await setDoc(doc(db, path), {
      schemaVersion: WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      cutoffAt: input.cutoffAt,
      bootstrapComplete: true,
      watermarkRegisteredAt: input.watermarkRegisteredAt,
      updatedBy: scope.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Mantém um índice derivado mínimo dos itens que ainda podem exigir tratamento.
 *
 * O primeiro acesso após a adoção faz um bootstrap único e paginado das NFs
 * elegíveis. Depois disso, apenas a janela incremental após o watermark é lida.
 * O índice não substitui NF, intake, ledger ou saldo; ele só permite descobrir
 * quais identidades precisam ser validadas no caminho operacional normal.
 */
export async function syncWarehouseIntakeQueueIndex(
  workspaceId: string,
  cutoffAt: string | null
): Promise<WarehouseIntakeQueueIndexSyncResult> {
  const state = await loadIndexState(workspaceId);
  const normalizedCutoff =
    cutoffAt && Number.isFinite(Date.parse(cutoffAt)) ? cutoffAt : null;
  const requiresBootstrap =
    !state
    || !state.bootstrapComplete
    || state.cutoffAt !== normalizedCutoff;

  const discovered = await discoverInvoices(workspaceId, {
    cutoffAt: normalizedCutoff,
    watermarkRegisteredAt: requiresBootstrap
      ? null
      : state?.watermarkRegisteredAt || null,
    bootstrap: requiresBootstrap,
  });

  const latestObserved =
    discovered.maxRegisteredAt
    || state?.watermarkRegisteredAt
    || normalizedCutoff
    || new Date().toISOString();
  const nextWatermark = rewindWatermark(latestObserved);

  await saveIndexState(workspaceId, {
    cutoffAt: normalizedCutoff,
    watermarkRegisteredAt: nextWatermark,
  });

  return {
    bootstrapPerformed: requiresBootstrap,
    invoiceReads: discovered.invoiceReads,
    intakeReads: discovered.intakeReads,
    candidateWrites: discovered.candidateWrites,
    discoveryComplete: true,
  };
}

function parseCandidate(
  workspaceId: string,
  ug: string,
  id: string,
  data: Record<string, unknown>
): WarehouseIntakeQueueCandidate | null {
  if (
    data.schemaVersion !== WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION
    || data.id !== id
    || data.workspaceId !== workspaceId
    || data.ug !== ug
    || data.active !== true
    || typeof data.invoiceRecordKey !== 'string'
    || typeof data.invoiceId !== 'string'
    || typeof data.empenhoId !== 'string'
    || typeof data.itemId !== 'string'
  ) {
    return null;
  }

  return {
    schemaVersion: WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION,
    id,
    workspaceId,
    ug,
    invoiceRecordKey: data.invoiceRecordKey,
    invoiceId: data.invoiceId,
    empenhoId: data.empenhoId,
    itemId: data.itemId,
    registeredAt:
      typeof data.registeredAt === 'string'
      && Number.isFinite(Date.parse(data.registeredAt))
        ? data.registeredAt
        : null,
    active: true,
  };
}

export async function listWarehouseActiveIntakeQueueCandidates(
  workspaceId: string
): Promise<WarehouseIntakeQueueCandidateResult> {
  const scope = currentScopeForWorkspace(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'intakeQueueIndex');
  const items: WarehouseIntakeQueueCandidate[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let pages = 0;

  try {
    while (pages < ACTIVE_MAX_PAGES) {
      const constraints: QueryConstraint[] = [where('active', '==', true)];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(ACTIVE_PAGE_SIZE));
      const snapshot = await getDocs(
        query(collection(db, path), ...constraints)
      );
      pages += 1;
      recordWarehouseDocumentReads(workspaceId, snapshot.size);

      for (const entry of snapshot.docs) {
        const parsed = parseCandidate(
          scope.workspaceId,
          scope.ug,
          entry.id,
          entry.data() as Record<string, unknown>
        );
        if (parsed) items.push(parsed);
      }

      if (snapshot.size < ACTIVE_PAGE_SIZE) {
        return { items, truncated: false, pages };
      }
      cursor = snapshot.docs.at(-1) || null;
      if (!cursor) break;
    }

    return { items, truncated: true, pages };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function deactivateWarehouseIntakeQueueCandidates(
  workspaceId: string,
  stateIds: string[]
): Promise<void> {
  const scope = currentScopeForWorkspace(workspaceId);
  const uniqueIds = Array.from(new Set(stateIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const path = warehouseDomainPath(scope.workspaceId, 'intakeQueueIndex');
  try {
    for (let index = 0; index < uniqueIds.length; index += 400) {
      const batch = writeBatch(db);
      for (const stateId of uniqueIds.slice(index, index + 400)) {
        batch.update(doc(db, path, stateId), {
          active: false,
          deactivatedAt: serverTimestamp(),
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
