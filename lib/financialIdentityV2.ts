import type { Empenho, Invoice, InvoicePdfDocument } from './types';
import {
  getInvoiceRecordKey,
  isValidSupplierCnpj,
  normalizeInvoiceNumber,
  normalizeSupplierCnpj,
} from './invoiceIdentity';

/**
 * V2 is an opt-in, read-only identity contract. It MUST NOT be used to rename
 * existing Firestore documents or to bypass the transactional NS/NE lifecycles.
 */
export interface InvoiceFiscalReference {
  supplierCnpj?: string | null;
  number?: string | null;
  series?: string | null;
  model?: string | null;
  accessKey?: string | null;
}

export type FiscalIdentityResolution =
  | { status: 'complete'; indexKey: string; accessKey: string | null }
  | { status: 'incomplete' | 'invalid'; reason: string };

export type FiscalIdentityComparison = 'duplicate' | 'distinct' | 'ambiguous';

export class FinancialIdentityError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'FinancialIdentityError';
  }
}

export function normalizeInvoiceSeries(value?: string | null): string {
  const raw = String(value ?? '').trim();
  return /^\d{1,3}$/.test(raw) ? raw.replace(/^0+(?=\d)/, '') : '';
}

export function normalizeInvoiceModel(value?: string | null): string {
  const raw = String(value ?? '').trim();
  return /^\d{2}$/.test(raw) ? raw : '';
}

/** Formatting whitespace is tolerated; non-digits and incorrect lengths are not. */
export function normalizeInvoiceAccessKey(value?: string | null): string {
  const raw = String(value ?? '').replace(/\s/g, '');
  return /^\d{44}$/.test(raw) ? raw : '';
}

