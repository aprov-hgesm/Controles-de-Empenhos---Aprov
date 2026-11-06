/** EMPROVEX Empresas W8 — deterministic, tenant-neutral finance domain. No military billing. */
import type { CompanyOwnedRecord } from '../contracts';

export type FinanceDirection = 'payable' | 'receivable';
export type FinanceEntryKind = 'settlement' | 'settlement_reversal' | 'adjustment';
export type FinanceStatus = 'open' | 'partial' | 'settled' | 'cancelled';
export interface FinanceEntry {
  id: string; kind: FinanceEntryKind; amountCents: number; occurredOn: string;
  reason: string; recordedAt: string; actorUid: string; reversesEntryId?: string;
}
export interface FinanceObligation extends CompanyOwnedRecord {
  direction: FinanceDirection;
  invoice: { number: string; series?: string; issuedOn: string; totalCents: number;
    currency: 'BRL'; source: 'manual'; verification: 'unverified' };
  counterparty: { id: string; label: string };
  sourceOrderId?: string;
  dueOn: string;
  notes?: string;
  entries: FinanceEntry[];
  financialStatus: FinanceStatus;
}
export class FinanceError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 404 | 409 | 503) {
    super(code); this.name = 'FinanceError';
  }
}
const bad = (code = 'FINANCE_INVALID_INPUT'): never => { throw new FinanceError(code, 400); };
export const recordId = (v: unknown): string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : bad();
const nonempty = (v: unknown, limit = 160): string =>
  typeof v === 'string' && !!v.trim() && v.trim().length <= limit ? v.trim() : bad();
