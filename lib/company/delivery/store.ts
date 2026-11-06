import 'server-only';
/** W9 Firestore REST adapter. All business records are scoped by verified company context. */
import {createHash,randomUUID} from 'node:crypto';
import cfg from '../../../firebase-applet-config.json';
import {getGoogleAccessToken} from '../../server/sectorProvisioningAdmin';
import {COMPANY_CONTRACT_VERSION,companyDocumentPath,companyCollectionPath,type CompanySubcollection} from '../contracts';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {DeliveryError,validId,validKey} from './domain.mjs';
type V={stringValue?:string;integerValue?:string;doubleValue?:number;booleanValue?:boolean;
 nullValue?:string;mapValue?:{fields?:Record<string,V>};arrayValue?:{values?:V[]}};
type Document={name?:string;fields?:Record<string,V>;updateTime?:string};
type Stored={data:Record<string,any>;updateTime:string};
export type DeliveryMutation={kind:'deliveries';id:string;data:Record<string,unknown>;updateTime?:string};
export type DeliveryCheck={kind:CompanySubcollection;id:string;updateTime:string};
const scopes=new Set<CompanySubcollection>(['deliveries','customerOrders','purchaseOrders','allocations','stockEvents',
  'documents','members','deliveryRoutes','idempotencyKeys','auditEvents']);
