import { deleteField, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  assertEmpenhoRevision,
  buildNextEmpenho,
  isEmpenhoConcurrencyError,
} from './empenhoConcurrency';
import {
  appendWorkspaceAuditEvent,
  createWorkspaceAuditCorrelationId,
} from './auditTrail';
import type { Empenho, Invoice } from './types';
import { getInvoiceRecordKey, isValidSupplierCnpj, normalizeSupplierCnpj } from './invoiceIdentity';
import {
  buildSupplierCnpjMigrationPlan,
  SupplierCnpjMigrationError,
} from './supplierCnpjMigration';
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  getOperationalDocumentPath,
  operationalCollectionRef,
  operationalDocRef,
  operationalSettingsDocRef,
} from './operationalPaths';
import {
  assertNsLockOwnership,
  buildLegacyNsLockDocumentId,
  buildNsLockDocument,
  buildNsLockDocumentId,
  isValidNsNumber,
  isValidNsUg,
  normalizeNsNumber,
  normalizeNsUg,
  validateNsIntegritySnapshot,
  NsIntegrityError,
  type NsIntegrityInvoiceDocument,
  type NsIntegrityMutation,
  type NsLockDocument,
} from './nsIntegrity';
export const MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS = 6;
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
  delete result.nsUg;
  return result;
}

function buildStoredNsLockDocumentId(invoice: Pick<Invoice, 'numeroNS' | 'nsUg'>): string {
  const numeroNS = normalizeNsNumber(invoice.numeroNS);
  if (!numeroNS) return '';
  const ug = normalizeNsUg(invoice.nsUg);
  return ug
    ? buildNsLockDocumentId(ug, numeroNS)
    : buildLegacyNsLockDocumentId(numeroNS);
}

