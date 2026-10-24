'use client';

import { warehouseDb } from '../firebase';
import { collection, doc, getDoc, getDocs, limit, query, where } from './mobileReadSdkBridge';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  isValidWarehouseDepotId, isValidWarehouseLocationId, isValidWarehouseSubpositionId,
  normalizeWarehouseLogicalCode, validateWarehouseDepot, validateWarehouseLocation,
  validateWarehouseLocationBalance,
  type WarehouseDepot,type WarehouseLocation,type WarehouseLocationKind,type WarehouseLocationBalance,
} from './location';
import { warehouseCanonicalLocationBalanceReadInput } from './readCompatibility';
import type { WarehouseDepotListItem, WarehouseLocationListItem, WarehouseLocationBalanceListItem } from './locationRepository';

const time=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
function depot(ws:string,id:string,d:Record<string,unknown>):WarehouseDepot {
  const result=validateWarehouseDepot({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,code:d.code,
    name:d.name,description:d.description??null,visualType:d.visualType??'STANDARD',
    sizeProfile:d.sizeProfile??'MEDIUM',status:d.status,
    createdBy:d.createdBy,updatedBy:d.updatedBy,
  },{expectedWorkspaceId:ws});
  if(!result.ok)throw new Error('WAREHOUSE_MOBILE_DEPOT_INVALID');
  return result.data;
}
function location(ws:string,id:string,d:Record<string,unknown>):WarehouseLocation {
  const result=validateWarehouseLocation({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    depotId:d.depotId,kind:d.kind,parentLocationId:d.parentLocationId??null,
    code:d.code,name:d.name,description:d.description??null,
    status:d.status,createdBy:d.createdBy,updatedBy:d.updatedBy,
  },{expectedWorkspaceId:ws});
  if(!result.ok)throw new Error('WAREHOUSE_MOBILE_LOCATION_INVALID');
  return result.data;
}
const wrapDepot=(ws:string,id:string,d:Record<string,unknown>):WarehouseDepotListItem=>({
  depot:depot(ws,id,d),createdAt:time(d.createdAt),updatedAt:time(d.updatedAt),
});
const wrapLocation=(ws:string,id:string,d:Record<string,unknown>):WarehouseLocationListItem=>({
  location:location(ws,id,d),createdAt:time(d.createdAt),updatedAt:time(d.updatedAt),
});

export async function getWarehouseDepot(ws:string,id:string):Promise<WarehouseDepotListItem|null> {
  if(!isValidWarehouseDepotId(id))return null;
  const result=await getDoc(doc(warehouseDb,warehouseDocumentPath(ws,'depots',id)));
  return result.exists()?wrapDepot(ws,result.id,result.data() as Record<string,unknown>):null;
}
export async function getWarehouseLocation(ws:string,id:string):Promise<WarehouseLocationListItem|null> {
  if(!isValidWarehouseLocationId(id)&&!isValidWarehouseSubpositionId(id))return null;
  const result=await getDoc(doc(warehouseDb,warehouseDocumentPath(ws,'locations',id)));
  return result.exists()?wrapLocation(ws,result.id,result.data() as Record<string,unknown>):null;
}
export async function getWarehouseDepotByCode(ws:string,code:string):Promise<WarehouseDepotListItem|null> {
  const value=normalizeWarehouseLogicalCode(code);
  if(!value)return null;
  const result=await getDocs(query(collection(warehouseDb,warehouseDomainPath(ws,'depots')),
    where('code','==',value),limit(5)));
  const matches=result.docs.map(row=>wrapDepot(ws,row.id,row.data() as Record<string,unknown>))
    .filter(row=>row.depot.status==='active');
  return matches.length===1?matches[0]:null;
}
export async function getWarehouseLocationByCode(
  ws:string,input:{depotId:string;kind:WarehouseLocationKind;parentLocationId:string|null;code:string}
):Promise<WarehouseLocationListItem|null> {
  const value=normalizeWarehouseLogicalCode(input.code);
  if(!value||!isValidWarehouseDepotId(input.depotId))return null;
  const result=await getDocs(query(collection(warehouseDb,warehouseDomainPath(ws,'locations')),
    where('code','==',value),limit(20)));
  const matches=result.docs.map(row=>wrapLocation(ws,row.id,row.data() as Record<string,unknown>))
    .filter(row=>row.location.status==='active'&&row.location.depotId===input.depotId
      &&row.location.kind===input.kind&&row.location.parentLocationId===input.parentLocationId);
  return matches.length===1?matches[0]:null;
}
export async function listWarehouseLocationBalances(
  ws:string,maxResults=500,materialId?:string
):Promise<WarehouseLocationBalanceListItem[]> {
  const base=collection(warehouseDb,warehouseDomainPath(ws,'locationBalances'));
  const count=Math.max(1,Math.min(maxResults,500));
  const result=await getDocs(materialId
    ?query(base,where('materialId','==',materialId),limit(count)):query(base,limit(count)));
  return result.docs.map(row=>{
    const d=row.data() as Record<string,unknown>;
    const parsed=validateWarehouseLocationBalance(warehouseCanonicalLocationBalanceReadInput(row.id,d),
      {expectedWorkspaceId:ws});
    if(!parsed.ok)throw new Error('WAREHOUSE_MOBILE_LOCATION_BALANCE_INVALID');
    return {balance:parsed.data,updatedAt:time(d.updatedAt)};
  });
}
