import { deleteField, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { Empenho, Invoice } from './types';
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
  const { numeroNS: _removed, ...rest } = invoice;
  return rest;
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
