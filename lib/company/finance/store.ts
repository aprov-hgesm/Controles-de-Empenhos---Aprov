/** W8 Firestore adapter: company-root only, server-guard required, no client SDK or military ledger. */
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import firebaseConfig from '../../../firebase-applet-config.json';
import { getGoogleAccessToken } from '../../server/sectorProvisioningAdmin';
import type { CompanyAuthorizedContext } from '../../server/companyAuthz';
import { COMPANY_CONTRACT_VERSION, companyDocumentPath } from '../contracts';
import { applyEntry, balance, cancelObligation, FinanceError, parseEntryCommand,
  parseFinanceDraft, recordId, type FinanceDirection, type FinanceObligation } from './model';

type Data = Record<string,unknown>;
type FV = {stringValue?:string;integerValue?:string;doubleValue?:number;booleanValue?:boolean;
  nullValue?:'NULL_VALUE';arrayValue?:{values?:FV[]};mapValue?:{fields?:Record<string,FV>}};
type Document = {name:string;fields?:Record<string,FV>;updateTime?:string};
type Write = {update:{name:string;fields:Record<string,FV>};currentDocument:{exists:false}|{updateTime:string}};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid=()=>randomUUID().replace(/-/g,'');
const encode=(v:unknown):FV=>{
  if(v===null) return {nullValue:'NULL_VALUE'};
  if(typeof v==='string') return {stringValue:v};
  if(typeof v==='boolean') return {booleanValue:v};
  if(typeof v==='number'&&Number.isSafeInteger(v)) return {integerValue:String(v)};
  if(typeof v==='number'&&Number.isFinite(v)) return {doubleValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(encode)}};
  if(v&&typeof v==='object') return {mapValue:{fields:toFields(v as Data)}};
  throw new FinanceError('FINANCE_INVALID_VALUE',400);
};
const toFields=(v:Data):Record<string,FV>=>Object.fromEntries(Object.entries(v)
  .filter(([,value])=>value!==undefined).map(([key,value])=>[key,encode(value)]));