export async function commitNsIntegrityMutations(
  userId: string,
  input: CommitNsIntegrityInput
): Promise<CommitNsIntegrityResult> {
  const scope = getCurrentOperationalScope(userId);
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/ns-integrity`;
  const correlationId = createWorkspaceAuditCorrelationId(scope);
  const scopeUg = normalizeNsUg(scope.ug);
  const mutations = input.mutations.map((mutation) => {
    const proposedNs = normalizeNsNumber(mutation.proposedNs);
    if (!proposedNs) {
      return { ...mutation, proposedUg: null };
    }

    if (!isValidNsUg(scopeUg)) {
      throw new NsIntegrityError(
        'invalid_ug',
        'A UG da Organização Militar não está configurada para este usuário. A gravação de NS foi bloqueada.'
      );
    }

    const requestedUg = normalizeNsUg(mutation.proposedUg);
    if (requestedUg && requestedUg !== scopeUg) {
      throw new NsIntegrityError(
        'invalid_ug',
        `A UG ${requestedUg} informada para a NS não corresponde à UG ${scopeUg} vinculada ao usuário.`
      );
    }

    return {
      ...mutation,
      proposedUg: scopeUg,
    };
  });

  if (mutations.length > MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS) {
    throw new Error(
      `A operação de NS excede o limite seguro de ${MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS} alterações por transação.`
    );
  }

  const targetRecordKeys = Array.from(
    new Set(mutations.map((mutation) => mutation.invoiceRecordKey))
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
    new Set(mutations.map((mutation) => mutation.empenhoId))
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

      for (const document of targetInvoiceDocuments) {
        const storedNs = normalizeNsNumber(document.invoice.numeroNS);
        const storedUg = normalizeNsUg(document.invoice.nsUg);
        if (storedNs && storedUg && isValidNsUg(scopeUg) && storedUg !== scopeUg) {
          throw new NsIntegrityError(
            'invalid_ug',
            `A NF ${document.invoice.id} está vinculada à UG ${storedUg}, diferente da UG ${scopeUg} deste usuário. A operação foi bloqueada.`
          );
        }
      }

      const empenhos: Empenho[] = empenhoSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => snapshot.data() as Empenho);

      const validation = validateNsIntegritySnapshot({
        mutations: mutations,
        targetInvoiceDocuments,
        knownOwnerInvoiceDocuments,
        empenhos,
      });

      const lockIds = new Set<string>();
      for (const mutation of mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        const currentNs = normalizeNsNumber(stored?.numeroNS);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        if (stored && currentNs) lockIds.add(buildStoredNsLockDocumentId(stored));
        if (proposedNs) lockIds.add(buildNsLockDocumentId(mutation.proposedUg, proposedNs));
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

      for (const mutation of mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;

        const currentNs = normalizeNsNumber(stored.numeroNS);
        const currentUg = normalizeNsUg(stored.nsUg);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        const proposedUg = normalizeNsUg(mutation.proposedUg);

        if (proposedNs) {
          const proposedLock = lockById.get(buildNsLockDocumentId(proposedUg, proposedNs));
          if (proposedLock) {
            assertNsLockOwnership(
              proposedLock,
              mutation,
              proposedUg,
              proposedNs,
              'ns_lock_conflict'
            );
          }
        }

        if (currentNs && (currentNs !== proposedNs || currentUg !== proposedUg)) {
          const currentLock = lockById.get(buildStoredNsLockDocumentId(stored));
          if (currentLock) {
            assertNsLockOwnership(
              currentLock,
              mutation,
              currentUg || null,
              currentNs,
              'stale_lock_owner'
            );
          }
        }
      }

      const writeKeys = new Set(validation.writes.map((mutation) => mutation.invoiceRecordKey));
      const now = new Date().toISOString();

      for (const mutation of mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;

        const currentNs = normalizeNsNumber(stored.numeroNS);
        const currentUg = normalizeNsUg(stored.nsUg);
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        const proposedUg = normalizeNsUg(mutation.proposedUg);

        if (writeKeys.has(mutation.invoiceRecordKey)) {
          transaction.set(
            operationalDocRef(scope, 'invoices', mutation.invoiceRecordKey),
            proposedNs
              ? {
                  numeroNS: proposedNs,
                  nsUg: proposedUg,
                  recordKey: mutation.invoiceRecordKey,
                  userId,
                }
              : {
                  numeroNS: deleteField(),
                  nsUg: deleteField(),
                  recordKey: mutation.invoiceRecordKey,
                  userId,
                },
            { merge: true }
          );
        } else if (proposedNs) {
          // Reaplicações idempotentes também normalizam a identidade física
          // para permitir reconstrução segura de locks em registros legados.
          transaction.set(
            operationalDocRef(scope, 'invoices', mutation.invoiceRecordKey),
            {
              recordKey: mutation.invoiceRecordKey,
              userId,
            },
            { merge: true }
          );
        }

        if (currentNs && (currentNs !== proposedNs || currentUg !== proposedUg)) {
          const currentLockId = buildStoredNsLockDocumentId(stored);
          if (lockById.get(currentLockId)) {
            transaction.delete(operationalSettingsDocRef(scope, currentLockId));
          }
        }

        if (proposedNs) {
          const lockId = buildNsLockDocumentId(proposedUg, proposedNs);
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

        if (writeKeys.has(mutation.invoiceRecordKey)) {
          const operation = !currentNs && proposedNs
            ? 'ns.assign'
            : currentNs && proposedNs
              ? 'ns.replace'
              : 'ns.remove';

          appendWorkspaceAuditEvent(
            transaction,
            scope,
            {
              operation,
              source: mutation.source,
              entityType: 'invoice',
              entityId: mutation.invoiceRecordKey,
              correlationId,
              before: {
                recordKey: mutation.invoiceRecordKey,
                invoiceId: mutation.invoiceId,
                empenhoId: mutation.empenhoId,
                supplierCnpj: mutation.supplierCnpj,
                numeroNS: currentNs || null,
                nsUg: currentUg || null,
              },
              after: {
                recordKey: mutation.invoiceRecordKey,
                invoiceId: mutation.invoiceId,
                empenhoId: mutation.empenhoId,
                supplierCnpj: mutation.supplierCnpj,
                numeroNS: proposedNs || null,
                nsUg: proposedUg || null,
              },
              metadata: {
                identityBefore: currentNs ? `${currentUg || 'legacy'}|${currentNs}` : null,
                identityAfter: proposedNs ? `${proposedUg}|${proposedNs}` : null,
              },
            },
            userId
          );
        }
      }

      const updatedInvoices: Invoice[] = [];
      for (const mutation of mutations) {
        const stored = targetByKey.get(mutation.invoiceRecordKey);
        if (!stored) continue;
        const proposedNs = normalizeNsNumber(mutation.proposedNs);
        const proposedUg = normalizeNsUg(mutation.proposedUg);
        updatedInvoices.push(
          proposedNs
            ? {
                ...stored,
                recordKey: mutation.invoiceRecordKey,
                numeroNS: proposedNs,
                nsUg: proposedUg,
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
      `${path}:${mutations.map((mutation) =>
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
  previousInvoiceRecordKey?: string;
}

export interface CommitInvoiceReceiptLifecycleResult {
  updatedTargetEmpenho: Empenho;
  updatedPreviousEmpenho?: Empenho;
  updatedInvoice: Invoice;
}

export interface CommitInvoiceDeletionLifecycleInput {
  updatedEmpenho: Empenho;
  invoiceRecordKey: string;
}

export interface CommitInvoiceDeletionLifecycleResult {
  updatedEmpenho: Empenho;
}

export interface CommitAllInvoicesDeletionLifecycleInput {
  updatedEmpenhos: Empenho[];
  invoiceRecordKeys: string[];
}

export interface CommitAllInvoicesDeletionLifecycleResult {
  updatedEmpenhos: Empenho[];
}

export const MAX_INVOICE_LIFECYCLE_WRITES = 450;
export const MAX_INVOICE_LIFECYCLE_NS_LOCKS = 8;

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
    expectedCurrentUg: normalizeNsUg(invoice.nsUg) || null,
    expectedCurrentNs: normalizeNsNumber(invoice.numeroNS) || null,
    proposedUg: proposedNs ? normalizeNsUg(invoice.nsUg) || null : null,
    proposedNs,
    source,
  };
}

