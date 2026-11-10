/** W6 server-only Firestore adapter; never calls military data or stock ledger. */
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import firebaseConfig from '../../../config/empresas-firebase-web.json';
import {getCompanyAccessToken} from '../../server/companyFirebaseRuntime';
import {COMPANY_CONTRACT_VERSION,companyDocumentPath} from '../contracts';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {
  PurchaseError,identifier,key,object,parseDraft,parseChange,positiveQuantity,milli,
  convertedMilli,needFromOrderLine,transition,
  type PurchaseOrder,type DraftInput,type PurchaseChange,type PurchaseEvent,
} from './domain';
type Data=Record<string,unknown>;
type FireValue={stringValue?:string;integerValue?:string;doubleValue?:number;booleanValue?:boolean;
  nullValue?:string;arrayValue?:{values?:FireValue[]};mapValue?:{fields?:Record<string,FireValue>}};
type FireDocument={name?:string;fields?:Record<string,FireValue>;updateTime?:string};
type Write={update?:{name:string;fields:Record<string,FireValue>};verify?:string;
  currentDocument:{exists:false}|{updateTime:string}};
type Stored={data:Data;updateTime:string};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const error=(code:string,status:400|404|409|429|503):never=>{throw new PurchaseError(code,status);};
const enc=(v:unknown):FireValue=>{
  if(v===null)return{nullValue:'NULL_VALUE'};
  if(typeof v==='string')return{stringValue:v};
  if(typeof v==='number'&&Number.isSafeInteger(v))return{integerValue:String(v)};
  if(typeof v==='boolean')return{booleanValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(x=>enc(x===undefined?null:x))}};
  if(object(v))return{mapValue:{fields:fields(v)}};
  return error('INVALID_FIRESTORE_VALUE',400);
};
const fields=(v:Data):Record<string,FireValue>=>Object.fromEntries(Object.entries(v)
  .filter(([,value])=>value!==undefined).map(([field,value])=>[field,enc(value)]));
