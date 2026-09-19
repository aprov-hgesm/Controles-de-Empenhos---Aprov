import { deleteField, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { Alert, Empenho, Invoice } from './types';
import { getInvoiceRecordKey, normalizeSupplierCnpj } from './invoiceIdentity';
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  getOperationalDocumentPath,
  operationalDocRef,
  operationalSettingsDocRef,
} from './operationalPaths';
import {
  assertNsLockOwnership,
  buildNsLockDocument,
  buildNsLockDocumentId,
  normalizeNsNumber,
  validateNsIntegritySnapshot,
  type NsIntegrityInvoiceDocument,
  type NsIntegrityMutation,
  type NsLockDocument,
} from './nsIntegrity';

export const MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS = 100;
export const MAX_NS_INTEGRITY_KNOWN_OWNER_READS = 200;

export interface CommitNsIntegrityInput {
  mutations: NsIntegrityMutation[];
  knownNsOwnerRecordKeys: string[];
}

export interface CommitNsIntegrityResult {
  appliedCount: number;
  noOpCount: number;
  updatedInvoices: Invoice[];
}

function withoutNumeroNs(invoice: Invoice): Invoice {
  const result: Invoice = { ...invoice };
  delete result.numeroNS;
  return result;
}

export async function commitNsIntegrityMutations(
  userId: string,
  input: CommitNsIntegrityInput
): Promise<CommitNsIntegrityResult> {
  const scope = getCurrentOperationalScope(userId);
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/ns-integrity`;

  if (input.mutations.length > MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS) {
    throw new Error(
      `A operação de NS excede o limite seguro de ${MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS} alterações por transação.`
    );
  }

  const targetRecordKeys = Array.from(
    new Set(input.mutations.map((mutation) => mutation.invoiceRecordKey))
  );
  const knownOwnerRecordKeys = Array.from(new Set(input.knownNsOwnerRecordKeys));

  if (knownOwnerRecordKeys.length > MAX_NS_INTEGRITY_KNOWN_OWNER_READS) {
    throw new Error(
      `A conferência de NS encontrou mais de ${MAX_NS_INTEGRITY_KNOWN_OWNER_READS} possíveis proprietários conhecidos. Revise inconsistências antes de continuar.`
    );
  }

  const relevantRecordKeys = Array.from(
    new Set([...targetRecordKeys, ...knownOwnerRecordKeys])
  );
  const empenhoIds = Array.from(
    new Set(input.mutations.map((mutation) => mutation.empenhoId))
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const invoiceSnapshots = await Promise.all(
        relevantRecordKeys.map((recordKey) =>
          transaction.get(operationalDocRef(scope, 'invoices', recordKey))
        )
      );
      const empenhoSnapshots = await Promise.all(
        empenhoIds.map((empenhoId) =>
          transaction.get(operationalDocRef(scope, 'empenhos', empenhoId))
        )
      );

      const knownOwnerInvoiceDocuments: NsIntegrityInvoiceDocument[] = invoiceSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => {
          const data = snapshot.data() as Invoice;
          return {
            recordKey: snapshot.id,
            invoice: {
              ...data,
              recordKey: data.recordKey || snapshot.id,
            },
          };
        });

      const targetSet = new Set(targetRecordKeys);
      const targetInvoiceDocuments = knownOwnerInvoiceDocuments.filter((document) =>
        targetSet.has(document.recordKey)
      );
      const targetByKey = new Map(
        targetInvoiceDocuments.map((document) => [document.recordKey, document.invoice])
      );

      const empenhos: Empenho[] = empenhoSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => snapshot.data() as Empenho);

      const validation = validateNsIntegritySnapshot({
        mutations: input.mutations,
        targetInvoiceDocuments,
        knownOwnerInvoiceDocuments,
        empenhos,
      });

      const lockIds = new Set<string>();
      for (const mutation of input.mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        const currentNs = normalizeNsNumber(stored?.numeroNS);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        if (currentNs) lockIds.add(buildNsLockDocumentId(currentNs));
        if (proposedNs) lockIds.add(buildNsLockDocumentId(proposedNs));
      }

      const lockIdList = Array.from(lockIds);
      const lockSnapshots = await Promise.all(
        lockIdList.map((lockId) =>
          transaction.get(operationalSettingsDocRef(scope, lockId))
        )
      );
      const lockById = new Map(
        lockSnapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists() ? (snapshot.data() as Partial<NsLockDocument>) : null,
        ])
      );

      for (const mutation of input.mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;

        const currentNs = normalizeNsNumber(stored.numeroNS);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);

        if (proposedNs) {
          const proposedLock = lockById.get(buildNsLockDocumentId(proposedNs));
          if (proposedLock) {
            assertNsLockOwnership(
              proposedLock,
              mutation,
              proposedNs,
              'ns_lock_conflict'
            );
          }
        }

        if (currentNs && currentNs !== proposedNs) {
          const currentLock = lockById.get(buildNsLockDocumentId(currentNs));
          if (currentLock) {
            assertNsLockOwnership(
              currentLock,
              mutation,
              currentNs,
              'stale_lock_owner'
            );
          }
        }
      }

      const writeKeys = new Set(validation.writes.map((mutation) => mutation.invoiceRecordKey));
      const now = new Date().toISOString();

      for (const mutation of input.mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;

        const currentNs = normalizeNsNumber(stored.numeroNS);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);

        if (writeKeys.has(mutation.invoiceRecordKey)) {
          transaction.set(
            operationalDocRef(scope, 'invoices', mutation.invoiceRecordKey),
            proposedNs
              ? {
                  numeroNS: proposedNs,
                  recordKey: mutation.invoiceRecordKey,
                  userId,
                }
              : {
                  numeroNS: deleteField(),
                  recordKey: mutation.invoiceRecordKey,
                  userId,
                },
            { merge: true }
          );
        }

        if (currentNs && currentNs !== proposedNs) {
          const currentLockId = buildNsLockDocumentId(currentNs);
          if (lockById.get(currentLockId)) {
            transaction.delete(operationalSettingsDocRef(scope, currentLockId));
          }
        }

        if (proposedNs) {
          const lockId = buildNsLockDocumentId(proposedNs);
          const existingLock = lockById.get(lockId);
          const lock = buildNsLockDocument({
            workspaceId: scope.workspaceId,
            mutation: {
              ...mutation,
              proposedNs,
            },
            userId,
            createdAt: existingLock?.createdAt || now,
            updatedAt: now,
          });
          transaction.set(
            operationalSettingsDocRef(scope, lockId),
            lock,
            { merge: true }
          );
        }
      }

      const updatedInvoices: Invoice[] = [];
      for (const mutation of input.mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        updatedInvoices.push(
          proposedNs
            ? {
                ...stored,
                recordKey: mutation.invoiceRecordKey,
                numeroNS: proposedNs,
              }
            : {
                ...withoutNumeroNs(stored),
                recordKey: mutation.invoiceRecordKey,
              }
        );
      }

      return {
        appliedCount: validation.writes.length,
        noOpCount: validation.noOps.length,
        updatedInvoices,
      };
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${path}:${input.mutations.map((mutation) =>
        getOperationalDocumentPath(scope, 'invoices', mutation.invoiceRecordKey)
      ).join(',')}`
    );
    throw error;
  }
}


