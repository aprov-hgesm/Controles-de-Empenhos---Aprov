import {
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';

import {
  appendWorkspaceAuditEvent,
  createWorkspaceAuditCorrelationId,
} from './auditTrail';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  assertEmpenhoRevision,
  isEmpenhoConcurrencyError,
} from './empenhoConcurrency';
import { isValidSupplierCnpj, normalizeSupplierCnpj } from './invoiceIdentity';
import {
  assertNsLockOwnership,
  buildLegacyNsLockDocumentId,
  buildNsLockDocumentId,
  normalizeNsNumber,
  normalizeNsUg,
  type NsIntegrityMutation,
  type NsLockDocument,
} from './nsIntegrity';
import {
  getCurrentOperationalScope,
  getOperationalDocumentPath,
  operationalCollectionRef,
  operationalDocRef,
  operationalSettingsDocRef,
  type OperationalDataScope,
} from './operationalPaths';
import type { Alert, CronogramaEmpenho, Empenho, Invoice } from './types';

export const EMPENHO_DELETION_LOCK_PREFIX = 'empenhoDelete_' as const;
export const EMPENHO_DELETION_LOCK_TYPE = 'empenho-deletion-lock' as const;
export const MAX_EMPENHO_DELETION_INVOICES = 120;
export const MAX_EMPENHO_DELETION_LINKED_DOCS = 350;
export const MAX_EMPENHO_DELETION_NS_LOCKS = 8;
export const MAX_EMPENHO_DELETION_WRITES = 450;

interface EmpenhoDeletionLockDocument {
  id: string;
  type: typeof EMPENHO_DELETION_LOCK_TYPE;
  workspaceId: string;
  empenhoId: string;
  correlationId: string;
  createdAt: string;
  createdBy: string;
}

interface DiscoveredEmpenhoLinks {
  invoices: Array<{ id: string; data: Invoice }>;
  alerts: Array<{ id: string; data: Alert & { empenhoId?: string } }>;
  cronogramas: Array<{ id: string; data: CronogramaEmpenho }>;
}

export interface CommitEmpenhoDeletionResult {
  empenhoId: string;
  deletedInvoiceRecordKeys: string[];
  deletedAlertIds: string[];
  deletedCronogramaIds: string[];
  deletedNsLockIds: string[];
}

function buildEmpenhoDeletionLockId(empenhoId: string): string {
  return `${EMPENHO_DELETION_LOCK_PREFIX}${empenhoId}`;
}

function buildStoredNsLockDocumentId(invoice: Pick<Invoice, 'numeroNS' | 'nsUg'>): string {
  const numeroNS = normalizeNsNumber(invoice.numeroNS);
  if (!numeroNS) return '';
  const ug = normalizeNsUg(invoice.nsUg);
  return ug
    ? buildNsLockDocumentId(ug, numeroNS)
    : buildLegacyNsLockDocumentId(numeroNS);
}

function buildDeletionMutation(
  invoice: Invoice,
  recordKey: string,
  supplierCnpj: string
): NsIntegrityMutation {
  const currentNs = normalizeNsNumber(invoice.numeroNS);
  return {
    invoiceRecordKey: recordKey,
    invoiceId: invoice.id,
    empenhoId: invoice.empenhoId,
    supplierCnpj,
    expectedCurrentUg: normalizeNsUg(invoice.nsUg) || null,
    expectedCurrentNs: currentNs || null,
    proposedUg: currentNs ? normalizeNsUg(invoice.nsUg) || null : null,
    proposedNs: currentNs || null,
    source: 'system',
  };
}

async function discoverEmpenhoLinks(
  scope: OperationalDataScope,
  empenhoId: string
): Promise<DiscoveredEmpenhoLinks> {
  const [invoiceSnapshot, alertSnapshot, cronogramaSnapshot] = await Promise.all([
    getDocs(query(
      operationalCollectionRef(scope, 'invoices'),
      where('empenhoId', '==', empenhoId)
    )),
    getDocs(query(
      operationalCollectionRef(scope, 'alerts'),
      where('empenhoId', '==', empenhoId)
    )),
    getDocs(query(
      operationalCollectionRef(scope, 'cronogramas'),
      where('empenhoId', '==', empenhoId)
    )),
  ]);

  return {
    invoices: invoiceSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      data: {
        ...(snapshot.data() as Invoice),
        recordKey: (snapshot.data() as Invoice).recordKey || snapshot.id,
      },
    })),
    alerts: alertSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      data: snapshot.data() as Alert & { empenhoId?: string },
    })),
    cronogramas: cronogramaSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      data: snapshot.data() as CronogramaEmpenho,
    })),
  };
}

