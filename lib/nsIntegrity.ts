import type { Empenho, Invoice } from './types';
import { getInvoiceRecordKey, isValidSupplierCnpj, normalizeSupplierCnpj } from './invoiceIdentity';

export const NS_LOCK_DOCUMENT_PREFIX = 'sagNsLock_' as const;
export const NS_LOCK_DOCUMENT_TYPE = 'sag-ns-lock' as const;

export type NsIntegrityMutationSource = 'sag' | 'manual' | 'migration' | 'system';

export interface NsIntegrityMutation {
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  supplierCnpj: string;
  expectedCurrentUg: string | null;
  expectedCurrentNs: string | null;
  proposedUg: string | null;
  proposedNs: string | null;
  source: NsIntegrityMutationSource;
}

export interface NsIntegrityInvoiceDocument {
  recordKey: string;
  invoice: Invoice;
}

export interface NsIntegritySnapshotInput {
  mutations: NsIntegrityMutation[];
  targetInvoiceDocuments: NsIntegrityInvoiceDocument[];
  knownOwnerInvoiceDocuments: NsIntegrityInvoiceDocument[];
  empenhos: Empenho[];
}

export interface NsIntegritySnapshotResult {
  writes: NsIntegrityMutation[];
  noOps: NsIntegrityMutation[];
}

export interface NsLockDocument {
  id: string;
  type: typeof NS_LOCK_DOCUMENT_TYPE;
  workspaceId: string;
  ug: string;
  numeroNS: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  supplierCnpj: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type NsIntegrityErrorCode =
  | 'invalid_supplier_cnpj'
  | 'invalid_ug'
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

export class NsIntegrityError extends Error {
  readonly code: NsIntegrityErrorCode;