const error=(c:string,status:400|403|404|409|503=503):never=>{throw new DeliveryError(c,status);};
function encode(x:unknown):V{
 if(x===null)return{nullValue:'NULL_VALUE'};
 if(typeof x==='string')return{stringValue:x};
 if(typeof x==='boolean')return{booleanValue:x};
 if(typeof x==='number' && Number.isSafeInteger(x))return{integerValue:String(x)};
 if(Array.isArray(x))return{arrayValue:{values:x.map(v=>encode(v===undefined?null:v))}};
 if(x&&typeof x==='object')return{mapValue:{fields:fields(x as Record<string,unknown>)}};
 return error('INVALID_FIRESTORE_VALUE');
}
function fields(v:Record<string,unknown>):Record<string,V>{
 return Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined).map(([name,value])=>[name,encode(value)]));
}
function decode(v:V):unknown{
 if(v.stringValue!==undefined)return v.stringValue;
 if(v.booleanValue!==undefined)return v.booleanValue;
 if(v.integerValue!==undefined)return Number(v.integerValue);
 if(v.doubleValue!==undefined)return v.doubleValue;
 if(v.nullValue!==undefined)return null;
 if(v.arrayValue)return(v.arrayValue.values||[]).map(decode);
 return Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,x])=>[k,decode(x)]));
}
function decodeDocument(v:Document){return Object.fromEntries(Object.entries(v.fields||{}).map(([k,x])=>[k,decode(x)])) as Record<string,any>;}
function endpoint(){
 if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
  const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
  const fs=process.env.FIRESTORE_EMULATOR_HOST||'',auth=process.env.FIREBASE_AUTH_EMULATOR_HOST||'';
  if(!/^demo-[a-z0-9-]+$/.test(project)||!['127.0.0.1:8080','localhost:8080'].includes(fs)||
    !['127.0.0.1:9099','localhost:9099'].includes(auth)||process.env.K_SERVICE||process.env.VERCEL||
    process.env.GAE_SERVICE||process.env.NODE_ENV==='production') return error('INVALID_EMULATOR_SCOPE');
  return {url:'http://'+fs+'/v1/projects/'+project+'/databases/(default)/documents',token:'owner'};
 }
 if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)return error('INVALID_EMULATOR_SCOPE');
 return {url:'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(cfg.projectId)+
   '/databases/'+encodeURIComponent(cfg.firestoreDatabaseId)+'/documents',token:''};
}
export class W9Store{
 private constructor(private root:string,private token:string,private ctx:CompanyAuthorizedContext){}
 static async connect(ctx:CompanyAuthorizedContext){
  const conf=endpoint();let token=conf.token;
  if(!token)try{token=await getGoogleAccessToken();}catch{return error('DIRECTORY_UNAVAILABLE');}
  return new W9Store(conf.url,token,ctx);
 }
 private path(kind:CompanySubcollection,id?:string){
  if(!scopes.has(kind))return error('INVALID_SCOPE');
  const path=id===undefined?companyCollectionPath(this.ctx.companyId,kind):companyDocumentPath(this.ctx.companyId,kind,validId(id));
  if(!path.startsWith(this.ctx.rootPath+'/'))return error('INVALID_SCOPE');
  return path;
 }
 private full(path:string){return this.root.split('/v1/')[1]+'/'+path;}
 private url(path:string){return this.root+'/'+path.split('/').map(encodeURIComponent).join('/');}
 private async request(url:string,init:RequestInit={}):Promise<Response>{
  try{return await fetch(url,{...init,headers:{authorization:'Bearer '+this.token,
    ...(init.body?{'content-type':'application/json'}:{})},cache:'no-store',signal:AbortSignal.timeout(12000)});}
  catch{return error('DIRECTORY_UNAVAILABLE');}
 }
 private ensureOwned(data:Record<string,any>,kind:CompanySubcollection,id:string){
  if(data.companyId!==this.ctx.companyId||data.workspaceId!==this.ctx.companyId||
    data.schemaVersion!==COMPANY_CONTRACT_VERSION || (data.id!==id &&
      kind!=='idempotencyKeys' && kind!=='auditEvents'))return error('TENANT_INTEGRITY_ERROR');
 }
 async get(kind:CompanySubcollection,id:string):Promise<Stored|null>{
  const path=this.path(kind,id);
  const response=await this.request(this.url(path));
  if(response.status===404)return null;
  if(!response.ok)return error('DIRECTORY_UNAVAILABLE');
  const doc=await response.json() as Document;
  if(doc.name!==this.full(path)||!doc.updateTime)return error('TENANT_INTEGRITY_ERROR');
  const data=decodeDocument(doc);this.ensureOwned(data,kind,id);
  return {data,updateTime:doc.updateTime};
 }
 async list(kind:'deliveries'|'purchaseOrders'|'customerOrders',limit:number,cursor=''){
  if(!Number.isInteger(limit)||limit<1||limit>50||cursor.length>2048||/[\u0000-\u001f]/.test(cursor))
    return error('INVALID_PAGING',400);
  const path=this.path(kind);
  const query=new URLSearchParams({pageSize:String(limit),orderBy:'__name__'});
  if(cursor)query.set('pageToken',cursor);
  const response=await this.request(this.url(path)+'?'+query.toString());
  if(response.status===404)return {items:[],nextCursor:null};
  if(!response.ok)return error('DIRECTORY_UNAVAILABLE');
  const payload=await response.json() as {documents?:Document[];nextPageToken?:string};
  if(payload.documents&&!Array.isArray(payload.documents))return error('TENANT_INTEGRITY_ERROR');
  const items=(payload.documents||[]).map(doc=>{
   const prefix=this.full(path)+'/';
   if(!doc.name?.startsWith(prefix)||doc.name.slice(prefix.length).includes('/'))return error('TENANT_INTEGRITY_ERROR');
   const id=doc.name.slice(prefix.length),record=decodeDocument(doc);
   this.ensureOwned(record,kind,id);return record;
  });
  return {items,nextCursor:payload.nextPageToken||null};
 }
 private idemId(action:string,key:string){
  return 'w9_'+createHash('sha256').update(this.ctx.uid+'|'+action+'|'+key).digest('hex');
 }
 async replay(action:string,key:string,payloadHash:string):Promise<Record<string,unknown>|null>{
  validKey(key);
  const row=await this.get('idempotencyKeys',this.idemId(action,key));
  if(!row)return null;
  const v=row.data;
  if(v.actorUid!==this.ctx.uid||v.action!==action||v.requestHash!==payloadHash)return error('IDEMPOTENCY_CONFLICT',409);
  return v.result as Record<string,unknown>;
 }
 async commit(action:string,key:string,hash:string,changes:DeliveryMutation[],checks:DeliveryCheck[],
   result:Record<string,unknown>,entityId:string,beforeRevision:number|null){
  if(changes.length<1||changes.length>3||
    new Set(changes.map(x=>x.id)).size!==changes.length)return error('INVALID_COMMIT');
  const now=new Date().toISOString(),auditId='w9_'+randomUUID().replace(/-/g,''),
    idemId=this.idemId(action,key);
  const writes:any[]=[
   ...changes.map(x=>({update:{name:this.full(this.path(x.kind,x.id)),fields:fields(x.data)},
     currentDocument:x.updateTime?{updateTime:x.updateTime}:{exists:false}})),
   {update:{name:this.full(this.path('idempotencyKeys',idemId)),fields:fields({
     id:idemId,schemaVersion:COMPANY_CONTRACT_VERSION,companyId:this.ctx.companyId,workspaceId:this.ctx.companyId,
     actorUid:this.ctx.uid,action,requestHash:hash,idempotencyKey:key,requestedAt:now,result})},currentDocument:{exists:false}},
   {update:{name:this.full(this.path('auditEvents',auditId)),fields:fields({
     schemaVersion:COMPANY_CONTRACT_VERSION,eventId:auditId,companyId:this.ctx.companyId,workspaceId:this.ctx.companyId,
     actorUid:this.ctx.uid,action:'deliveries:write',operation:action,
     entityType:'deliveries',entityId,correlationId:auditId,idempotencyKey:key,
     beforeRevision,afterRevision:beforeRevision===null?1:beforeRevision+1,occurredAt:now})},currentDocument:{exists:false}},
   ...checks.map(x=>({verify:this.full(this.path(x.kind,x.id)),currentDocument:{updateTime:x.updateTime}}))
  ];
  const response=await this.request(this.root+':commit',{method:'POST',body:JSON.stringify({writes})});
  if(response.ok)return;
  const detail=(await response.text()).slice(0,350);
  if([409,412].includes(response.status)||/ALREADY_EXISTS|ABORTED|FAILED_PRECONDITION/i.test(detail))
   return error('CONCURRENT_MODIFICATION',409);
  return error('DIRECTORY_UNAVAILABLE');
 }
}
