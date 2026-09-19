import type { Empenho, Invoice } from './types';
import {
  getInvoiceRecordKey,
  normalizeSupplierCnpj,
} from './invoiceIdentity';
import {
  isValidSagNsNumber,
  normalizeSagNsNumber,
} from './sagNsContract';
import type { SagNsApplicationPreview } from './sagNsApplicationPreview';

export function buildSagNsLockDocumentId(value?: string | null): string {
  const normalizedNs = normalizeSagNsNumber(value);
  return normalizedNs ? `sagNsLock_${encodeURIComponent(normalizedNs)}` : '';
}

export interface SagNsPersistenceChange {
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  expectedCurrentNs: string | null;
  proposedNs: string;
}

export interface SagNsPersistenceInvoiceDocument {
  recordKey: string;
  invoice: Invoice;
}

export interface SagNsPersistenceValidationInput {
  supplierCnpj: string;
  changes: SagNsPersistenceChange[];
  targetInvoiceDocuments: SagNsPersistenceInvoiceDocument[];
  scopedInvoiceDocuments: SagNsPersistenceInvoiceDocument[];
  empenhos: Empenho[];
}

export interface SagNsPersistenceValidationResult {
  writes: SagNsPersistenceChange[];
  alreadyApplied: SagNsPersistenceChange[];
}

export type SagNsPersistencePlanErrorCode =
  | 'invalid_supplier_cnpj'
  | 'empty_change_set'
  | 'duplicate_invoice_target'
  | 'duplicate_ns_in_batch'
  | 'invalid_ns'
  | 'invoice_missing'
  | 'invoice_identity_changed'
  | 'empenho_missing'
  | 'supplier_scope_changed'
  | 'invoice_supplier_conflict'
  | 'stale_invoice_ns'
  | 'ns_reused_in_scope'
  | 'ns_lock_conflict'
  | 'stale_lock_owner';

export class SagNsPersistencePlanError extends Error {
  readonly code: SagNsPersistencePlanErrorCode;

  constructor(code: SagNsPersistencePlanErrorCode, message: string) {
    super(message);
    this.name = 'SagNsPersistencePlanError';
    this.code = code;
  }
}

export function buildSagNsPersistenceChanges(
  preview: SagNsApplicationPreview
): SagNsPersistenceChange[] {
  return preview.items
    .filter((item) => item.decision === 'change')
    .map((item) => {
      if (
        !item.invoiceRecordKey ||
        !item.invoiceId ||
        !item.empenhoId ||
        !item.proposedNs
      ) {
        throw new SagNsPersistencePlanError(
          'invoice_identity_changed',
          'A prévia contém uma alteração sem identidade completa de NF/NE.'
        );
      }

      const proposedNs = normalizeSagNsNumber(item.proposedNs);
      if (!isValidSagNsNumber(proposedNs)) {
        throw new SagNsPersistencePlanError(
          'invalid_ns',
          `A NS proposta para a NF ${item.invoiceId} é inválida.`
        );
      }

      return {
        invoiceRecordKey: item.invoiceRecordKey,
        invoiceId: item.invoiceId,
        empenhoId: item.empenhoId,
        expectedCurrentNs: item.currentNs
          ? normalizeSagNsNumber(item.currentNs)
          : null,
        proposedNs,
      };
    });
}