  constructor(code: NsIntegrityErrorCode, message: string) {
    super(message);
    this.name = 'NsIntegrityError';
    this.code = code;
  }
}

export function normalizeNsNumber(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isValidNsNumber(value?: string | number | null): boolean {
  return /^\d{4}NS\d{6}$/.test(normalizeNsNumber(value));
}

export function normalizeNsUg(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\D/g, '');
}

export function isValidNsUg(value?: string | number | null): boolean {
  return /^\d{6}$/.test(normalizeNsUg(value));
}

export function buildNsIdentityKey(
  ug?: string | number | null,
  numeroNS?: string | number | null
): string {
  const normalizedUg = normalizeNsUg(ug);
  const normalizedNs = normalizeNsNumber(numeroNS);
  return isValidNsUg(normalizedUg) && isValidNsNumber(normalizedNs)
    ? `${normalizedUg}|${normalizedNs}`
    : '';
}

export function buildNsLockDocumentId(
  ug?: string | number | null,
  numeroNS?: string | number | null
): string {
  const identity = buildNsIdentityKey(ug, numeroNS);
  if (!identity) return '';
  const [normalizedUg, normalizedNs] = identity.split('|');
  return `${NS_LOCK_DOCUMENT_PREFIX}${normalizedUg}_${encodeURIComponent(normalizedNs)}`;
}

export function buildLegacyNsLockDocumentId(value?: string | number | null): string {
  const normalizedNs = normalizeNsNumber(value);
  return isValidNsNumber(normalizedNs)
    ? `${NS_LOCK_DOCUMENT_PREFIX}${encodeURIComponent(normalizedNs)}`
    : '';
}

export function getInvoiceNsIdentity(invoice: Pick<Invoice, 'numeroNS' | 'nsUg'>): {
  ug: string;
  numeroNS: string;
  canonical: boolean;
} {
  const numeroNS = normalizeNsNumber(invoice.numeroNS);
  const ug = normalizeNsUg(invoice.nsUg);
  return {
    ug,
    numeroNS,
    canonical: Boolean(numeroNS && isValidNsNumber(numeroNS) && isValidNsUg(ug)),
  };
}

export function buildNsLockDocument(input: {
  workspaceId: string;
  mutation: NsIntegrityMutation;
  userId: string;
  createdAt: string;
  updatedAt: string;
}): NsLockDocument {
  const numeroNS = normalizeNsNumber(input.mutation.proposedNs);
  if (!isValidNsNumber(numeroNS)) {
    throw new NsIntegrityError(
      'invalid_ns',
      `A NS proposta para a NF ${input.mutation.invoiceId} é inválida.`
    );
  }

  const ug = normalizeNsUg(input.mutation.proposedUg);
  if (!isValidNsUg(ug)) {
    throw new NsIntegrityError(
      'invalid_ug',
      `A UG emitente da NS ${numeroNS} deve possuir 6 dígitos.`
    );
  }

  const supplierCnpj = normalizeSupplierCnpj(input.mutation.supplierCnpj);
  if (!supplierCnpj || !isValidSupplierCnpj(supplierCnpj)) {
    throw new NsIntegrityError(
      'invalid_supplier_cnpj',
      `O CNPJ da NF ${input.mutation.invoiceId} possui formato ou dígitos verificadores inválidos para reserva da NS.`
    );
  }

  const id = buildNsLockDocumentId(ug, numeroNS);
  return {
    id,
    type: NS_LOCK_DOCUMENT_TYPE,
    workspaceId: input.workspaceId,
    ug,
    numeroNS,
    invoiceRecordKey: input.mutation.invoiceRecordKey,
    invoiceId: input.mutation.invoiceId,
    empenhoId: input.mutation.empenhoId,
    supplierCnpj,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    updatedBy: input.userId,
  };
}

export function assertNsLockOwnership(
  lock: Partial<NsLockDocument>,
  mutation: NsIntegrityMutation,
  expectedUg: string | null,
  expectedNs: string,
  conflictCode: 'ns_lock_conflict' | 'stale_lock_owner'
): void {
  const normalizedExpectedNs = normalizeNsNumber(expectedNs);
  const normalizedExpectedUg = normalizeNsUg(expectedUg);
  const lockNs = normalizeNsNumber(lock.numeroNS);
  const lockUg = normalizeNsUg(lock.ug);

  if (
    !lock.invoiceRecordKey ||
    !lockNs ||
    lockNs !== normalizedExpectedNs ||
    (normalizedExpectedUg && lockUg !== normalizedExpectedUg)
  ) {
    throw new NsIntegrityError(
      'stale_lock_owner',
      `O lock da NS ${normalizedExpectedNs || expectedNs}${normalizedExpectedUg ? ` / UG ${normalizedExpectedUg}` : ''} está inconsistente. Nenhuma alteração foi aplicada.`
    );
  }

  if (lock.invoiceRecordKey !== mutation.invoiceRecordKey) {
    throw new NsIntegrityError(
      conflictCode,
      conflictCode === 'ns_lock_conflict'
        ? `A identidade UG ${normalizedExpectedUg || 'legada'} + NS ${normalizedExpectedNs} já está reservada para outra NF neste workspace.`
        : `O lock atual da NS ${normalizedExpectedNs} pertence a outra NF. Nenhuma alteração foi aplicada.`
    );
  }
}

export function validateNsIntegritySnapshot(
  input: NsIntegritySnapshotInput
): NsIntegritySnapshotResult {
  if (input.mutations.length === 0) {
    throw new NsIntegrityError(
      'empty_change_set',
      'Não existem alterações de NS elegíveis para persistência.'
    );
  }

  const targetKeys = new Set<string>();
  const proposedIdentitiesInBatch = new Set<string>();

  for (const mutation of input.mutations) {
    if (targetKeys.has(mutation.invoiceRecordKey)) {
      throw new NsIntegrityError(
        'duplicate_invoice_target',
        `A NF ${mutation.invoiceId} aparece mais de uma vez no mesmo lote.`
      );
    }
    targetKeys.add(mutation.invoiceRecordKey);

    if (!isValidSupplierCnpj(mutation.supplierCnpj)) {
      throw new NsIntegrityError(
        'invalid_supplier_cnpj',
        `O CNPJ da NF ${mutation.invoiceId} possui formato ou dígitos verificadores inválidos para persistência de NS.`
      );
    }

    if (mutation.proposedNs !== null) {
      const proposedNs = normalizeNsNumber(mutation.proposedNs);
      const proposedUg = normalizeNsUg(mutation.proposedUg);
      if (!isValidNsNumber(proposedNs)) {
        throw new NsIntegrityError(
          'invalid_ns',
          `A NS proposta para a NF ${mutation.invoiceId} é inválida.`
        );
      }
      if (!isValidNsUg(proposedUg)) {
        throw new NsIntegrityError(
          'invalid_ug',
          `A UG emitente da NS ${proposedNs} deve possuir 6 dígitos.`
        );
      }

      const proposedIdentity = buildNsIdentityKey(proposedUg, proposedNs);
      if (proposedIdentitiesInBatch.has(proposedIdentity)) {
        throw new NsIntegrityError(
          'duplicate_ns_in_batch',
          `A identidade UG ${proposedUg} + NS ${proposedNs} foi proposta para mais de uma NF no mesmo lote.`
        );
      }
      proposedIdentitiesInBatch.add(proposedIdentity);
    } else if (mutation.proposedUg !== null && normalizeNsUg(mutation.proposedUg)) {
      throw new NsIntegrityError(
        'invalid_ug',
        `A NF ${mutation.invoiceId} não pode manter UG de NS sem numeroNS.`
      );
    }
  }

  const targetByKey = new Map(
    input.targetInvoiceDocuments.map((document) => [document.recordKey, document])
  );
  const empenhoById = new Map(input.empenhos.map((empenho) => [empenho.id, empenho]));

  const canonicalOwners = new Map<string, string[]>();
  const legacyOwnersByNs = new Map<string, string[]>();
  for (const document of input.knownOwnerInvoiceDocuments) {
    const { ug, numeroNS, canonical } = getInvoiceNsIdentity(document.invoice);
    if (!numeroNS) continue;
    if (canonical) {
      const key = buildNsIdentityKey(ug, numeroNS);
      const owners = canonicalOwners.get(key) || [];
      owners.push(document.recordKey);
      canonicalOwners.set(key, owners);
    } else {
      const owners = legacyOwnersByNs.get(numeroNS) || [];
      owners.push(document.recordKey);
      legacyOwnersByNs.set(numeroNS, owners);
    }
  }

  const writes: NsIntegrityMutation[] = [];
  const noOps: NsIntegrityMutation[] = [];

  for (const mutation of input.mutations) {
    const document = targetByKey.get(mutation.invoiceRecordKey);
    if (!document) {
      throw new NsIntegrityError(
        'invoice_missing',
        `A NF ${mutation.invoiceId} não existe mais no Firestore.`
      );
    }

    const storedInvoice = document.invoice;
    const storedRecordKey = getInvoiceRecordKey({
      id: storedInvoice.id,
      recordKey: storedInvoice.recordKey || document.recordKey,
    });

    if (
      storedRecordKey !== mutation.invoiceRecordKey ||
      storedInvoice.id !== mutation.invoiceId ||
      storedInvoice.empenhoId !== mutation.empenhoId
    ) {
      throw new NsIntegrityError(
        'invoice_identity_changed',
        `A identidade da NF ${mutation.invoiceId} mudou desde a preparação da operação.`
      );
    }

    const empenho = empenhoById.get(mutation.empenhoId);
    if (!empenho) {
      throw new NsIntegrityError(
        'empenho_missing',
        `O empenho ${mutation.empenhoId} não existe mais.`
      );
    }

    const supplierCnpj = normalizeSupplierCnpj(mutation.supplierCnpj);
    if (normalizeSupplierCnpj(empenho.supplierCnpj) !== supplierCnpj) {
      throw new NsIntegrityError(
        'supplier_scope_changed',
        `O empenho ${mutation.empenhoId} não pertence mais ao CNPJ esperado.`
      );
    }

    const invoiceCnpj = normalizeSupplierCnpj(storedInvoice.supplierCnpj);
    if (invoiceCnpj && invoiceCnpj !== supplierCnpj) {
      throw new NsIntegrityError(
        'invoice_supplier_conflict',
        `A NF ${mutation.invoiceId} possui CNPJ divergente do empenho.`
      );
    }

    const currentNs = normalizeNsNumber(storedInvoice.numeroNS);
    const currentUg = normalizeNsUg(storedInvoice.nsUg);
    const expectedCurrentNs = normalizeNsNumber(mutation.expectedCurrentNs);
    const expectedCurrentUg = normalizeNsUg(mutation.expectedCurrentUg);
    const proposedNs = normalizeNsNumber(mutation.proposedNs);
    const proposedUg = normalizeNsUg(mutation.proposedUg);

    if (proposedNs) {
      const proposedIdentity = buildNsIdentityKey(proposedUg, proposedNs);
      const otherCanonicalOwners = (canonicalOwners.get(proposedIdentity) || []).filter(
        (recordKey) => recordKey !== mutation.invoiceRecordKey
      );
      const ambiguousLegacyOwners = (legacyOwnersByNs.get(proposedNs) || []).filter(
        (recordKey) => recordKey !== mutation.invoiceRecordKey
      );
      if (otherCanonicalOwners.length > 0 || ambiguousLegacyOwners.length > 0) {
        throw new NsIntegrityError(
          'ns_reused_in_scope',
          ambiguousLegacyOwners.length > 0
            ? `A NS ${proposedNs} existe em registro legado sem UG. Informe/corrija a UG desse histórico antes de reutilizar o número.`
            : `A identidade UG ${proposedUg} + NS ${proposedNs} já está vinculada a outra NF conhecida no mesmo workspace.`
        );
      }
    }

    if (currentNs === proposedNs && currentUg === proposedUg) {
      noOps.push(mutation);
      continue;
    }

    if (currentNs !== expectedCurrentNs || currentUg !== expectedCurrentUg) {
      throw new NsIntegrityError(
        'stale_invoice_ns',
        `A identidade UG + NS da NF ${mutation.invoiceId} mudou desde a preparação da operação.`
      );
    }

    writes.push(mutation);
  }

  return { writes, noOps };
}
