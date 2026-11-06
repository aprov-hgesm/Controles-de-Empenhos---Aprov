import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import firebaseConfig from '../../../firebase-applet-config.json';
import {getGoogleAccessToken} from '../../server/sectorProvisioningAdmin';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {companyDocumentPath,COMPANY_CONTRACT_VERSION} from '../contracts';
import {RoutingError,identifier,object,vehicleOf,candidateOf,manualProposal,
  reorderStops,approvePlan} from '../geo/core.mjs';
import {optimizedProposal} from './providers';
type RecordData=Record<string,unknown>;
type Kind='deliveryRoutes'|'vehicles'|'idempotencyKeys'|'auditEvents';
type FireValue={stringValue?:string;integerValue?:string;doubleValue?:number;booleanValue?:boolean;
 nullValue?:string;arrayValue?:{values?:FireValue[]};mapValue?:{fields?:Record<string,FireValue>}};
type FireDoc={name:string;fields?:Record<string,FireValue>;updateTime?:string};
type Write={update:{name:string;fields:Record<string,FireValue>};currentDocument:{exists:false}|{updateTime:string}};
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
function encode(value:unknown):FireValue{
 if(value===null||value===undefined)return {nullValue:'NULL_VALUE'};
 if(typeof value==='string')return{stringValue:value};
 if(typeof value==='boolean')return{booleanValue:value};
 if(typeof value==='number'&&Number.isFinite(value))return Number.isSafeInteger(value)?
   {integerValue:String(value)}:{doubleValue:value};
 if(Array.isArray(value))return{arrayValue:{values:value.map(encode)}};
 if(object(value))return{mapValue:{fields:fields(value as RecordData)}};
 throw new RoutingError('INVALID_FIRESTORE_VALUE');
}
function fields(x:RecordData){return Object.fromEntries(Object.entries(x)
 .filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));}
