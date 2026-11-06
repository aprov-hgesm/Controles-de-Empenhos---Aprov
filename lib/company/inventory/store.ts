import { createHash, randomUUID } from 'node:crypto';
import config from '../../../firebase-applet-config.json';
import {companyDocumentPath, companyCollectionPath, type CompanySubcollection} from '../contracts';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {getGoogleAccessToken} from '../../server/sectorProvisioningAdmin';
import {InventoryError} from './engine.mjs';

type Value={stringValue?:string;integerValue?:string;doubleValue?:number;booleanValue?:boolean;nullValue?:string;arrayValue?:{values?:Value[]};mapValue?:{fields?:Record<string,Value>}};
type Document={name?:string;fields?:Record<string,Value>;updateTime?:string};
export type Stored={data:Record<string,any>; updateTime:string};
export type Mutation={collection:CompanySubcollection;id:string;data:Record<string,unknown>;updateTime?:string};
export type ReadCheck={collection:CompanySubcollection;id:string;updateTime:string};
const collections=new Set<CompanySubcollection>(['catalogItems','customerOrders','purchaseOrders','stockEvents','allocations','inboundShipments','auditEvents','idempotencyKeys']);
const f=(value:Record<string,unknown>):Record<string,Value> => Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
function encode(v:unknown):Value {
 if(v===null)return{nullValue:'NULL_VALUE'};
 if(typeof v==='string')return{stringValue:v};
 if(typeof v==='boolean')return{booleanValue:v};
 if(typeof v==='number'){if(!Number.isFinite(v)||!Number.isSafeInteger(v))throw new InventoryError('INVALID_NUMBER',400);return{integerValue:String(v)};}
 if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};
 if(v && typeof v==='object')return{mapValue:{fields:f(v as Record<string,unknown>)}};
 throw new InventoryError('INVALID_FIELD',400);
}
function decode(v:Value):any {
 if(v.stringValue!==undefined)return v.stringValue;
 if(v.integerValue!==undefined)return Number(v.integerValue);
 if(v.doubleValue!==undefined)return v.doubleValue;
 if(v.booleanValue!==undefined)return v.booleanValue;
 if(v.nullValue!==undefined)return null;
 if(v.arrayValue!==undefined)return(v.arrayValue.values||[]).map(decode);
 return Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,val])=>[k,decode(val)]));
}
function data(d:Document):Record<string,any>{return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]));}
function emulator():{host:string;project:string}|null{
 if(process.env.EMPROVEX_E2E_SERVER_AUTH!=='1'){
   if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
     throw new InventoryError('EMULATOR_SCOPE_INVALID',503);
   return null;
 }
 const host=process.env.FIRESTORE_EMULATOR_HOST||'',auth=process.env.FIREBASE_AUTH_EMULATOR_HOST||'';
 const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
 if(process.env.K_SERVICE||process.env.VERCEL||process.env.GAE_SERVICE||
 !['127.0.0.1:8080','localhost:8080'].includes(host)||
 !['127.0.0.1:9099','localhost:9099'].includes(auth)||
 !/^demo-[a-z0-9-]+$/.test(project))throw new InventoryError('EMULATOR_SCOPE_INVALID',503);
 return {host,project};
}
export class InventoryStore{
 private constructor(private root:string, private token:string,private ctx:CompanyAuthorizedContext){}
 static async connect(ctx:CompanyAuthorizedContext):Promise<InventoryStore>{
   const demo=emulator();
   const project=demo?.project||config.projectId;
   const db=demo?'(default)':config.firestoreDatabaseId;
   const root=(demo?'http://'+demo.host+'/v1':'https://firestore.googleapis.com/v1')+
     '/projects/'+encodeURIComponent(project)+'/databases/'+encodeURIComponent(db)+'/documents';
   return new InventoryStore(root,demo?'owner':await getGoogleAccessToken(),ctx);
 }
 private path(collection:CompanySubcollection,id:string):string{
   if(!collections.has(collection))throw new InventoryError('INVALID_SCOPE',503);
   const path=companyDocumentPath(this.ctx.companyId,collection,id);
   if(!path.startsWith(this.ctx.rootPath+'/'))throw new InventoryError('INVALID_SCOPE',503);
   return path;
 }
 private full(path:string){return this.root.replace(/^https?:\/\/[^/]+\/v1\//,'')+'/'+path;}
 private url(path:string){return this.root+'/'+path.split('/').map(encodeURIComponent).join('/');}
 private async request(url:string,init:RequestInit):Promise<Response>{
   try{return await fetch(url,{...init,headers:{authorization:'Bearer '+this.token,
     ...(init.body?{'content-type':'application/json'}:{})},cache:'no-store',signal:AbortSignal.timeout(15000)});}
   catch{throw new InventoryError('BACKEND_UNAVAILABLE',503);}
 }
 async get(collection:CompanySubcollection,id:string):Promise<Stored|null>{
   const path=this.path(collection,id);
   const response=await this.request(this.url(path),{method:'GET'});
   if(response.status===404)return null;
   if(!response.ok)throw new InventoryError('BACKEND_UNAVAILABLE',503);
   const raw=await response.json() as Document;
   if(raw.name!==this.full(path)||!raw.updateTime)throw new InventoryError('INTEGRITY_ERROR',503);
   const record=data(raw);
   if(record.schemaVersion!=='company-r1-v1'||record.companyId!==this.ctx.companyId||record.workspaceId!==this.ctx.companyId||
   record.id!==id)throw new InventoryError('INTEGRITY_ERROR',503);
   return {data:record,updateTime:raw.updateTime};
 }
 async list(collection:CompanySubcollection,limit:number,cursor?:string){
   if(!collections.has(collection)||!Number.isInteger(limit)||limit<1||limit>50||
      (cursor && (cursor.length>2048||/[\x00-\x1f]/.test(cursor))))throw new InventoryError('INVALID_INPUT',400);
   const path=companyCollectionPath(this.ctx.companyId,collection);
   const args=new URLSearchParams({pageSize:String(limit),orderBy:'__name__'});if(cursor)args.set('pageToken',cursor);
   const response=await this.request(this.url(path)+'?'+args.toString(),{method:'GET'});
   if(response.status===404)return {items:[],nextCursor:null};
   if(!response.ok)throw new InventoryError('BACKEND_UNAVAILABLE',503);
   const raw=await response.json() as {documents?:Document[];nextPageToken?:string};
   const items=(raw.documents||[]).map(doc=>{
     const name=doc.name||'';
     if(!name.startsWith(this.full(path)+'/')||name.slice(this.full(path).length+1).includes('/'))
       throw new InventoryError('INTEGRITY_ERROR',503);
     const item=data(doc);
     if(item.schemaVersion!=='company-r1-v1'||item.companyId!==this.ctx.companyId||item.workspaceId!==this.ctx.companyId||
     item.id!==name.slice(name.lastIndexOf('/')+1))throw new InventoryError('INTEGRITY_ERROR',503);
     return item;
   });
   return {items,nextCursor:raw.nextPageToken||null};
 }
 async replay(action:string,key:string,hash:string):Promise<Record<string,unknown>|null>{
   const row=await this.get('idempotencyKeys',createHash('sha256').update(this.ctx.uid+':'+action+':'+key).digest('hex'));
   if(!row)return null;
   if(row.data.requestHash!==hash||row.data.action!==action||row.data.uid!==this.ctx.uid)throw new InventoryError('IDEMPOTENCY_CONFLICT',409);
   return row.data.result as Record<string,unknown>;
 }
 async commit(action:string,key:string,hash:string,mutations:Mutation[],event:Record<string,unknown>,result:Record<string,unknown>,checks:ReadCheck[]=[]){
   if(mutations.length>7||mutations.length<1||new Set(mutations.map(m=>m.collection+':'+m.id)).size!==mutations.length)
     throw new InventoryError('INVALID_COMMIT',503);
   if(mutations.some(m=>!['stockEvents','allocations'].includes(m.collection)))
     throw new InventoryError('INVALID_SCOPE',503);
   const now=new Date().toISOString();
   const idemId=createHash('sha256').update(this.ctx.uid+':'+action+':'+key).digest('hex');
   const auditId=randomUUID();
   const records:Mutation[]=[...mutations,
     {collection:'stockEvents',id:String(event.id),data:event},
     {collection:'idempotencyKeys',id:idemId,data:{id:idemId,companyId:this.ctx.companyId,workspaceId:this.ctx.companyId,
       schemaVersion:'company-r1-v1',uid:this.ctx.uid,action,idempotencyKey:key,requestHash:hash,requestedAt:now,result}},
     {collection:'auditEvents',id:auditId,data:{id:auditId,schemaVersion:'company-r1-v1',eventId:auditId,
       companyId:this.ctx.companyId,workspaceId:this.ctx.companyId,actorUid:this.ctx.uid,
       action:'stockEvents:write',operation:action,entityType:'stockEvents',entityId:event.id,
       correlationId:auditId,idempotencyKey:key,beforeRevision:null,afterRevision:1,occurredAt:now}},
   ];
   const writes=[...records.map(m=>({update:{name:this.full(this.path(m.collection,m.id)),fields:f(m.data)},
     currentDocument:m.updateTime?{updateTime:m.updateTime}:{exists:false}})),
     ...checks.map(check=>({verify:this.full(this.path(check.collection,check.id)),currentDocument:{updateTime:check.updateTime}}))];
   const response=await this.request(this.root+':commit',{method:'POST',body:JSON.stringify({writes})});
   if(!response.ok){
     const message=(await response.text()).slice(0,500);
     if([409,412].includes(response.status)||/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/.test(message))
       throw new InventoryError('CONCURRENT_MODIFICATION',409);
     throw new InventoryError('BACKEND_UNAVAILABLE',503);
   }
 }
}
