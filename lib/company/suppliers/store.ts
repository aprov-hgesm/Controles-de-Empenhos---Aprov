/** W2 Firestore REST adapter. Server-only, privileged; always called AFTER W0 guard. */
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import firebaseConfig from '../../../config/empresas-firebase-web.json';
import type { CompanyAuthorizedContext } from '../../server/companyAuthz';
import { getCompanyAccessToken } from '../../server/companyFirebaseRuntime';
import { COMPANY_CONTRACT_VERSION, companyDocumentPath, type CompanySubcollection } from '../contracts';
import {
  assertSupplierSelectable, normalizedSupplierName, normalizedSku, parseCatalogItem,
  parseSourceSupplier, supplierRecordStatus, SupplierValidationError,
  purchaseSelectionContract, type CatalogItem, type CatalogItemInput, type SourceSupplier,
} from './domain';

export class SupplierServiceError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 404 | 409 | 503) { super(code); this.name = 'SupplierServiceError'; }
}
type RecordData = Record<string, unknown>;
type FireValue = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: 'NULL_VALUE'; arrayValue?: { values?: FireValue[] }; mapValue?: { fields?: Record<string, FireValue> } };
type FireDocument = { name: string; fields?: Record<string, FireValue>; updateTime?: string };
type FireWrite = { update: { name: string; fields: Record<string, FireValue> }; currentDocument: { exists: false } | { updateTime: string } };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = () => randomUUID().replace(/-/g, '');
const encode = (value: unknown): FireValue => {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === 'object') return { mapValue: { fields: fields(value as RecordData) } };
  throw new SupplierServiceError('INVALID_FIRESTORE_VALUE', 400);
};
const fields = (object: RecordData): Record<string, FireValue> => Object.fromEntries(Object.entries(object).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
const decode = (v: FireValue): unknown => {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue) return null;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(decode);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k,value])=>[k,decode(value)]));
  return null;
};
const unfields = (object?: Record<string, FireValue>): RecordData => Object.fromEntries(Object.entries(object ?? {}).map(([k,v])=>[k,decode(v)]));
function config(): { root: string; auth: string } {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH === '1') {
    const project = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID ?? '';
    const firestore = process.env.FIRESTORE_EMULATOR_HOST ?? '';
    const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
    if (!project.startsWith('demo-') || !['127.0.0.1:8080', 'localhost:8080'].includes(firestore)
        || !['127.0.0.1:9099', 'localhost:9099'].includes(auth)
        || process.env.K_SERVICE || process.env.VERCEL || process.env.GAE_SERVICE) throw new SupplierServiceError('EMULATOR_ENV_INVALID', 503);
    return { root: `http://${firestore}/v1/projects/${project}/databases/(default)/documents`, auth: 'Bearer owner' };
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new SupplierServiceError('EMULATOR_ENV_INVALID', 503);
  return { root: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents`, auth: '' };
}
async function client(): Promise<{ root: string; headers: Record<string,string> }> {
  const c = config();
  try {
    const auth = c.auth || ('Bearer ' + await getCompanyAccessToken());
    return { root: c.root, headers: { authorization: auth, 'content-type': 'application/json' } };
  } catch { throw new SupplierServiceError('COMPANY_DIRECTORY_UNAVAILABLE', 503); }
}
async function response<T>(r: Response): Promise<T> {
  if (r.status === 404) throw new SupplierServiceError('NOT_FOUND',404);
  if (r.status === 409 || r.status === 412) throw new SupplierServiceError('CONFLICT',409);
  if (!r.ok) throw new SupplierServiceError('COMPANY_DIRECTORY_UNAVAILABLE',503);
  try { return await r.json() as T; } catch { throw new SupplierServiceError('COMPANY_DIRECTORY_UNAVAILABLE',503); }
}
const docName = (root: string, path: string) => root.split('/v1/')[1] + '/' + path;
const urlPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
async function getDoc(c: Awaited<ReturnType<typeof client>>, path: string): Promise<(FireDocument & { data: RecordData }) | null> {
  const r = await fetch(c.root + '/' + urlPath(path), { headers: c.headers, cache:'no-store', signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return null;
  const doc = await response<FireDocument>(r);
  return { ...doc, data: unfields(doc.fields) };
}
async function commit(c: Awaited<ReturnType<typeof client>>, writes: FireWrite[]): Promise<void> {
  const r = await fetch(c.root + ':commit', { method: 'POST', headers: c.headers, body: JSON.stringify({ writes }), cache:'no-store', signal: AbortSignal.timeout(10000) });
  await response<RecordData>(r);
}
const put = (c: Awaited<ReturnType<typeof client>>, path: string, data: RecordData, pre: FireWrite['currentDocument']): FireWrite => ({ update: { name: docName(c.root,path), fields: fields(data) }, currentDocument: pre });
const target = (context: CompanyAuthorizedContext, collection: 'sourceSuppliers' | 'catalogItems', id: string) => companyDocumentPath(context.companyId,collection,id);
const belongs = (context: CompanyAuthorizedContext, d: RecordData) => {
  if (d.companyId !== context.companyId || d.workspaceId !== context.companyId || d.schemaVersion !== COMPANY_CONTRACT_VERSION) throw new SupplierServiceError('COMPANY_SCOPE_FORBIDDEN', 404);
};
function verifyId(id: string) { if (!/^[a-z0-9_-]{2,128}$/.test(id)) throw new SupplierServiceError('INVALID_ID',400); }
function keyHeader(key: string): string {
  if (!/^[A-Za-z0-9._:-]{12,128}$/.test(key)) throw new SupplierServiceError('IDEMPOTENCY_KEY_REQUIRED',400);
  return key;
}
async function prior(c: Awaited<ReturnType<typeof client>>, ctx: CompanyAuthorizedContext, action: string, key: string, requestHash: string): Promise<{ id: string; snapshot: RecordData } | null> {
  const path = companyDocumentPath(ctx.companyId,'idempotencyKeys', 'w2_'+hash(action+'|'+key));
  const doc = await getDoc(c,path);
  if (!doc) return null;
  belongs(ctx,doc.data);
  if (doc.data.requestHash !== requestHash || doc.data.action !== action) throw new SupplierServiceError('CONFLICT',409);
  return { id: String(doc.data.entityId), snapshot: (doc.data.resultSnapshot || {}) as RecordData };
}
function trail(c: Awaited<ReturnType<typeof client>>, ctx: CompanyAuthorizedContext, args: { action: 'sourceSuppliers:write' | 'catalogItems:write'; id: string; kind: CompanySubcollection; now: string; key: string; requestHash: string; before: number | null; after: number; operation: string; snapshot: RecordData }) {
  const eventId = 'w2_' + uuid();
  const event = { schemaVersion: COMPANY_CONTRACT_VERSION, eventId, companyId: ctx.companyId, workspaceId: ctx.companyId, actorUid: ctx.uid, action: args.action, entityType: args.kind, entityId: args.id, correlationId: eventId, idempotencyKey: args.key, beforeRevision: args.before, afterRevision: args.after, occurredAt: args.now };
  const idem = { schemaVersion: COMPANY_CONTRACT_VERSION, companyId: ctx.companyId, workspaceId: ctx.companyId, action: args.operation, requestHash: args.requestHash, entityId: args.id, actorUid: ctx.uid, createdAt: args.now, resultSnapshot: args.snapshot };
  const idemId = 'w2_'+hash(args.operation+'|'+args.key);
  return [put(c,companyDocumentPath(ctx.companyId,'auditEvents',eventId),event,{exists:false}), put(c,companyDocumentPath(ctx.companyId,'idempotencyKeys',idemId),idem,{exists:false})];
}
async function mutation<T extends object>(ctx: CompanyAuthorizedContext, kind: 'sourceSuppliers' | 'catalogItems', id: string, input: RecordData, key: string, expectedRevision?: number): Promise<{ result: T; replay: boolean }> {
  keyHeader(key); verifyId(id);
  const op = `${kind}:${expectedRevision === undefined ? 'create' : 'update'}:${id}`;
  const requestHash = hash(JSON.stringify({ input, expectedRevision }));
  const c = await client();
  const replayRecord = await prior(c,ctx,op,key,requestHash);
  if (replayRecord) {
    belongs(ctx,replayRecord.snapshot);
    return { result: replayRecord.snapshot as unknown as T, replay: true };
  }
  const existing = await getDoc(c,target(ctx,kind,id));
  if (expectedRevision === undefined && existing) throw new SupplierServiceError('CONFLICT',409);
  if (expectedRevision !== undefined) {
    if (!existing) throw new SupplierServiceError('NOT_FOUND',404);
    belongs(ctx,existing.data);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || existing.data.revision !== expectedRevision || !existing.updateTime) throw new SupplierServiceError('CONFLICT',409);
  }
  const now = new Date().toISOString();
  const record = { ...input, schemaVersion: COMPANY_CONTRACT_VERSION, id, companyId: ctx.companyId, workspaceId: ctx.companyId, createdByUid: existing ? existing.data.createdByUid : ctx.uid, createdAt: existing ? existing.data.createdAt : now, updatedAt: now, revision: (expectedRevision ?? 0) + 1 };
  const writes = [put(c,target(ctx,kind,id),record,existing ? {updateTime:existing.updateTime!}:{exists:false}), ...trail(c,ctx,{action:kind+':write' as 'sourceSuppliers:write'|'catalogItems:write',kind,id,now,key,requestHash,before:expectedRevision??null,after:record.revision,operation:op,snapshot:record})];
  try { await commit(c,writes); }
  catch (error) {
    if (error instanceof SupplierServiceError && error.status===409) {
      const done = await prior(c,ctx,op,key,requestHash);
      if (done) { belongs(ctx,done.snapshot); return { result:done.snapshot as unknown as T,replay:true }; }
    }
    throw error;
  }
  return { result: record as unknown as T, replay:false };
}
export async function getCompanyRecord<T>(ctx: CompanyAuthorizedContext, kind: 'sourceSuppliers' | 'catalogItems', id: string): Promise<T> {
  verifyId(id);
  const c = await client();
  const doc = await getDoc(c,target(ctx,kind,id));
  if (!doc) throw new SupplierServiceError('NOT_FOUND',404);
  belongs(ctx,doc.data);
  return doc.data as unknown as T;
}
export interface CompanyPage<T> { items: T[]; nextCursor: string | null; scanned: number }
export async function listCompanyRecords<T>(ctx: CompanyAuthorizedContext, kind: 'sourceSuppliers'|'catalogItems', search: string, cursor: string, pageSize: number): Promise<CompanyPage<T>> {
  if (search.length > 120 || cursor.length > 2048 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new SupplierServiceError('INVALID_PAGING',400);
  const c = await client();
  const params = new URLSearchParams({pageSize:String(pageSize)});
  if (cursor) params.set('pageToken',cursor);
  const r = await fetch(c.root + '/' + urlPath(ctx.rootPath+'/'+kind) + '?' + params, { headers:c.headers, cache:'no-store', signal:AbortSignal.timeout(8000) });
  const page = await response<{ documents?:FireDocument[]; nextPageToken?:string }>(r);
  const candidates = (page.documents ?? []).map(d=>unfields(d.fields));
  const query = normalizedSupplierName(search);
  const items = candidates.filter(d => { belongs(ctx,d); return !query || normalizedSupplierName([d.legalName,d.tradeName,d.cnpj,d.sku,d.title].filter(Boolean).join(' ')).includes(query); });
  // Cursor advances over scanned documents even when the filter found nothing.
  return {items:items as T[], nextCursor:page.nextPageToken ?? null, scanned:candidates.length};
}
export async function createSourceSupplier(ctx: CompanyAuthorizedContext, raw: unknown, key: string) {
  const parsed = parseSourceSupplier(raw);
  const id = parsed.cnpj ? 'tax_'+parsed.cnpj : 'name_'+hash(normalizedSupplierName(parsed.legalName)).slice(0,40);
  return mutation<SourceSupplier>(ctx,'sourceSuppliers',id,{...parsed, normalizedName:normalizedSupplierName(parsed.legalName), status:supplierRecordStatus(parsed.lifecycle)},key);
}
export async function updateSourceSupplier(ctx: CompanyAuthorizedContext, id: string, raw: unknown, key: string) {
  const input = raw as { expectedRevision?: unknown; data?: unknown };
  if (!input || !Number.isSafeInteger(input.expectedRevision)) throw new SupplierServiceError('EXPECTED_REVISION_REQUIRED',400);
  const existing = await getCompanyRecord<SourceSupplier>(ctx,'sourceSuppliers',id);
  const parsed = parseSourceSupplier(input.data);
  if (parsed.cnpj !== existing.cnpj || normalizedSupplierName(parsed.legalName) !== existing.normalizedName) throw new SupplierServiceError('IMMUTABLE_SUPPLIER_IDENTITY',409);
  return mutation<SourceSupplier>(ctx,'sourceSuppliers',id,{...parsed, normalizedName:existing.normalizedName, status:supplierRecordStatus(parsed.lifecycle)},key,input.expectedRevision as number);
}
async function verifySourceOptions(ctx: CompanyAuthorizedContext, input: CatalogItemInput): Promise<void> {
  for (const id of new Set(input.sourcingOptions.map(o=>o.sourceSupplierId))) {
    const supplier = await getCompanyRecord<SourceSupplier>(ctx,'sourceSuppliers',id);
    // Historical associations remain visible; W6 must call assertSupplierSelectable on checkout.
    if (supplier.companyId !== ctx.companyId) throw new SupplierServiceError('COMPANY_SCOPE_FORBIDDEN',404);
  }
}
export async function createCatalogItem(ctx: CompanyAuthorizedContext, raw: unknown, key: string) {
  const parsed = parseCatalogItem(raw);
  await verifySourceOptions(ctx,parsed);
  const id = 'sku_'+hash(normalizedSku(parsed.sku)).slice(0,48);
  return mutation<CatalogItem>(ctx,'catalogItems',id,{...parsed,status:'active'},key);
}
export async function updateCatalogItem(ctx: CompanyAuthorizedContext, id: string, raw: unknown, key: string) {
  const input = raw as { expectedRevision?: unknown; data?: unknown };
  if (!input || !Number.isSafeInteger(input.expectedRevision)) throw new SupplierServiceError('EXPECTED_REVISION_REQUIRED',400);
  const existing = await getCompanyRecord<CatalogItem>(ctx,'catalogItems',id);
  const parsed = parseCatalogItem(input.data);
  if (parsed.sku !== existing.sku || parsed.canonicalUnit !== existing.canonicalUnit) throw new SupplierServiceError('IMMUTABLE_CATALOG_IDENTITY',409);
  // Price observations and references are append-only: historical quotes cannot be rewritten/deleted.
  for (const oldOption of existing.sourcingOptions) {
    const nextOption = parsed.sourcingOptions.find(o=>o.sourceSupplierId===oldOption.sourceSupplierId && o.supplierSku===oldOption.supplierSku);
    if (!nextOption || nextOption.purchaseUnit !== oldOption.purchaseUnit
      || nextOption.conversion.from !== oldOption.conversion.from || nextOption.conversion.to !== oldOption.conversion.to
      || nextOption.conversion.numerator !== oldOption.conversion.numerator || nextOption.conversion.denominator !== oldOption.conversion.denominator
      || nextOption.priceHistory.length < oldOption.priceHistory.length
      || oldOption.priceHistory.some((oldPrice, index) => {
        const nextPrice = nextOption.priceHistory[index];
        return !nextPrice || nextPrice.amountCents !== oldPrice.amountCents || nextPrice.currency !== oldPrice.currency
          || nextPrice.quotedAt !== oldPrice.quotedAt || nextPrice.validFrom !== oldPrice.validFrom
          || nextPrice.validUntil !== oldPrice.validUntil || nextPrice.basis !== oldPrice.basis;
      })) throw new SupplierServiceError('PRICE_HISTORY_IMMUTABLE',409);
  }
  const wantedStatus = (input.data as RecordData)?.status ?? existing.status;
  if (wantedStatus !== 'active' && wantedStatus !== 'archived') throw new SupplierServiceError('INVALID_STATUS',400);
  await verifySourceOptions(ctx,parsed);
  return mutation<CatalogItem>(ctx,'catalogItems',id,{...parsed,status:wantedStatus},key,input.expectedRevision as number);
}
export function verifySupplierForPurchase(supplier: SourceSupplier) { assertSupplierSelectable(supplier); }

/** W6 must call this after guard, at purchase validation, and recheck supplier inside its own commit transaction. */
export async function resolveSourceOptionForPurchase(ctx: CompanyAuthorizedContext, itemId: string, supplierId: string, supplierSku: string) {
  const [item, supplier] = await Promise.all([getCompanyRecord<CatalogItem>(ctx,'catalogItems',itemId), getCompanyRecord<SourceSupplier>(ctx,'sourceSuppliers',supplierId)]);
  return purchaseSelectionContract(item,supplier,supplierSku);
}
