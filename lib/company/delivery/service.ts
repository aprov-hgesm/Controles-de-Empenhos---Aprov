import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {COMPANY_CONTRACT_VERSION} from '../contracts';
import {W9Store,type DeliveryCheck,type DeliveryMutation} from './store';
import {DeliveryError,parseDeliveryDraft,checkDispatchQuota,transitionDelivery,assessSchedule,
  approvePromise,validId,validKey,milli,decimal} from './domain.mjs';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest=(...parts:string[])=>createHash('sha256').update(parts.join(':')).digest('hex');
const error=(c:string,status:400|403|404|409|503=409):never=>{throw new DeliveryError(c,status);};
const obj=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):string=>validId(v);
const sameCompany=(v:Record<string,any>,ctx:CompanyAuthorizedContext)=>{
 if(v.companyId!==ctx.companyId||v.workspaceId!==ctx.companyId)return error('TENANT_INTEGRITY_ERROR',503);
};
function owned(ctx:CompanyAuthorizedContext,idValue:string,kind:string,data:Record<string,unknown>,existing?:Record<string,any>){
 const at=new Date().toISOString();
 return {...data,id:idValue,kind,schemaVersion:COMPANY_CONTRACT_VERSION,companyId:ctx.companyId,
  workspaceId:ctx.companyId,status:'active',createdByUid:existing?.createdByUid||ctx.uid,
  createdAt:existing?.createdAt||at,updatedAt:at,revision:(existing?.revision||0)+1};
}
function mandatory(record:Awaited<ReturnType<W9Store['get']>>,code:string){
 if(!record||record.data.status!=='active')return error(code,409);
 return record;
}
async function role(ctx:CompanyAuthorizedContext,store:W9Store) {
 if(ctx.role==='owner')return {canPlan:true,isDriverOnly:false};
 const email=ctx.authorizedEmail.toLowerCase().trim();
 const memberId=digest(email);
 const row=mandatory(await store.get('members',memberId),'MEMBER_REVOKED');
 if(row.data.firebaseUid!==ctx.uid||row.data.email!==email || row.data.status!=='active')return error('MEMBER_REVOKED',403);
 const roles=Array.isArray(row.data.roles)?row.data.roles:[];
 const canPlan=roles.includes('admin')||roles.includes('logistics');
 return {canPlan,isDriverOnly:roles.includes('driver')&&!canPlan};
}
function hashLink(orderId:string,lineId:string,source:string,purchaseId:string,purchaseLineId:string){
 return 'link_'+digest(orderId,lineId,source,purchaseId,purchaseLineId);
}
function orderProjectionId(orderId:string,lineId:string){return 'order_'+digest(orderId,lineId);}
function quotaId(orderId:string,lineId:string){return 'w9_total_'+digest(orderId,lineId);}
function sourceQuotaId(linkId:string){return 'w9_source_'+digest(linkId);}
function qty(v:any,unit:string):string{
 if(!v||v.unit!==unit)return error('UNIT_MISMATCH',409);
 return decimal(milli(v.value));
}
function mutation(row:Awaited<ReturnType<W9Store['get']>>,record:Record<string,unknown>):DeliveryMutation{
 return {kind:'deliveries',id:String(record.id),data:record,...(row?{updateTime:row.updateTime}:{})};
}
async function replay(store:W9Store,action:string,key:unknown,body:unknown){
 const token=validKey(key),fingerprint=hash(body);
 return {token,fingerprint,previous:await store.replay(action,token,fingerprint)};
}
async function committed(store:W9Store,action:string,command:{token:string;fingerprint:string},
 mutations:DeliveryMutation[],checks:DeliveryCheck[],result:Record<string,unknown>,entity:string,before:number|null) {
 try{await store.commit(action,command.token,command.fingerprint,mutations,checks,result,entity,before);}
 catch(ex){
  if(ex instanceof DeliveryError&&(ex.status===409||ex.status===503)){
   const earlier=await store.replay(action,command.token,command.fingerprint);
   if(earlier)return earlier;
  }
  throw ex;
 }
 return result;
}
async function assertDocument(store:W9Store,documentId:unknown){
 const doc=mandatory(await store.get('documents',id(documentId)),'PROOF_DOCUMENT_MISSING');
 if(doc.data.status!=='active')return error('PROOF_DOCUMENT_MISSING',409);
 return doc;
}
/** W7 dispatch precedes and limits W9 delivery. Two W9 CAS quotas prevent double assignment. */
export async function createDelivery(ctx:CompanyAuthorizedContext,body:unknown,key:unknown){
 const store=await W9Store.connect(ctx),who=await role(ctx,store);
 if(!who.canPlan)return error('LOGISTICS_ROLE_REQUIRED',403);
 const draft=parseDeliveryDraft(body),command=await replay(store,'deliveries:create',key,draft);
 if(command.previous)return command.previous;
 const order=mandatory(await store.get('customerOrders',draft.customerOrderId),'ORDER_UNAVAILABLE');
 const line=Array.isArray(order.data.lines)?order.data.lines.find((x:any)=>x.id===draft.customerOrderLineId):null;
 if(!line||line.quantity?.unit!==draft.quantity.unit)return error('ORDER_LINE_MISMATCH',409);
 const orderProj=mandatory(await store.get('allocations',orderProjectionId(draft.customerOrderId,draft.customerOrderLineId)),'W7_DISPATCH_REQUIRED');
 if(orderProj.data.kind!=='order_projection'||orderProj.data.customerOrderId!==draft.customerOrderId||
    orderProj.data.customerOrderLineId!==draft.customerOrderLineId||
    orderProj.data.catalogItemId!==draft.catalogItemId)return error('W7_DISPATCH_MISMATCH',409);
 const source=draft.source==='supplier_direct'?'purchase':'stock';
 const purchaseId=draft.source==='supplier_direct'?draft.purchaseOrderId:'';
 const purchaseLineId=draft.source==='supplier_direct'?draft.purchaseLineId:'';
 const linkId=hashLink(draft.customerOrderId,draft.customerOrderLineId,source,purchaseId,purchaseLineId);
 const link=mandatory(await store.get('allocations',linkId),'W7_DISPATCH_SOURCE_REQUIRED');
 if(link.data.kind!=='allocation_link'||link.data.customerOrderId!==draft.customerOrderId||
   link.data.customerOrderLineId!==draft.customerOrderLineId||link.data.catalogItemId!==draft.catalogItemId||
   link.data.sourceType!==source||link.data.purchaseOrderId!==(purchaseId||null)||
   link.data.purchaseLineId!==(purchaseLineId||null))return error('W7_DISPATCH_SOURCE_MISMATCH',409);
 if(draft.source==='supplier_direct'){
  const purchase=mandatory(await store.get('purchaseOrders',purchaseId),'DIRECT_PURCHASE_UNAVAILABLE');
  if(!['confirmed','partially_confirmed','partially_received','received'].includes(String(purchase.data.workflowState)))
   return error('DIRECT_PURCHASE_UNCONFIRMED',409);
  const linePurchase=Array.isArray(purchase.data.lines)?purchase.data.lines.find((x:any)=>x.id===purchaseLineId):null;
  if(!linePurchase||linePurchase.catalogItemId!==draft.catalogItemId)return error('DIRECT_PURCHASE_MISMATCH',409);
  // Distinguish W7 direct_dispatch from purchase stock dispatch using its inbound projection.
  const inbound=mandatory(await store.get('allocations','inbound_'+digest(purchaseId,purchaseLineId)),'DIRECT_DISPATCH_UNVERIFIED');
  if(inbound.data.kind!=='inbound_projection'||inbound.data.purchaseOrderId!==purchaseId||
    inbound.data.purchaseLineId!==purchaseLineId)return error('DIRECT_DISPATCH_UNVERIFIED',409);
  if(milli(inbound.data.directDispatched||'0')<milli(draft.quantity.value))return error('DIRECT_DISPATCH_UNVERIFIED',409);
 }
 const totalId=quotaId(draft.customerOrderId,draft.customerOrderLineId),sourceId=sourceQuotaId(linkId);
 const [totalRow,sourceRow]=await Promise.all([store.get('deliveries',totalId),store.get('deliveries',sourceId)]);
 for(const q of [totalRow,sourceRow])if(q&&q.data.kind!=='delivery_quota')return error('QUOTA_INTEGRITY_ERROR',503);
 const totalUsed=totalRow?.data.assigned||'0',sourceUsed=sourceRow?.data.assigned||'0';
 const base={unit:draft.quantity.unit,demand:line.quantity,requested:draft.quantity,source:draft.source};
 checkDispatchQuota({...base,dispatched:{value:qty(orderProj.data.dispatched,draft.quantity.unit),unit:draft.quantity.unit},
   alreadyAssigned:{value:totalUsed,unit:draft.quantity.unit},
   ...(draft.source==='supplier_direct'?{directEvidence:{value:qty(link.data.dispatched,draft.quantity.unit),unit:draft.quantity.unit}}:{})});
 checkDispatchQuota({...base,dispatched:{value:qty(link.data.dispatched,draft.quantity.unit),unit:draft.quantity.unit},
   alreadyAssigned:{value:sourceUsed,unit:draft.quantity.unit},
   ...(draft.source==='supplier_direct'?{directEvidence:{value:qty(link.data.dispatched,draft.quantity.unit),unit:draft.quantity.unit}}:{})});
 const deliveryId='delivery_'+randomUUID().replace(/-/g,'');
 const record=owned(ctx,deliveryId,'delivery',{...draft,deliveryState:'planned',
  deliveredQuantity:{value:'0',unit:draft.quantity.unit},history:[],routePlanId:null,
  createdFromW7Dispatch:true,atesto:false,liquidacao:false,payment:false});
 const total=owned(ctx,totalId,'delivery_quota',{customerOrderId:draft.customerOrderId,
  customerOrderLineId:draft.customerOrderLineId,unit:draft.quantity.unit,
  assigned:decimal(milli(totalUsed)+milli(draft.quantity.value))},totalRow?.data);
 const sourceQuota=owned(ctx,sourceId,'delivery_quota',{customerOrderId:draft.customerOrderId,
  customerOrderLineId:draft.customerOrderLineId,sourceLinkId:linkId,unit:draft.quantity.unit,
  assigned:decimal(milli(sourceUsed)+milli(draft.quantity.value))},sourceRow?.data);
 const checks:DeliveryCheck[]=[
  {kind:'customerOrders',id:draft.customerOrderId,updateTime:order.updateTime},
  {kind:'allocations',id:orderProjectionId(draft.customerOrderId,draft.customerOrderLineId),updateTime:orderProj.updateTime},
  {kind:'allocations',id:linkId,updateTime:link.updateTime}];
 return committed(store,'deliveries:create',command,[mutation(null,record),mutation(totalRow,total),mutation(sourceRow,sourceQuota)],checks,
   {delivery:record,romaneio:{id:deliveryId,manualSequence:draft.manualSequence,driverUid:draft.driverUid,
    source:draft.source,quantity:draft.quantity,destination:draft.destination,eta:null,estimatedDistanceMeters:null,
    status:'draft_manual',issued:false}},deliveryId,null);
}
export async function getDelivery(ctx:CompanyAuthorizedContext,deliveryId:string){
 const row=mandatory(await (await W9Store.connect(ctx)).get('deliveries',id(deliveryId)),'DELIVERY_NOT_FOUND');
 if(row.data.kind!=='delivery')return error('DELIVERY_NOT_FOUND',404);
 return row.data;
}
export async function listDeliveries(ctx:CompanyAuthorizedContext,limit:number,cursor:string){
 const page=await(await W9Store.connect(ctx)).list('deliveries',limit,cursor);
 return {...page,items:page.items.filter((v:any)=>v.kind==='delivery')};
}
export async function updateDelivery(ctx:CompanyAuthorizedContext,deliveryId:string,body:unknown,key:unknown){
 if(!obj(body)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)return error('EXPECTED_REVISION_REQUIRED',400);
 const store=await W9Store.connect(ctx),who=await role(ctx,store);
 const action=body.kind==='attach_route'?'deliveries:attach_route':'deliveries:event';
 const command=await replay(store,action,key,{deliveryId,body});
 if(command.previous)return command.previous;
 const existing=mandatory(await store.get('deliveries',id(deliveryId)),'DELIVERY_NOT_FOUND');
 if(existing.data.kind!=='delivery')return error('DELIVERY_NOT_FOUND',404);
 if(existing.data.revision!==body.expectedRevision)return error('REVISION_CONFLICT',409);
 if(!who.canPlan && (!who.isDriverOnly||existing.data.driverUid!==ctx.uid))return error('DRIVER_ASSIGNMENT_REQUIRED',403);
 const checks:DeliveryCheck[]=[];
 let next:Record<string,unknown>;
 if(body.kind==='attach_route'){
  if(!who.canPlan)return error('LOGISTICS_ROLE_REQUIRED',403);
  if(existing.data.deliveryState!=='planned')return error('ROUTE_ASSIGNMENT_TOO_LATE',409);
  const routeId=id(body.routePlanId);
  const plan=mandatory(await store.get('deliveryRoutes',routeId),'APPROVED_ROUTE_NOT_FOUND');
  if(plan.data.planStatus!=='approved'&&plan.data.routeStatus!=='approved')return error('ROUTE_NOT_APPROVED',409);
  const stop=Array.isArray(plan.data.stops)?plan.data.stops.find((v:any)=>v.candidateDeliveryId===deliveryId):null;
  if(!stop||!Number.isSafeInteger(stop.sequence)||stop.sequence<1||
    plan.data.unassigned?.some((x:any)=>x.candidateDeliveryId===deliveryId))return error('ROUTE_STOP_NOT_APPROVED',409);
  next={...existing.data,routePlanId:routeId,manualSequence:stop.sequence,
    revision:existing.data.revision+1,updatedAt:new Date().toISOString(),
    history:[...(existing.data.history||[]),{kind:'route_attached',at:new Date().toISOString(),actorUid:ctx.uid,
      routePlanId:routeId,source:'approved_route'}]};
  checks.push({kind:'deliveryRoutes',id:routeId,updateTime:plan.updateTime});
 } else {
  if(!['collected','departed','delivered','partial','refused','damaged','returned'].includes(body.kind))
    return error('INVALID_OPERATION',400);
  if(['delivered','partial','refused','damaged','returned'].includes(body.kind)){
   const proof=await assertDocument(store,body.proofDocumentId);
   checks.push({kind:'documents',id:proof.data.id,updateTime:proof.updateTime});
  }
  if(body.kind==='departed'){
   const projection=mandatory(await store.get('allocations',
     orderProjectionId(existing.data.customerOrderId,existing.data.customerOrderLineId)),'W7_DISPATCH_REQUIRED');
   if(milli(projection.data.dispatched||'0')<milli(existing.data.quantity.value))
     return error('W7_DISPATCH_REVERSED',409);
   checks.push({kind:'allocations',id:String(projection.data.id),updateTime:projection.updateTime});
  }
  if(body.kind==='returned' && existing.data.source==='company_stock'){
   const eventId=id(body.w7ReturnEventId);
   const stockEvent=mandatory(await store.get('stockEvents',eventId),'W7_RETURN_REQUIRED');
   if(stockEvent.data.kind!=='stock_movement'||!['return','return_converted'].includes(stockEvent.data.operation)||
    stockEvent.data.customerOrderId!==existing.data.customerOrderId||
    stockEvent.data.customerOrderLineId!==existing.data.customerOrderLineId)return error('W7_RETURN_MISMATCH',409);
   checks.push({kind:'stockEvents',id:eventId,updateTime:stockEvent.updateTime});
  }
  next=transitionDelivery(existing.data,body,ctx.uid,new Date().toISOString());
 }
 return committed(store,action,command,[mutation(existing,next)],checks,
   {delivery:next,stockLedgerChanged:false,atesto:false,liquidacao:false,payment:false},
   deliveryId,existing.data.revision);
}
/** Server-computed inbound/outbound timeline. Never expose simulated ETAs. */
export async function listSchedule(ctx:CompanyAuthorizedContext,limit:number,cursor:string,orderFilter?:string){
 const store=await W9Store.connect(ctx);
 const orders=orderFilter ? {items:[mandatory(await store.get('customerOrders',id(orderFilter)),'ORDER_NOT_FOUND').data],
   nextCursor:null} : await store.list('customerOrders',limit,cursor);
 const purchases=await store.list('purchaseOrders',50,'');
 const now=new Date().toISOString();
 const items=await Promise.all(orders.items.flatMap((order:any)=>Array.isArray(order.lines)?
   order.lines.slice(0,60).map(async(line:any)=>{
    const orderLineId=id(line.id);
    const inbound=purchases.items.filter((po:any)=>Array.isArray(po.lines)&&po.lines.some((p:any)=>
       Array.isArray(p.allocations)&&p.allocations.some((a:any)=>a.customerOrderId===order.id&&a.customerOrderLineId===orderLineId)));
    const projection=await store.get('allocations',orderProjectionId(order.id,orderLineId));
    const plan=await store.get('deliveries','w9_schedule_'+digest(order.id,orderLineId));
    const requested=order.requestedDelivery?.value||null;
    const supplierPromised=inbound.map((p:any)=>p.supplierPromisedAt?.value).filter(Boolean).sort().at(-1)||null;
    const risk=assessSchedule({requestedAt:requested||undefined,supplierPromisedAt:supplierPromised||undefined,
      dispatched:milli(projection?.data.dispatched||'0')>0n,now});
    return {customerOrderId:order.id,customerOrderLineId:orderLineId,quantity:line.quantity,
      dispatched:{value:projection?.data.dispatched||'0',unit:line.quantity.unit},
      inboundSources:inbound.map((po:any)=>({purchaseOrderId:po.id,workflowState:po.workflowState,
        desiredAt:po.desiredAt||null,supplierPromisedAt:po.supplierPromisedAt||null})),
      requestedDelivery:order.requestedDelivery||null,approvedPromise:plan?.data.approval||null,
      risk, partialCoverage:purchases.nextCursor!==null};
   }):[]));
 return {items,nextCursor:orders.nextCursor||null,purchasesTruncated:purchases.nextCursor!==null};
}
export async function approveSchedule(ctx:CompanyAuthorizedContext,body:unknown,key:unknown){
 if(!obj(body)||body.approved!==true)return error('HUMAN_APPROVAL_REQUIRED',409);
 const store=await W9Store.connect(ctx),who=await role(ctx,store);
 if(!who.canPlan)return error('LOGISTICS_ROLE_REQUIRED',403);
 const orderId=id(body.customerOrderId),lineId=id(body.customerOrderLineId);
 const approvedByUid=ctx.uid,now=new Date().toISOString();
 const command=await replay(store,'schedule:approve',key,body);
 if(command.previous)return command.previous;
 const order=mandatory(await store.get('customerOrders',orderId),'ORDER_UNAVAILABLE');
 if(!Array.isArray(order.data.lines)||!order.data.lines.some((v:any)=>v.id===lineId))
  return error('ORDER_LINE_MISMATCH',409);
 const evidence=await assertDocument(store,body.approvalDocumentId);
 const planId='w9_schedule_'+digest(orderId,lineId);
 const existing=await store.get('deliveries',planId);
 if(existing&&existing.data.kind!=='schedule_plan')return error('SCHEDULE_INTEGRITY_ERROR',503);
 if(existing && existing.data.revision!==body.expectedRevision)return error('REVISION_CONFLICT',409);
 if(!existing && body.expectedRevision!==undefined && body.expectedRevision!==0)return error('REVISION_CONFLICT',409);
 const approval=approvePromise(existing?.data.approval?.next,body.promisedAt,{
    approved:true,approvedByUid,reason:body.reason,approvedAt:now});
 const record=owned(ctx,planId,'schedule_plan',{customerOrderId:orderId,customerOrderLineId:lineId,
   approval:{...approval,approvalDocumentId:evidence.data.id,source:'publicCustomer_confirmed'},
   history:[...(existing?.data.history||[]).slice(-39),approval]},existing?.data);
 return committed(store,'schedule:approve',command,[mutation(existing,record)],
  [{kind:'customerOrders',id:orderId,updateTime:order.updateTime},
   {kind:'documents',id:evidence.data.id,updateTime:evidence.updateTime}],
  {approval:record.approval,revision:record.revision,source:'manual_documented'},planId,existing?.data.revision||null);
}
