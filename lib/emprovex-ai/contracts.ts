/**
 * EMPROVEX AI W3 — contrato fechado entre interpretação (W4) e executor (W3).
 * Apenas leitura. Toda propriedade desconhecida é rejeitada.
 */
export const AI_QUERY_VERSION = 'emprovex.ai.query.v1' as const;
export const AI_RESPONSE_VERSION = 'emprovex.ai.response.v1' as const;
export const CONTRACTS = {
  supplier_contact_find: 'supplier.contact.find.v1',
  commitment_get: 'commitment.get.v1',
  commitment_total_balance: 'commitment.balance.v1',
  commitment_previous_open_list: 'commitment.previousOpen.list.v1',
  schedule_sent_history_list: 'schedule.sentHistory.list.v1',
  invoice_registration_period_list: 'invoice.registrationPeriod.list.v1',
  warehouse_stock_get: 'warehouse.stock.get.v1',
  warehouse_material_locations_list: 'warehouse.materialLocations.list.v1',
} as const;
export type AiIntent = keyof typeof CONTRACTS;
export type AiStatus = 'ok'|'empty'|'ambiguous'|'partial'|'unsupported'|'forbidden'|'error';
export type AiPeriod = { start: string; endExclusive: string };
export type AiQuery = {version: typeof AI_QUERY_VERSION; intent: AiIntent; params: Record<string, unknown>};
export type AiEvidence = { source: string; documentId: string };
export type AiResponse = {
  version: typeof AI_RESPONSE_VERSION; status: AiStatus; intent: AiIntent | null;
  contract: string | null; data: unknown; filters: Record<string, unknown>;
  evidence: AiEvidence[]; asOf: string; coverage: 'complete'|'incomplete'|'unknown';
  limitations: string[]; pagination: { nextCursor: string | null; truncated: boolean } | null;
  metrics: { durationMs: number; examinedDocuments: number };
};
export class AiInputError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiInputError('AI_INVALID_OBJECT');
  return value as Record<string, unknown>;
}
export function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some(key => !keys.includes(key) || key === '__proto__' || key === 'constructor'))
    throw new AiInputError('AI_UNEXPECTED_PARAMETER');
}
function stringParam(value: unknown, name: string, pattern: RegExp, max = 128): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || !pattern.test(value.trim()))
    throw new AiInputError('AI_INVALID_' + name.toUpperCase());
  return value.trim();
}
const ID = /^[A-Za-z0-9_-]{1,130}$/;
const NE = /^\d{4}NE\d{1,10}$/i;
const CNPJ = /^\d{14}$/;
const MATERIAL_TEXT = /^[^\u0000-\u001f\u007f<>]{2,120}$/u;
function cnpj(value: unknown): string {
  const s = stringParam(value, 'cnpj', /^[0-9.\-/\s]{14,22}$/).replace(/\D/g, '');
  if (!CNPJ.test(s) || /^(\d)\1{13}$/.test(s)) throw new AiInputError('AI_INVALID_CNPJ');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i < 4 ? 5-i : 13-i);
  const first = (11 - (sum % 11)) % 11;
  if (Number(s[12]) !== (first >= 10 ? 0 : first)) throw new AiInputError('AI_INVALID_CNPJ');
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i < 5 ? 6-i : 14-i);
  const second = (11 - (sum % 11)) % 11;
  if (Number(s[13]) !== (second >= 10 ? 0 : second)) throw new AiInputError('AI_INVALID_CNPJ');
  return s;
}
function pageSize(value: unknown): number {
  if (value === undefined) return 20;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 50)
    throw new AiInputError('AI_INVALID_PAGE_SIZE');
  return value as number;
}
function period(value: unknown): AiPeriod {
  const p = objectValue(value);
  onlyKeys(p, ['start','endExclusive']);
  const start = stringParam(p.start, 'period_start', /^\d{4}-\d{2}-\d{2}$/, 10);
  const endExclusive = stringParam(p.endExclusive, 'period_end', /^\d{4}-\d{2}-\d{2}$/, 10);
  const validDate = (date:string) => !Number.isNaN(Date.parse(date + 'T00:00:00Z'))
    && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date;
  if (!validDate(start) || !validDate(endExclusive) || start >= endExclusive)
    throw new AiInputError('AI_INVALID_PERIOD');
  if (Date.parse(endExclusive) - Date.parse(start) > 366*24*3600*1000)
    throw new AiInputError('AI_PERIOD_TOO_LARGE');
  return {start,endExclusive};
}
function materialParams(p:Record<string,unknown>): Record<string,unknown> {
  const out:Record<string,unknown> = {};
  if (p.materialId !== undefined) out.materialId = stringParam(p.materialId,'material_id', /^mat_[a-f0-9]{32}$/, 36);
  if (p.materialQuery !== undefined) out.materialQuery = stringParam(p.materialQuery,'material_query', MATERIAL_TEXT,120);
  if (p.barcode !== undefined) out.barcode = stringParam(p.barcode,'barcode', /^[^\u0000-\u001f\u007f]{1,128}$/,128);
  if (!Object.keys(out).length) throw new AiInputError('AI_MATERIAL_REQUIRED');
  return out;
}
export function parseAiQuery(input: unknown): AiQuery {
  const root = objectValue(input);
  onlyKeys(root, ['version','intent','params']);
  if (root.version !== AI_QUERY_VERSION) throw new AiInputError('AI_QUERY_VERSION_UNSUPPORTED');
  if (typeof root.intent !== 'string' || !Object.prototype.hasOwnProperty.call(CONTRACTS,root.intent))
    throw new AiInputError('AI_INTENT_UNSUPPORTED',422);
  const intent = root.intent as AiIntent;
  const p = objectValue(root.params);
  let params:Record<string,unknown> = {};
  switch (intent) {
    case 'supplier_contact_find': {
      onlyKeys(p,['cnpj','nameQuery','channel']);
      if (p.cnpj !== undefined) params.cnpj = cnpj(p.cnpj);
      if (p.nameQuery !== undefined) params.nameQuery = stringParam(p.nameQuery,'name',MATERIAL_TEXT,120);
      if (!params.cnpj && !params.nameQuery) throw new AiInputError('AI_SUPPLIER_REQUIRED');
      if (p.channel !== undefined && !['all','email','phone','whatsapp'].includes(String(p.channel)))
        throw new AiInputError('AI_CHANNEL_INVALID');
      params.channel = p.channel ?? 'all'; break;
    }
    case 'commitment_get':
    case 'commitment_total_balance': {
      onlyKeys(p,intent==='commitment_get'?['commitmentId','includeItems']:['commitmentId','itemId']);
      params.commitmentId = stringParam(p.commitmentId,'commitment_id', NE,22).toUpperCase();
      if (intent==='commitment_get') {
        if (p.includeItems !== undefined && typeof p.includeItems !== 'boolean') throw new AiInputError('AI_INVALID_INCLUDE_ITEMS');
        params.includeItems = p.includeItems === true;
      } else if(p.itemId!==undefined) params.itemId = stringParam(p.itemId,'item_id',ID,130);
      break;
    }
    case 'commitment_previous_open_list': {
      onlyKeys(p,['exerciseYear','includeHistorical','pageSize','cursor']);
      if (p.exerciseYear !== undefined) {
        if (!Number.isInteger(p.exerciseYear) || (p.exerciseYear as number) < 2000 || (p.exerciseYear as number) > 2100)
          throw new AiInputError('AI_INVALID_YEAR');
        params.exerciseYear=p.exerciseYear;
      }
      if (p.includeHistorical !== undefined && typeof p.includeHistorical !== 'boolean') throw new AiInputError('AI_INVALID_INCLUDE_HISTORICAL');
      params.includeHistorical=p.includeHistorical === true; params.pageSize=pageSize(p.pageSize);
      if (p.cursor!==undefined) params.cursor=stringParam(p.cursor,'cursor',/^[A-Za-z0-9._-]{8,2048}$/,2048);
      break;
    }
    case 'schedule_sent_history_list': {
      onlyKeys(p,['commitmentId','sentPeriod','supplierCnpj','pageSize']);
      if (p.commitmentId!==undefined) params.commitmentId=stringParam(p.commitmentId,'commitment_id',NE,22).toUpperCase();
      if (p.sentPeriod!==undefined) params.sentPeriod=period(p.sentPeriod);
      if (p.supplierCnpj!==undefined) params.supplierCnpj=cnpj(p.supplierCnpj);
      if (!params.commitmentId && !params.sentPeriod && !params.supplierCnpj)
        throw new AiInputError('AI_SCHEDULE_FILTER_REQUIRED');
      params.pageSize=pageSize(p.pageSize); break;
    }
    case 'invoice_registration_period_list': {
      onlyKeys(p,['interval','dateMeaning','supplierCnpj','commitmentId','pageSize','cursor']);
      params.interval=period(p.interval);
      if(p.dateMeaning!=='registered') throw new AiInputError('AI_INVOICE_DATE_MEANING_INVALID');
      params.dateMeaning='registered';
      if(p.supplierCnpj!==undefined) params.supplierCnpj=cnpj(p.supplierCnpj);
      if(p.commitmentId!==undefined) params.commitmentId=stringParam(p.commitmentId,'commitment_id',NE,22).toUpperCase();
      params.pageSize=pageSize(p.pageSize);
      if(p.cursor!==undefined) params.cursor=stringParam(p.cursor,'cursor',/^[A-Za-z0-9._-]{8,2048}$/,2048);
      break;
    }
    case 'warehouse_stock_get':
    case 'warehouse_material_locations_list': {
      onlyKeys(p,intent==='warehouse_stock_get'?['materialId','materialQuery','barcode']:['materialId','materialQuery','barcode','depotId','pageSize']);
      params=materialParams(p);
      if (p.depotId!==undefined) params.depotId=stringParam(p.depotId,'depot_id',/^dep_[a-f0-9]{32}$/,36);
      if (p.pageSize!==undefined) params.pageSize=pageSize(p.pageSize);
      break;
    }
  }
  return {version:AI_QUERY_VERSION,intent,params};
}
