import { randomUUID } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction,warehouseAdminListCollection,
  WarehouseStoreError,
} from './warehouseFirestoreTransaction';
import { validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import { validateWarehouseBalance,type WarehouseBalance } from '../warehouse/movement';
import { validateWarehouseLocationBalance,type WarehouseLocationBalance } from '../warehouse/location';
import {
  warehouseCanonicalLocationBalanceReadInput,warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';
import {
  validateWarehouseInventoryScope,warehouseInventoryScopeIncludesPosition,
  createWarehouseInventoryItemId,validateWarehouseInventoryItem,
  validateWarehouseInventorySession,
  WAREHOUSE_INVENTORY_SCHEMA_VERSION,WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION,
  type WarehouseInventorySession,type WarehouseInventoryItem,
} from '../warehouse/inventory';
import type { StartWarehouseInventoryInput,WarehouseInventorySessionRecord } from '../warehouse/inventoryRepository';

const fail=(c:string,status=409):never=>{throw new WarehouseStoreError(c,status);};
const p=(ws:string,domain:string,id:string)=>`warehouse/${ws}/${domain}/${id}`;

export async function startWarehouseInventoryServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<WarehouseInventorySessionRecord>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_INVENTORY_SCOPE_INVALID',400);
  const input=raw as Partial<StartWarehouseInventoryInput>;
  const requested=validateWarehouseInventoryScope(input.scope);
  if(!requested)return fail('WAREHOUSE_INVENTORY_SCOPE_INVALID',400);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  // Each listing is bounded. Never open an inventory from a truncated list.
  const [materialsRows,globalRows,locationRows,depotsRows,locationsRows]=await Promise.all([
    warehouseAdminListCollection(token,access.workspaceId,'materials',499),
    warehouseAdminListCollection(token,access.workspaceId,'balances',499),
    warehouseAdminListCollection(token,access.workspaceId,'locationBalances',499),
    warehouseAdminListCollection(token,access.workspaceId,'depots',249),
    warehouseAdminListCollection(token,access.workspaceId,'locations',499),
  ]);
  const materials=new Map<string,WarehouseMaterial>();
  // Keep canonical parsed values for projection verification.
  for(const row of materialsRows){
    const id=row.path.split('/').at(-1)||'';
    const r=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(id,row.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!r.ok)return fail('WAREHOUSE_INVENTORY_MATERIAL_INVALID');
    materials.set(id,r.data);
  }
  const globals=new Map<string,WarehouseBalance>();
  for(const row of globalRows){
    const id=row.path.split('/').at(-1)||'';
    const d=row.data;
    const r=validateWarehouseBalance({
      schemaVersion:d.schemaVersion,workspaceId:d.workspaceId,ug:d.ug,materialId:d.materialId,
      quantity:d.quantity,revision:d.revision,lastMovementId:d.lastMovementId,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:id});
    if(!r.ok)return fail('WAREHOUSE_INVENTORY_BALANCE_INVALID');
    globals.set(id,r.data);
  }
  const locations=new Map<string,WarehouseLocationBalance>();
  for(const row of locationRows){
    const id=row.path.split('/').at(-1)||'';
    const r=validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(id,row.data),
      {expectedWorkspaceId:access.workspaceId});
    if(!r.ok||r.data.ug!==access.ug)return fail('WAREHOUSE_INVENTORY_LOCATION_BALANCE_INVALID');
    locations.set(id,r.data);
  }
  // A estrutura de escopo deve existir e estar ativa.
  const depotMap=new Map(depotsRows.map(row=>[row.path.split('/').at(-1)||'',row.data]));
  const locationMap=new Map(locationsRows.map(row=>[row.path.split('/').at(-1)||'',row.data]));
  if(requested.kind!=='TOTAL'){
    const depot=depotMap.get(requested.depotId);
    if(!depot||depot.workspaceId!==access.workspaceId||depot.ug!==access.ug||depot.status!=='active') {
      return fail('WAREHOUSE_INVENTORY_DEPOT_INVALID');
    }
  }
  if(requested.kind==='LOCATION'||requested.kind==='SUBPOSITION'){
    const loc=locationMap.get(requested.locationId);
    if(!loc||loc.kind!=='LOCAL'||loc.depotId!==requested.depotId
      ||loc.workspaceId!==access.workspaceId||loc.ug!==access.ug||loc.status!=='active'){
      return fail('WAREHOUSE_INVENTORY_LOCATION_INVALID');
    }
  }
  if(requested.kind==='SUBPOSITION'){
    const sub=locationMap.get(requested.subpositionId);
    if(!sub||sub.kind!=='SUBPOSITION'||sub.depotId!==requested.depotId
      ||sub.parentLocationId!==requested.locationId
      ||sub.workspaceId!==access.workspaceId||sub.ug!==access.ug||sub.status!=='active'){
      return fail('WAREHOUSE_INVENTORY_SUBPOSITION_INVALID');
    }
  }
  const selected=[...locations.values()].filter(row=>
    row.quantity>0&&row.position.kind!=='UNASSIGNED'
    &&warehouseInventoryScopeIncludesPosition(requested,row.position)
    &&materials.get(row.materialId)?.status==='active'
  );
  if(!selected.length)return fail('WAREHOUSE_INVENTORY_SCOPE_EMPTY');
  if(selected.length>120)return fail('WAREHOUSE_INVENTORY_SCOPE_TOO_LARGE');
  // Physical totals must reconcile to the official global balance.
  for(const materialId of new Set(selected.map(row=>row.materialId))){
    const global=globals.get(materialId);
    if(!global)return fail('WAREHOUSE_INVENTORY_BALANCE_NOT_FOUND');
    const sum=[...locations.values()].filter(x=>x.materialId===materialId)
      .reduce((total,row)=>total+row.quantity,0);
    if(Math.abs(sum-global.quantity)>0.000001)return fail('WAREHOUSE_INVENTORY_PROJECTION_INCONSISTENT');
  }
  const inventoryId='inv_'+randomUUID().replace(/-/g,'').toLowerCase();
  const sessionPath=p(access.workspaceId,'inventories',inventoryId);
  const built:Array<{path:string;item:WarehouseInventoryItem;balance:WarehouseLocationBalance}>=[];
  for(const balance of selected){
    const global=globals.get(balance.materialId);
    if(!global)return fail('WAREHOUSE_INVENTORY_BALANCE_NOT_FOUND');
    const id=await createWarehouseInventoryItemId(inventoryId,balance.materialId,balance.position);
    const item:WarehouseInventoryItem={
      schemaVersion:WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION,id,inventoryId,
      workspaceId:access.workspaceId,ug:access.ug,
      materialId:balance.materialId,position:balance.position,
      locationBalanceId:balance.id,expectedQuantity:balance.quantity,
      expectedBalanceRevision:global.revision,
      expectedBalanceLastMovementId:global.lastMovementId,
      expectedLocationRevision:balance.revision,
      expectedLocationLastMovementId:balance.lastMovementId,
      countedQuantity:null,difference:null,status:'PENDING',
      countedBy:null,adjustmentMovementId:null,adjustedBy:null,
    };
    const r=validateWarehouseInventoryItem(item,{
      expectedWorkspaceId:access.workspaceId,expectedInventoryId:inventoryId,
    });
    if(!r.ok)return fail('WAREHOUSE_INVENTORY_ITEM_INVALID');
    built.push({path:sessionPath+'/items/'+id,item:r.data,balance});
  }
  const materialPaths=[...new Set(selected.map(x=>p(access.workspaceId,'materials',x.materialId)))];
  const balancePaths=[...new Set(selected.map(x=>p(access.workspaceId,'balances',x.materialId)))];
  const locationPaths=selected.map(x=>p(access.workspaceId,'locationBalances',x.id));
  const paths=[...new Set([
    sessionPath,...built.map(x=>x.path),...materialPaths,...balancePaths,...locationPaths,
  ])];
  if(paths.length>512)return fail('WAREHOUSE_INVENTORY_TRANSACTION_TOO_LARGE');
  const session:WarehouseInventorySession={
    schemaVersion:WAREHOUSE_INVENTORY_SCHEMA_VERSION,id:inventoryId,
    workspaceId:access.workspaceId,ug:access.ug,scope:requested,
    status:'COUNTING',itemCount:built.length,openedBy:access.uid,
    reviewedBy:null,confirmationStartedBy:null,confirmedBy:null,cancelledBy:null,
    reviewSummary:null,staleItemId:null,
  };
  if(!validateWarehouseInventorySession(session,{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug
  }).ok) return fail('WAREHOUSE_INVENTORY_SESSION_INVALID');

  return warehouseAdminTransaction<WarehouseInventorySessionRecord>(token,paths,rows=>{
    if(rows.get(sessionPath))return fail('WAREHOUSE_INVENTORY_ID_COLLISION');
    for(const entry of built){
      if(rows.get(entry.path))return fail('WAREHOUSE_INVENTORY_ITEM_COLLISION');
      const fresh=rows.get(p(access.workspaceId,'locationBalances',entry.item.locationBalanceId));
      const freshGlobal=rows.get(p(access.workspaceId,'balances',entry.item.materialId));
      const freshMaterial=rows.get(p(access.workspaceId,'materials',entry.item.materialId));
      if(!fresh||!freshGlobal||!freshMaterial)return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      if(fresh.data.revision!==entry.balance.revision
        ||fresh.data.lastMovementId!==entry.balance.lastMovementId
        ||fresh.data.quantity!==entry.balance.quantity
        ||freshGlobal.data.revision!==entry.item.expectedBalanceRevision
        ||freshGlobal.data.lastMovementId!==entry.item.expectedBalanceLastMovementId
        ||freshMaterial.data.status!=='active'){
        return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      }
    }
    const now=new Date();
    return {result:{
      session,referenceCapturedAt:now.toISOString(),
      createdAt:now.toISOString(),updatedAt:now.toISOString(),
      reviewedAt:null,confirmationStartedAt:null,confirmedAt:null,cancelledAt:null,
    },writes:[
      {path:sessionPath,data:{...session,
        referenceCapturedAt:now,createdAt:now,updatedAt:now,
        reviewedAt:null,confirmationStartedAt:null,confirmedAt:null,cancelledAt:null}},
      ...built.map(x=>({path:x.path,data:{...x.item,countedAt:null,adjustedAt:null}})),
    ]};
  });
}
