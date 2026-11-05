import { randomUUID } from 'node:crypto';
import {
  COMPANY_CONTRACT_VERSION,
  type CompanyMoney, type CompanyOwnedRecord, type CompanyQuantity,
  type CompanyTemporalFact, type CompanyUnit,
} from '../contracts';

export interface PublicCustomer extends CompanyOwnedRecord {
  kind: 'military_organization' | 'public_agency'; name: string;
  ug?: string; uasg?: string; contacts: Array<{ name: string; email?: string; phone?: string }>;
  addresses: Array<{ label: string; street: string; city: string; state: string; postalCode?: string }>;
  notes?: string;
}
export interface CommitmentLine {
  id: string; description: string; quantity: CompanyQuantity;
  orderedQuantity: CompanyQuantity; salePrice: CompanyMoney;
}
export interface Commitment extends CompanyOwnedRecord {
  publicCustomerId: string; neNumber: string; fiscalYear: number;
  lines: CommitmentLine[]; reviewedByUid: string; reviewedAt: string;
  extractionSource: 'manual' | 'pdf_reviewed'; reviewNotes?: string;
}
export interface CustomerOrderLine {
  id: string; commitmentLineId: string; description: string;
  quantity: CompanyQuantity; salePrice: CompanyMoney;
  fulfilledQuantity: CompanyQuantity;
}
export interface CustomerOrder extends CompanyOwnedRecord {
  commitmentId: string; publicCustomerId: string; reference: string;
  lines: CustomerOrderLine[]; requestedDelivery?: CompanyTemporalFact;
  negotiationNote?: string; fulfillmentState: 'pending' | 'partial' | 'fulfilled';
}
export class W1Error extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 404 | 409 | 503) {
    super(code); this.name = 'W1Error';
  }
}
const bad = (): never => { throw new W1Error('INVALID_INPUT', 400); };
const obj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 180): string =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : bad();
const optional = (v: unknown, max = 180): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : str(v, max);
export const validId = (v: unknown): string =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v) ? v : bad();
export const validIdempotency = (v: unknown): string =>
  typeof v === 'string' && /^[a-zA-Z0-9._:-]{8,128}$/.test(v) ? v : bad();
const arr = (v: unknown, max = 60): Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every(obj) ? v : bad();