function decode(v:FireValue):unknown{
 if(v.stringValue!==undefined)return v.stringValue;
 if(v.integerValue!==undefined)return Number(v.integerValue);
 if(v.doubleValue!==undefined)return v.doubleValue;
 if(v.booleanValue!==undefined)return v.booleanValue;
 if(v.nullValue!==undefined)return null;
 if(v.arrayValue)return(v.arrayValue.values||[]).map(decode);
 return Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,x])=>[k,decode(x)]));
}
function data(doc:FireDoc):RecordData{
 return Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,decode(v)]));
}
function config(){
 if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
  const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'',fs=process.env.FIRESTORE_EMULATOR_HOST||'';
  if(!project.startsWith('demo-')||!['127.0.0.1:8080','localhost:8080'].includes(fs)
    ||!['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST||'')
    ||process.env.K_SERVICE||process.env.VERCEL||process.env.GAE_SERVICE)
    throw new RoutingError('INVALID_EMULATOR_SCOPE',503);
  return{root:'http://'+fs+'/v1/projects/'+project+'/databases/(default)/documents',token:'Bearer owner'};
 }
 if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
   throw new RoutingError('INVALID_EMULATOR_SCOPE',503);
 return{root:'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+
  '/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',token:''};
}
class Client{
 private constructor(readonly ctx:CompanyAuthorizedContext,readonly root:string,readonly token:string){}
 static async connect(ctx:CompanyAuthorizedContext){
  const c=config();
  let token=c.token;
  if(!token){try{token='Bearer '+await getGoogleAccessToken();}
    catch{throw new RoutingError('COMPANY_DIRECTORY_UNAVAILABLE',503);}}
  return new Client(ctx,c.root,token);
 }
 name(kind:Kind,id:string){return this.root.split('/v1/')[1]+'/'+companyDocumentPath(this.ctx.companyId,kind,identifier(id));}
 url(kind:Kind,id?:string){
  const path=this.ctx.rootPath+'/'+kind+(id?'/'+identifier(id):'');
  return this.root+'/'+path.split('/').map(encodeURIComponent).join('/');
 }
 async send(url:string,init:RequestInit={}){
  try{return await fetch(url,{...init,headers:{authorization:this.token,'content-type':'application/json'},
    signal:AbortSignal.timeout(10000),cache:'no-store'});}
  catch{throw new RoutingError('COMPANY_DIRECTORY_UNAVAILABLE',503);}
 }
 owned(v:RecordData){
  if(v.schemaVersion!==COMPANY_CONTRACT_VERSION||v.companyId!==this.ctx.companyId
    ||v.workspaceId!==this.ctx.companyId)throw new RoutingError('COMPANY_SCOPE_FORBIDDEN',403);
 }
 async get(kind:Kind,id:string){
  const resp=await this.send(this.url(kind,id));
  if(resp.status===404)return null;
  if(!resp.ok)throw new RoutingError('COMPANY_DIRECTORY_UNAVAILABLE',503);
  const raw=await resp.json() as FireDoc;
  if(raw.name!==this.name(kind,id)||!raw.updateTime)throw new RoutingError('INTEGRITY_ERROR',503);
  const value=data(raw);this.owned(value);
  return{value,updateTime:raw.updateTime};
 }
 async list(kind:'deliveryRoutes'|'vehicles',limit:number,cursor:string){
  if(!Number.isSafeInteger(limit)||limit<1||limit>50||cursor.length>2048||/[\u0000-\u001f]/.test(cursor))
    throw new RoutingError('INVALID_PAGING');
  const url=this.url(kind)+'?'+new URLSearchParams({pageSize:String(limit),...(cursor?{pageToken:cursor}:{})});
  const resp=await this.send(url);
  if(resp.status===404)return {items:[],nextCursor:null};
  if(!resp.ok)throw new RoutingError('COMPANY_DIRECTORY_UNAVAILABLE',503);
  const raw=await resp.json() as {documents?:FireDoc[];nextPageToken?:string};
  if(raw.documents!==undefined&&!Array.isArray(raw.documents))throw new RoutingError('INTEGRITY_ERROR',503);
  const prefix=this.root.split('/v1/')[1]+'/'+this.ctx.rootPath+'/'+kind+'/';
  const items=(raw.documents||[]).map(v=>{
   if(!v.name.startsWith(prefix)||v.name.slice(prefix.length).includes('/'))throw new RoutingError('INTEGRITY_ERROR',503);
   const row=data(v);this.owned(row);return row;
  });
  return {items,nextCursor:raw.nextPageToken||null};
 }
 write(kind:Kind,id:string,record:RecordData,pre:{exists:false}|{updateTime:string}):Write{
  return{update:{name:this.name(kind,id),fields:fields(record)},currentDocument:pre};
 }
 async commit(writes:Write[]){
  const response=await this.send(this.root+':commit',{method:'POST',body:JSON.stringify({writes})});
  if(response.ok)return;
  if([409,412].includes(response.status))throw new RoutingError('REVISION_CONFLICT',409);
  const message=(await response.text()).slice(0,256);
  if(/ABORTED|ALREADY_EXISTS|FAILED_PRECONDITION/.test(message))
    throw new RoutingError('REVISION_CONFLICT',409);
  throw new RoutingError('COMPANY_DIRECTORY_UNAVAILABLE',503);
 }
}
function key(value:unknown){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(value))
  throw new RoutingError('IDEMPOTENCY_KEY_REQUIRED');
 return value;
}
function idemId(ctx:CompanyAuthorizedContext,action:string,token:string){
 return 'w11_'+digest(ctx.companyId+'|'+ctx.uid+'|'+action+'|'+token);
}
async function replay(c:Client,action:string,k:string,hash:string){
 const marker=await c.get('idempotencyKeys',idemId(c.ctx,action,k));
 if(!marker)return null;
 if(marker.value.requestHash!==hash||marker.value.action!==action
   ||marker.value.actorUid!==c.ctx.uid)throw new RoutingError('IDEMPOTENCY_CONFLICT',409);
 return marker.value.result;
}
function audit(c:Client,action:'deliveryRoutes:write'|'vehicles:write',id:string,k:string,hash:string,
  result:RecordData,before:number|null){
 const now=new Date().toISOString(),auditId='w11_'+randomUUID().replace(/-/g,'');
 const markerId=idemId(c.ctx,action+':'+id,k);
 // The same canonical action is used for replay and marker.
 return{now,auditId,markerId,
  audit:{schemaVersion:COMPANY_CONTRACT_VERSION,eventId:auditId,companyId:c.ctx.companyId,
   workspaceId:c.ctx.companyId,actorUid:c.ctx.uid,action,entityType:action.split(':')[0],
   entityId:id,correlationId:auditId,idempotencyKey:k,beforeRevision:before,
   afterRevision:result.revision,occurredAt:now}};
}
function provenance(ctx:CompanyAuthorizedContext,id:string,now:string){
 return{schemaVersion:COMPANY_CONTRACT_VERSION,id,companyId:ctx.companyId,workspaceId:ctx.companyId,
  createdByUid:ctx.uid,createdAt:now,updatedAt:now,revision:1};
}
async function mutate(ctx:CompanyAuthorizedContext,kind:'deliveryRoutes'|'vehicles',id:string,
  operation:string,kHeader:unknown,fingerprint:unknown,
  change:(prior:RecordData|null)=>RecordData,expectedRevision?:number){
 const k=key(kHeader),client=await Client.connect(ctx),action=kind+':'+operation+':'+id;
 const hash=digest(JSON.stringify(fingerprint));
 const existing=await replay(client,action,k,hash);if(existing)return{result:existing,replayed:true};
 const prior=await client.get(kind,id);
 if((expectedRevision===undefined&&prior)||(expectedRevision!==undefined
   &&(!prior||prior.value.revision!==expectedRevision)))throw new RoutingError('REVISION_CONFLICT',409);
 const next=change(prior?.value||null),now=new Date().toISOString();
 const auditId='w11_'+randomUUID().replace(/-/g,''),markerId=idemId(ctx,action,k);
 const marker:RecordData={schemaVersion:COMPANY_CONTRACT_VERSION,id:markerId,
  companyId:ctx.companyId,workspaceId:ctx.companyId,actorUid:ctx.uid,action,requestHash:hash,
  requestedAt:now,result:next};
 const history:RecordData={schemaVersion:COMPANY_CONTRACT_VERSION,eventId:auditId,
  companyId:ctx.companyId,workspaceId:ctx.companyId,actorUid:ctx.uid,
  action:kind+':write',entityType:kind,entityId:id,correlationId:auditId,
  idempotencyKey:k,beforeRevision:prior?prior.value.revision:null,afterRevision:next.revision,occurredAt:now};
 const writes=[client.write(kind,id,next,prior?{updateTime:prior.updateTime}:{exists:false}),
  client.write('idempotencyKeys',markerId,marker,{exists:false}),
  client.write('auditEvents',auditId,history,{exists:false})];
 try{await client.commit(writes);}catch(e){
  if(e instanceof RoutingError&&[409,503].includes(e.status)){
   const done=await replay(client,action,k,hash);if(done)return{result:done,replayed:true};
  }throw e;
 }
 return{result:next,replayed:false};
}
export async function previewRoute(ctx:CompanyAuthorizedContext,body:unknown){
 if(!object(body))throw new RoutingError('INVALID_BODY');
 const input=body as RecordData;
 if(input.mode==='optimized')return optimizedProposal(ctx.companyId,input.candidates,input.vehicles);
 if(input.mode!=='manual')throw new RoutingError('INVALID_MODE');
 return manualProposal({companyId:ctx.companyId,workspaceId:ctx.companyId,
  candidates:input.candidates,vehicles:input.vehicles,assignments:input.assignments});
}
export async function createRoute(ctx:CompanyAuthorizedContext,body:unknown,k:unknown){
 if(!object(body))throw new RoutingError('INVALID_BODY');
 const input=body as RecordData;
 if(input.mode!=='manual')throw new RoutingError('INVALID_BODY');
 // Only validated manual drafts are persisted; external optimized suggestions require manual review/replay.
 const proposed=await previewRoute(ctx,body);
 const candidates=(input.candidates as unknown[]).map(v=>candidateOf(v,ctx.companyId));
 const vehicles=(input.vehicles as unknown[]).map(vehicleOf);
 const id='route_'+randomUUID().replace(/-/g,'');
 const now=new Date().toISOString();
 const doc:RecordData={...provenance(ctx,id,now),status:'draft',source:'manual',proposal:proposed,
  stops:proposed.stops,unassigned:proposed.unassigned,candidates,vehicles,
  requiresHumanApproval:true,approvedByHuman:false,dispatched:false,
  warnings:proposed.warnings};
 // Token controls retries even if generated IDs vary: use fixed create ID derived from tenant/token.
 const stableId='route_'+digest(ctx.companyId+'|'+ctx.uid+'|'+key(k)).slice(0,40);
 return mutate(ctx,'deliveryRoutes',stableId,'create',k,
   {mode:input.mode,candidates,vehicles,assignments:input.assignments},()=>{
     return{...doc,id:stableId};
   });
}
export async function getRoute(ctx:CompanyAuthorizedContext,id:string){
 const v=await(await Client.connect(ctx)).get('deliveryRoutes',identifier(id));
 if(!v)throw new RoutingError('ROUTE_NOT_FOUND',404);return v.value;
}
export async function listRoutes(ctx:CompanyAuthorizedContext,limit:number,cursor:string){
 return(await Client.connect(ctx)).list('deliveryRoutes',limit,cursor);
}
export async function changeRoute(ctx:CompanyAuthorizedContext,id:string,raw:unknown,k:unknown){
 if(!object(raw)||!Number.isSafeInteger(raw.expectedRevision)||raw.expectedRevision<1
   ||!['reorder','approve'].includes(String(raw.action)))throw new RoutingError('INVALID_BODY');
 const action=String(raw.action),rev=Number(raw.expectedRevision);
 return mutate(ctx,'deliveryRoutes',identifier(id),action,k,input,(prior)=>{
   if(!prior)throw new RoutingError('ROUTE_NOT_FOUND',404);
   if(prior.status==='dispatched'||prior.status==='closed')
     throw new RoutingError('W9_ONLY_DELIVERY_STATE',403);
   const now=new Date().toISOString();
   if(action==='reorder'){
     if(prior.status!=='draft'&&prior.status!=='optimizedSuggestion')
       throw new RoutingError('ROUTE_NOT_EDITABLE',409);
     const plan=reorderStops(prior.proposal,input.orderedIds);
     return {...prior,proposal:plan,stops:plan.stops,status:'draft',source:'manual',revision:rev+1,
       approvedByHuman:false,updatedAt:now};
   }
   const reviewed=approvePlan({...prior,stops:prior.stops,unassigned:prior.unassigned},{
    expectedRevision:rev,confirmedUnassignedIds:input.confirmedUnassignedIds,
    confirmedDestinationIds:input.confirmedDestinationIds});
   return{...prior,status:reviewed.status,revision:reviewed.revision,
     approvedByHuman:true,approvedByUid:ctx.uid,approvedAt:now,updatedAt:now};
 },rev);
}
export async function listVehicles(ctx:CompanyAuthorizedContext,limit:number,cursor:string){
 return(await Client.connect(ctx)).list('vehicles',limit,cursor);
}
export async function saveVehicle(ctx:CompanyAuthorizedContext,raw:unknown,k:unknown,id?:string){
 if(!object(raw))throw new RoutingError('INVALID_BODY');
 const input=raw as RecordData;
 const vehicle=vehicleOf(input);
 if(id!==undefined&&vehicle.id!==identifier(id))throw new RoutingError('INVALID_IDENTIFIER');
 const expected=input.expectedRevision;
 if(id!==undefined&&(!Number.isSafeInteger(expected)||Number(expected)<1))
   throw new RoutingError('REVISION_REQUIRED');
 if(id===undefined&&expected!==undefined)throw new RoutingError('INVALID_REVISION');
 return mutate(ctx,'vehicles',vehicle.id,id?'update':'create',k,vehicle,(prior)=>{
  if(id&&!prior)throw new RoutingError('VEHICLE_NOT_FOUND',404);
  const now=new Date().toISOString();
  return {...(prior||provenance(ctx,vehicle.id,now)),...vehicle,
    status:'active',updatedAt:now,revision:id?Number(prior!.revision)+1:1};
 },id?Number(expected):undefined);
}
