/** W7 independent company inventory service. Neither military warehouse nor billing is imported. */
import {createHash,randomUUID} from 'node:crypto';
import type {CompanyAuthorizedContext} from '../../server/companyAuthz';
import {InventoryStore, type Stored, type Mutation, type ReadCheck} from './store';
import {InventoryError, id, key, asQuantity, decimal, parseMilli,
  blankStock,blankOrder,blankLink,blankInbound,applyInventoryCommand} from './engine.mjs';

type ObjectValue=Record<string,any>;
const kinds=new Set(['adjust_in','adjust_out','reserve','release','dispatch','return','release_converted','dispatch_converted','return_converted',
  'plan_purchase','unplan_purchase','consume_receipt','convert_purchase','direct_dispatch']);
const withOrder=new Set(['reserve','release','dispatch','return','release_converted','dispatch_converted','return_converted','plan_purchase',
  'unplan_purchase','convert_purchase','direct_dispatch']);
const withPurchase=new Set(['release_converted','dispatch_converted','return_converted','plan_purchase','unplan_purchase','consume_receipt','convert_purchase','direct_dispatch']);
const toObj=(raw:unknown):ObjectValue=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new InventoryError('INVALID_BODY',400);
 return raw as ObjectValue;
};
function owned(ctx:CompanyAuthorizedContext, record:Stored|null, idValue:string, payload:ObjectValue){
 const at=new Date().toISOString();
 return {...(record?.data||{}),...payload,schemaVersion:'company-r1-v1',
    id:idValue,companyId:ctx.companyId,workspaceId:ctx.companyId,status:'active',
    createdByUid:record?.data.createdByUid||ctx.uid,createdAt:record?.data.createdAt||at,
    updatedAt:at,revision:(record?.data.revision||0)+1};
}
function checkDoc(row:Stored|null, kind:string):Stored {
 if(!row||row.data.status!=='active')throw new InventoryError(kind+'_UNAVAILABLE',409);
 return row;
}
function normalizeHash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function summaryId(prefix:string,...parts:string[]){return prefix+'_'+createHash('sha256').update(parts.join(':')).digest('hex');}
function mutable(collection:Mutation['collection'],record:Stored|null,recordId:string,data:ObjectValue):Mutation {
 return {collection,id:recordId,data, ...(record?{updateTime:record.updateTime}:{})};
}
function actionFor(kind:string){return ['reserve','release','dispatch','return','release_converted','dispatch_converted','return_converted','plan_purchase',
 'unplan_purchase','convert_purchase','direct_dispatch'].includes(kind)?'allocations:write':
 kind==='consume_receipt'?'inboundShipments:write':'stockEvents:write';}
