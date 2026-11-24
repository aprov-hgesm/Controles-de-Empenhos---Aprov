import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

const database = 'emprovex-credito';
const prefix = 'projects/' + firebaseConfig.projectId + '/databases/' + database + '/documents';
const root = 'https://firestore.googleapis.com/v1/' + prefix;
export class CreditStoreError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message); this.name = 'CreditStoreError';
  }
}
const unavailable = () => new CreditStoreError(503, 'CREDIT_STORE_UNAVAILABLE', 'Serviço financeiro indisponível. Tente novamente.');
const conflict = () => new CreditStoreError(409, 'CREDIT_STORE_CONFLICT', 'Registro alterado simultaneamente. Atualize e confira novamente.');
type Wire = Record<string, unknown>;
type Fields = Record<string, Wire>;
export type CreditDocument<T = Record<string, unknown>> = { path: string; data: T; updateTime: string };
export type CreditCollection = 'credits'|'commitments'|'centers'|'movements'|'audit'|'documents';
const docPattern = /^creditUnits\/\d{6}\/(?:credits|commitments|centers|movements|audit|documents|settings)\/[A-Za-z0-9_-]{1,180}$/;
function name(path: string) {
  if (!docPattern.test(path)) throw new CreditStoreError(422, 'CREDIT_INVALID_PATH', 'Identificador financeiro inválido.');
  return prefix + '/' + path;
}
function encode(value: unknown): Wire {
  if (value === null) return {nullValue: null};
  if (typeof value === 'string') return {stringValue: value};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number' && Number.isSafeInteger(value)) return {integerValue: String(value)};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return {mapValue: {fields: encodeFields(value as Record<string, unknown>)}};
  }
  throw new CreditStoreError(422, 'CREDIT_INVALID_VALUE', 'Valor financeiro inválido.');
}
export function encodeFields(data: Record<string, unknown>): Fields {
  return Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
}
function decode(v: Wire): unknown {
  if ('nullValue' in v) return null;
  if (typeof v.stringValue === 'string') return v.stringValue;
  if (typeof v.booleanValue === 'boolean') return v.booleanValue;
  if (typeof v.timestampValue === 'string') return v.timestampValue;
  if (typeof v.integerValue === 'string' && /^-?\d+$/.test(v.integerValue)) {
    const n = Number(v.integerValue); if (Number.isSafeInteger(n)) return n;
  }
  if (v.arrayValue && typeof v.arrayValue === 'object') {
    const values = (v.arrayValue as {values?: Wire[]}).values ?? [];
    if (Array.isArray(values)) return values.map(decode);
  }
  if (v.mapValue && typeof v.mapValue === 'object') return decodeFields((v.mapValue as {fields?: Fields}).fields ?? {});
  throw unavailable();
}
export function decodeFields(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,decode(v)]));
}
function stream(raw: string): Wire[] {
  try {
    const value: unknown = JSON.parse(raw);
    const rows = Array.isArray(value) ? value : [value];
    if (rows.every(r=>r && typeof r==='object' && !Array.isArray(r))) return rows as Wire[];
  } catch { /* alguns adaptadores devolvem NDJSON */ }
  try { return raw.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line) as Wire); }
  catch { throw unavailable(); }
}
function document<T>(raw: unknown, expectedName: string): CreditDocument<T> {
  const doc = raw as {name?: string; updateTime?: string; fields?: Fields};
  if (!doc || doc.name !== expectedName || !doc.updateTime || !doc.fields) throw unavailable();
  return {path: expectedName.slice(prefix.length+1), data: decodeFields(doc.fields) as T, updateTime: doc.updateTime};
}
class CreditFirestore {
  constructor(private readonly token: string) {}
  async request(operation: string, body: unknown): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(root+operation, {
        method:'POST', cache:'no-store', signal:AbortSignal.timeout(15000),
        headers:{authorization:'Bearer '+this.token,'content-type':'application/json'},
        body:JSON.stringify(body),
      });
    } catch { throw unavailable(); }
    if (!response.ok) {
      const raw = await response.text().catch(()=> '');
      if (response.status===409 || response.status===412 || /"status"\s*:\s*"(ABORTED|FAILED_PRECONDITION)"/.test(raw)) throw conflict();
      throw unavailable();
    }
    return response;
  }
  async begin(readOnly: boolean): Promise<string> {
    const data = await (await this.request(':beginTransaction',{options: readOnly ? {readOnly:{}} : {readWrite:{}}})).json();
    if (typeof data.transaction !== 'string' || !data.transaction) throw unavailable();
    return data.transaction;
  }
}
export class CreditTransaction {
  private readonly read = new Map<string, CreditDocument | null>();
  private readonly writes = new Map<string, Wire>();
  constructor(private readonly db: CreditFirestore, private readonly transaction: string, private readonly readOnly: boolean) {}
  async get<T>(path: string): Promise<CreditDocument<T> | null> {
    return (await this.getMany<T>([path])).get(path) ?? null;
  }
  async getMany<T>(paths: readonly string[]): Promise<Map<string, CreditDocument<T> | null>> {
    if (paths.length > 250) throw new CreditStoreError(422,'CREDIT_READ_LIMIT','Quantidade de registros acima do limite.');
    const unique = [...new Set(paths)];
    const missing = unique.filter(p=>!this.read.has(p));
    if (missing.length) {
      if (this.writes.size) throw unavailable(); // Firestore exige todas as leituras antes das escritas.
      const expected = new Map(missing.map(p=>[name(p),p]));
      const rows = stream(await (await this.db.request(':batchGet',{documents:[...expected.keys()],transaction:this.transaction})).text());
      const seen = new Set<string>();
      for (const row of rows) {
        const found = row.found as {name?: string} | undefined;
        const n = found?.name ?? row.missing;
        if (typeof n!=='string' || !expected.has(n) || seen.has(n)) throw unavailable();
        seen.add(n);
        this.read.set(expected.get(n)!,found ? document(n && found,n) : null);
      }
      if (seen.size!==expected.size) throw unavailable();
    }
    return new Map(unique.map(p=>[p,this.read.get(p) as CreditDocument<T>|null]));
  }
  /** Consulta paginada por nome, dentro do mesmo snapshot. Filtro simples indexado automaticamente. */
  async list<T>(ug: string, collection: CreditCollection, filter?: {field:'year'|'creditId'|'centerId'; value:string}): Promise<CreditDocument<T>[]> {
    if (!/^\d{6}$/.test(ug) || this.writes.size) throw unavailable();
    const parent = 'creditUnits/'+ug;
    const collectionPrefix = name(parent+'/'+collection+'/probe').slice(0,-5);
    const result: CreditDocument<T>[] = [];
    let last = '';
    const max = 5000, pageSize = 250;
    for (;;) {
      const structuredQuery = {
        from:[{collectionId:collection}],
        ...(filter?{where:{fieldFilter:{field:{fieldPath:filter.field},op:'EQUAL',value:{stringValue:filter.value}}}}:{}),
        orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],
        ...(last?{startAt:{values:[{referenceValue:last}],before:false}}:{}),
        limit:Math.min(pageSize,max-result.length+1),
      };
      const rows = stream(await (await this.db.request('/'+parent+':runQuery',{structuredQuery,transaction:this.transaction})).text());
      let count=0;
      for (const row of rows) {
        if (!row.document) continue;
        const n = (row.document as {name?:string}).name;
        if (!n || !n.startsWith(collectionPrefix) || !/^[A-Za-z0-9_-]{1,180}$/.test(n.slice(collectionPrefix.length)) || n<=last) throw unavailable();
        const doc = document<T>(row.document,n);
        result.push(doc);
        this.read.set(doc.path,doc as CreditDocument);
        count++; last=n;
        if (result.length>max) throw new CreditStoreError(503,'CREDIT_QUERY_LIMIT','Volume financeiro acima do limite seguro de consulta. Solicite revisão técnica.');
      }
      if (count<structuredQuery.limit) return result;
    }
  }
  set(path: string, data: object) {
    if (this.readOnly || !this.read.has(path) || this.writes.has(path) || this.writes.size>=450) throw unavailable();
    const old = this.read.get(path);
    this.writes.set(path,{update:{name:name(path),fields:encodeFields(data as Record<string,unknown>)},
      currentDocument:old ? {updateTime:old.updateTime} : {exists:false}});
  }
  async commit(): Promise<boolean> {
    if (!this.writes.size) return false;
    await this.db.request(':commit',{transaction:this.transaction,writes:[...this.writes.values()]});
    return true;
  }
}
export async function creditTransaction<T>(work:(tx:CreditTransaction)=>Promise<T>, readOnly=false):Promise<T> {
  const db = new CreditFirestore(await getGoogleAccessToken());
  for(let attempt=0;attempt<3;attempt++) {
    let transaction = '', committed=false;
    try {
      transaction = await db.begin(readOnly);
      const tx = new CreditTransaction(db,transaction,readOnly);
      const result = await work(tx);
      committed = await tx.commit();
      return result;
    } catch(error) {
      if (!(error instanceof CreditStoreError) || error.code!=='CREDIT_STORE_CONFLICT' || attempt===2) throw error;
    } finally {
      if(transaction&&!committed) await db.request(':rollback',{transaction}).catch(()=>undefined);
    }
    await new Promise(resolve=>setTimeout(resolve,30*(attempt+1)));
  }
  throw conflict();
}
