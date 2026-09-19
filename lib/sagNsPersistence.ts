import { runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { Empenho, Invoice } from './types';
import {
  getOperationalCollectionPath,
  getOperationalDocumentPath,
  getCurrentOperationalScope,
  operationalDocRef,
} from './operationalPaths';
import {
  validateSagNsPersistenceSnapshot,
  type SagNsPersistenceChange,
  type SagNsPersistenceInvoiceDocument,
} from './sagNsPersistencePlan';

export interface SagNsImportCommitInput {
  supplierCnpj: string;
  changes: SagNsPersistenceChange[];
  scopedInvoiceRecordKeys: string[];
}

export interface SagNsImportCommitResult {
  appliedCount: number;
  alreadyAppliedCount: number;
  updatedInvoices: Invoice[];
}

export async function commitSagNsImport(
  userId: string,
  input: SagNsImportCommitInput
): Promise<SagNsImportCommitResult> {
  const scope = getCurrentOperationalScope(userId);
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/sag-import`;

  if (input.changes.length > 400) {
    throw new Error('O lote SAG excede o limite seguro de 400 alterações por transação.');
  }

  const targetRecordKeys = Array.from(
    new Set(input.changes.map((change) => change.invoiceRecordKey))
  );
  const scopedRecordKeys = Array.from(
    new Set([...input.scopedInvoiceRecordKeys, ...targetRecordKeys])
  );
  const empenhoIds = Array.from(
    new Set(input.changes.map((change) => change.empenhoId))
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const scopedSnapshots = await Promise.all(
        scopedRecordKeys.map((recordKey) =>
          transaction.get(operationalDocRef(scope, 'invoices', recordKey))
        )
      );

      const empenhoSnapshots = await Promise.all(
        empenhoIds.map((empenhoId) =>
          transaction.get(operationalDocRef(scope, 'empenhos', empenhoId))
        )
      );

      const scopedInvoiceDocuments: SagNsPersistenceInvoiceDocument[] = scopedSnapshots
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

      const targetByKey = new Map(
        targetInvoiceDocuments.map((document) => [document.recordKey, document.invoice])
      );

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

      const updatedInvoices = input.changes
        .map((change) => {
          const stored = targetByKey.get(change.invoiceRecordKey);
          if (!stored) return null;
          return {
            ...stored,
            recordKey: change.invoiceRecordKey,
            numeroNS: change.proposedNs,
          } satisfies Invoice;
        })
        .filter((invoice): invoice is Invoice => Boolean(invoice));

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