export interface CommitInvoiceReceiptLifecycleInput {
  targetEmpenho: Empenho;
  previousEmpenho?: Empenho;
  invoice: Invoice;
  alert: Alert;
  previousInvoiceRecordKey?: string;
}

export interface CommitInvoiceDeletionLifecycleInput {
  updatedEmpenho: Empenho;
  invoiceRecordKey: string;
}

export interface CommitAllInvoicesDeletionLifecycleInput {
  updatedEmpenhos: Empenho[];
  invoiceRecordKeys: string[];
}

export const MAX_INVOICE_LIFECYCLE_WRITES = 450;

function invoiceWithRecordKey(snapshotId: string, invoice: Invoice): Invoice {
  return {
    ...invoice,
    recordKey: invoice.recordKey || snapshotId,
  };
}

function buildLifecycleMutation(
  invoice: Invoice,
  invoiceRecordKey: string,
  supplierCnpj: string,
  proposedNs: string | null,
  source: 'migration' | 'system'
): NsIntegrityMutation {
  return {
    invoiceRecordKey,
    invoiceId: invoice.id,
    empenhoId: invoice.empenhoId,
    supplierCnpj,
    expectedCurrentNs: normalizeNsNumber(invoice.numeroNS) || null,
    proposedNs,
    source,
  };
}