function assertDeletionCapacity(links: DiscoveredEmpenhoLinks): void {
  if (links.invoices.length > MAX_EMPENHO_DELETION_INVOICES) {
    throw new Error(
      `O empenho possui ${links.invoices.length} NFs vinculadas e excede o limite seguro de ${MAX_EMPENHO_DELETION_INVOICES} para exclusão transacional.`
    );
  }

  const linkedCount = links.invoices.length + links.alerts.length + links.cronogramas.length;
  if (linkedCount > MAX_EMPENHO_DELETION_LINKED_DOCS) {
    throw new Error(
      `A exclusão possui ${linkedCount} documentos vinculados e excede o limite seguro de ${MAX_EMPENHO_DELETION_LINKED_DOCS} em uma única operação.`
    );
  }

  const lockIds = new Set(
    links.invoices
      .map(({ data }) => buildStoredNsLockDocumentId(data))
      .filter(Boolean)
  );
  if (lockIds.size > MAX_EMPENHO_DELETION_NS_LOCKS) {
    throw new Error(
      `O empenho possui ${lockIds.size} NFs com NS e excede o limite seguro de ${MAX_EMPENHO_DELETION_NS_LOCKS} locks para validação cruzada pelas Firestore Rules.`
    );
  }
}

async function acquireEmpenhoDeletionLock(
  scope: OperationalDataScope,
  userId: string,
  empenhoId: string,
  expectedRevision?: number
): Promise<EmpenhoDeletionLockDocument> {
  const empenhoRef = operationalDocRef(scope, 'empenhos', empenhoId);
  const lockId = buildEmpenhoDeletionLockId(empenhoId);
  const lockRef = operationalSettingsDocRef(scope, lockId);

  return runTransaction(db, async (transaction) => {
    const [empenhoSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(empenhoRef),
      transaction.get(lockRef),
    ]);

    if (!empenhoSnapshot.exists()) {
      throw new Error(`O empenho ${empenhoId} não existe mais.`);
    }

    const storedEmpenho = empenhoSnapshot.data() as Empenho;
    if (storedEmpenho.id !== empenhoId) {
      throw new Error('A identidade do empenho mudou. A exclusão foi cancelada.');
    }
    assertEmpenhoRevision(storedEmpenho, expectedRevision);

    if (lockSnapshot.exists()) {
      const lock = lockSnapshot.data() as Partial<EmpenhoDeletionLockDocument>;
      if (
        lock.id !== lockId
        || lock.type !== EMPENHO_DELETION_LOCK_TYPE
        || lock.workspaceId !== scope.workspaceId
        || lock.empenhoId !== empenhoId
        || lock.createdBy !== userId
        || !lock.correlationId
      ) {
        throw new Error(
          'Já existe uma exclusão protegida deste empenho em andamento. Atualize os dados e tente novamente.'
        );
      }
      return lock as EmpenhoDeletionLockDocument;
    }

    const now = new Date().toISOString();
    const lock: EmpenhoDeletionLockDocument = {
      id: lockId,
      type: EMPENHO_DELETION_LOCK_TYPE,
      workspaceId: scope.workspaceId,
      empenhoId,
      correlationId: createWorkspaceAuditCorrelationId(scope),
      createdAt: now,
      createdBy: userId,
    };

    transaction.set(lockRef, lock);
    return lock;
  });
}

async function releaseEmpenhoDeletionLock(
  scope: OperationalDataScope,
  userId: string,
  empenhoId: string
): Promise<void> {
  const lockRef = operationalSettingsDocRef(
    scope,
    buildEmpenhoDeletionLockId(empenhoId)
  );

  await runTransaction(db, async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    if (!lockSnapshot.exists()) return;

    const lock = lockSnapshot.data() as Partial<EmpenhoDeletionLockDocument>;
    if (
      lock.type !== EMPENHO_DELETION_LOCK_TYPE
      || lock.workspaceId !== scope.workspaceId
      || lock.empenhoId !== empenhoId
      || lock.createdBy !== userId
    ) {
      return;
    }

    transaction.delete(lockRef);
  });
}

