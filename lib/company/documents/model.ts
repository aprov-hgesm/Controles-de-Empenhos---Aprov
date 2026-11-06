import { createHash } from 'node:crypto';
import { COMPANY_CONTRACT_VERSION, type CompanyOwnedRecord } from '../contracts';
import type { ParsedEmpenhoPdfResult } from '../../server/empenhoPdfParser';

export const MAX_COMPANY_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_COMPANY_NE_BYTES = 12 * 1024 * 1024;
export type CompanyDocumentKind = 'ne' | 'purchase' | 'proof' | 'other';
export type CompanyReference = 'commitments' | 'purchaseOrders' | 'deliveries';

export class CompanyDocumentError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 403 | 404 | 409 | 413 | 422 | 503) {
    super(code);
    this.name = 'CompanyDocumentError';
  }
}
export interface NeReviewLine { id: string; description: string; quantity: string; unit: string; unitPriceCents: number; totalCents: number }
export interface NeReview {
  neNumber: string;
  buyerUg: string | null;
  supplier: string;
  supplierCnpj: string;
  issueDate: string;
  totalCents: number;
  items: NeReviewLine[];
}
export interface CompanyDocumentRecord extends CompanyOwnedRecord {
  kind: CompanyDocumentKind;
  status: 'active';
  displayName: string;
  mediaType: 'application/pdf' | 'image/png' | 'image/jpeg';
  byteLength: number;
  sha256: string;
  storageObject: string;
  referenceType: CompanyReference | null;
  referenceId: string | null;
  review: NeReview | null;
  originalExtraction: NeReview | null;
  confirmedByUid: string | null;
  confirmedAt: string | null;
  expiresAt: string | null;
}
export function sha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
export function safeFilename(input: string): string {
  const segment = (input || '').replace(/\\/g, '/').split('/').at(-1) || '';
  return segment.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/[^\p{L}\p{N}._() -]/gu, '_').replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '').trim().slice(0, 120) || 'documento';
}
export function validateUpload(
  file: { name: string; size: number; type: string },
  bytes: Uint8Array, kind: CompanyDocumentKind,
): { filename: string; mime: CompanyDocumentRecord['mediaType'] } {
  if (!(['ne', 'purchase', 'proof', 'other'] as string[]).includes(kind)) throw new CompanyDocumentError('DOCUMENT_KIND_INVALID', 400);
  const limit = kind === 'ne' ? MAX_COMPANY_NE_BYTES : MAX_COMPANY_ATTACHMENT_BYTES;
  if (!Number.isSafeInteger(file.size) || file.size < 16 || file.size > limit || file.size !== bytes.length) {
    throw new CompanyDocumentError('DOCUMENT_SIZE_INVALID', 413);
  }
  const b = Buffer.from(bytes);
  const mime = b.subarray(0, 5).toString('latin1') === '%PDF-'
    ? 'application/pdf'
    : b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      ? 'image/png'
      : b[0] === 255 && b[1] === 216 && b[2] === 255
        ? 'image/jpeg' : null;
  if (!mime || mime !== file.type || (kind === 'ne' && mime !== 'application/pdf')) {
    throw new CompanyDocumentError('DOCUMENT_CONTENT_TYPE_INVALID', 422);
  }
  if (mime === 'application/pdf') {
    if (!b.subarray(Math.max(0, b.length - 2048)).toString('latin1').includes('%%EOF')) {
      throw new CompanyDocumentError('DOCUMENT_PDF_MALFORMED', 422);
    }
    if (/\/Encrypt\b/.test(b.toString('latin1'))) throw new CompanyDocumentError('DOCUMENT_PDF_ENCRYPTED', 422);
  }
  return { filename: safeFilename(file.name), mime };
}
function cents(v: number): number {
  if (!Number.isFinite(v) || v < 0 || v > 10_000_000_000) throw new CompanyDocumentError('NE_VALUE_INVALID', 422);
  const n = Math.round(v * 100);
  if (!Number.isSafeInteger(n)) throw new CompanyDocumentError('NE_VALUE_INVALID', 422);
  return n;
}
export function extractedNeReview(parsed: ParsedEmpenhoPdfResult): NeReview {
  return {
    neNumber: parsed.id, buyerUg: parsed.ug, supplier: parsed.supplier,
    supplierCnpj: parsed.supplierCnpj, issueDate: parsed.date,
    totalCents: cents(parsed.valorTotal),
    items: parsed.items.map((i) => ({
      id: i.id, description: i.name, quantity: String(i.quantity),
      unit: i.unit, unitPriceCents: cents(i.unitPrice), totalCents: cents(i.declaredTotal),
    })),
  };
}
const filled = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const integerMoney = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000_000_000;
export function validateNeReview(value: unknown): NeReview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CompanyDocumentError('NE_REVIEW_INVALID', 422);
  const v = value as Record<string, unknown>;
  if (!filled(v.neNumber, 48) || !/^\d{4}NE\d{1,8}$/.test(v.neNumber)
    || (v.buyerUg !== null && (typeof v.buyerUg !== 'string' || !/^\d{6}$/.test(v.buyerUg)))
    || !filled(v.supplier, 200) || !filled(v.supplierCnpj, 32)
    || !filled(v.issueDate, 20) || !/^\d{2}\/\d{2}\/\d{4}$/.test(v.issueDate)
    || !integerMoney(v.totalCents) || !Array.isArray(v.items) || !v.items.length || v.items.length > 300) {
    throw new CompanyDocumentError('NE_REVIEW_INVALID', 422);
  }
  const seen = new Set<string>();
  const items: NeReviewLine[] = v.items.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CompanyDocumentError('NE_LINE_INVALID', 422);
    const line = raw as Record<string, unknown>;
    if (!filled(line.id, 64) || seen.has(line.id) || !filled(line.description, 400)
      || !filled(line.unit, 20) || !filled(line.quantity, 28)
      || !/^\d{1,12}(?:\.\d{1,6})?$/.test(line.quantity) || Number(line.quantity) <= 0
      || !integerMoney(line.unitPriceCents) || !integerMoney(line.totalCents)) {
      throw new CompanyDocumentError('NE_LINE_INVALID', 422);
    }
    seen.add(line.id);
    return {
      id: line.id, description: line.description.trim(), quantity: line.quantity,
      unit: line.unit.trim(), unitPriceCents: line.unitPriceCents, totalCents: line.totalCents,
    };
  });
  return {
    neNumber: v.neNumber, buyerUg: v.buyerUg as string | null,
    supplier: v.supplier.trim(), supplierCnpj: v.supplierCnpj.trim(), issueDate: v.issueDate,
    totalCents: v.totalCents, items,
  };
}
export function assertReadableCompanyDocument(companyId: string, record: CompanyDocumentRecord, now = Date.now()): void {
  if (record.companyId !== companyId || record.workspaceId !== companyId || record.status !== 'active') {
    throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  }
  if (record.expiresAt !== null && (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= now)) {
    throw new CompanyDocumentError('DOCUMENT_EXPIRED', 403);
  }
}
export function publicDocument(record: CompanyDocumentRecord): Omit<CompanyDocumentRecord, 'storageObject'> {
  const { storageObject: _secret, ...metadata } = record;
  return metadata;
}
export function makeRecord(
  data: Omit<CompanyDocumentRecord, keyof CompanyOwnedRecord | 'status'>,
  identity: { id: string; companyId: string; uid: string; now: string },
): CompanyDocumentRecord {
  return {
    ...data, schemaVersion: COMPANY_CONTRACT_VERSION, id: identity.id,
    companyId: identity.companyId, workspaceId: identity.companyId, status: 'active',
    createdByUid: identity.uid, createdAt: identity.now, updatedAt: identity.now, revision: 1,
  };
}
