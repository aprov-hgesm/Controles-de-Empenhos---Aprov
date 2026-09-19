import type { Empenho, Invoice } from './types';
import {
  buildNsLockDocumentId,
  NsIntegrityError,
  normalizeNsNumber,
  validateNsIntegritySnapshot,
  type NsIntegrityErrorCode,
  type NsIntegrityMutation,
} from './nsIntegrity';
import {
  isValidSagNsNumber,
  normalizeSagNsNumber,
} from './sagNsContract';
import type { SagNsApplicationPreview } from './sagNsApplicationPreview';

export function buildSagNsLockDocumentId(value?: string | null): string {
  return buildNsLockDocumentId(value);
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

export type SagNsPersistencePlanErrorCode = NsIntegrityErrorCode;

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
  const mutations: NsIntegrityMutation[] = input.changes.map((change) => ({
    invoiceRecordKey: change.invoiceRecordKey,
    invoiceId: change.invoiceId,
    empenhoId: change.empenhoId,
    supplierCnpj: input.supplierCnpj,
    expectedCurrentNs: change.expectedCurrentNs,
    proposedNs: change.proposedNs,
    source: 'sag',
  }));

  try {
    const result = validateNsIntegritySnapshot({
      mutations,
      targetInvoiceDocuments: input.targetInvoiceDocuments,
      knownOwnerInvoiceDocuments: input.scopedInvoiceDocuments,
      empenhos: input.empenhos,
    });

    const writeKeys = new Set(result.writes.map((mutation) => mutation.invoiceRecordKey));
    const noOpKeys = new Set(result.noOps.map((mutation) => mutation.invoiceRecordKey));

    return {
      writes: input.changes.filter((change) => writeKeys.has(change.invoiceRecordKey)),
      alreadyApplied: input.changes.filter((change) => noOpKeys.has(change.invoiceRecordKey)),
    };
  } catch (error) {
    if (error instanceof NsIntegrityError) {
      throw new SagNsPersistencePlanError(error.code, error.message);
    }
    throw error;
  }
}

export function normalizeSagPersistenceExpectedNs(value?: string | null): string | null {
  const normalized = normalizeNsNumber(value);
  return normalized || null;
}