const dec=(v:FireValue):unknown=>{
  if(v.stringValue!==undefined)return v.stringValue;
  if(v.integerValue!==undefined)return Number(v.integerValue);
  if(v.doubleValue!==undefined)return v.doubleValue;
  if(v.booleanValue!==undefined)return v.booleanValue;
  if(v.nullValue!==undefined)return null;
  if(v.arrayValue)return(v.arrayValue.values||[]).map(dec);
  return Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,value])=>[k,dec(value)]));
};
const data=(d:FireDocument):Data=>Object.fromEntries(Object.entries(d.fields||{}).map(([k,value])=>[k,dec(value)]));
function configuration():{root:string;authorization:string} {
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
    const fs=process.env.FIRESTORE_EMULATOR_HOST||'';
    const auth=process.env.FIREBASE_AUTH_EMULATOR_HOST||'';
    if(!project.startsWith('demo-')||!['127.0.0.1:8080','localhost:8080'].includes(fs)
      ||!['127.0.0.1:9099','localhost:9099'].includes(auth)
      ||process.env.K_SERVICE||process.env.VERCEL||process.env.GAE_SERVICE) return error('INVALID_EMULATOR_SCOPE',503);
    return {root:'http://'+fs+'/v1/projects/'+project+'/databases/(default)/documents',authorization:'Bearer owner'};
  }
  if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST) return error('INVALID_EMULATOR_SCOPE',503);
  return {root:'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)
    +'/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',authorization:''};
}
class Client {
  private constructor(readonly root:string,private readonly auth:string,readonly ctx:CompanyAuthorizedContext){}
  static async create(ctx:CompanyAuthorizedContext):Promise<Client>{
    const cfg=configuration();
    let auth=cfg.authorization;
    if(!auth)try{auth='Bearer '+await getCompanyAccessToken();}catch{return error('COMPANY_DIRECTORY_UNAVAILABLE',503);}
    return new Client(cfg.root,auth,ctx);
  }
  path(kind:'purchaseOrders'|'sourceSuppliers'|'catalogItems'|'customerOrders'|'inboundShipments'|'idempotencyKeys'|'auditEvents',id:string){
    return companyDocumentPath(this.ctx.companyId,kind,identifier(id));
  }
  url(path:string){return this.root+'/'+path.split('/').map(encodeURIComponent).join('/');}
  full(path:string){return this.root.split('/v1/')[1]+'/'+path;}
  private async fetch(url:string,init:RequestInit={}):Promise<Response>{
    try{return await fetch(url,{...init,headers:{authorization:this.auth,'content-type':'application/json'},
      cache:'no-store',signal:AbortSignal.timeout(12000)});}
    catch{return error('COMPANY_DIRECTORY_UNAVAILABLE',503);}
  }
  async get(kind:Parameters<Client['path']>[0],id:string):Promise<Stored|null>{
    const path=this.path(kind,id);
    const response=await this.fetch(this.url(path));
    if(response.status===404)return null;
    if(!response.ok)return error('COMPANY_DIRECTORY_UNAVAILABLE',503);
    const doc=await response.json() as FireDocument;
    if(doc.name!==this.full(path)||!doc.updateTime)return error('INTEGRITY_ERROR',503);
    const v=data(doc);this.owned(v,kind);
    if(v.id!==id && kind!=='idempotencyKeys')return error('INTEGRITY_ERROR',503);
    return{data:v,updateTime:doc.updateTime};
  }
  owned(v:Data,kind?:string){
    if(v.companyId!==this.ctx.companyId||v.workspaceId!==this.ctx.companyId
      ||v.schemaVersion!==COMPANY_CONTRACT_VERSION) return error('INTEGRITY_ERROR',503);
    if(kind==='purchaseOrders'&&(!Number.isSafeInteger(v.revision)||Number(v.revision)<1))return error('INTEGRITY_ERROR',503);
  }
  async page(kind:'purchaseOrders'|'inboundShipments',limit:number,cursor:string){
    if(!Number.isSafeInteger(limit)||limit<1||limit>50||cursor.length>2048||/[\u0000-\u001f]/.test(cursor))return error('INVALID_PAGING',400);
    const path=this.ctx.rootPath+'/'+kind;
    const args=new URLSearchParams({pageSize:String(limit)});
    if(cursor)args.set('pageToken',cursor);
    const response=await this.fetch(this.url(path)+'?'+args.toString());
    if(response.status===404)return {items:[],nextCursor:null};
    if(!response.ok)return error('COMPANY_DIRECTORY_UNAVAILABLE',503);
    const page=await response.json() as {documents?:FireDocument[];nextPageToken?:string};
    if(page.documents!==undefined&&!Array.isArray(page.documents))return error('INTEGRITY_ERROR',503);
    const items=(page.documents||[]).map(d=>{
      if(!d.name?.startsWith(this.full(path)+'/')||d.name.slice(this.full(path).length+1).includes('/'))return error('INTEGRITY_ERROR',503);
      const item=data(d);this.owned(item,kind);return item;
    });
    return{items,nextCursor:page.nextPageToken||null};
  }
  put(kind:Parameters<Client['path']>[0],id:string,v:Data,pre:{exists:false}|{updateTime:string}):Write{
    return{update:{name:this.full(this.path(kind,id)),fields:fields(v)},currentDocument:pre};
  }
  verify(kind:Parameters<Client['path']>[0],id:string,updateTime:string):Write{
    return{verify:this.full(this.path(kind,id)),currentDocument:{updateTime}};
  }
  async commit(writes:Write[]):Promise<void>{
    const response=await this.fetch(this.root+':commit',{method:'POST',body:JSON.stringify({writes})});
    if(response.ok)return;
    if(response.status===409||response.status===412)return error('CONFLICT',409);
    const snippet=(await response.text()).slice(0,800);
    if(/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/i.test(snippet))return error('CONFLICT',409);
    return error('COMPANY_DIRECTORY_UNAVAILABLE',503);
  }
}
function idemId(ctx:CompanyAuthorizedContext,action:string,token:string){return'w6_'+hash(ctx.uid+'|'+action+'|'+token);}
async function replay(c:Client,action:string,token:string,payloadHash:string):Promise<{result:PurchaseOrder;event?:PurchaseEvent}|null>{
  const stored=await c.get('idempotencyKeys',idemId(c.ctx,action,token));
  if(!stored)return null;
  if(stored.data.action!==action||stored.data.actorUid!==c.ctx.uid||stored.data.requestHash!==payloadHash)return error('IDEMPOTENCY_CONFLICT',409);
  if(!object(stored.data.result))return error('INTEGRITY_ERROR',503);
  const result=stored.data.result as unknown as {result:PurchaseOrder;event?:PurchaseEvent};
  if(!result.result||result.result.companyId!==c.ctx.companyId)return error('INTEGRITY_ERROR',503);
  return result;
}
function auditWrites(c:Client,action:string,token:string,payloadHash:string,result:{result:PurchaseOrder;event?:PurchaseEvent},before:number|null):Write[]{
  const id='w6_'+randomUUID().replace(/-/g,'');
  const now=result.result.updatedAt;
  const audit:Data={schemaVersion:COMPANY_CONTRACT_VERSION,eventId:id,companyId:c.ctx.companyId,
    workspaceId:c.ctx.companyId,actorUid:c.ctx.uid,action:'purchaseOrders:write',
    operation:action,entityType:'purchaseOrders',entityId:result.result.id,correlationId:id,
    idempotencyKey:token,beforeRevision:before,afterRevision:result.result.revision,occurredAt:now};
  const idem:Data={schemaVersion:COMPANY_CONTRACT_VERSION,id:idemId(c.ctx,action,token),
    companyId:c.ctx.companyId,workspaceId:c.ctx.companyId,actorUid:c.ctx.uid,action,
    idempotencyKey:token,requestHash:payloadHash,requestedAt:now,result};
  return[c.put('idempotencyKeys',String(idem.id),idem,{exists:false}),c.put('auditEvents',id,audit,{exists:false})];
}
function required(v:Stored|null,name:string):Stored{
  if(!v)return error(name+'_NOT_FOUND',404);
  return v;
}
/** Read W1/W2 persisted contracts without importing unmerged branches or mutating their records. */
async function validateDraft(c:Client,draft:DraftInput):Promise<{verifications:Write[];supplierName:string}>{
  const reads=new Map<string,{kind:'sourceSuppliers'|'catalogItems'|'customerOrders';id:string;doc:Stored}>();
  const load=async(kind:'sourceSuppliers'|'catalogItems'|'customerOrders',id:string):Promise<Stored>=>{
    const path=kind+'/'+id;
    if(reads.has(path))return reads.get(path)!.doc;
    const doc=required(await c.get(kind,id),kind.toUpperCase());
    reads.set(path,{kind,id,doc});
    return doc;
  };
  const supplier=(await load('sourceSuppliers',draft.sourceSupplierId)).data;
  const planned=new Map<string,bigint>();
  if(supplier.status!=='active'||supplier.lifecycle!=='active')return error('SUPPLIER_NOT_SELECTABLE',409);
  for(const line of draft.lines){
    const catalog=(await load('catalogItems',line.catalogItemId)).data;
    if(catalog.status!=='active'||catalog.canonicalUnit!==line.conversion.to
      ||!Array.isArray(catalog.sourcingOptions))return error('CATALOG_CONFLICT',409);
    const source=catalog.sourcingOptions.find((raw:unknown)=>object(raw)
      &&raw.sourceSupplierId===draft.sourceSupplierId&&raw.supplierSku===line.supplierSku);
    if(!object(source)||source.purchaseUnit!==line.quantity.unit||!object(source.conversion)
      ||source.conversion.from!==line.conversion.from||source.conversion.to!==line.conversion.to
      ||source.conversion.numerator!==line.conversion.numerator
      ||source.conversion.denominator!==line.conversion.denominator)return error('SOURCE_OPTION_CONFLICT',409);
    for(const allocation of line.allocations){
      const order=(await load('customerOrders',allocation.customerOrderId)).data;
      if(order.status!=='active'||!Array.isArray(order.lines))return error('CUSTOMER_ORDER_CONFLICT',409);
      const demand=order.lines.find((raw:unknown)=>object(raw)&&raw.id===allocation.customerOrderLineId);
      if(!object(demand)||!object(demand.quantity)||!object(demand.fulfilledQuantity))return error('ORDER_LINE_NOT_FOUND',409);
      const need=needFromOrderLine(allocation.customerOrderId,{id:allocation.customerOrderLineId,
        quantity:positiveQuantity(demand.quantity),fulfilledQuantity:positiveQuantity(demand.fulfilledQuantity,true)});
      const allocationKey=allocation.customerOrderId+'|'+allocation.customerOrderLineId;
      const nextPlanned=(planned.get(allocationKey)||BigInt(0))+milli(allocation.quantity.value);
      if(need.outstanding.unit!==allocation.quantity.unit||nextPlanned>milli(need.outstanding.value))
        return error('ALLOCATION_EXCEEDS_OUTSTANDING',409);
      planned.set(allocationKey,nextPlanned);
    }
  }
  // A Firestore commit verifies the exact W1/W2 revisions used. A suspension or
  // W1 order edit racing checkout fails; no write to W1/W2 records is necessary.
  return {verifications:[...reads.values()].map(v=>c.verify(v.kind,v.id,v.doc.updateTime)),
    supplierName:typeof supplier.legalName==='string'?supplier.legalName:''};
}
export async function createPurchase(ctx:CompanyAuthorizedContext,body:unknown,keyHeader:unknown) {
  const token=key(keyHeader),draft=parseDraft(body),client=await Client.create(ctx);
  const action='purchaseOrders:create',fingerprint=hash(JSON.stringify(draft));
  const old=await replay(client,action,token,fingerprint);if(old)return{...old,replayed:true};
  const validation=await validateDraft(client,draft);
  const now=new Date().toISOString(),id='po_'+randomUUID().replace(/-/g,'');
  const order:PurchaseOrder={schemaVersion:COMPANY_CONTRACT_VERSION,id,companyId:ctx.companyId,workspaceId:ctx.companyId,
    createdByUid:ctx.uid,createdAt:now,updatedAt:now,revision:1,status:'draft',
    sourceSupplierId:draft.sourceSupplierId,reference:draft.reference,workflowState:'draft',
    desiredAt:{value:draft.desiredAt,basis:'requested',source:'user',updatedAt:now},
    lines:draft.lines.map(line=>({...line,confirmedQuantity:{value:'0',unit:line.quantity.unit},
      receivedQuantity:{value:'0',unit:line.quantity.unit}})),
    history:[],pdfSnapshot:{id,companyId:ctx.companyId,workspaceId:ctx.companyId,
      documentNumber:draft.reference,customerName:ctx.legalName||ctx.companyName,
      supplierName:validation.supplierName,
      issuedAt:now,lines:draft.lines.map(x=>({id:x.id,description:x.description,
        quantity:x.quantity.value,unit:x.quantity.unit,unitPriceCents:x.unitPriceCents}))}};
  const result={result:order};
  const writes=[...validation.verifications,client.put('purchaseOrders',id,order as unknown as Data,{exists:false}),
    ...auditWrites(client,action,token,fingerprint,result,null)];
  try{await client.commit(writes);}catch(e){
    if(e instanceof PurchaseError&&(e.status===409||e.status===503)){const done=await replay(client,action,token,fingerprint);if(done)return{...done,replayed:true};}
    throw e;
  }
  return{...result,replayed:false};
}
export async function updatePurchase(ctx:CompanyAuthorizedContext,id:string,body:unknown,keyHeader:unknown){
  const token=key(keyHeader),change=parseChange(body),client=await Client.create(ctx),purchaseId=identifier(id);
  const action='purchaseOrders:'+change.action+':'+purchaseId;
  const fingerprint=hash(JSON.stringify(change));
  const old=await replay(client,action,token,fingerprint);if(old)return{...old,replayed:true};
  const stored=required(await client.get('purchaseOrders',purchaseId),'PURCHASE');
  const doc=stored.data as unknown as PurchaseOrder;
  // Mesmo comprovante da mesma compra nunca gera duas entradas, ainda que troquem a chave de retry.
  const eventId=change.action==='receive'
    ? 'w6_'+hash(ctx.companyId+'|'+purchaseId+'|receipt|'+change.reference).slice(0,48)
    : 'w6_'+randomUUID().replace(/-/g,'');
  const {order,event}=transition(doc,change,ctx.uid,new Date().toISOString(),eventId,token);
  const result={result:order,event};
  const writes=[client.put('purchaseOrders',purchaseId,order as unknown as Data,{updateTime:stored.updateTime}),
    client.put('inboundShipments',event.id,event as unknown as Data,{exists:false}),
    ...auditWrites(client,action,token,fingerprint,result,doc.revision)];
  try{await client.commit(writes);}catch(e){
    if(e instanceof PurchaseError&&(e.status===409||e.status===503)){const done=await replay(client,action,token,fingerprint);if(done)return{...done,replayed:true};}
    throw e;
  }
  return{...result,replayed:false};
}
export async function getPurchase(ctx:CompanyAuthorizedContext,id:string){
  return required(await(await Client.create(ctx)).get('purchaseOrders',identifier(id)),'PURCHASE').data as unknown as PurchaseOrder;
}
export async function listPurchases(ctx:CompanyAuthorizedContext,limit:number,cursor:string){
  return(await Client.create(ctx)).page('purchaseOrders',limit,cursor);
}
export async function listPurchaseEvents(ctx:CompanyAuthorizedContext,id:string,limit:number,cursor:string){
  await getPurchase(ctx,id);
  const page=await(await Client.create(ctx)).page('inboundShipments',limit,cursor);
  // Filtering is page-local; nextCursor advances through ALL events.
  return{...page,items:page.items.filter(x=>x.purchaseOrderId===id)};
}
export async function previewPurchaseNeed(ctx:CompanyAuthorizedContext,orderId:string){
  const order=required(await(await Client.create(ctx)).get('customerOrders',identifier(orderId)),'CUSTOMER_ORDER').data;
  if(order.status!=='active'||!Array.isArray(order.lines))return error('CUSTOMER_ORDER_CONFLICT',409);
  return{customerOrderId:orderId,lines:order.lines.map(raw=>{
    if(!object(raw)||!object(raw.quantity)||!object(raw.fulfilledQuantity))return error('INTEGRITY_ERROR',503);
    return needFromOrderLine(orderId,{id:identifier(raw.id),quantity:positiveQuantity(raw.quantity),
      fulfilledQuantity:positiveQuantity(raw.fulfilledQuantity,true)});
  }),stockReconciled:false,netShortageKnown:false};
}
