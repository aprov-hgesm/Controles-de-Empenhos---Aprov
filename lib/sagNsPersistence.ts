import { runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { Empenho, Invoice } from './types';
import {
  getOperationalCollectionPath,
  getOperationalDocumentPath,
  getCurrentOperationalScope,
  operationalDocRef,
  operationalSettingsDocRef,
} from './operationalPaths';
import { normalizeSupplierCnpj } from './invoiceIdentity';
import {
  buildSagNsLockDocumentId,
  SagNsPersistencePlanError,
  validateSagNsPersistenceSnapshot,
  type SagNsPersistenceChange,
  type SagNsPersistenceInvoiceDocument,
} from './sagNsPersistencePlan';

export const MAX_SAG_NS_TRANSACTION_CHANGES = 100;
export const MAX_SAG_NS_KNOWN_OWNER_READS = 200;

export interface SagNsImportCommitInput {
  supplierCnpj: string;
  changes: SagNsPersistenceChange[];
  knownNsOwnerRecordKeys: string[];
}

export interface SagNsImportCommitResult {
  appliedCount: number;
  alreadyAppliedCount: number;
  updatedInvoices: Invoice[];
}

interface SagNsLockDocument {
  id: string;
  type: 'sag-ns-lock';
  workspaceId: string;
  numeroNS: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  supplierCnpj: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export async function commitSagNsImport(
  userId: string,
  input: SagNsImportCommitInput
): Promise<SagNsImportCommitResult> {
  const scope = getCurrentOperationalScope(userId);
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/sag-import`;

  if (input.changes.length > MAX_SAG_NS_TRANSACTION_CHANGES) {
    throw new Error(
      `O lote SAG excede o limite seguro de ${MAX_SAG_NS_TRANSACTION_CHANGES} alterações por transação.`
    );
  }

  const targetRecordKeys = Array.from(
    new Set(input.changes.map((change) => change.invoiceRecordKey))
  );
  const knownOwnerRecordKeys = Array.from(
    new Set(input.knownNsOwnerRecordKeys)
  );

  if (knownOwnerRecordKeys.length > MAX_SAG_NS_KNOWN_OWNER_READS) {
    throw new Error(
      `A conferência SAG encontrou mais de ${MAX_SAG_NS_KNOWN_OWNER_READS} possíveis proprietários de NS. Revise duplicidades antes de importar.`
    );
  }

  const relevantRecordKeys = Array.from(
    new Set([...targetRecordKeys, ...knownOwnerRecordKeys])
  );
  const empenhoIds = Array.from(
    new Set(input.changes.map((change) => change.empenhoId))
  );
  const lockIds = input.changes.map((change) =>
    buildSagNsLockDocumentId(change.proposedNs)
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
      const lockSnapshots = await Promise.all(
        lockIds.map((lockId) =>
          transaction.get(operationalSettingsDocRef(scope, lockId))
        )
      );

      const scopedInvoiceDocuments: SagNsPersistenceInvoiceDocument[] = invoiceSnapshots
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
      const targetInvoiceDocuments = scopedInvoiceDocuments.filter((document) =>
        targetSet.has(document.recordKey)
      );

      const empenhos: Empenho[] = empenhoSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => snapshot.data() as Empenho);

      const validation = validateSagNsPersistenceSnapshot({
        supplierCnpj: input.supplierCnpj,
        changes: input.changes,
        targetInvoiceDocuments,
        scopedInvoiceDocuments,
        empenhos,
      });

      input.changes.forEach((change, index) => {
        const lockSnapshot = lockSnapshots[index];
        if (!lockSnapshot.exists()) return;

        const lock = lockSnapshot.data() as Partial<SagNsLockDocument>;
        if (!lock.invoiceRecordKey || !lock.numeroNS) {
          throw new SagNsPersistencePlanError(
            'stale_lock_owner',
            `O lock da NS ${change.proposedNs} está inconsistente. Nenhuma alteração foi aplicada.`
          );
        }

        if (lock.invoiceRecordKey !== change.invoiceRecordKey) {
          throw new SagNsPersistencePlanError(
            'ns_lock_conflict',
            `A NS ${change.proposedNs} já está reservada para outra NF neste workspace.`
          );
        }
      });

      const targetByKey = new Map(
        targetInvoiceDocuments.map((document) => [document.recordKey, document.invoice])
      );
      const normalizedSupplierCnpj = normalizeSupplierCnpj(input.supplierCnpj);
      const now = new Date().toISOString();

      validation.writes.forEach((change) => {
        transaction.set(
          operationalDocRef(scope, 'invoices', change.invoiceRecordKey),
          {
            numeroNS: change.proposedNs,
            recordKey: change.invoiceRecordKey,
            userId,
          },
          { merge: true }
        );
      });

      input.changes.forEach((change, index) => {
        const lockId = lockIds[index];
        const existingLock = lockSnapshots[index].exists()
          ? (lockSnapshots[index].data() as Partial<SagNsLockDocument>)
          : null;
        const lock: SagNsLockDocument = {
          id: lockId,
          type: 'sag-ns-lock',
          workspaceId: scope.workspaceId,
          numeroNS: change.proposedNs,
          invoiceRecordKey: change.invoiceRecordKey,
          invoiceId: change.invoiceId,
          empenhoId: change.empenhoId,
          supplierCnpj: normalizedSupplierCnpj,
          createdAt: existingLock?.createdAt || now,
          updatedAt: now,
          updatedBy: userId,
        };

        transaction.set(
          operationalSettingsDocRef(scope, lockId),
          lock,
          { merge: true }
        );
      });

      const updatedInvoices: Invoice[] = [];
      for (const change of input.changes) {
        const stored = targetByKey.get(change.invoiceRecordKey);
        if (!stored) continue;
        updatedInvoices.push({
          ...stored,
          recordKey: change.invoiceRecordKey,
          numeroNS: change.proposedNs,
        });
      }

      return {
        appliedCount: validation.writes.length,
        alreadyAppliedCount: validation.alreadyApplied.length,
        updatedInvoices,
      };
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${path}:${input.changes.map((change) => getOperationalDocumentPath(scope, 'invoices', change.invoiceRecordKey)).join(',')}`
    );
    throw error;
  }
}
