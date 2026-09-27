import {
  collection,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import {
  getCurrentOperationalScope,
} from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import { recordWarehouseDocumentReads } from './telemetry';
import { warehouseDomainPath } from './namespace';

export const WAREHOUSE_INTAKE_QUEUE_EXCLUSION_SCHEMA_VERSION =
  'warehouse_intake_queue_exclusion_v1' as const;

export interface WarehouseQueueExclusionInput {
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  pregao: string | null;
}

function currentScope(workspaceId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_QUEUE_EXCLUSION_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(currentUser.uid);
  const expected = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== expected || !scope.ug) {
    throw new Error('WAREHOUSE_QUEUE_EXCLUSION_SCOPE_MISMATCH');
  }

  return {
    workspaceId: expected,
    ug: scope.ug,
    uid: currentUser.uid,
  };
}

export async function createWarehouseQueueExclusionId(
  workspaceId: string,
  invoiceRecordKey: string
): Promise<string> {
  const payload = new TextEncoder().encode(
    [
      workspaceId.trim().toLowerCase(),
      'INTAKE_QUEUE_EXCLUSION',
      invoiceRecordKey.trim(),
    ].join('\n')
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'qex_' + hex;
}

export async function listWarehouseQueueExcludedInvoiceKeys(
  workspaceId: string,
  invoiceRecordKeys: string[]
): Promise<Set<string>> {
  const scope = currentScope(workspaceId);
  const uniqueKeys = Array.from(
    new Set(invoiceRecordKeys.map((value) => value.trim()).filter(Boolean))
  );
  if (uniqueKeys.length === 0) return new Set();

  const entries = await Promise.all(
    uniqueKeys.map(async (invoiceRecordKey) => ({
      invoiceRecordKey,
      id: await createWarehouseQueueExclusionId(
        scope.workspaceId,
        invoiceRecordKey
      ),
    }))
  );
  const keyById = new Map(entries.map((entry) => [entry.id, entry.invoiceRecordKey]));
  const excluded = new Set<string>();
  const path = warehouseDomainPath(scope.workspaceId, 'queueExclusions');

  try {
    for (let index = 0; index < entries.length; index += 30) {
      const ids = entries.slice(index, index + 30).map((entry) => entry.id);
      const snapshot = await getDocs(
        query(
          collection(db, path),
          where(documentId(), 'in', ids)
        )
      );
      recordWarehouseDocumentReads(workspaceId, snapshot.size);

      for (const entry of snapshot.docs) {
        const data = entry.data() as Record<string, unknown>;
        const expectedKey = keyById.get(entry.id);
        if (
          expectedKey
          && data.schemaVersion === WAREHOUSE_INTAKE_QUEUE_EXCLUSION_SCHEMA_VERSION
          && data.workspaceId === scope.workspaceId
          && data.ug === scope.ug
          && data.invoiceRecordKey === expectedKey
        ) {
          excluded.add(expectedKey);
        }
      }
    }
    return excluded;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function excludeWarehouseInvoicesFromPendingQueue(
  workspaceId: string,
  invoices: WarehouseQueueExclusionInput[]
): Promise<number> {
  const scope = currentScope(workspaceId);
  const unique = Array.from(
    new Map(
      invoices
        .filter((invoice) => invoice.invoiceRecordKey.trim())
        .map((invoice) => [invoice.invoiceRecordKey.trim(), invoice])
    ).values()
  );
  if (unique.length === 0) return 0;

  const path = warehouseDomainPath(scope.workspaceId, 'queueExclusions');
  const prepared = await Promise.all(
    unique.map(async (invoice) => ({
      invoice,
      id: await createWarehouseQueueExclusionId(
        scope.workspaceId,
        invoice.invoiceRecordKey
      ),
    }))
  );

  try {
    for (let index = 0; index < prepared.length; index += 400) {
      const batch = writeBatch(db);
      for (const { invoice, id } of prepared.slice(index, index + 400)) {
        batch.set(doc(db, path, id), {
          schemaVersion: WAREHOUSE_INTAKE_QUEUE_EXCLUSION_SCHEMA_VERSION,
          id,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          invoiceRecordKey: invoice.invoiceRecordKey.trim(),
          invoiceId: invoice.invoiceId.trim(),
          empenhoId: invoice.empenhoId.trim(),
          pregao: invoice.pregao?.trim() || null,
          removedBy: scope.uid,
          removedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return prepared.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
