import { createHash, randomUUID } from 'node:crypto';
import firebaseConfig from '../../../config/empresas-firebase-web.json';
import { companyCollectionPath, companyDocumentPath, type CompanySubcollection } from '../contracts';
import type { CompanyAuthorizedContext } from '../../server/companyAuthz';
import { getCompanyAccessToken } from '../../server/companyFirebaseRuntime';
import { ensureOwned, W1Error } from './model';

/** Server-only Firestore REST; never expose a client SDK with privileges. */
type Value = {stringValue?:string; integerValue?:string; doubleValue?:number; booleanValue?:boolean;
  nullValue?:string; mapValue?:{fields?:Record<string,Value>}; arrayValue?:{values?:Value[]}};
type Document = {name?:string; fields?:Record<string,Value>; updateTime?:string};
type Write = {path:string; data:Record<string,unknown>; updateTime?:string};
const domains = new Set<CompanySubcollection>(['publicCustomers','commitments','customerOrders']);

function demoConfig(): {host:string; project:string} | null {
  const requested = process.env.EMPROVEX_E2E_SERVER_AUTH === '1';
  if (!requested) return null;
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  const project = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || '';
  if (process.env.K_SERVICE || process.env.VERCEL || process.env.GAE_SERVICE
    || !['127.0.0.1:8080','localhost:8080'].includes(host)
    || !project.startsWith('demo-')
    || !['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
    throw new W1Error('EMULATOR_SCOPE_INVALID', 503);
  }
  return {host,project};
}
function encode(v: unknown): Value {
  if (v === null) return {nullValue:'NULL_VALUE'};
  if (typeof v === 'string') return {stringValue:v};
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new W1Error('INVALID_INPUT',400);
    return Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v};
  }
  if (typeof v === 'boolean') return {booleanValue:v};
  if (Array.isArray(v)) return {arrayValue:{values:v.map(x => encode(x === undefined ? null : x))}};
  if (v && typeof v === 'object') return {mapValue:{fields:fields(v as Record<string,unknown>)}};
  throw new W1Error('INVALID_INPUT',400);
}
function fields(v: Record<string,unknown>): Record<string,Value> {
  return Object.fromEntries(Object.entries(v).filter(([,value]) => value !== undefined)
    .map(([name,value]) => [name,encode(value)]));
}
function decode(v:Value):unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decode);
  return Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([key,value]) => [key,decode(value)]));
}
function decodeDoc(d:Document): Record<string,unknown> {
  return Object.fromEntries(Object.entries(d.fields || {}).map(([key,value]) => [key,decode(value)]));
}
export interface Stored {data:Record<string,unknown>; updateTime:string}
export class W1Store {
  private constructor(private readonly root:string, private readonly token:string,
    private readonly ctx:CompanyAuthorizedContext) {}
  static async connect(ctx:CompanyAuthorizedContext): Promise<W1Store> {
    const demo=demoConfig();
    const root = demo
      ? 'http://' + demo.host + '/v1/projects/' + demo.project + '/databases/(default)/documents'
      : 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(firebaseConfig.projectId)
        + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';
    return new W1Store(root, demo ? 'owner' : await getCompanyAccessToken(), ctx);
  }
  private check(domain: CompanySubcollection, id?:string):string {
    if (!domains.has(domain)) throw new W1Error('INVALID_SCOPE',503);
    const collection=companyCollectionPath(this.ctx.companyId, domain);
    if (collection !== this.ctx.rootPath + '/' + domain) throw new W1Error('INVALID_SCOPE',503);
    return id === undefined ? collection : companyDocumentPath(this.ctx.companyId,domain,id);
  }
  private url(path:string) { const at=path.indexOf('?'); const route=at===-1 ? path : path.slice(0,at);
    return this.root + '/' + route.split('/').map(encodeURIComponent).join('/') + (at===-1 ? '' : path.slice(at)); }
  private async request(path:string, init:RequestInit):Promise<Response> {
    try {
      return await fetch(this.url(path),{...init,headers:{authorization:'Bearer '+this.token,
        ...(init.body ? {'content-type':'application/json'} : {})}, cache:'no-store',signal:AbortSignal.timeout(15000)});
    } catch { throw new W1Error('DIRECTORY_UNAVAILABLE',503); }
  }
  async get(domain:CompanySubcollection,id:string):Promise<Stored|null> {
    const path=this.check(domain,id);
    const response=await this.request(path,{method:'GET'});
    if (response.status===404) return null;
    if (!response.ok) throw new W1Error('DIRECTORY_UNAVAILABLE',503);
    const raw=await response.json() as Document;
    if (raw.name !== this.fullName(path) || !raw.updateTime) throw new W1Error('TENANT_INTEGRITY_ERROR',503);
    const data=decodeDoc(raw); ensureOwned(data,this.ctx.companyId);
    return {data,updateTime:raw.updateTime};
  }
  async list(domain:CompanySubcollection,limit:number,cursor:string|undefined) {
    const path=this.check(domain);
    if (!Number.isInteger(limit) || limit<1 || limit>50 || (cursor && (cursor.length>2048 || /[\x00-\x1f]/.test(cursor)))) {
      throw new W1Error('INVALID_INPUT',400);
    }
    const qs=new URLSearchParams({pageSize:String(limit),orderBy:'__name__'});
    if (cursor) qs.set('pageToken',cursor);
    const response=await this.request(path+'?'+qs.toString(),{method:'GET'});
    if (response.status===404) return {items:[],nextCursor:null};
    if (!response.ok) throw new W1Error('DIRECTORY_UNAVAILABLE',503);
    const raw=await response.json() as {documents?:Document[];nextPageToken?:string};
    if (!Array.isArray(raw.documents) && raw.documents !== undefined) throw new W1Error('TENANT_INTEGRITY_ERROR',503);
    const items=(raw.documents || []).map(d => {
      const prefix=this.fullName(path)+'/';
      if (!d.name?.startsWith(prefix) || d.name.slice(prefix.length).includes('/') || !d.updateTime) {
        throw new W1Error('TENANT_INTEGRITY_ERROR',503);
      }
      const data=decodeDoc(d); ensureOwned(data,this.ctx.companyId);
      if (data.id !== d.name?.slice(d.name.lastIndexOf('/')+1)) throw new W1Error('TENANT_INTEGRITY_ERROR',503);
      return data;
    });
    return {items,nextCursor:raw.nextPageToken || null};
  }
  async replay(action:string,key:string,hash:string):Promise<Record<string,unknown>|null> {
    const id=createHash('sha256').update(this.ctx.uid+':'+action+':'+key).digest('hex');
    const path=companyDocumentPath(this.ctx.companyId,'idempotencyKeys',id);
    const response=await this.request(path,{method:'GET'});
    if (response.status===404) return null;
    if (!response.ok) throw new W1Error('DIRECTORY_UNAVAILABLE',503);
    const d=decodeDoc(await response.json() as Document);
    if (d.companyId!==this.ctx.companyId || d.uid!==this.ctx.uid || d.action!==action) throw new W1Error('TENANT_INTEGRITY_ERROR',503);
    if (d.requestHash!==hash) throw new W1Error('IDEMPOTENCY_CONFLICT',409);
    return d.result && typeof d.result==='object' && !Array.isArray(d.result)
      ? d.result as Record<string,unknown> : null;
  }
  async commit(action:string,key:string,hash:string,result:Record<string,unknown>,entityId:string,
    writes:Write[],correlationId:string):Promise<void> {
    if (!writes.length || writes.length>3) throw new W1Error('INVALID_SCOPE',503);
    const keyId=createHash('sha256').update(this.ctx.uid+':'+action+':'+key).digest('hex');
    const auditId=randomUUID();
    const now=new Date().toISOString();
    const idemPath=companyDocumentPath(this.ctx.companyId,'idempotencyKeys',keyId);
    const auditPath=companyDocumentPath(this.ctx.companyId,'auditEvents',auditId);
    const permitted=new Set(writes.map(w=>w.path));
    if (permitted.size!==writes.length || writes.some(w=>!['publicCustomers','commitments','customerOrders']
      .some(domain=>w.path.startsWith(this.check(domain as CompanySubcollection)+'/')))) throw new W1Error('INVALID_SCOPE',503);
    const auditAction=action.split(':')[0]+':write';
    if (!['publicCustomers:write','commitments:write','customerOrders:write'].includes(auditAction)) throw new W1Error('INVALID_SCOPE',503);
    const commitWrites=[
      ...writes.map(w=>({update:{name:this.fullName(w.path),fields:fields(w.data)},
        currentDocument:w.updateTime ? {updateTime:w.updateTime} : {exists:false}})),
      {update:{name:this.fullName(idemPath),fields:fields({
        schemaVersion:'company-r1-v1',companyId:this.ctx.companyId,uid:this.ctx.uid,
        action,idempotencyKey:key,requestHash:hash,requestedAt:now,result,
      })},currentDocument:{exists:false}},
      {update:{name:this.fullName(auditPath),fields:fields({
        schemaVersion:'company-r1-v1',eventId:auditId,companyId:this.ctx.companyId,
        actorUid:this.ctx.uid,action:auditAction,operation:action,
        entityType:action.split(':')[0],entityId,
        correlationId,idempotencyKey:key,beforeRevision:writes[0].updateTime ? Number(writes[0].data.revision)-1 : null,
        afterRevision:Number(writes[0].data.revision),occurredAt:now,
      })},currentDocument:{exists:false}},
    ];
    let response:Response;
    try {
      response=await fetch(this.root+':commit',{method:'POST',headers:{authorization:'Bearer '+this.token,
        'content-type':'application/json'},body:JSON.stringify({writes:commitWrites}),
        cache:'no-store',signal:AbortSignal.timeout(15000)});
    } catch { throw new W1Error('DIRECTORY_UNAVAILABLE',503); }
    if (!response.ok) {
      if ([409,412].includes(response.status)) throw new W1Error('CONFLICT',409);
      const body=(await response.text()).slice(0,500);
      if (/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/i.test(body)) throw new W1Error('CONFLICT',409);
      throw new W1Error('DIRECTORY_UNAVAILABLE',503);
    }
  }
  documentPath(domain:CompanySubcollection,id:string):string {return this.check(domain,id);}
  private fullName(path:string):string {
    const prefix=this.root.replace(/^https?:\/\/[^/]+\/v1\//,'');
    return prefix+'/'+path;
  }
}