export async function commitInvoiceReceiptLifecycle(
  userId: string,
  input: CommitInvoiceReceiptLifecycleInput
): Promise<CommitInvoiceReceiptLifecycleResult> {
  const scope = getCurrentOperationalScope(userId);
  const nextRecordKey = getInvoiceRecordKey(input.invoice);
  const previousRecordKey = input.previousInvoiceRecordKey;
  const isExistingEdit = Boolean(previousRecordKey);
  const isIdentityMigration = Boolean(
    previousRecordKey && previousRecordKey !== nextRecordKey
  );
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/receipt-lifecycle`;
  const correlationId = createWorkspaceAuditCorrelationId(scope);

  try {
    return await runTransaction(db, async (transaction) => {
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

      const targetEmpenhoRef = operationalDocRef(
        scope,
        'empenhos',
        input.targetEmpenho.id
      );
      const previousEmpenhoRef =
        input.previousEmpenho &&
        input.previousEmpenho.id !== input.targetEmpenho.id
          ? operationalDocRef(scope, 'empenhos', input.previousEmpenho.id)
          : null;
      const [storedTargetEmpenhoSnapshot, storedPreviousEmpenhoSnapshot] =
        await Promise.all([
          transaction.get(targetEmpenhoRef),
          previousEmpenhoRef
            ? transaction.get(previousEmpenhoRef)
            : Promise.resolve(null),
        ]);

      if (!storedTargetEmpenhoSnapshot.exists()) {
        throw new NsIntegrityError(
          'empenho_missing',
          'O empenho selecionado não existe mais. O recebimento foi cancelado.'
        );
      }
      if (previousEmpenhoRef && !storedPreviousEmpenhoSnapshot?.exists()) {
        throw new NsIntegrityError(
          'empenho_missing',
          'O empenho anterior da Nota Fiscal não existe mais. A edição foi cancelada.'
        );
      }

      const storedTargetEmpenho = storedTargetEmpenhoSnapshot.data() as Empenho;
      assertEmpenhoRevision(storedTargetEmpenho, input.targetEmpenho.revision);

      const storedPreviousEmpenho =
        previousEmpenhoRef && storedPreviousEmpenhoSnapshot?.exists()
          ? (storedPreviousEmpenhoSnapshot.data() as Empenho)
          : null;
      if (storedPreviousEmpenho && input.previousEmpenho) {
        assertEmpenhoRevision(storedPreviousEmpenho, input.previousEmpenho.revision);
      }

      let committedTargetEmpenho = buildNextEmpenho(
        input.targetEmpenho,
        storedTargetEmpenho,
        userId
      );
      const committedPreviousEmpenho =
        storedPreviousEmpenho && input.previousEmpenho
          ? buildNextEmpenho(input.previousEmpenho, storedPreviousEmpenho, userId)
          : undefined;

      const storedTargetCnpj = normalizeSupplierCnpj(storedTargetEmpenho.supplierCnpj);
      const expectedTargetCnpj = normalizeSupplierCnpj(input.targetEmpenho.supplierCnpj);
      const invoiceCnpj = normalizeSupplierCnpj(input.invoice.supplierCnpj);
      const storedTargetHasCnpj = Boolean(String(storedTargetEmpenho.supplierCnpj || '').trim());
      const invoiceHasCnpj = Boolean(String(input.invoice.supplierCnpj || '').trim());

      if (
        (storedTargetHasCnpj && (!storedTargetCnpj || !isValidSupplierCnpj(storedTargetCnpj))) ||
        (invoiceHasCnpj && (!invoiceCnpj || !isValidSupplierCnpj(invoiceCnpj)))
      ) {
        throw new NsIntegrityError(
          'invalid_supplier_cnpj',
          'O recebimento foi bloqueado porque o CNPJ do empenho ou da NF possui formato ou dígitos verificadores inválidos.'
        );
      }

      if (
        storedTargetCnpj !== expectedTargetCnpj ||
        (invoiceCnpj && invoiceCnpj !== storedTargetCnpj)
      ) {
        throw new NsIntegrityError(
          'supplier_scope_changed',
          'O CNPJ do empenho mudou durante o recebimento. Reabra a Nota Fiscal e tente novamente.'
        );
      }

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
        const oldUg = normalizeNsUg(oldInvoice.nsUg);
        const nextNs = normalizeNsNumber(input.invoice.numeroNS);
        const nextUg = normalizeNsUg(input.invoice.nsUg);
        if (oldNs !== nextNs || oldUg !== nextUg) {
          throw new NsIntegrityError(
            'stale_invoice_ns',
            'A identidade UG + NS da Nota Fiscal mudou durante a edição. Altere-a pelo campo específico.'
          );
        }

        if (oldNs) {
          migratedLockRef = operationalSettingsDocRef(
            scope,
            buildStoredNsLockDocumentId(oldInvoice)
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
              oldUg || null,
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
        targetEmpenhoRef,
        { ...committedTargetEmpenho, userId }
      );
      if (committedPreviousEmpenho) {
        transaction.set(
          operationalDocRef(scope, 'empenhos', committedPreviousEmpenho.id),
          { ...committedPreviousEmpenho, userId }
        );
      }

      transaction.set(nextInvoiceRef, {
        ...input.invoice,
        recordKey: nextRecordKey,
        userId,
      });
      if (isIdentityMigration && previousInvoiceRef) {
        transaction.delete(previousInvoiceRef);
      }

      const preservedNs = normalizeNsNumber(oldInvoice?.numeroNS);
      const preservedUg = normalizeNsUg(oldInvoice?.nsUg);
      if (
        isExistingEdit &&
        preservedNs &&
        supplierCnpj &&
        migratedLockRef
      ) {
        if (!preservedUg) {
          if (isIdentityMigration) {
            throw new NsIntegrityError(
              'invalid_ug',
              'A NF possui NS legada sem UG. Informe a UG pelo controle de NS antes de migrar a identidade da Nota Fiscal.'
            );
          }
        } else {
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
      }

      if (isIdentityMigration && oldInvoice) {
        appendWorkspaceAuditEvent(
          transaction,
          scope,
          {
            operation: 'invoice.identity_migrate',
            source: 'migration',
            entityType: 'invoice',
            entityId: nextRecordKey,
            correlationId,
            before: {
              recordKey: previousRecordKey || null,
              invoiceId: oldInvoice.id,
              empenhoId: oldInvoice.empenhoId,
              supplierCnpj: normalizeSupplierCnpj(oldInvoice.supplierCnpj) || null,
              numeroNS: normalizeNsNumber(oldInvoice.numeroNS) || null,
              nsUg: normalizeNsUg(oldInvoice.nsUg) || null,
            },
            after: {
              recordKey: nextRecordKey,
              invoiceId: input.invoice.id,
              empenhoId: input.invoice.empenhoId,
              supplierCnpj: supplierCnpj || null,
              numeroNS: normalizeNsNumber(input.invoice.numeroNS) || null,
              nsUg: normalizeNsUg(input.invoice.nsUg) || null,
            },
          },
          userId
        );
      }

      return {
        updatedTargetEmpenho: committedTargetEmpenho,
        ...(committedPreviousEmpenho
          ? { updatedPreviousEmpenho: committedPreviousEmpenho }
          : {}),
        updatedInvoice: {
          ...input.invoice,
          recordKey: nextRecordKey,
        },
      };
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function commitInvoiceDeletionLifecycle(
  userId: string,
  input: CommitInvoiceDeletionLifecycleInput
): Promise<CommitInvoiceDeletionLifecycleResult> {
  const scope = getCurrentOperationalScope(userId);
  const invoiceRef = operationalDocRef(scope, 'invoices', input.invoiceRecordKey);
  const path = getOperationalDocumentPath(scope, 'invoices', input.invoiceRecordKey);
  const correlationId = createWorkspaceAuditCorrelationId(scope);

  try {
    return await runTransaction(db, async (transaction) => {
      const empenhoRef = operationalDocRef(scope, 'empenhos', input.updatedEmpenho.id);
      const [invoiceSnapshot, empenhoSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(empenhoRef),
      ]);
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
      if (!empenhoSnapshot.exists()) {
        throw new NsIntegrityError(
          'empenho_missing',
          'O empenho vinculado não existe mais. A exclusão foi cancelada.'
        );
      }

      const storedEmpenho = empenhoSnapshot.data() as Empenho;
      assertEmpenhoRevision(storedEmpenho, input.updatedEmpenho.revision);
      const committedEmpenho = buildNextEmpenho(
        input.updatedEmpenho,
        storedEmpenho,
        userId
      );

      const currentNs = normalizeNsNumber(invoice.numeroNS);
      let lockRef: ReturnType<typeof operationalSettingsDocRef> | null = null;
      let lockExists = false;

      if (currentNs) {
        lockRef = operationalSettingsDocRef(
          scope,
          buildStoredNsLockDocumentId(invoice)
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
            normalizeNsUg(invoice.nsUg) || null,
            currentNs,
            'stale_lock_owner'
          );
        }
      }

      transaction.set(
        empenhoRef,
        { ...committedEmpenho, userId }
      );
      transaction.delete(invoiceRef);
      if (lockRef && lockExists) {
        transaction.delete(lockRef);
      }

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'invoice.delete',
          source: 'system',
          entityType: 'invoice',
          entityId: input.invoiceRecordKey,
          correlationId,
          before: {
            recordKey: input.invoiceRecordKey,
            invoiceId: invoice.id,
            empenhoId: invoice.empenhoId,
            supplierCnpj: normalizeSupplierCnpj(invoice.supplierCnpj) || null,
            numeroNS: normalizeNsNumber(invoice.numeroNS) || null,
            nsUg: normalizeNsUg(invoice.nsUg) || null,
          },
          after: {
            deleted: true,
          },
          metadata: {
            lockRemoved: Boolean(lockRef && lockExists),
          },
        },
        userId
      );

      return { updatedEmpenho: committedEmpenho };
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function commitAllInvoicesDeletionLifecycle(
  userId: string,
  input: CommitAllInvoicesDeletionLifecycleInput
): Promise<CommitAllInvoicesDeletionLifecycleResult> {
  const scope = getCurrentOperationalScope(userId);
  const uniqueRecordKeys = Array.from(new Set(input.invoiceRecordKeys));
  const path = `${getOperationalCollectionPath(scope, 'invoices')}/bulk-lifecycle`;
  const correlationId = createWorkspaceAuditCorrelationId(scope);

  try {
    return await runTransaction(db, async (transaction) => {
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

      const affectedEmpenhoIds = Array.from(
        new Set(invoices.map((invoice) => invoice.empenhoId))
      );
      const inputEmpenhoById = new Map(
        input.updatedEmpenhos.map((empenho) => [empenho.id, empenho])
      );
      const affectedEmpenhos = affectedEmpenhoIds.map((empenhoId) => {
        const empenho = inputEmpenhoById.get(empenhoId);
        if (!empenho) {
          throw new NsIntegrityError(
            'empenho_missing',
            `O empenho ${empenhoId} não foi informado para reverter as Notas Fiscais.`
          );
        }
        return empenho;
      });
      const affectedEmpenhoRefs = affectedEmpenhos.map((empenho) =>
        operationalDocRef(scope, 'empenhos', empenho.id)
      );

      const lockEntries = invoices
        .map((invoice, index) => ({
          invoice,
          recordKey: uniqueRecordKeys[index],
          ns: normalizeNsNumber(invoice.numeroNS),
          ug: normalizeNsUg(invoice.nsUg),
        }))
        .filter((entry) => entry.ns);

      if (lockEntries.length > MAX_INVOICE_LIFECYCLE_NS_LOCKS) {
        throw new Error(
          `A exclusão em lote possui ${lockEntries.length} NFs com NS e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_NS_LOCKS} para validação cruzada pelas Firestore Rules.`
        );
      }

      const lockIds = Array.from(
        new Set(lockEntries.map((entry) => buildStoredNsLockDocumentId(entry.invoice)))
      );
      const lockRefs = lockIds.map((lockId) =>
        operationalSettingsDocRef(scope, lockId)
      );
      const [lockSnapshots, storedEmpenhoSnapshots] = await Promise.all([
        Promise.all(lockRefs.map((ref) => transaction.get(ref))),
        Promise.all(affectedEmpenhoRefs.map((ref) => transaction.get(ref))),
      ]);

      if (storedEmpenhoSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new NsIntegrityError(
          'empenho_missing',
          'Um ou mais empenhos vinculados não existem mais. A exclusão em lote foi cancelada.'
        );
      }

      const committedEmpenhos = affectedEmpenhos.map((empenho, index) => {
        const stored = storedEmpenhoSnapshots[index].data() as Empenho;
        assertEmpenhoRevision(stored, empenho.revision);
        return buildNextEmpenho(empenho, stored, userId);
      });

      const lockById = new Map(
        lockSnapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists() ? (snapshot.data() as Partial<NsLockDocument>) : null,
        ])
      );

      const empenhoById = new Map(
        committedEmpenhos.map((empenho) => [empenho.id, empenho])
      );

      for (const entry of lockEntries) {
        const lock = lockById.get(buildStoredNsLockDocumentId(entry.invoice));
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
          entry.ug || null,
          entry.ns,
          'stale_lock_owner'
        );
      }

      const existingLockRefs = lockRefs.filter(
        (_, index) => lockSnapshots[index].exists()
      );
      const totalWrites =
        committedEmpenhos.length +
        invoiceRefs.length +
        existingLockRefs.length +
        1;
      if (totalWrites > MAX_INVOICE_LIFECYCLE_WRITES) {
        throw new Error(
          `A exclusão em lote exige ${totalWrites} gravações e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_WRITES}.`
        );
      }

      committedEmpenhos.forEach((empenho) => {
        transaction.set(
          operationalDocRef(scope, 'empenhos', empenho.id),
          { ...empenho, userId }
        );
      });
      invoiceRefs.forEach((ref) => transaction.delete(ref));
      existingLockRefs.forEach((ref) => transaction.delete(ref));

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'invoice.bulk_delete',
          source: 'system',
          entityType: 'invoice_batch',
          entityId: correlationId,
          correlationId,
          before: {
            recordKeys: uniqueRecordKeys,
            invoiceIds: invoices.map((invoice) => invoice.id),
          },
          after: {
            deletedCount: invoiceRefs.length,
          },
          metadata: {
            removedLockCount: existingLockRefs.length,
            updatedEmpenhoCount: committedEmpenhos.length,
          },
        },
        userId
      );

      return { updatedEmpenhos: committedEmpenhos };
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}


export const MAX_SUPPLIER_CNPJ_MIGRATION_INVOICES = 100;
export const MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS = 5;

export interface CommitEmpenhoSupplierCnpjMigrationInput {
  empenhoId: string;
  targetSupplierCnpj: string;
  expectedRevision?: number;
  /**
   * Correções explícitas para NS legadas fora do padrão AAAANS000000.
   * A chave é o recordKey atual da NF. A interface só envia este mapa após
   * confirmação humana do número completo; a UG continua vindo do workspace.
   */
  legacyNsCanonicalOverrides?: Record<string, string>;
}

export interface CommitEmpenhoSupplierCnpjMigrationResult {
  updatedEmpenho: Empenho;
  invoiceMigrations: Array<{
    sourceRecordKey: string;
    targetRecordKey: string;
    invoice: Invoice;
  }>;
  migratedInvoiceCount: number;
  migratedLockCount: number;
  backfilledNsUgCount: number;
  canonicalizedLegacyNsCount: number;
  noOp: boolean;
}

export async function commitEmpenhoSupplierCnpjMigration(
  userId: string,
  input: CommitEmpenhoSupplierCnpjMigrationInput
): Promise<CommitEmpenhoSupplierCnpjMigrationResult> {
  const scope = getCurrentOperationalScope(userId);
  const rawTarget = String(input.targetSupplierCnpj || '').trim();
  const normalizedTarget = normalizeSupplierCnpj(rawTarget);

  if (rawTarget && (!normalizedTarget || !isValidSupplierCnpj(normalizedTarget))) {
    throw new SupplierCnpjMigrationError(
      'invalid_target_cnpj',
      'Informe um CNPJ válido, com formato oficial e dígitos verificadores corretos.'
    );
  }

  const linkedQuery = query(
    operationalCollectionRef(scope, 'invoices'),
    where('empenhoId', '==', input.empenhoId)
  );
  const linkedSnapshot = await getDocs(linkedQuery);

  if (linkedSnapshot.size > MAX_SUPPLIER_CNPJ_MIGRATION_INVOICES) {
    throw new Error(
      `O empenho possui ${linkedSnapshot.size} NFs vinculadas e excede o limite seguro de ${MAX_SUPPLIER_CNPJ_MIGRATION_INVOICES} para migração de CNPJ em uma única transação.`
    );
  }

  const discoveredRecordKeys = linkedSnapshot.docs.map((snapshot) => snapshot.id);
  const path = `${getOperationalDocumentPath(scope, 'empenhos', input.empenhoId)}/supplier-cnpj-migration`;
  const correlationId = createWorkspaceAuditCorrelationId(scope);

  try {
    return await runTransaction(db, async (transaction) => {
      const empenhoRef = operationalDocRef(scope, 'empenhos', input.empenhoId);
      const empenhoSnapshot = await transaction.get(empenhoRef);
      if (!empenhoSnapshot.exists()) {
        throw new NsIntegrityError(
          'empenho_missing',
          `O empenho ${input.empenhoId} não existe mais.`
        );
      }

      const currentEmpenho = empenhoSnapshot.data() as Empenho;
      assertEmpenhoRevision(currentEmpenho, input.expectedRevision);
      const sourceInvoiceRefs = discoveredRecordKeys.map((recordKey) =>
        operationalDocRef(scope, 'invoices', recordKey)
      );
      const sourceSnapshots = await Promise.all(
        sourceInvoiceRefs.map((ref) => transaction.get(ref))
      );

      if (sourceSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new NsIntegrityError(
          'invoice_missing',
          'Uma ou mais Notas Fiscais mudaram durante a preparação da migração de CNPJ.'
        );
      }

      const linkedInvoices = sourceSnapshots.map((snapshot) => {
        const data = snapshot.data() as Invoice;
        if (data.recordKey && data.recordKey !== snapshot.id) {
          throw new NsIntegrityError(
            'invoice_identity_changed',
            `A NF ${data.id} possui recordKey divergente do documento Firestore. Corrija a identidade antes de alterar o CNPJ.`
          );
        }
        if (data.empenhoId !== input.empenhoId) {
          throw new NsIntegrityError(
            'invoice_identity_changed',
            `A NF ${data.id} mudou de empenho durante a preparação da migração de CNPJ.`
          );
        }
        return {
          ...data,
          recordKey: snapshot.id,
        };
      });

      const plan = buildSupplierCnpjMigrationPlan(
        currentEmpenho,
        linkedInvoices,
        rawTarget
      );

      const hasRequestedNsRepair = plan.items.some((item) => {
        const storedNs = normalizeNsNumber(item.invoice.numeroNS);
        const requestedOverride = normalizeNsNumber(
          input.legacyNsCanonicalOverrides?.[item.sourceRecordKey]
        );
        return Boolean(
          requestedOverride ||
          (storedNs && !normalizeNsUg(item.invoice.nsUg))
        );
      });

      if (plan.isNoOp && !hasRequestedNsRepair) {
        return {
          updatedEmpenho: currentEmpenho,
          invoiceMigrations: plan.items.map((item) => ({
            sourceRecordKey: item.sourceRecordKey,
            targetRecordKey: item.targetRecordKey,
            invoice: item.updatedInvoice,
          })),
          migratedInvoiceCount: 0,
          migratedLockCount: 0,
          backfilledNsUgCount: 0,
          canonicalizedLegacyNsCount: 0,
          noOp: true,
        };
      }

      const targetRecordKeys = Array.from(
        new Set(
          plan.items
            .filter((item) => item.targetRecordKey !== item.sourceRecordKey)
            .map((item) => item.targetRecordKey)
        )
      );
      const targetSnapshots = await Promise.all(
        targetRecordKeys.map((recordKey) =>
          transaction.get(operationalDocRef(scope, 'invoices', recordKey))
        )
      );
      const occupiedTargetKeys = new Set(
        targetSnapshots
          .filter((snapshot) => snapshot.exists())
          .map((snapshot) => snapshot.id)
      );
      if (occupiedTargetKeys.size > 0) {
        throw new SupplierCnpjMigrationError(
          'duplicate_target_identity',
          `A migração foi bloqueada porque já existe NF com a nova identidade: ${Array.from(occupiedTargetKeys).join(', ')}.`
        );
      }

      const scopeUg = normalizeNsUg(scope.ug);
      let backfilledNsUgCount = 0;
      let canonicalizedLegacyNsCount = 0;

      const nsEntries = plan.items
        .map((item) => {
          const storedNs = normalizeNsNumber(item.invoice.numeroNS);
          if (!storedNs) {
            return {
              item,
              ns: '',
              ug: '',
              sourceUg: '',
              sourceLockId: '',
              targetLockId: '',
            };
          }

          const requestedOverride = normalizeNsNumber(
            input.legacyNsCanonicalOverrides?.[item.sourceRecordKey]
          );
          const storedNsIsCanonical = isValidNsNumber(storedNs);

          if (requestedOverride && storedNsIsCanonical && requestedOverride !== storedNs) {
            throw new NsIntegrityError(
              'stale_invoice_ns',
              `A NF ${item.invoice.id} já possui uma NS canônica (${storedNs}) e não pode ser substituída durante a migração de CNPJ.`
            );
          }

          const resolvedNs = requestedOverride || storedNs;
          if (!isValidNsNumber(resolvedNs)) {
            throw new NsIntegrityError(
              'invalid_ns',
              `A NF ${item.invoice.id} possui a NS legada "${storedNs}" fora do padrão AAAANS000000. Confirme o número completo da NS para continuar a migração do CNPJ.`
            );
          }

          const sourceUg = normalizeNsUg(item.invoice.nsUg);
          const resolvedUg = sourceUg || scopeUg;
          if (!isValidNsUg(resolvedUg)) {
            throw new NsIntegrityError(
              'invalid_ug',
              `A NF ${item.invoice.id} possui NS sem UG e a UG da unidade autenticada não está configurada. A migração do CNPJ foi bloqueada.`
            );
          }

          if (!sourceUg) {
            backfilledNsUgCount += 1;
          }
          if (requestedOverride && requestedOverride !== storedNs) {
            canonicalizedLegacyNsCount += 1;
          }

          item.updatedInvoice = {
            ...item.updatedInvoice,
            numeroNS: resolvedNs,
            nsUg: resolvedUg,
          };

          return {
            item,
            ns: resolvedNs,
            ug: resolvedUg,
            sourceUg,
            sourceLockId: buildStoredNsLockDocumentId(item.invoice),
            targetLockId: buildNsLockDocumentId(resolvedUg, resolvedNs),
          };
        })
        .filter((entry) => entry.ns);

      if (nsEntries.length > MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS) {
        throw new Error(
          `A migração possui ${nsEntries.length} NFs com NS e excede o limite seguro de ${MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS} para validação cruzada pelas Firestore Rules.`
        );
      }

      const seenNsIdentities = new Set<string>();
      for (const entry of nsEntries) {
        const identityKey = `${entry.ug}|${entry.ns}`;
        if (seenNsIdentities.has(identityKey)) {
          throw new NsIntegrityError(
            'ns_reused_in_scope',
            `A identidade UG ${entry.ug} + NS ${entry.ns} aparece em mais de uma NF vinculada ao empenho. Corrija a inconsistência antes de alterar o CNPJ.`
          );
        }
        seenNsIdentities.add(identityKey);
      }

      const lockIds = Array.from(
        new Set(
          nsEntries
            .flatMap((entry) => [entry.sourceLockId, entry.targetLockId])
            .filter(Boolean)
        )
      );
      const lockSnapshots = await Promise.all(
        lockIds.map((lockId) =>
          transaction.get(operationalSettingsDocRef(scope, lockId))
        )
      );
      const lockById = new Map(
        lockSnapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists() ? (snapshot.data() as Partial<NsLockDocument>) : null,
        ])
      );

      for (const entry of nsEntries) {
        const sourceLock = entry.sourceLockId
          ? lockById.get(entry.sourceLockId)
          : null;
        const targetLock = entry.targetLockId
          ? lockById.get(entry.targetLockId)
          : null;

        const sourceSupplierCnpj =
          normalizeSupplierCnpj(entry.item.invoice.supplierCnpj) ||
          plan.sourceSupplierCnpj ||
          plan.targetSupplierCnpj;

        if (!sourceSupplierCnpj) {
          throw new NsIntegrityError(
            'invalid_supplier_cnpj',
            `A NF ${entry.item.invoice.id} não possui CNPJ suficiente para validar o lock da NS.`
          );
        }

        if (sourceLock) {
          const lockSupplierCnpj = normalizeSupplierCnpj(sourceLock.supplierCnpj);
          if (
            (sourceLock.invoiceId && sourceLock.invoiceId !== entry.item.invoice.id) ||
            (sourceLock.empenhoId && sourceLock.empenhoId !== input.empenhoId) ||
            (lockSupplierCnpj && lockSupplierCnpj !== sourceSupplierCnpj)
          ) {
            throw new NsIntegrityError(
              'stale_lock_owner',
              `O lock da NS ${entry.ns} possui metadados divergentes da NF ${entry.item.invoice.id}. Corrija a inconsistência antes de alterar o CNPJ.`
            );
          }

          assertNsLockOwnership(
            sourceLock,
            buildLifecycleMutation(
              entry.item.invoice,
              entry.item.sourceRecordKey,
              sourceSupplierCnpj,
              normalizeNsNumber(entry.item.invoice.numeroNS),
              'migration'
            ),
            entry.sourceUg || null,
            normalizeNsNumber(entry.item.invoice.numeroNS),
            'stale_lock_owner'
          );
        }

        if (
          targetLock &&
          entry.targetLockId !== entry.sourceLockId
        ) {
          const targetLockSupplierCnpj = normalizeSupplierCnpj(targetLock.supplierCnpj);
          if (
            targetLock.invoiceRecordKey !== entry.item.sourceRecordKey ||
            (targetLock.invoiceId && targetLock.invoiceId !== entry.item.invoice.id) ||
            (targetLock.empenhoId && targetLock.empenhoId !== input.empenhoId) ||
            (targetLockSupplierCnpj && targetLockSupplierCnpj !== sourceSupplierCnpj)
          ) {
            throw new NsIntegrityError(
              'ns_lock_conflict',
              `A identidade UG ${entry.ug} + NS ${entry.ns} já está reservada para outra NF neste workspace.`
            );
          }
        }
      }

      const lockWriteCount = nsEntries.reduce((count, entry) => {
        const sourceLockExists = Boolean(
          entry.sourceLockId && lockById.get(entry.sourceLockId)
        );
        const releasesLegacyLock =
          sourceLockExists &&
          entry.sourceLockId !== entry.targetLockId;
        return count + 1 + (releasesLegacyLock ? 1 : 0);
      }, 0);
      const invoiceWriteCount = plan.items.reduce(
        (count, item) =>
          count + 1 + (item.sourceRecordKey !== item.targetRecordKey ? 1 : 0),
        0
      );
      const totalWrites = 1 + invoiceWriteCount + lockWriteCount + 1;
      if (totalWrites > MAX_INVOICE_LIFECYCLE_WRITES) {
        throw new Error(
          `A migração exige ${totalWrites} gravações e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_WRITES}.`
        );
      }

      const updatedEmpenho = buildNextEmpenho(
        plan.updatedEmpenho,
        currentEmpenho,
        userId
      );
      transaction.set(
        empenhoRef,
        { ...updatedEmpenho, userId }
      );

      for (const item of plan.items) {
        transaction.set(
          operationalDocRef(scope, 'invoices', item.targetRecordKey),
          {
            ...item.updatedInvoice,
            recordKey: item.targetRecordKey,
            userId,
          }
        );

        if (item.sourceRecordKey !== item.targetRecordKey) {
          transaction.delete(
            operationalDocRef(scope, 'invoices', item.sourceRecordKey)
          );
        }
      }

      const now = new Date().toISOString();
      let migratedLockCount = 0;
      for (const entry of nsEntries) {
        const sourceLock = entry.sourceLockId
          ? lockById.get(entry.sourceLockId)
          : null;
        const targetLock = entry.targetLockId
          ? lockById.get(entry.targetLockId)
          : null;

        const targetMutation = buildLifecycleMutation(
          entry.item.updatedInvoice,
          entry.item.targetRecordKey,
          plan.targetSupplierCnpj,
          entry.ns,
          'migration'
        );
        const nextLock = buildNsLockDocument({
          workspaceId: scope.workspaceId,
          mutation: targetMutation,
          userId,
          createdAt: targetLock?.createdAt || sourceLock?.createdAt || now,
          updatedAt: now,
        });

        transaction.set(
          operationalSettingsDocRef(scope, entry.targetLockId),
          nextLock,
          { merge: true }
        );

        if (
          sourceLock &&
          entry.sourceLockId &&
          entry.sourceLockId !== entry.targetLockId
        ) {
          transaction.delete(
            operationalSettingsDocRef(scope, entry.sourceLockId)
          );
        }

        migratedLockCount += 1;
      }

      const migratedInvoiceCount = plan.items.filter(
        (item) =>
          item.sourceRecordKey !== item.targetRecordKey ||
          normalizeSupplierCnpj(item.invoice.supplierCnpj) !==
            plan.targetSupplierCnpj
      ).length;

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'supplier_cnpj.migrate',
          source: 'migration',
          entityType: 'empenho',
          entityId: input.empenhoId,
          correlationId,
          before: {
            supplierCnpj: plan.sourceSupplierCnpj || null,
          },
          after: {
            supplierCnpj: plan.targetSupplierCnpj || null,
          },
          metadata: {
            migratedInvoiceCount,
            migratedLockCount,
            backfilledNsUgCount,
            canonicalizedLegacyNsCount,
            sourceRecordKeys: plan.items.map((item) => item.sourceRecordKey),
            targetRecordKeys: plan.items.map((item) => item.targetRecordKey),
          },
        },
        userId
      );

      return {
        updatedEmpenho,
        invoiceMigrations: plan.items.map((item) => ({
          sourceRecordKey: item.sourceRecordKey,
          targetRecordKey: item.targetRecordKey,
          invoice: item.updatedInvoice,
        })),
        migratedInvoiceCount,
        migratedLockCount,
        backfilledNsUgCount,
        canonicalizedLegacyNsCount,
        noOp: false,
      };
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
