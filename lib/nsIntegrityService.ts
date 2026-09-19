import { deleteField, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { Alert, Empenho, Invoice } from './types';
import { getInvoiceRecordKey, normalizeSupplierCnpj } from './invoiceIdentity';
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
  buildNsLockDocument,
  buildNsLockDocumentId,
  normalizeNsNumber,
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
      const storedTargetCnpj = normalizeSupplierCnpj(storedTargetEmpenho.supplierCnpj);
      const expectedTargetCnpj = normalizeSupplierCnpj(input.targetEmpenho.supplierCnpj);
      const invoiceCnpj = normalizeSupplierCnpj(input.invoice.supplierCnpj);

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
        targetEmpenhoRef,
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

      if (lockEntries.length > MAX_INVOICE_LIFECYCLE_NS_LOCKS) {
        throw new Error(
          `A exclusão em lote possui ${lockEntries.length} NFs com NS e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_NS_LOCKS} para validação cruzada pelas Firestore Rules.`
        );
      }

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


export const MAX_SUPPLIER_CNPJ_MIGRATION_INVOICES = 100;
export const MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS = 5;

export interface CommitEmpenhoSupplierCnpjMigrationInput {
  empenhoId: string;
  targetSupplierCnpj: string;
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
  noOp: boolean;
}

export async function commitEmpenhoSupplierCnpjMigration(
  userId: string,
  input: CommitEmpenhoSupplierCnpjMigrationInput
): Promise<CommitEmpenhoSupplierCnpjMigrationResult> {
  const scope = getCurrentOperationalScope(userId);
  const rawTarget = String(input.targetSupplierCnpj || '').trim();
  const normalizedTarget = normalizeSupplierCnpj(rawTarget);

  if (rawTarget && !normalizedTarget) {
    throw new SupplierCnpjMigrationError(
      'invalid_target_cnpj',
      'Informe um CNPJ válido com 14 dígitos.'
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

      if (plan.isNoOp) {
        return {
          updatedEmpenho: plan.updatedEmpenho,
          invoiceMigrations: plan.items.map((item) => ({
            sourceRecordKey: item.sourceRecordKey,
            targetRecordKey: item.targetRecordKey,
            invoice: item.updatedInvoice,
          })),
          migratedInvoiceCount: 0,
          migratedLockCount: 0,
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

      const nsEntries = plan.items
        .map((item) => ({
          item,
          ns: normalizeNsNumber(item.invoice.numeroNS),
        }))
        .filter((entry) => entry.ns);

      if (nsEntries.length > MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS) {
        throw new Error(
          `A migração possui ${nsEntries.length} NFs com NS e excede o limite seguro de ${MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS} para validação cruzada pelas Firestore Rules.`
        );
      }

      const seenNs = new Set<string>();
      for (const entry of nsEntries) {
        if (seenNs.has(entry.ns)) {
          throw new NsIntegrityError(
            'ns_reused_in_scope',
            `A NS ${entry.ns} aparece em mais de uma NF vinculada ao empenho. Corrija a inconsistência antes de alterar o CNPJ.`
          );
        }
        seenNs.add(entry.ns);
      }

      const lockIds = Array.from(
        new Set(nsEntries.map((entry) => buildNsLockDocumentId(entry.ns)))
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
        const lock = lockById.get(buildNsLockDocumentId(entry.ns));
        if (!lock) continue;

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

        const lockSupplierCnpj = normalizeSupplierCnpj(lock.supplierCnpj);
        if (
          (lock.invoiceId && lock.invoiceId !== entry.item.invoice.id) ||
          (lock.empenhoId && lock.empenhoId !== input.empenhoId) ||
          (lockSupplierCnpj && lockSupplierCnpj !== sourceSupplierCnpj)
        ) {
          throw new NsIntegrityError(
            'stale_lock_owner',
            `O lock da NS ${entry.ns} possui metadados divergentes da NF ${entry.item.invoice.id}. Corrija a inconsistência antes de alterar o CNPJ.`
          );
        }

        assertNsLockOwnership(
          lock,
          buildLifecycleMutation(
            entry.item.invoice,
            entry.item.sourceRecordKey,
            sourceSupplierCnpj,
            entry.ns,
            'migration'
          ),
          entry.ns,
          'stale_lock_owner'
        );
      }

      const lockWriteCount = nsEntries.length;
      const invoiceWriteCount = plan.items.reduce(
        (count, item) =>
          count + 1 + (item.sourceRecordKey !== item.targetRecordKey ? 1 : 0),
        0
      );
      const totalWrites = 1 + invoiceWriteCount + lockWriteCount;
      if (totalWrites > MAX_INVOICE_LIFECYCLE_WRITES) {
        throw new Error(
          `A migração exige ${totalWrites} gravações e excede o limite seguro de ${MAX_INVOICE_LIFECYCLE_WRITES}.`
        );
      }

      const updatedEmpenho = plan.updatedEmpenho;
      if (plan.targetSupplierCnpj) {
        transaction.set(
          empenhoRef,
          {
            supplierCnpj: plan.targetSupplierCnpj,
            userId,
          },
          { merge: true }
        );
      } else {
        transaction.set(
          empenhoRef,
          {
            supplierCnpj: deleteField(),
            userId,
          },
          { merge: true }
        );
      }

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
        const lockId = buildNsLockDocumentId(entry.ns);
        const existingLock = lockById.get(lockId);

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
          createdAt: existingLock?.createdAt || now,
          updatedAt: now,
        });
        transaction.set(
          operationalSettingsDocRef(scope, lockId),
          nextLock,
          { merge: true }
        );
        migratedLockCount += 1;
      }

      return {
        updatedEmpenho,
        invoiceMigrations: plan.items.map((item) => ({
          sourceRecordKey: item.sourceRecordKey,
          targetRecordKey: item.targetRecordKey,
          invoice: item.updatedInvoice,
        })),
        migratedInvoiceCount: plan.items.filter(
          (item) =>
            item.sourceRecordKey !== item.targetRecordKey ||
            normalizeSupplierCnpj(item.invoice.supplierCnpj) !==
              plan.targetSupplierCnpj
        ).length,
        migratedLockCount,
        noOp: false,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
