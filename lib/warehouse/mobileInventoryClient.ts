'use client';

import { warehouseDb } from '../firebase';
import { warehouseServerCommand } from './serverCommandClient';
import { collection,getDocs,limit,orderBy,query } from './mobileReadSdkBridge';
import { warehouseDomainPath } from './namespace';
import { isValidWarehouseInventoryId,validateWarehouseInventoryItem,
  validateWarehouseInventorySession } from './inventory';
import type {
  WarehouseInventorySessionRecord,WarehouseInventoryItemRecord,
  ApplyWarehouseInventoryAdjustmentResult,
} from './inventoryRepository';

export {
  startWarehouseInventory,saveWarehouseInventoryCount,beginWarehouseInventoryReview,
  reopenWarehouseInventoryCounting,cancelWarehouseInventory,
} from './inventoryRepository';
export type { WarehouseInventorySessionRecord,WarehouseInventoryItemRecord } from './inventoryRepository';

const iso=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))
  ?new Date(x).toISOString():null;

export async function listWarehouseInventorySessions(
  workspaceId:string,maxResults=24
):Promise<WarehouseInventorySessionRecord[]> {
  const snap=await getDocs(query(
    collection(warehouseDb,warehouseDomainPath(workspaceId,'inventories')),
    orderBy('createdAt','desc'),limit(Math.max(1,Math.min(maxResults,60)))));
  return snap.docs.map(r=>{
    const d=r.data() as Record<string,unknown>;
    const p=validateWarehouseInventorySession({
      schemaVersion:d.schemaVersion,id:r.id,workspaceId:d.workspaceId,ug:d.ug,
      scope:d.scope,status:d.status,itemCount:d.itemCount,openedBy:d.openedBy,
      reviewedBy:d.reviewedBy??null,confirmationStartedBy:d.confirmationStartedBy??null,
      confirmedBy:d.confirmedBy??null,cancelledBy:d.cancelledBy??null,
      reviewSummary:d.reviewSummary??null,staleItemId:d.staleItemId??null,
    },{expectedWorkspaceId:workspaceId});
    if(!p.ok)throw new Error('WAREHOUSE_MOBILE_INVENTORY_SESSION_INVALID');
    return {session:p.data,referenceCapturedAt:iso(d.referenceCapturedAt),
      createdAt:iso(d.createdAt),updatedAt:iso(d.updatedAt),
      reviewedAt:iso(d.reviewedAt),confirmationStartedAt:iso(d.confirmationStartedAt),
      confirmedAt:iso(d.confirmedAt),cancelledAt:iso(d.cancelledAt)};
  });
}
export async function listWarehouseInventoryItems(
  workspaceId:string,inventoryId:string,maxResults=500
):Promise<WarehouseInventoryItemRecord[]> {
  if(!isValidWarehouseInventoryId(inventoryId))
    throw new Error('WAREHOUSE_MOBILE_INVENTORY_INVALID_ID');
  const snap=await getDocs(query(collection(warehouseDb,
    warehouseDomainPath(workspaceId,'inventories')+'/'+inventoryId+'/items'),
    limit(Math.max(1,Math.min(maxResults,500)))));
  return snap.docs.map(r=>{
    const d=r.data() as Record<string,unknown>;
    const p=validateWarehouseInventoryItem({
      schemaVersion:d.schemaVersion,id:r.id,inventoryId:d.inventoryId,
      workspaceId:d.workspaceId,ug:d.ug,materialId:d.materialId,
      position:d.position,locationBalanceId:d.locationBalanceId,
      expectedQuantity:d.expectedQuantity,
      expectedBalanceRevision:d.expectedBalanceRevision,
      expectedBalanceLastMovementId:d.expectedBalanceLastMovementId,
      expectedLocationRevision:d.expectedLocationRevision,
      expectedLocationLastMovementId:d.expectedLocationLastMovementId,
      countedQuantity:d.countedQuantity??null,difference:d.difference??null,
      status:d.status,countedBy:d.countedBy??null,
      adjustmentMovementId:d.adjustmentMovementId??null,
      adjustedBy:d.adjustedBy??null,
    },{expectedWorkspaceId:workspaceId,expectedInventoryId:inventoryId});
    if(!p.ok)throw new Error('WAREHOUSE_MOBILE_INVENTORY_ITEM_INVALID');
    return {item:p.data,countedAt:iso(d.countedAt),adjustedAt:iso(d.adjustedAt)};
  });
}

/** Confirmação segue o motor canônico, com leituras também server-only. */
export async function confirmWarehouseInventory(
  workspaceId:string,inventoryId:string
):Promise<{adjusted:number;matched:number}> {
  await warehouseServerCommand(workspaceId,'INVENTORY_BEGIN_CONFIRM',{inventoryId});
  const records=await listWarehouseInventoryItems(workspaceId,inventoryId);
  let adjusted=records.filter(r=>r.item.status==='ADJUSTED').length;
  const matched=records.filter(r=>r.item.status==='MATCHED').length;
  for(const {item} of records) {
    if(item.status!=='DIVERGENT')continue;
    try {
      const result=await warehouseServerCommand<ApplyWarehouseInventoryAdjustmentResult>(
        workspaceId,'INVENTORY_ADJUST',{inventoryId,itemId:item.id});
      if(result.applied)adjusted++;
    }catch(e){
      const message=e instanceof Error?e.message:'';
      if(message.includes('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE')) {
        await warehouseServerCommand(workspaceId,'INVENTORY_STALE',{inventoryId,itemId:item.id});
      }
      throw e;
    }
  }
  await warehouseServerCommand(workspaceId,'INVENTORY_FINISH_CONFIRM',{inventoryId});
  return {adjusted,matched};
}