export function validateSagNsPersistenceSnapshot(
  input: SagNsPersistenceValidationInput
): SagNsPersistenceValidationResult {
  const supplierCnpj = normalizeSupplierCnpj(input.supplierCnpj);
  if (!supplierCnpj) {
    throw new SagNsPersistencePlanError(
      'invalid_supplier_cnpj',
      'CNPJ do fornecedor inválido para persistência SAG.'
    );
  }

  if (input.changes.length === 0) {
    throw new SagNsPersistencePlanError(
      'empty_change_set',
      'Não existem alterações de NS elegíveis para persistência.'
    );
  }

  const targetKeys = new Set<string>();
  const batchNs = new Set<string>();

  for (const change of input.changes) {
    if (targetKeys.has(change.invoiceRecordKey)) {
      throw new SagNsPersistencePlanError(
        'duplicate_invoice_target',
        `A NF ${change.invoiceId} aparece mais de uma vez no mesmo lote.`
      );
    }
    targetKeys.add(change.invoiceRecordKey);

    const proposedNs = normalizeSagNsNumber(change.proposedNs);
    if (!isValidSagNsNumber(proposedNs)) {
      throw new SagNsPersistencePlanError(
        'invalid_ns',
        `A NS proposta para a NF ${change.invoiceId} é inválida.`
      );
    }
    if (batchNs.has(proposedNs)) {
      throw new SagNsPersistencePlanError(
        'duplicate_ns_in_batch',
        `A NS ${proposedNs} foi proposta para mais de uma NF no mesmo lote.`
      );
    }
    batchNs.add(proposedNs);
  }

  const targetByKey = new Map(
    input.targetInvoiceDocuments.map((document) => [document.recordKey, document])
  );
  const empenhoById = new Map(input.empenhos.map((empenho) => [empenho.id, empenho]));

  const nsOwners = new Map<string, string[]>();
  for (const document of input.scopedInvoiceDocuments) {
    const ns = normalizeSagNsNumber(document.invoice.numeroNS);
    if (!ns) continue;
    const owners = nsOwners.get(ns) || [];
    owners.push(document.recordKey);
    nsOwners.set(ns, owners);
  }

  const writes: SagNsPersistenceChange[] = [];
  const alreadyApplied: SagNsPersistenceChange[] = [];

  for (const change of input.changes) {
    const document = targetByKey.get(change.invoiceRecordKey);
    if (!document) {
      throw new SagNsPersistencePlanError(
        'invoice_missing',
        `A NF ${change.invoiceId} não existe mais no Firestore.`
      );
    }

    const storedInvoice = document.invoice;
    const storedRecordKey = getInvoiceRecordKey({
      id: storedInvoice.id,
      recordKey: storedInvoice.recordKey || document.recordKey,
    });
    if (
      storedRecordKey !== change.invoiceRecordKey ||
      storedInvoice.id !== change.invoiceId ||
      storedInvoice.empenhoId !== change.empenhoId
    ) {
      throw new SagNsPersistencePlanError(
        'invoice_identity_changed',
        `A identidade da NF ${change.invoiceId} mudou desde a prévia.`
      );
    }

    const empenho = empenhoById.get(change.empenhoId);
    if (!empenho) {
      throw new SagNsPersistencePlanError(
        'empenho_missing',
        `O empenho ${change.empenhoId} não existe mais.`
      );
    }

    if (normalizeSupplierCnpj(empenho.supplierCnpj) !== supplierCnpj) {
      throw new SagNsPersistencePlanError(
        'supplier_scope_changed',
        `O empenho ${change.empenhoId} não pertence mais ao CNPJ selecionado.`
      );
    }

    const invoiceCnpj = normalizeSupplierCnpj(storedInvoice.supplierCnpj);
    if (invoiceCnpj && invoiceCnpj !== supplierCnpj) {
      throw new SagNsPersistencePlanError(
        'invoice_supplier_conflict',
        `A NF ${change.invoiceId} possui CNPJ divergente do fornecedor selecionado.`
      );
    }

    const proposedNs = normalizeSagNsNumber(change.proposedNs);
    const currentNs = normalizeSagNsNumber(storedInvoice.numeroNS);
    const expectedCurrentNs = normalizeSagNsNumber(change.expectedCurrentNs);

    const otherOwners = (nsOwners.get(proposedNs) || []).filter(
      (recordKey) => recordKey !== change.invoiceRecordKey
    );
    if (otherOwners.length > 0) {
      throw new SagNsPersistencePlanError(
        'ns_reused_in_scope',
        `A NS ${proposedNs} já está vinculada a outra NF do mesmo fornecedor.`
      );
    }

    if (currentNs === proposedNs) {
      alreadyApplied.push(change);
      continue;
    }

    if (currentNs !== expectedCurrentNs) {
      throw new SagNsPersistencePlanError(
        'stale_invoice_ns',
        `A NF ${change.invoiceId} teve sua NS alterada desde a prévia. O lote foi cancelado.`
      );
    }

    writes.push(change);
  }

  return { writes, alreadyApplied };
}