export function inventoryActionFor(kind:string):'allocations:write'|'inboundShipments:write'|'stockEvents:write' {
 if(!kinds.has(kind))throw new InventoryError('UNKNOWN_OPERATION',400);
 return actionFor(kind) as 'allocations:write'|'inboundShipments:write'|'stockEvents:write';
}
export async function executeInventory(ctx:CompanyAuthorizedContext, raw:unknown,rawKey:unknown){
 const command=toObj(raw),kind=String(command.kind);
 if(!kinds.has(kind))throw new InventoryError('UNKNOWN_OPERATION',400);
 if(ctx.action!==inventoryActionFor(kind))throw new InventoryError('ACTION_FORBIDDEN',403);
 const idem=key(rawKey),catalogItemId=id(command.catalogItemId);
 const orderId=withOrder.has(kind)?id(command.customerOrderId):'';
 const orderLineId=withOrder.has(kind)?id(command.customerOrderLineId):'';
 const purchaseOrderId=withPurchase.has(kind)?id(command.purchaseOrderId):'';
 const purchaseLineId=withPurchase.has(kind)?id(command.purchaseLineId):'';
 const reason=kind.startsWith('adjust') ? command.reason : undefined;
 const purchaseEventId=kind==='consume_receipt'?id(command.purchaseEventId):'';
 const input={kind,catalogItemId,customerOrderId:orderId,customerOrderLineId:orderLineId,
  purchaseOrderId,purchaseLineId,purchaseEventId,quantity:kind==='consume_receipt'?null:command.quantity,reason};
 const fingerprint=normalizeHash(input),action='stockEvents:'+kind;
 const store=await InventoryStore.connect(ctx);
 // Replay must precede checks of current stock and orders: a committed command is stable.
 const earlier=await store.replay(action,idem,fingerprint);
 if(earlier)return earlier;
 const catalogue=checkDoc(await store.get('catalogItems',catalogItemId),'CATALOG_ITEM');
 const unit=catalogue.data.canonicalUnit;
 if(!['UN','KG','G','L','ML','CX','FD','M'].includes(unit))
   throw new InventoryError('INVALID_CATALOG_UNIT',503);
 const checks:ReadCheck[]=[{collection:'catalogItems',id:catalogItemId,updateTime:catalogue.updateTime}];
 const orderRecord=orderId?checkDoc(await store.get('customerOrders',orderId),'ORDER'):null;
 let orderLimit='0';
 if(orderRecord){
   checks.push({collection:'customerOrders',id:orderId,updateTime:orderRecord.updateTime});
   const line=Array.isArray(orderRecord.data.lines)?
      orderRecord.data.lines.find((l:ObjectValue)=>l.id===orderLineId):null;
   if(!line || line.quantity?.unit!==unit)throw new InventoryError('ORDER_LINE_UNIT_MISMATCH',409);
   if(orderRecord.data.fulfillmentState==='fulfilled')throw new InventoryError('ORDER_ALREADY_FULFILLED',409);
   orderLimit=line.quantity.value;
   parseMilli(orderLimit);
 }
 const purchaseRecord=purchaseOrderId?checkDoc(await store.get('purchaseOrders',purchaseOrderId),'PURCHASE_CONTRACT_NOT_READY'):null;
 let purchaseLine: ObjectValue | null=null;
 let purchaseQuantity='0', conversion:undefined|ObjectValue;
 if(purchaseRecord){
   checks.push({collection:'purchaseOrders',id:purchaseOrderId,updateTime:purchaseRecord.updateTime});
   const po=purchaseRecord.data;
   if(!['confirmed','partially_confirmed','partially_received','received'].includes(String(po.workflowState||'')))
     throw new InventoryError('PURCHASE_NOT_CONFIRMED',409);
   const line=Array.isArray(po.lines)?po.lines.find((l:ObjectValue)=>l.id===purchaseLineId):null;
   purchaseLine=line||null;
   if(!line||line.catalogItemId!==catalogItemId||!line.quantity?.value||!line.quantity?.unit ||
       !line.confirmedQuantity?.value || line.confirmedQuantity?.unit!==line.quantity.unit)
     throw new InventoryError('PURCHASE_LINE_CONTRACT_UNAVAILABLE',503);
   if(typeof po.sourceSupplierId!=='string')throw new InventoryError('PURCHASE_SUPPLIER_UNVERIFIED',503);
   const option=Array.isArray(catalogue.data.sourcingOptions)?
     catalogue.data.sourcingOptions.find((item:ObjectValue)=>item.sourceSupplierId===po.sourceSupplierId
       && item.supplierSku===line.supplierSku && item.purchaseUnit===line.quantity.unit):null;
   if(!option)throw new InventoryError('PURCHASE_SOURCE_MISMATCH',409);
   conversion=option.conversion;
   if(!line.conversion||line.conversion.from!==conversion?.from||line.conversion.to!==conversion?.to||
      line.conversion.numerator!==conversion?.numerator||line.conversion.denominator!==conversion?.denominator)
      throw new InventoryError('PURCHASE_CONVERSION_MISMATCH',409);
   purchaseQuantity=decimal(asQuantity(line.confirmedQuantity,unit,conversion));
 }
 // No arbitrary conversion submitted by the client: the validated W2 catalogue is authoritative.
 let canonicalQuantity:string;
 let purchaseEvent:Stored|null=null;
 if(kind==='consume_receipt') {
   purchaseEvent=await store.get('inboundShipments',purchaseEventId);
   if(!purchaseEvent)throw new InventoryError('PURCHASE_RECEIPT_UNAVAILABLE',409);
   const v=purchaseEvent.data;
   if(v.kind!=='purchase.received'||v.stockPosted!==false||v.purchaseOrderId!==purchaseOrderId||
      v.sourceSupplierId!==purchaseRecord?.data.sourceSupplierId||!Array.isArray(v.receivedDeltas) ||
      !v.receiptReference||typeof v.receiptReference!=='string')
     throw new InventoryError('INVALID_INBOUND_EVENT',409);
   const matches=v.receivedDeltas.filter((delta:ObjectValue)=>delta.lineId===purchaseLineId && delta.catalogItemId===catalogItemId);
   if(matches.length!==1||matches[0].quantity?.unit!==purchaseLine?.quantity?.unit||
      matches[0].conversion?.from!==purchaseLine?.conversion?.from||
      matches[0].conversion?.to!==purchaseLine?.conversion?.to||
      matches[0].conversion?.numerator!==purchaseLine?.conversion?.numerator||
      matches[0].conversion?.denominator!==purchaseLine?.conversion?.denominator)
     throw new InventoryError('INBOUND_LINE_MISMATCH',409);
   canonicalQuantity=decimal(asQuantity(matches[0].quantity,unit,conversion));
   checks.push({collection:'inboundShipments',id:purchaseEventId,updateTime:purchaseEvent.updateTime});
 } else canonicalQuantity=decimal(asQuantity(command.quantity,unit,conversion));
 const stockId=summaryId('balance',catalogItemId);
 const orderSummaryId=orderId?summaryId('order',orderId,orderLineId):'';
 const sourceType=purchaseOrderId?'purchase':'stock';
 const linkId=orderId?summaryId('link',orderId,orderLineId,sourceType,purchaseOrderId,purchaseLineId):'';
 const inboundId=purchaseOrderId?summaryId('inbound',purchaseOrderId,purchaseLineId):'';
 const [stockRow,orderRow,linkRow,inboundRow]=await Promise.all([
   store.get('stockEvents',stockId),
   orderSummaryId?store.get('allocations',orderSummaryId):Promise.resolve(null),
   linkId?store.get('allocations',linkId):Promise.resolve(null),
   inboundId?store.get('inboundShipments',inboundId):Promise.resolve(null),
 ]);
 const stock=stockRow?.data||blankStock();
 const order=orderRow?.data||blankOrder(catalogItemId,unit);
 const link=linkRow?.data||blankLink(sourceType);
 const inbound=inboundId?(inboundRow?.data||blankInbound(purchaseQuantity)):null;
 // W6 planning is only a proposal, not a stock reservation. Never assign its
 // quantity to a different OM order/line than the immutable purchase plan permits.
 if(purchaseLine && orderId){
   const allowed=Array.isArray(purchaseLine.allocations)?
     purchaseLine.allocations.find((a:ObjectValue)=>a.customerOrderId===orderId&&a.customerOrderLineId===orderLineId):null;
   if(!allowed||allowed.quantity?.unit!==unit)throw new InventoryError('PURCHASE_ALLOCATION_NOT_PLANNED',409);
   const used=parseMilli(link.planned||'0')+parseMilli(link.reserved||'0')+parseMilli(link.dispatched||'0');
   if(kind==='plan_purchase'&&used+parseMilli(canonicalQuantity)>parseMilli(allowed.quantity.value))
     throw new InventoryError('PURCHASE_ALLOCATION_EXCEEDS_PLAN',409);
 }
 if(order.catalogItemId!==catalogItemId||order.canonicalUnit!==unit ||
   link.sourceType!==sourceType||(inbound&&inbound.purchaseQuantity!==purchaseQuantity))
   throw new InventoryError('PROJECTION_INTEGRITY_ERROR',503);
 // Physical receipt checks the confirmed purchase; an allocation alone is not stock.
 const result=applyInventoryCommand({
    command:{kind:kind==='consume_receipt'?'receive_purchase':kind,canonicalQuantity,reason},
    stock,order,link,inbound,orderLimit,purchased:purchaseQuantity
 });
 const mutations:Mutation[]=[
   mutable('stockEvents',stockRow,stockId,owned(ctx,stockRow,stockId,{
      ...result.stock,catalogItemId,canonicalUnit:unit})),
 ];
 if(orderSummaryId)mutations.push(mutable('allocations',orderRow,orderSummaryId,owned(ctx,orderRow,orderSummaryId,{
    ...result.order,customerOrderId:orderId,customerOrderLineId:orderLineId})));
 if(linkId)mutations.push(mutable('allocations',linkRow,linkId,owned(ctx,linkRow,linkId,{
    ...result.link,catalogItemId,customerOrderId:orderId,customerOrderLineId:orderLineId,
    purchaseOrderId:purchaseOrderId||null,purchaseLineId:purchaseLineId||null})));
 if(inboundId&&result.inbound)mutations.push(mutable('inboundShipments',inboundRow,inboundId,
   owned(ctx,inboundRow,inboundId,{...result.inbound,catalogItemId,purchaseOrderId,purchaseLineId,canonicalUnit:unit})));
 // Event-specific marker is tenant-global, not UID-scoped; this avoids double stock posting
 // even if another authorized operator submits the same W6 receipt with a new key.
 if(kind==='consume_receipt'){
   const markerId=summaryId('receipt',purchaseEventId,purchaseLineId);
   mutations.push(mutable('inboundShipments',null,markerId,owned(ctx,null,markerId,{
      kind:'receipt_consumed',purchaseEventId,purchaseOrderId,purchaseLineId,catalogItemId,
      canonicalQuantity,sourceEventKind:'purchase.received'})));
 }
 const eventId='event_'+randomUUID();
 const event=owned(ctx,null,eventId,{kind:'stock_movement',operation:kind,catalogItemId,
    customerOrderId:orderId||null,customerOrderLineId:orderLineId||null,
    purchaseOrderId:purchaseOrderId||null,purchaseLineId:purchaseLineId||null,
    purchaseEventId:purchaseEventId||null,quantity:{value:canonicalQuantity,unit},reason:typeof reason==='string'?reason.trim():null,
    actorUid:ctx.uid,correlationId:eventId});
 const output={eventId,catalogItemId,stock:result.stock,
    allocation:orderSummaryId?result.order:null,source:linkId?result.link:null,
    inbound:result.inbound,operation:kind,dispatchedIsNotDelivered:kind==='dispatch'||kind==='direct_dispatch'};
 try{await store.commit(action,idem,fingerprint,mutations,event,output,checks);}
 catch(error){
   if(error instanceof InventoryError&&[409,503].includes(error.status)){
     const replay=await store.replay(action,idem,fingerprint);
     if(replay)return replay;
   }
   throw error;
 }
 return output;
}
export async function getInventory(ctx:CompanyAuthorizedContext,catalogId:string){
 const store=await InventoryStore.connect(ctx);
 const catalogue=checkDoc(await store.get('catalogItems',id(catalogId)),'CATALOG_ITEM');
 const summary=await store.get('stockEvents',summaryId('balance',catalogId));
 return {catalogItemId:catalogId,canonicalUnit:catalogue.data.canonicalUnit,
  ...(summary?summary.data:blankStock()),free:decimal(
     parseMilli(summary?.data.onHand||'0')-parseMilli(summary?.data.reserved||'0'))};
}
export async function listInventoryEvents(ctx:CompanyAuthorizedContext,limit:number,cursor?:string){
 const page=await (await InventoryStore.connect(ctx)).list('stockEvents',limit,cursor);
 return {items:page.items.filter(v=>v.kind==='stock_movement'),nextCursor:page.nextCursor};
}