export function millis(v: string): bigint {
  if (typeof v !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,3})?$/.test(v)) return bad();
  const [integer, fraction = ''] = v.split('.');
  return BigInt(integer) * BigInt(1000) + BigInt(fraction.padEnd(3, '0'));
}
export function asDecimal(v: bigint): string {
  if (v < BigInt(0)) return bad();
  const f = (v % BigInt(1000)).toString().padStart(3, '0').replace(/0+$/, '');
  return (v / BigInt(1000)).toString() + (f ? '.' + f : '');
}
const unitSet = new Set<CompanyUnit>(['UN','KG','G','L','ML','CX','FD','M']);
export function quantity(v: unknown, allowZero = false): CompanyQuantity {
  if (!obj(v) || typeof v.value !== 'string' || typeof v.unit !== 'string'
    || !unitSet.has(v.unit as CompanyUnit)) return bad();
  const n = millis(v.value);
  if (n < BigInt(0) || (!allowZero && n === BigInt(0))) return bad();
  return {value: asDecimal(n), unit: v.unit as CompanyUnit};
}
export function money(v: unknown): CompanyMoney {
  if (!obj(v) || v.currency !== 'BRL' || typeof v.amountCents !== 'number'
    || !Number.isSafeInteger(v.amountCents) || v.amountCents < 0 || v.amountCents > 1e12) return bad();
  return {amountCents: v.amountCents, currency: 'BRL'};
}
export function parseCustomer(v: unknown) {
  if (!obj(v) || !['military_organization','public_agency'].includes(String(v.kind))) return bad();
  const ug = optional(v.ug, 10), uasg = optional(v.uasg, 10);
  if ((ug && !/^\d{5,10}$/.test(ug)) || (uasg && !/^\d{5,10}$/.test(uasg))) return bad();
  const contacts: PublicCustomer['contacts'] = v.contacts === undefined ? [] :
    Array.isArray(v.contacts) && v.contacts.length <= 15 && v.contacts.every(obj) ?
      v.contacts.map(c => {
        const email = optional(c.email), phone = optional(c.phone, 35);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad();
        return {name: str(c.name), ...(email ? {email} : {}), ...(phone ? {phone} : {})};
      }) : bad();
  const addresses: PublicCustomer['addresses'] = v.addresses === undefined ? [] :
    Array.isArray(v.addresses) && v.addresses.length <= 15 && v.addresses.every(obj) ?
      v.addresses.map(a => {
        const state = str(a.state, 2).toUpperCase();
        if (!/^[A-Z]{2}$/.test(state)) return bad();
        const postalCode = optional(a.postalCode, 12);
        return {label: str(a.label, 60), street: str(a.street), city: str(a.city),
          state, ...(postalCode ? {postalCode} : {})};
      }) : bad();
  return {kind: v.kind as PublicCustomer['kind'], name: str(v.name),
    ...(ug ? {ug} : {}), ...(uasg ? {uasg} : {}), contacts, addresses,
    ...(optional(v.notes, 2000) ? {notes: optional(v.notes, 2000)} : {})};
}
export function parseCommitment(v: unknown) {
  if (!obj(v) || typeof v.fiscalYear !== 'number' || !Number.isInteger(v.fiscalYear)
    || v.fiscalYear < 2000 || v.fiscalYear > 2100) return bad();
  const lines = arr(v.lines).map(l => ({
    id: validId(l.id), description: str(l.description, 500),
    quantity: quantity(l.quantity), salePrice: money(l.salePrice),
  }));
  if (new Set(lines.map(l => l.id)).size !== lines.length) return bad();
  if (v.extractionSource !== 'manual' && v.extractionSource !== 'pdf_reviewed') return bad();
  return {publicCustomerId: validId(v.publicCustomerId),
    neNumber: str(v.neNumber, 100), fiscalYear: v.fiscalYear, lines,
    extractionSource: v.extractionSource as Commitment['extractionSource'],
    ...(optional(v.reviewNotes, 2000) ? {reviewNotes: optional(v.reviewNotes, 2000)} : {})};
}
export function parseOrder(v: unknown) {
  if (!obj(v)) return bad();
  const lines = arr(v.lines).map(l => ({
    id: validId(l.id), commitmentLineId: validId(l.commitmentLineId), quantity: quantity(l.quantity),
  }));
  if (new Set(lines.map(l => l.id)).size !== lines.length ||
      new Set(lines.map(l => l.commitmentLineId)).size !== lines.length) return bad();
  let requestedDelivery: CompanyTemporalFact | undefined;
  if (v.requestedDelivery !== undefined && v.requestedDelivery !== null) {
    const d = v.requestedDelivery;
    if (!obj(d) || typeof d.value !== 'string' || !Number.isFinite(Date.parse(d.value))
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(d.value)
      || !['requested','promised','estimated','confirmed','actual'].includes(String(d.basis))
      || !['user','publicCustomer','supplier','system'].includes(String(d.source))) return bad();
    requestedDelivery = {value: d.value, basis: d.basis as CompanyTemporalFact['basis'],
      source: d.source as CompanyTemporalFact['source'], updatedAt: new Date().toISOString()};
  }
  return {publicCustomerId: validId(v.publicCustomerId), commitmentId: validId(v.commitmentId),
    reference: str(v.reference, 120), lines, requestedDelivery,
    negotiationNote: optional(v.negotiationNote, 2000)};
}
export function owned(companyId: string, uid: string, payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {...payload, id: randomUUID(), schemaVersion: COMPANY_CONTRACT_VERSION,
    companyId, workspaceId: companyId, status: 'active' as const,
    createdByUid: uid, createdAt: now, updatedAt: now, revision: 1};
}
export function ensureOwned(v: unknown, companyId: string): asserts v is CompanyOwnedRecord {
  if (!obj(v) || v.schemaVersion !== COMPANY_CONTRACT_VERSION
    || v.companyId !== companyId || v.workspaceId !== companyId
    || !Number.isSafeInteger(v.revision) || Number(v.revision) < 1) {
    throw new W1Error('TENANT_INTEGRITY_ERROR', 503);
  }
}
export function allocate(commitment: Commitment, input: ReturnType<typeof parseOrder>,
  priorLines: CustomerOrderLine[] = []) {
  if (commitment.status !== 'active' || commitment.publicCustomerId !== input.publicCustomerId) {
    throw new W1Error('CONFLICT', 409);
  }
  const byId = new Map(commitment.lines.map(l => [l.id, l]));
  const used = new Map(commitment.lines.map(l => [l.id, millis(l.orderedQuantity.value)]));
  for (const p of priorLines) {
    const base = byId.get(p.commitmentLineId);
    if (!base || base.quantity.unit !== p.quantity.unit) throw new W1Error('CONFLICT', 409);
    used.set(base.id, (used.get(base.id) || BigInt(0)) - millis(p.quantity.value));
  }
  const orderLines: CustomerOrderLine[] = input.lines.map(l => {
    const c = byId.get(l.commitmentLineId);
    if (!c || c.quantity.unit !== l.quantity.unit) throw new W1Error('CONFLICT', 409);
    const next = (used.get(c.id) || BigInt(0)) + millis(l.quantity.value);
    if (next < BigInt(0) || next > millis(c.quantity.value)) throw new W1Error('CONFLICT', 409);
    used.set(c.id, next);
    return {id: l.id, commitmentLineId: c.id, description: c.description,
      quantity: l.quantity, salePrice: c.salePrice,
      fulfilledQuantity: {value: '0', unit: l.quantity.unit}};
  });
  return {orderLines, commitmentLines: commitment.lines.map(l => ({
    ...l, orderedQuantity: {value: asDecimal(used.get(l.id) || BigInt(0)), unit: l.quantity.unit},
  }))};
}