export async function commitInvoiceReceiptLifecycle(
  userId: string,
  input: CommitInvoiceReceiptLifecycleInput
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const nextRecordKey = getInvoiceRecordKey(input.invoice);
  const previousRecordKey = input.previousInvoiceRecordKey;
  const isExistingEdit = Boolean(previousRecordKey);
  const isIdentityMigration = Boolean(
    previousRecordKey && previousRecordKey !== nextRecordKey
  );
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/receipt-lifecycle`;

  try {
    await runTransaction(db, async (transaction) => {
      const nextInvoiceRef = operationalDocRef(scope, 'invoices', nextRecordKey);
      const previousInvoiceRef = isExistingEdit
        ? operationalDocRef(scope, 'invoices', previousRecordKey!)
        : null;

      const existingSnapshot = previousInvoiceRef
        ? await transaction.get(previousInvoiceRef)
        : await transaction.get(nextInvoiceRef);
      const targetSnapshot = isIdentityMigration
        ? await transaction.get(nextInvoiceRef)
        : existingSnapshot;

      if (isExistingEdit && !existingSnapshot.exists()) {
        throw new NsIntegrityError(
          'invoice_missing',
          'A Nota Fiscal original não existe mais. A edição foi cancelada.'
        );
      }
      if (!isExistingEdit && existingSnapshot.exists()) {
        throw new NsIntegrityError(
          'invoice_identity_changed',
          'Já existe uma Nota Fiscal com esta identidade. O cadastro foi cancelado.'
        );
      }
      if (isIdentityMigration && targetSnapshot.exists()) {
        throw new NsIntegrityError(
          'invoice_identity_changed',
          'Já existe uma Nota Fiscal com a nova identidade. A edição foi cancelada.'
        );
      }

      let oldInvoice: Invoice | null = null;
      let migratedLockRef: ReturnType<typeof operationalSettingsDocRef> | null = null;
      let migratedLock: Partial<NsLockDocument> | null = null;

      if (isExistingEdit) {
        oldInvoice = invoiceWithRecordKey(
          existingSnapshot.id,
          existingSnapshot.data() as Invoice
        );
        const oldNs = normalizeNsNumber(oldInvoice.numeroNS);
        const nextNs = normalizeNsNumber(input.invoice.numeroNS);
        if (oldNs !== nextNs) {
          throw new NsIntegrityError(
            'stale_invoice_ns',
            'A NS da Nota Fiscal mudou durante a edição. Altere a NS pelo campo específico.'
          );
        }

        if (oldNs) {
          migratedLockRef = operationalSettingsDocRef(
            scope,
            buildNsLockDocumentId(oldNs)
          );
          const lockSnapshot = await transaction.get(migratedLockRef);
          if (lockSnapshot.exists()) {
            migratedLock = lockSnapshot.data() as Partial<NsLockDocument>;
            const oldSupplierCnpj = normalizeSupplierCnpj(
              oldInvoice.supplierCnpj || input.invoice.supplierCnpj
            );
            if (!oldSupplierCnpj) {
              throw new NsIntegrityError(
                'invalid_supplier_cnpj',
                'A Nota Fiscal original não possui CNPJ válido para validar o lock da NS.'
              );
            }
            assertNsLockOwnership(
              migratedLock,
              buildLifecycleMutation(
                oldInvoice,
                previousRecordKey!,
                oldSupplierCnpj,
                oldNs,
                'migration'
              ),
              oldNs,
              'stale_lock_owner'
            );
          }
        }
      } else if (normalizeNsNumber(input.invoice.numeroNS)) {
        throw new NsIntegrityError(
          'invoice_identity_changed',
          'Uma nova Nota Fiscal deve ser cadastrada sem NS e receber a NS pelo fluxo específico.'
        );
      }

      const supplierCnpj = normalizeSupplierCnpj(input.invoice.supplierCnpj);
      if (input.invoice.numeroNS && !supplierCnpj) {
        throw new NsIntegrityError(
          'invalid_supplier_cnpj',
          'A Nota Fiscal editada não possui CNPJ válido para preservar o lock da NS.'
        );
      }

      transaction.set(
        operationalDocRef(scope, 'empenhos', input.targetEmpenho.id),
        { ...input.targetEmpenho, userId }
      );
      if (
        input.previousEmpenho &&
        input.previousEmpenho.id !== input.targetEmpenho.id
      ) {
        transaction.set(
          operationalDocRef(scope, 'empenhos', input.previousEmpenho.id),
          { ...input.previousEmpenho, userId }
        );
      }

      transaction.set(nextInvoiceRef, {
        ...input.invoice,
        recordKey: nextRecordKey,
        userId,
      });
      transaction.set(
        operationalDocRef(scope, 'alerts', input.alert.id),
        { ...input.alert, userId }
      );

      if (isIdentityMigration && previousInvoiceRef) {
        transaction.delete(previousInvoiceRef);
      }

      const preservedNs = normalizeNsNumber(oldInvoice?.numeroNS);
      if (
        isExistingEdit &&
        preservedNs &&
        supplierCnpj &&
        migratedLockRef
      ) {
        const now = new Date().toISOString();
        const refreshedMutation = buildLifecycleMutation(
          input.invoice,
          nextRecordKey,
          supplierCnpj,
          preservedNs,
          'migration'
        );
        const nextLock = buildNsLockDocument({
          workspaceId: scope.workspaceId,
          mutation: refreshedMutation,
          userId,
          createdAt: migratedLock?.createdAt || now,
          updatedAt: now,
        });
        transaction.set(migratedLockRef, nextLock, { merge: true });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function commitInvoiceDeletionLifecycle(
  userId: string,
  input: CommitInvoiceDeletionLifecycleInput
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const invoiceRef = operationalDocRef(scope, 'invoices', input.invoiceRecordKey);
  const path = getOperationalDocumentPath(scope, 'invoices', input.invoiceRecordKey);

  try {
    await runTransaction(db, async (transaction) => {
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new NsIntegrityError(
          'invoice_missing',
          'A Nota Fiscal não existe mais. A exclusão foi cancelada.'
        );
      }

      const invoice = invoiceWithRecordKey(
        invoiceSnapshot.id,
        invoiceSnapshot.data() as Invoice
      );
      if (invoice.empenhoId !== input.updatedEmpenho.id) {
        throw new NsIntegrityError(
          'invoice_identity_changed',
          'O vínculo da Nota Fiscal com o empenho mudou. A exclusão foi cancelada.'
        );
      }

      const currentNs = normalizeNsNumber(invoice.numeroNS);
      let lockRef: ReturnType<typeof operationalSettingsDocRef> | null = null;
      let lockExists = false;

      if (currentNs) {
        lockRef = operationalSettingsDocRef(
          scope,
          buildNsLockDocumentId(currentNs)
        );
        const lockSnapshot = await transaction.get(lockRef);
        if (lockSnapshot.exists()) {
          lockExists = true;
          const supplierCnpj = normalizeSupplierCnpj(
            invoice.supplierCnpj || input.updatedEmpenho.supplierCnpj
          );
          if (!supplierCnpj) {
            throw new NsIntegrityError(
              'invalid_supplier_cnpj',
              'A Nota Fiscal não possui CNPJ válido para validar o lock da NS.'
            );
          }
          assertNsLockOwnership(
            lockSnapshot.data() as Partial<NsLockDocument>,
            buildLifecycleMutation(
              invoice,
              input.invoiceRecordKey,
              supplierCnpj,
              currentNs,
              'system'
            ),
            currentNs,
            'stale_lock_owner'
          );
        }
      }

      transaction.set(
        operationalDocRef(scope, 'empenhos', input.updatedEmpenho.id),
        { ...input.updatedEmpenho, userId }
      );
      transaction.delete(invoiceRef);
      if (lockRef && lockExists) {
        transaction.delete(lockRef);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function commitAllInvoicesDeletionLifecycle(
  userId: string,
  input: CommitAllInvoicesDeletionLifecycleInput
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const uniqueRecordKeys = Array.from(new Set(input.invoiceRecordKeys));
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/bulk-lifecycle`;

  try {
    await runTransaction(db, async (transaction) => {
      const invoiceRefs = uniqueRecordKeys.map((recordKey) =>
        operationalDocRef(scope, 'invoices', recordKey)
      );
      const invoiceSnapshots = await Promise.all(
        invoiceRefs.map((ref) => transaction.get(ref))
      );

      if (invoiceSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new NsIntegrityError(
          'invoice_missing',
          'Uma ou mais Notas Fiscais mudaram antes da exclusão em lote. A operação foi cancelada.'
        );
      }

      const invoices = invoiceSnapshots.map((snapshot) =>
        invoiceWithRecordKey(snapshot.id, snapshot.data() as Invoice)
      );
      const lockEntries = invoices
        .map((invoice, index) => ({
          invoice,
          recordKey: uniqueRecordKeys[index],
          ns: normalizeNsNumber(invoice.numeroNS),
        }))
        .filter((entry) => entry.ns);

      const lockIds = Array.from(
        new Set(lockEntries.map((entry) => buildNsLockDocumentId(entry.ns)))
      );
      const lockRefs = lockIds.map((lockId) =>
        operationalSettingsDocRef(scope, lockId)
      );
      const lockSnapshots = await Promise.all(
        lockRefs.map((ref) => transaction.get(ref))
      );
      const lockById = new Map(
        lockSnapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists() ? (snapshot.data() as Partial<NsLockDocument>) : null,
        ])
      );

      const empenhoById = new Map(
        input.updatedEmpenhos.map((empenho) => [empenho.id, empenho])
      );

      for (const entry of lockEntries) {
        const lock = lockById.get(buildNsLockDocumentId(entry.ns));
        if (!lock) continue;
        const relatedEmpenho = empenhoById.get(entry.invoice.empenhoId);
        const supplierCnpj = normalizeSupplierCnpj(
          entry.invoice.supplierCnpj || relatedEmpenho?.supplierCnpj
        );
        if (!supplierCnpj) {
          throw new NsIntegrityError(
            'invalid_supplier_cnpj',
            `A NF ${entry.invoice.id} não possui CNPJ válido para validar o lock da NS.`
          );
        }
        assertNsLockOwnership(
          lock,
          buildLifecycleMutation(
            entry.invoice,
            entry.recordKey,
            supplierCnpj,
            entry.ns,
            'system'
          ),
          entry.ns,
          'stale_lock_owner'
        );
      }

      const existingLockRefs = lockRefs.filter(
        (_, index) => lockSnapshots[index].exists()
      );
      const totalWrites =
        input.updatedEmpenhos.length +
        invoiceRefs.length +
        existingLockRefs.length;
      if (totalWrites > MAX_INVOICE_LIFECYCLE_WRITES) {
        throw new Error(
          `A exclusão em lote exige ${totalWrites} gravações e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_WRITES}.`
        );
      }

      input.updatedEmpenhos.forEach((empenho) => {
        transaction.set(
          operationalDocRef(scope, 'empenhos', empenho.id),
          { ...empenho, userId }
        );
      });
      invoiceRefs.forEach((ref) => transaction.delete(ref));
      existingLockRefs.forEach((ref) => transaction.delete(ref));
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
