import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, warehouseAdminListInventoryItems,
  WarehouseStoreError, type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  validateWarehouseInventorySession,validateWarehouseInventoryItem,
  calculateWarehouseInventoryDifference, warehouseInventoryItemStatusForDifference,
  summarizeWarehouseInventoryItems,type WarehouseInventorySession,
  type WarehouseInventoryItem, type WarehouseInventoryReviewSummary,
} from '../warehouse/inventory';
import { normalizeWarehouseQuantity } from '../warehouse/movement';

const fail=(error:string,status=409):never=>{throw new WarehouseStoreError(error,status);};
const sessionPath=(ws:string,id:string)=>`warehouse/${ws}/inventories/${id}`;
const itemPath=(ws:string,inv:string,id:string)=>sessionPath(ws,inv)+'/items/'+id;
export function verifySession(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument) {
  const d=row.data;
  const r=validateWarehouseInventorySession({
    schemaVersion:d.schemaVersion,id:d.id,workspaceId:d.workspaceId,ug:d.ug,
    scope:d.scope,status:d.status,itemCount:d.itemCount,openedBy:d.openedBy,
    reviewedBy:d.reviewedBy??null,confirmationStartedBy:d.confirmationStartedBy??null,
    confirmedBy:d.confirmedBy??null,cancelledBy:d.cancelledBy??null,
    reviewSummary:d.reviewSummary??null,staleItemId:d.staleItemId??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_INVENTORY_INVALID_SESSION');
  return r.data;
}
export function verifyItem(access:VerifiedWarehouseRequest,inventoryId:string,row:WarehouseAdminDocument) {
  const d=row.data;
  const r=validateWarehouseInventoryItem({
    schemaVersion:d.schemaVersion,id:d.id,inventoryId:d.inventoryId,
    workspaceId:d.workspaceId,ug:d.ug,materialId:d.materialId,
    position:d.position,locationBalanceId:d.locationBalanceId,
    expectedQuantity:d.expectedQuantity,
    expectedBalanceRevision:d.expectedBalanceRevision,
    expectedBalanceLastMovementId:d.expectedBalanceLastMovementId,
    expectedLocationRevision:d.expectedLocationRevision,
    expectedLocationLastMovementId:d.expectedLocationLastMovementId,
    countedQuantity:d.countedQuantity??null,difference:d.difference??null,
    status:d.status,countedBy:d.countedBy??null,
    adjustmentMovementId:d.adjustmentMovementId??null,adjustedBy:d.adjustedBy??null,
  },{expectedWorkspaceId:access.workspaceId,expectedInventoryId:inventoryId});
  if(!r.ok||r.data.ug!==access.ug)return fail('WAREHOUSE_INVENTORY_INVALID_ITEM');
  return r.data;
}
function cmd(raw:unknown):{inventoryId:string;itemId?:string;countedQuantity?:number} {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_INVENTORY_INVALID_COMMAND',400);
  const x=raw as Record<string,unknown>;
  if(typeof x.inventoryId!=='string'||!/^inv_[a-f0-9]{32}$/.test(x.inventoryId)) {
    return fail('WAREHOUSE_INVENTORY_INVALID_ID',400);
  }
  if(x.itemId!==undefined&&(typeof x.itemId!=='string'||!/^invit_[a-f0-9]{64}$/.test(x.itemId))) {
    return fail('WAREHOUSE_INVENTORY_INVALID_ITEM_ID',400);
  }
  return {inventoryId:x.inventoryId,
    ...(typeof x.itemId==='string'?{itemId:x.itemId}:{}),
    ...(typeof x.countedQuantity==='number'?{countedQuantity:x.countedQuantity}:{})};
}
export async function warehouseInventoryLifecycleServer(
  access:VerifiedWarehouseRequest,action:
  'COUNT'|'REVIEW'|'REOPEN'|'BEGIN_CONFIRM'|'FINISH_CONFIRM'|'CANCEL'|'STALE',
  raw:unknown
):Promise<WarehouseInventoryItem|WarehouseInventoryReviewSummary|{ok:true}> {
  const {inventoryId,itemId,countedQuantity}=cmd(raw);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const session=sessionPath(access.workspaceId,inventoryId);
  if(action==='COUNT'||action==='STALE'){
    if(!itemId)return fail('WAREHOUSE_INVENTORY_INVALID_ITEM_ID',400);
    const item=itemPath(access.workspaceId,inventoryId,itemId);
    const count=normalizeWarehouseQuantity(countedQuantity);
    if(action==='COUNT'&&(count===null||count<0))return fail('WAREHOUSE_INVENTORY_INVALID_COUNT',400);
    return warehouseAdminTransaction(token,[session,item],rows=>{
      const s=rows.get(session),i=rows.get(item);
      if(!s||!i)return fail('WAREHOUSE_INVENTORY_NOT_FOUND',404);
      const known=verifySession(access,s),current=verifyItem(access,inventoryId,i);
      if(action==='STALE'){
        if(known.status!=='CONFIRMING'||current.status==='ADJUSTED'){
          return {result:{ok:true as const},writes:[]};
        }
        return {result:{ok:true as const},writes:[
          {path:item,data:{...i.data,status:'STALE'}},
          {path:session,data:{...s.data,status:'RECONCILIATION_REQUIRED',
            staleItemId:itemId,updatedAt:new Date()}},
        ]};
      }
      if(known.status!=='COUNTING')return fail('WAREHOUSE_INVENTORY_NOT_COUNTING');
      if(current.status==='ADJUSTED')return fail('WAREHOUSE_INVENTORY_ITEM_ALREADY_ADJUSTED');
      const difference=calculateWarehouseInventoryDifference(current.expectedQuantity,count!);
      const next:WarehouseInventoryItem={...current,countedQuantity:count!,
        difference,status:warehouseInventoryItemStatusForDifference(count!,difference),
        countedBy:access.uid,adjustmentMovementId:null,adjustedBy:null};
      return {result:next,writes:[{path:item,data:{...i.data,...next,
        countedAt:new Date(),adjustedAt:null}}]};
    });
  }
  if(action==='REVIEW'||action==='FINISH_CONFIRM') {
    const listed=await warehouseAdminListInventoryItems(token,access.workspaceId,inventoryId,120);
    if(!listed.length)return fail('WAREHOUSE_INVENTORY_EMPTY');
    const paths=[session,...listed.map(x=>x.path)];
    return warehouseAdminTransaction(token,paths,rows=>{
      const current=rows.get(session);
      if(!current)return fail('WAREHOUSE_INVENTORY_NOT_FOUND',404);
      const known=verifySession(access,current);
      const all=listed.map(row=>{
        const authoritative=rows.get(row.path);
        if(!authoritative)return fail('WAREHOUSE_INVENTORY_ITEM_DISAPPEARED');
        return verifyItem(access,inventoryId,authoritative);
      });
      if(all.length!==known.itemCount)return fail('WAREHOUSE_INVENTORY_SCOPE_SATURATED');
      if(action==='REVIEW'){
        if(known.status!=='COUNTING')return fail('WAREHOUSE_INVENTORY_NOT_COUNTING');
        if(all.some(i=>i.status==='PENDING'||i.status==='STALE'))return fail('WAREHOUSE_INVENTORY_COUNT_INCOMPLETE');
        const summary=summarizeWarehouseInventoryItems(all);
        return {result:summary,writes:[{path:session,data:{
          ...current.data,status:'REVIEW',reviewedBy:access.uid,
          reviewSummary:summary,reviewedAt:new Date(),updatedAt:new Date(),
          staleItemId:null,
        }}]};
      }
      if(known.status!=='CONFIRMING')return fail('WAREHOUSE_INVENTORY_NOT_CONFIRMING');
      if(all.some(i=>['PENDING','DIVERGENT','STALE'].includes(i.status))) {
        return fail('WAREHOUSE_INVENTORY_CONFIRMATION_INCOMPLETE');
      }
      return {result:{ok:true as const},writes:[{path:session,data:{
        ...current.data,status:'CONFIRMED',confirmedBy:access.uid,
        confirmedAt:new Date(),updatedAt:new Date(),staleItemId:null,
      }}]};
    });
  }
  return warehouseAdminTransaction(token,[session],rows=>{
    const current=rows.get(session);
    if(!current)return fail('WAREHOUSE_INVENTORY_NOT_FOUND',404);
    const known=verifySession(access,current);
    const update:Record<string,unknown>={...current.data,updatedAt:new Date()};
    if(action==='CANCEL'){
      if(known.status==='CONFIRMED'||known.status==='CANCELLED')return fail('WAREHOUSE_INVENTORY_FINALIZED');
      if(known.status==='CONFIRMING')return fail('WAREHOUSE_INVENTORY_CONFIRMATION_IN_PROGRESS');
      Object.assign(update,{status:'CANCELLED',cancelledBy:access.uid,cancelledAt:new Date()});
    }else if(action==='REOPEN'){
      if(known.status!=='REVIEW')return fail('WAREHOUSE_INVENTORY_NOT_IN_REVIEW');
      Object.assign(update,{status:'COUNTING',reviewedBy:null,reviewSummary:null,reviewedAt:null});
    }else if(action==='BEGIN_CONFIRM'){
      if(known.status==='CONFIRMING')return {result:{ok:true as const},writes:[]};
      if(known.status!=='REVIEW')return fail('WAREHOUSE_INVENTORY_NOT_IN_REVIEW');
      Object.assign(update,{status:'CONFIRMING',
        confirmationStartedBy:access.uid,confirmationStartedAt:new Date()});
    }else return fail('WAREHOUSE_INVENTORY_OPERATION_UNSUPPORTED',400);
    return {result:{ok:true as const},writes:[{path:session,data:update}]};
  });
}
