'use client';

import { warehouseDb } from '../firebase';
import { collection,getDocs,limit,query } from './mobileReadSdkBridge';
import { warehouseDomainPath } from './namespace';
import {
  isWarehouseDestinationId,normalizeWarehouseDestinationName,
  WAREHOUSE_DESTINATION_SCHEMA_VERSION,
  type WarehouseDestinationListItem, type WarehouseDestination,
} from './withdrawal';

export {createWarehouseDestination,finalizeWarehouseMaterialWithdrawal} from './withdrawalRepository';

const iso=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))
  ?new Date(v).toISOString():null;
function checked(ws:string,id:string,d:Record<string,unknown>):WarehouseDestination {
  const name=typeof d.name==='string'?normalizeWarehouseDestinationName(d.name):'';
  if(d.schemaVersion!==WAREHOUSE_DESTINATION_SCHEMA_VERSION
    ||!isWarehouseDestinationId(id)||d.id!==id||d.workspaceId!==ws
    ||typeof d.ug!=='string'||!/^\d{6}$/.test(d.ug)||!name
    ||(d.status!=='active'&&d.status!=='inactive')
    ||typeof d.createdBy!=='string'||!d.createdBy
    ||typeof d.updatedBy!=='string'||!d.updatedBy)
      throw new Error('WAREHOUSE_MOBILE_DESTINATION_INVALID');
  return {
    schemaVersion:WAREHOUSE_DESTINATION_SCHEMA_VERSION,id,workspaceId:ws,ug:d.ug,name,
    status:d.status,createdBy:d.createdBy,updatedBy:d.updatedBy,
  };
}
export async function listWarehouseDestinationsCached(
  workspaceId:string,maxResults=250
):Promise<WarehouseDestinationListItem[]> {
  const snap=await getDocs(query(
    collection(warehouseDb,warehouseDomainPath(workspaceId,'destinations')),
    limit(Math.max(1,Math.min(maxResults,250)))));
  return snap.docs.map(r=>{
    const d=r.data() as Record<string,unknown>;
    return {destination:checked(workspaceId,r.id,d),
      createdAt:iso(d.createdAt),updatedAt:iso(d.updatedAt)};
  }).sort((a,b)=>a.destination.name.localeCompare(b.destination.name,'pt-BR'));
}