export function hasValidNfeAccessKeyCheckDigit(value: string): boolean {
  const key = normalizeInvoiceAccessKey(value);
  if (!key) return false;
  let weight = 2;
  let sum = 0;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(key[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const digit = remainder < 2 ? 0 : 11 - remainder;
  return Number(key[43]) === digit;
}

/**
 * Deterministic *candidate* uniqueness index; no persisted identity is changed.
 * Completeness is mandatory so a missing series/model cannot silently collide.
 * Persisting a reservation requires server-verified scope + Firestore transaction.
 */
export function resolveInvoiceFiscalIdentityV2(
  input: InvoiceFiscalReference
): FiscalIdentityResolution {
  const supplierCnpj = normalizeSupplierCnpj(input.supplierCnpj);
  const number = normalizeInvoiceNumber(input.number);
  const series = normalizeInvoiceSeries(input.series);
  const model = normalizeInvoiceModel(input.model);
  const accessKeyInput = String(input.accessKey ?? '').trim();
  const accessKey = normalizeInvoiceAccessKey(accessKeyInput);

  if (input.supplierCnpj && (!supplierCnpj || !isValidSupplierCnpj(supplierCnpj))) {
    return { status: 'invalid', reason: 'invalid_supplier_cnpj' };
  }
  if (String(input.number ?? '').trim() && !number) {
    return { status: 'invalid', reason: 'invalid_invoice_number' };
  }
  if (String(input.series ?? '').trim() && !series) {
    return { status: 'invalid', reason: 'invalid_invoice_series' };
  }
  if (String(input.model ?? '').trim() && !model) {
    return { status: 'invalid', reason: 'invalid_invoice_model' };
  }
  if (accessKeyInput && (!accessKey || !hasValidNfeAccessKeyCheckDigit(accessKey))) {
    return { status: 'invalid', reason: 'invalid_nfe_access_key' };
  }
  if (!supplierCnpj || !number || !series || !model) {
    return { status: 'incomplete', reason: 'missing_fiscal_dimensions' };
  }
  if (accessKey && (
    accessKey.slice(6, 20) !== supplierCnpj ||
    accessKey.slice(20, 22) !== model ||
    normalizeInvoiceSeries(accessKey.slice(22, 25)) !== series ||
    normalizeInvoiceNumber(accessKey.slice(25, 34)) !== number
  )) {
    return { status: 'invalid', reason: 'access_key_dimensions_mismatch' };
  }

  return {
    status: 'complete',
    indexKey: 'nfv2_' + supplierCnpj + '_' + model + '_' + series + '_' + encodeURIComponent(number),
    accessKey: accessKey || null,
  };
}

/**
 * A missing dimension or a legacy invoice is ambiguous, never proof that a
 * new invoice is unique. No client-only check authorizes a write.
 */
export function compareInvoiceFiscalIdentitiesV2(
  left: InvoiceFiscalReference,
  right: InvoiceFiscalReference
): FiscalIdentityComparison {
  const a = resolveInvoiceFiscalIdentityV2(left);
  const b = resolveInvoiceFiscalIdentityV2(right);
  if (a.status === 'invalid' || b.status === 'invalid') return 'ambiguous';

  if (a.status === 'complete' && b.status === 'complete') {
    if (a.accessKey && b.accessKey && a.accessKey === b.accessKey) return 'duplicate';
    return a.indexKey === b.indexKey ? 'duplicate' : 'distinct';
  }

  const aCnpj = normalizeSupplierCnpj(left.supplierCnpj);
  const bCnpj = normalizeSupplierCnpj(right.supplierCnpj);
  const aNumber = normalizeInvoiceNumber(left.number);
  const bNumber = normalizeInvoiceNumber(right.number);
  if (aCnpj && bCnpj && aCnpj !== bCnpj) return 'distinct';
  if (aNumber && bNumber && aNumber !== bNumber) return 'distinct';
  return 'ambiguous';
}

/** Preserve the physical Firestore document key even for legacy documents. */
export function resolveHistoricalInvoiceRecordKey(invoice: Pick<Invoice, 'id' | 'recordKey'>): string {
  return getInvoiceRecordKey(invoice);
}

/**
 * Verifies linked invoice items against the committed NE. Does not create
 * warehouse IDs and never equates materials by their display descriptions.
 */
export function assertInvoiceItemReferences(
  invoice: Pick<Invoice, 'empenhoId' | 'items'>,
  empenho: Pick<Empenho, 'id' | 'items'>
): void {
  if (invoice.empenhoId !== empenho.id) {
    throw new FinancialIdentityError('empenho_mismatch', 'NF belongs to another empenho.');
  }
  const known = new Map(empenho.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const line of invoice.items) {
    if (!line.itemId || seen.has(line.itemId)) {
      throw new FinancialIdentityError('duplicate_or_missing_item', 'Invoice item ID is missing or repeated.');
    }
    seen.add(line.itemId);
    const source = known.get(line.itemId);
    if (!source) throw new FinancialIdentityError('unknown_empenho_item', 'Invoice item is not linked to the empenho.');
    if (line.warehouseMaterialId && source.warehouseMaterialId &&
        line.warehouseMaterialId !== source.warehouseMaterialId) {
      throw new FinancialIdentityError('warehouse_link_conflict', 'Warehouse material link does not match the empenho.');
    }
    if (line.warehouseMovementIds?.length && !line.warehouseMaterialId) {
      throw new FinancialIdentityError('unresolved_warehouse_material', 'Warehouse movements require a material link.');
    }
  }
}

export type PdfReferenceStatus = 'verified' | 'legacy-unverified';

/**
 * The expected workspace must come from server-verified authorization,
 * NEVER from request fields. Missing legacy workspace metadata is not proof
 * of ownership and must be resolved before an authorization-sensitive write.
 */
export function assertInvoicePdfReferences(
  pdf: InvoicePdfDocument,
  expected: { invoiceId: string; empenhoId: string; workspaceId: string }
): PdfReferenceStatus {
  if (!pdf.id || !pdf.pathname || !expected.workspaceId) {
    throw new FinancialIdentityError('invalid_pdf_identity', 'Missing PDF or authoritative workspace identity.');
  }
  if (pdf.invoiceId !== expected.invoiceId || pdf.empenhoId !== expected.empenhoId) {
    throw new FinancialIdentityError('pdf_owner_mismatch', 'PDF belongs to another invoice or empenho.');
  }
  if (pdf.storage?.workspaceId && pdf.storage.workspaceId !== expected.workspaceId) {
    throw new FinancialIdentityError('pdf_workspace_mismatch', 'PDF storage belongs to a different workspace.');
  }
  return pdf.storage?.workspaceId === expected.workspaceId ? 'verified' : 'legacy-unverified';
}

/** Reject ambiguous version references without mutating deletion schedules. */
export function assertDistinctPdfVersionIds(
  current: InvoicePdfDocument | undefined,
  versions: readonly InvoicePdfDocument[]
): void {
  const seen = new Map<string, string>();
  for (const pdf of [...(current ? [current] : []), ...versions]) {
    if (!pdf.id || !pdf.pathname) {
      throw new FinancialIdentityError('invalid_pdf_identity', 'PDF logical identity is incomplete.');
    }
    const location = pdf.storage?.objectKey || pdf.pathname;
    if (seen.has(pdf.id) && seen.get(pdf.id) !== location) {
      throw new FinancialIdentityError('pdf_version_identity_collision', 'One PDF ID points to different physical files.');
    }
    seen.set(pdf.id, location);
  }
}