export async function commitEmpenhoDeletionLifecycle(
  userId: string,
  empenhoId: string,
  expectedRevision?: number
): Promise<CommitEmpenhoDeletionResult> {
  const scope = getCurrentOperationalScope(userId);
  const path = `${getOperationalDocumentPath(scope, 'empenhos', empenhoId)}/deletion-lifecycle`;

  // Preflight avoids acquiring a write lock for cases that cannot fit safely
  // in one transaction. The authoritative discovery is repeated after locking.
  const preflight = await discoverEmpenhoLinks(scope, empenhoId);
  assertDeletionCapacity(preflight);

  let lock: EmpenhoDeletionLockDocument | null = null;

  try {
    lock = await acquireEmpenhoDeletionLock(scope, userId, empenhoId, expectedRevision);

    // Once the lock exists, Rules reject new invoice creation and normal
    // empenho/linked writes. This closes the query -> delete race window.
    const links = await discoverEmpenhoLinks(scope, empenhoId);
    assertDeletionCapacity(links);

    const result = await runTransaction(db, async (transaction) => {
      const empenhoRef = operationalDocRef(scope, 'empenhos', empenhoId);
      const deletionLockRef = operationalSettingsDocRef(scope, lock!.id);
      const invoiceRefs = links.invoices.map(({ id }) =>
        operationalDocRef(scope, 'invoices', id)
      );
      const alertRefs = links.alerts.map(({ id }) =>
        operationalDocRef(scope, 'alerts', id)
      );
      const cronogramaRefs = links.cronogramas.map(({ id }) =>
        operationalDocRef(scope, 'cronogramas', id)
      );

      const baseSnapshots = await Promise.all([
        transaction.get(empenhoRef),
        transaction.get(deletionLockRef),
        ...invoiceRefs.map((ref) => transaction.get(ref)),
        ...alertRefs.map((ref) => transaction.get(ref)),
        ...cronogramaRefs.map((ref) => transaction.get(ref)),
      ]);

      const empenhoSnapshot = baseSnapshots[0];
      const deletionLockSnapshot = baseSnapshots[1];
      if (!empenhoSnapshot.exists()) {
        throw new Error('O empenho não existe mais. A exclusão foi cancelada.');
      }
      if (!deletionLockSnapshot.exists()) {
        throw new Error('O lock de exclusão do empenho não existe mais. A operação foi cancelada.');
      }

      const storedEmpenho = empenhoSnapshot.data() as Empenho;
      assertEmpenhoRevision(storedEmpenho, expectedRevision);
      const storedDeletionLock = deletionLockSnapshot.data() as Partial<EmpenhoDeletionLockDocument>;
      if (
        storedEmpenho.id !== empenhoId
        || storedDeletionLock.id !== lock!.id
        || storedDeletionLock.type !== EMPENHO_DELETION_LOCK_TYPE
        || storedDeletionLock.workspaceId !== scope.workspaceId
        || storedDeletionLock.empenhoId !== empenhoId
        || storedDeletionLock.createdBy !== userId
        || storedDeletionLock.correlationId !== lock!.correlationId
      ) {
        throw new Error('O estado protegido da exclusão mudou. Atualize a tela e tente novamente.');
      }

      let cursor = 2;
      const invoiceSnapshots = baseSnapshots.slice(cursor, cursor + invoiceRefs.length);
      cursor += invoiceRefs.length;
      const alertSnapshots = baseSnapshots.slice(cursor, cursor + alertRefs.length);
      cursor += alertRefs.length;
      const cronogramaSnapshots = baseSnapshots.slice(cursor, cursor + cronogramaRefs.length);

      if (invoiceSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new Error(
          'Uma Nota Fiscal vinculada mudou durante a exclusão. A operação foi cancelada sem apagar o empenho.'
        );
      }
      if (alertSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new Error(
          'Um alerta vinculado mudou durante a exclusão. A operação foi cancelada sem apagar o empenho.'
        );
      }
      if (cronogramaSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new Error(
          'Um cronograma vinculado mudou durante a exclusão. A operação foi cancelada sem apagar o empenho.'
        );
      }

      const storedInvoices = invoiceSnapshots.map((snapshot) => {
        const data = snapshot.data() as Invoice;
        if (data.empenhoId !== empenhoId) {
          throw new Error('Uma Nota Fiscal mudou de empenho durante a exclusão.');
        }
        return {
          recordKey: snapshot.id,
          invoice: { ...data, recordKey: data.recordKey || snapshot.id },
        };
      });

      for (const snapshot of alertSnapshots) {
        const data = snapshot.data() as Alert & { empenhoId?: string };
        if (data.empenhoId !== empenhoId) {
          throw new Error('Um alerta mudou de empenho durante a exclusão.');
        }
      }
      for (const snapshot of cronogramaSnapshots) {
        const data = snapshot.data() as CronogramaEmpenho;
        if (data.empenhoId !== empenhoId) {
          throw new Error('Um cronograma mudou de empenho durante a exclusão.');
        }
      }

      const lockIds = Array.from(new Set(
        storedInvoices
          .map(({ invoice }) => buildStoredNsLockDocumentId(invoice))
          .filter(Boolean)
      ));
      if (lockIds.length > MAX_EMPENHO_DELETION_NS_LOCKS) {
        throw new Error(
          `A exclusão encontrou ${lockIds.length} locks de NS e excede o limite seguro de ${MAX_EMPENHO_DELETION_NS_LOCKS}.`
        );
      }

      const nsLockRefs = lockIds.map((lockId) =>
        operationalSettingsDocRef(scope, lockId)
      );
      const nsLockSnapshots = await Promise.all(
        nsLockRefs.map((ref) => transaction.get(ref))
      );
      const nsLockById = new Map(
        nsLockSnapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists() ? (snapshot.data() as Partial<NsLockDocument>) : null,
        ])
      );

      for (const { recordKey, invoice } of storedInvoices) {
        const numeroNS = normalizeNsNumber(invoice.numeroNS);
        if (!numeroNS) continue;

        const lockId = buildStoredNsLockDocumentId(invoice);
        const nsLock = nsLockById.get(lockId);
        if (!nsLock) continue;

        const supplierCnpj = normalizeSupplierCnpj(
          invoice.supplierCnpj || storedEmpenho.supplierCnpj
        );
        if (!supplierCnpj || !isValidSupplierCnpj(supplierCnpj)) {
          throw new Error(
            `A NF ${invoice.id} não possui CNPJ válido para validar o lock da NS.`
          );
        }

        assertNsLockOwnership(
          nsLock,
          buildDeletionMutation(invoice, recordKey, supplierCnpj),
          normalizeNsUg(invoice.nsUg) || null,
          numeroNS,
          'stale_lock_owner'
        );
      }

      const existingNsLockRefs = nsLockRefs.filter(
        (_, index) => nsLockSnapshots[index].exists()
      );
      const totalWrites =
        1
        + 1
        + invoiceRefs.length
        + alertRefs.length
        + cronogramaRefs.length
        + existingNsLockRefs.length
        + 1;

      if (totalWrites > MAX_EMPENHO_DELETION_WRITES) {
        throw new Error(
          `A exclusão exige ${totalWrites} gravações e excede o limite seguro de ${MAX_EMPENHO_DELETION_WRITES}.`
        );
      }

      invoiceRefs.forEach((ref) => transaction.delete(ref));
      existingNsLockRefs.forEach((ref) => transaction.delete(ref));
      alertRefs.forEach((ref) => transaction.delete(ref));
      cronogramaRefs.forEach((ref) => transaction.delete(ref));
      transaction.delete(empenhoRef);
      transaction.delete(deletionLockRef);

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'empenho.delete',
          source: 'system',
          entityType: 'empenho',
          entityId: empenhoId,
          correlationId: lock!.correlationId,
          before: {
            empenhoId,
            supplier: storedEmpenho.supplier,
            supplierCnpj: normalizeSupplierCnpj(storedEmpenho.supplierCnpj) || null,
            invoiceRecordKeys: storedInvoices.map(({ recordKey }) => recordKey),
          },
          after: {
            deleted: true,
          },
          metadata: {
            deletedInvoiceCount: invoiceRefs.length,
            deletedNsLockCount: existingNsLockRefs.length,
            deletedAlertCount: alertRefs.length,
            deletedCronogramaCount: cronogramaRefs.length,
          },
        },
        userId
      );

      return {
        empenhoId,
        deletedInvoiceRecordKeys: storedInvoices.map(({ recordKey }) => recordKey),
        deletedAlertIds: links.alerts.map(({ id }) => id),
        deletedCronogramaIds: links.cronogramas.map(({ id }) => id),
        deletedNsLockIds: existingNsLockRefs.map((ref) => ref.id),
      };
    });

    return result;
  } catch (error) {
    if (lock) {
      await releaseEmpenhoDeletionLock(scope, userId, empenhoId).catch(() => undefined);
    }
    if (isEmpenhoConcurrencyError(error)) throw error;
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch (wrappedError) {
      throw wrappedError;
    }
    throw error;
  }
}