const decode=(v:FV):unknown=>{
  if(v.stringValue!==undefined)return v.stringValue;
  if(v.integerValue!==undefined) { const n=Number(v.integerValue); if(!Number.isSafeInteger(n)) throw new FinanceError('FINANCE_DATA_INVALID',503); return n; }
  if(v.doubleValue!==undefined)return v.doubleValue;
  if(v.booleanValue!==undefined)return v.booleanValue;
  if(v.nullValue)return null;
  if(v.arrayValue)return (v.arrayValue.values??[]).map(decode);
  if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,value])=>[k,decode(value)]));
  return null;
};
const fromFields=(v?:Record<string,FV>):Data=>Object.fromEntries(Object.entries(v??{}).map(([k,value])=>[k,decode(value)]));
function cfg(){
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID??'';
    const f=process.env.FIRESTORE_EMULATOR_HOST??'',a=process.env.FIREBASE_AUTH_EMULATOR_HOST??'';
    if(!/^demo-[a-z0-9-]+$/.test(project)||!['127.0.0.1:8080','localhost:8080'].includes(f)
      ||!['127.0.0.1:9099','localhost:9099'].includes(a)
      ||process.env.K_SERVICE||process.env.VERCEL||process.env.GAE_SERVICE) throw new FinanceError('FINANCE_EMULATOR_INVALID',503);
    return {root:'http://'+f+'/v1/projects/'+project+'/databases/(default)/documents',token:'owner'};
  }
  if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new FinanceError('FINANCE_EMULATOR_INVALID',503);
  return {root:'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)
    +'/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',token:''};
}
type Client={root:string;headers:Record<string,string>};
async function client():Promise<Client>{
  const c=cfg();
  try{return {root:c.root,headers:{Authorization:'Bearer '+(c.token||await getGoogleAccessToken()),
    'Content-Type':'application/json'}};}catch{throw new FinanceError('FINANCE_BACKEND_UNAVAILABLE',503);}
}
async function checked<T>(r:Response):Promise<T>{
  if(r.status===404)throw new FinanceError('FINANCE_NOT_FOUND',404);
  if(r.status===409||r.status===412)throw new FinanceError('FINANCE_CONFLICT',409);
  if(!r.ok)throw new FinanceError('FINANCE_BACKEND_UNAVAILABLE',503);
  try{return await r.json() as T;}catch{throw new FinanceError('FINANCE_BACKEND_UNAVAILABLE',503);}
}
const pathUrl=(p:string)=>p.split('/').map(encodeURIComponent).join('/');
const fullName=(c:Client,path:string)=>c.root.split('/v1/')[1]+'/'+path;
async function get(c:Client,path:string):Promise<(Document&{data:Data})|null>{
  const r=await fetch(c.root+'/'+pathUrl(path),{headers:c.headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(r.status===404)return null;
  const d=await checked<Document>(r);
  return {...d,data:fromFields(d.fields)};
}
const put=(c:Client,path:string,data:Data,pre:Write['currentDocument']):Write=>
  ({update:{name:fullName(c,path),fields:toFields(data)},currentDocument:pre});
async function commit(c:Client,writes:Write[]):Promise<void>{
  await checked<Data>(await fetch(c.root+':commit',{method:'POST',headers:c.headers,
    body:JSON.stringify({writes}),cache:'no-store',signal:AbortSignal.timeout(12000)}));
}
function collection(direction:FinanceDirection){return direction==='payable'?'accountsPayable':'accountsReceivable';}
function owned(ctx:CompanyAuthorizedContext,d:Data){
  if(d.companyId!==ctx.companyId||d.workspaceId!==ctx.companyId||d.schemaVersion!==COMPANY_CONTRACT_VERSION
    ||!Number.isSafeInteger(d.revision)||Number(d.revision)<1) throw new FinanceError('FINANCE_SCOPE_INVALID',503);
}
function authenticated(ctx:CompanyAuthorizedContext,direction:FinanceDirection,write:boolean){
  if(ctx.action!==(collection(direction)+(write?':write':':read'))) throw new FinanceError('FINANCE_FORBIDDEN',503);
  // W0 admits only verified owner. After W3 integration, role comes strictly from live server membership.
  if(!['owner','admin','finance'].includes(ctx.role))throw new FinanceError('FINANCE_FORBIDDEN',503);
}
function target(ctx:CompanyAuthorizedContext,direction:FinanceDirection,id:string){
  return companyDocumentPath(ctx.companyId,collection(direction),recordId(id));
}
function key(v:string):string{
  if(!/^[A-Za-z0-9._:-]{12,128}$/.test(v)) throw new FinanceError('FINANCE_IDEMPOTENCY_REQUIRED',400);
  return v;
}
function stable(v:unknown):string{
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v as Data).sort().map(k=>JSON.stringify(k)+':'+stable((v as Data)[k])).join(',')+'}';
  return JSON.stringify(v);
}
async function replay(c:Client,ctx:CompanyAuthorizedContext,op:string,k:string,digest:string):Promise<FinanceObligation|null>{
  const id='w8_'+hash(ctx.uid+'|'+op+'|'+k);
  const d=await get(c,companyDocumentPath(ctx.companyId,'idempotencyKeys',id));
  if(!d)return null;
  owned(ctx,d.data);
  if(d.data.requestHash!==digest||d.data.operation!==op)throw new FinanceError('FINANCE_CONFLICT',409);
  const snapshot=d.data.resultSnapshot as FinanceObligation;
  owned(ctx,snapshot as unknown as Data);
  return snapshot;
}
async function mutate(ctx:CompanyAuthorizedContext,direction:FinanceDirection,op:string,
  request:unknown,k:string,id:string,
  build:(current:FinanceObligation|null)=>FinanceObligation):Promise<{result:FinanceObligation;replay:boolean}>{
  authenticated(ctx,direction,true);key(k);
  const digest=hash(stable({request,op,direction}));
  const c=await client();const found=await replay(c,ctx,op,k,digest);
  if(found)return {result:found,replay:true};
  const prior=await get(c,target(ctx,direction,id));
  if(prior)owned(ctx,prior.data);
  const current=prior?.data as unknown as FinanceObligation|null ?? null;
  const result=build(current);
  const now=new Date().toISOString(),eventId='w8_'+uuid(),idemId='w8_'+hash(ctx.uid+'|'+op+'|'+k);
  const audit={schemaVersion:COMPANY_CONTRACT_VERSION,eventId,companyId:ctx.companyId,
    workspaceId:ctx.companyId,actorUid:ctx.uid,action:collection(direction)+':write',
    operation:op,entityType:collection(direction),entityId:id,correlationId:eventId,idempotencyKey:k,
    beforeRevision:current?.revision??null,afterRevision:result.revision,occurredAt:now};
  const idem={schemaVersion:COMPANY_CONTRACT_VERSION,companyId:ctx.companyId,workspaceId:ctx.companyId,
    actorUid:ctx.uid,operation:op,requestHash:digest,createdAt:now,resultSnapshot:result};
  const writes=[
    put(c,target(ctx,direction,id),result as unknown as Data,prior?.updateTime?{updateTime:prior.updateTime}:{exists:false}),
    put(c,companyDocumentPath(ctx.companyId,'auditEvents',eventId),audit,{exists:false}),
    put(c,companyDocumentPath(ctx.companyId,'idempotencyKeys',idemId),idem,{exists:false}),
  ];
  try{await commit(c,writes);}catch(e){
    if(e instanceof FinanceError&&e.status===409){const completed=await replay(c,ctx,op,k,digest);
      if(completed)return {result:completed,replay:true};}
    throw e;
  }
  return {result,replay:false};
}
export async function createObligation(ctx:CompanyAuthorizedContext,direction:FinanceDirection,
  body:unknown,idem:string){
  authenticated(ctx,direction,true);
  const parsed=parseFinanceDraft(body,direction);
  const id='f8_'+hash(stable({direction,counterparty:parsed.counterparty.id,
    number:parsed.invoice.number,series:parsed.invoice.series||''})).slice(0,48);
  return mutate(ctx,direction,'create:'+id,parsed,idem,id,current=>{
    if(current)throw new FinanceError('FINANCE_DUPLICATE_INVOICE',409);
    const at=new Date().toISOString();
    return {...parsed,id,schemaVersion:COMPANY_CONTRACT_VERSION,companyId:ctx.companyId,workspaceId:ctx.companyId,
      status:'active',createdByUid:ctx.uid,createdAt:at,updatedAt:at,revision:1,
      entries:[],financialStatus:'open'};
  });
}
export async function recordEntry(ctx:CompanyAuthorizedContext,direction:FinanceDirection,id:string,
  body:unknown,idem:string){
  authenticated(ctx,direction,true);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new FinanceError('FINANCE_INVALID_INPUT',400);
  const raw=body as Data,command=parseEntryCommand(raw);
  const revision=raw.expectedRevision;
  if(!Number.isSafeInteger(revision)||Number(revision)<1)throw new FinanceError('FINANCE_INVALID_INPUT',400);
  return mutate(ctx,direction,'entry:'+id,{command,revision},idem,id,current=>{
    if(!current)throw new FinanceError('FINANCE_NOT_FOUND',404);
    if(current.revision!==revision)throw new FinanceError('FINANCE_CONFLICT',409);
    const at=new Date().toISOString();
    return applyEntry(current,command,'fe_'+uuid(),ctx.uid,at);
  });
}
export async function cancel(ctx:CompanyAuthorizedContext,direction:FinanceDirection,id:string,
  body:unknown,idem:string){
  authenticated(ctx,direction,true);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new FinanceError('FINANCE_INVALID_INPUT',400);
  const raw=body as Data;
  if(!Number.isSafeInteger(raw.expectedRevision)||typeof raw.reason!=='string')throw new FinanceError('FINANCE_INVALID_INPUT',400);
  return mutate(ctx,direction,'cancel:'+id,{revision:raw.expectedRevision,reason:raw.reason},idem,id,current=>{
    if(!current)throw new FinanceError('FINANCE_NOT_FOUND',404);
    if(current.revision!==raw.expectedRevision)throw new FinanceError('FINANCE_CONFLICT',409);
    return cancelObligation(current,raw.reason as string,new Date().toISOString());
  });
}
export async function one(ctx:CompanyAuthorizedContext,direction:FinanceDirection,id:string):Promise<FinanceObligation>{
  authenticated(ctx,direction,false);
  const c=await client(),d=await get(c,target(ctx,direction,id));
  if(!d)throw new FinanceError('FINANCE_NOT_FOUND',404);
  owned(ctx,d.data);
  const r=d.data as unknown as FinanceObligation;balance(r);return r;
}
export async function page(ctx:CompanyAuthorizedContext,direction:FinanceDirection,limit:number,cursor:string){
  authenticated(ctx,direction,false);
  if(!Number.isSafeInteger(limit)||limit<1||limit>50||cursor.length>2048)throw new FinanceError('FINANCE_INVALID_PAGING',400);
  const c=await client(),p=new URLSearchParams({pageSize:String(limit)});
  if(cursor)p.set('pageToken',cursor);
  const r=await checked<{documents?:Document[];nextPageToken?:string}>(await fetch(
    c.root+'/'+pathUrl(ctx.rootPath+'/'+collection(direction))+'?'+p,{headers:c.headers,cache:'no-store',signal:AbortSignal.timeout(8000)}));
  const items=(r.documents??[]).map(d=>{const obj=fromFields(d.fields);owned(ctx,obj);const row=obj as unknown as FinanceObligation;
    if(row.direction!==direction)throw new FinanceError('FINANCE_SCOPE_INVALID',503);
    balance(row);return row;});
  return {items,nextCursor:r.nextPageToken??null,complete:!r.nextPageToken};
}