export function cents(v: unknown, allowNegative = false): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)
      || Math.abs(v) > 1_000_000_000_000 || (!allowNegative && v < 0)) return bad();
  return v;
}
function date(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)
      || Number.isNaN(Date.parse(v + 'T00:00:00Z'))
      || new Date(v + 'T00:00:00Z').toISOString().slice(0,10) !== v) return bad();
  return v;
}
function object(v: unknown): v is Record<string,unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function parseFinanceDraft(raw: unknown, direction: FinanceDirection) {
  if (!object(raw) || !object(raw.invoice) || !object(raw.counterparty)) return bad();
  const invoice = {
    number: nonempty(raw.invoice.number, 100),
    ...(raw.invoice.series === undefined || raw.invoice.series === '' ? {} : { series: nonempty(raw.invoice.series, 30) }),
    issuedOn: date(raw.invoice.issuedOn), totalCents: cents(raw.invoice.totalCents),
    currency: 'BRL' as const, source: 'manual' as const, verification: 'unverified' as const,
  };
  if (invoice.totalCents === 0) return bad();
  return {
    direction, invoice,
    counterparty: { id: recordId(raw.counterparty.id), label: nonempty(raw.counterparty.label, 200) },
    ...(raw.sourceOrderId === undefined || raw.sourceOrderId === '' ? {} : { sourceOrderId: recordId(raw.sourceOrderId) }),
    dueOn: date(raw.dueOn),
    ...(raw.notes === undefined || raw.notes === '' ? {} : { notes: nonempty(raw.notes, 2000) }),
  };
}
/** Exact integer-cent projection; never assumes bank credit or public-sector liquidation. */
export function balance(record: Pick<FinanceObligation, 'invoice'|'entries'|'status'>) {
  let total = BigInt(cents(record.invoice.totalCents));
  let applied = 0n;
  const settlements = new Map<string,FinanceEntry>();
  const reversed = new Set<string>();
  for (const entry of record.entries) {
    if (entry.kind === 'adjustment') total += BigInt(cents(entry.amountCents, true));
    else if (entry.kind === 'settlement') {
      if (settlements.has(entry.id)) return bad('FINANCE_DUPLICATE_ENTRY');
      settlements.set(entry.id, entry);
      applied += BigInt(cents(entry.amountCents));
    } else if (entry.kind === 'settlement_reversal') {
      const original = entry.reversesEntryId && settlements.get(entry.reversesEntryId);
      if (!original || reversed.has(original.id) || entry.amountCents !== original.amountCents) {
        return bad('FINANCE_INVALID_REVERSAL');
      }
      reversed.add(original.id); applied -= BigInt(original.amountCents);
    } else return bad();
  }
  if (total < 0n || applied < 0n || applied > total
      || total > BigInt(Number.MAX_SAFE_INTEGER)) return bad('FINANCE_INVALID_BALANCE');
  return { totalCents: Number(total), appliedCents: Number(applied), outstandingCents: Number(total-applied),
    status: record.status === 'cancelled' ? 'cancelled' as const :
      applied === 0n ? 'open' as const : applied === total ? 'settled' as const : 'partial' as const };
}
export type EntryCommand = {
  kind: FinanceEntryKind; amountCents?: number; occurredOn: string;
  reason: string; reversesEntryId?: string;
};
export function parseEntryCommand(raw: unknown): EntryCommand {
  if (!object(raw) || !['settlement','settlement_reversal','adjustment'].includes(String(raw.kind))) return bad();
  const kind = raw.kind as FinanceEntryKind;
  const reason = nonempty(raw.reason, 1200);
  if ((kind === 'adjustment' || kind === 'settlement_reversal') && reason.length < 12) return bad();
  const amountCents = kind === 'settlement_reversal' ? undefined : cents(raw.amountCents, kind === 'adjustment');
  if (amountCents === 0) return bad();
  return { kind, ...(amountCents === undefined ? {} : { amountCents }),
    occurredOn: date(raw.occurredOn), reason,
    ...(kind === 'settlement_reversal' ? { reversesEntryId: recordId(raw.reversesEntryId) } : {}) };
}
export function applyEntry(record: FinanceObligation, command: EntryCommand, id: string, uid: string, at: string): FinanceObligation {
  if (record.status === 'cancelled') throw new FinanceError('FINANCE_CANCELLED',409);
  const before = balance(record);
  if (before.status === 'cancelled') throw new FinanceError('FINANCE_CANCELLED',409);
  let amount = command.amountCents ?? 0;
  if (command.kind === 'settlement_reversal') {
    const target = record.entries.find(e => e.id === command.reversesEntryId && e.kind === 'settlement');
    if (!target || record.entries.some(e => e.kind === 'settlement_reversal' && e.reversesEntryId === target.id)) {
      throw new FinanceError('FINANCE_INVALID_REVERSAL',409);
    }
    amount = target.amountCents;
  }
  const entry: FinanceEntry = { id, kind: command.kind, amountCents: amount,
    occurredOn: command.occurredOn, reason: command.reason, recordedAt: at, actorUid: uid,
    ...(command.reversesEntryId ? {reversesEntryId:command.reversesEntryId} : {}) };
  const next = { ...record, entries: [...record.entries,entry], revision: record.revision + 1, updatedAt: at };
  let projection: ReturnType<typeof balance>;
  try { projection = balance(next); } catch { throw new FinanceError('FINANCE_INVALID_BALANCE',409); }
  if (command.kind === 'settlement' && amount > before.outstandingCents) throw new FinanceError('FINANCE_OVERPAYMENT',409);
  return { ...next, financialStatus: projection.status };
}
export function cancelObligation(record: FinanceObligation, reason: string, at: string): FinanceObligation {
  if (record.status === 'cancelled') throw new FinanceError('FINANCE_CANCELLED',409);
  if (nonempty(reason,1200).length < 12 || balance(record).appliedCents !== 0) throw new FinanceError('FINANCE_CANCEL_FORBIDDEN',409);
  return { ...record, status: 'cancelled', financialStatus:'cancelled', revision:record.revision+1, updatedAt:at,
    notes: [record.notes, 'Cancelamento: '+reason].filter(Boolean).join('\n') };
}
/** Partial margins always state the unknown components; never label an estimate realized. */
export function estimateMargin(input: { revenueCents:number; materialCostCents?:number;
  freightCents?:number; taxesCents?:number; otherCents?:number }) {
  const fields = ['materialCostCents','freightCents','taxesCents','otherCents'] as const;
  const missing = fields.filter(f => input[f] === undefined);
  let value = BigInt(cents(input.revenueCents));
  for (const f of fields) if (input[f] !== undefined) value -= BigInt(cents(input[f]));
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) return bad();
  return { knownComponentMarginCents: Number(value), missing, complete:missing.length===0, basis:'estimate' as const };
}
export function cashflow(records: readonly FinanceObligation[]) {
  const events = new Map<string,{payableCents:number;receivableCents:number}>();
  for (const r of records) {
    if (r.status === 'cancelled') continue;
    const b = balance(r);
    const row = events.get(r.dueOn) ?? {payableCents:0,receivableCents:0};
    const key = r.direction === 'payable' ? 'payableCents' : 'receivableCents';
    row[key] += b.outstandingCents;
    if (!Number.isSafeInteger(row[key])) return bad();
    events.set(r.dueOn,row);
  }
  return [...events].sort(([a],[b])=>a.localeCompare(b)).map(([dueOn,v]) => ({
    dueOn,...v,netForecastCents:v.receivableCents-v.payableCents,
    basis:'open_obligations_not_confirmed_cash' as const,
  }));
}
