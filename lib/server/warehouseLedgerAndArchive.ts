import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction,warehouseAdminListCollection,WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  validateWarehouseLocationBalance,validateWarehouseDepot,validateWarehouseLocation,
} from '../warehouse/location';
import { validateWarehouseLot } from '../warehouse/lot';
import {
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';

const fail=(s:string,code=409):never=>{throw new WarehouseStoreError(s,code)};
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
const obj=(v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return fail('WAREHOUSE_COMMAND_INVALID',400);
  return v as Record<string,unknown>;
};
function sameScope(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument,kind:string) {
  if(row.data.workspaceId!==access.workspaceId||row.data.ug!==access.ug)return fail('WAREHOUSE_ARCHIVE_SCOPE_MISMATCH',403);
  if(kind==='location'){
    const id=row.path.split('/').at(-1)||'';
    const r=validateWarehouseLocation(warehouseCanonicalLocationReadInput(id,row.data),{
      expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
    });
    if(!r.ok)return fail('WAREHOUSE_ARCHIVE_LOCATION_INVALID');
    return r.data;
  }
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseDepot(warehouseCanonicalDepotReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_ARCHIVE_DEPOT_INVALID');
  return r.data;
}
export async function warehouseStructureArchiveServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true}>{
  const data=obj(raw),isDepot=data.kind==='DEPOT';
  if((!isDepot&&data.kind!=='LOCAL'&&data.kind!=='SUBPOSITION')
    ||typeof data.id!=='string'
    ||!(isDepot?/^dep_[a-f0-9]{32}$/.test(data.id)
      :/^(loc_|sub_)[a-f0-9]{32}$/.test(data.id))){
    return fail('WAREHOUSE_ARCHIVE_INVALID_TARGET',400);
  }
  const archiveId=data.id as string;
  const ws=access.workspaceId,authToken=await token();
  const [depots,locations,balances,lots]=await Promise.all([
    warehouseAdminListCollection(authToken,ws,'depots',500),
    warehouseAdminListCollection(authToken,ws,'locations',500),
    warehouseAdminListCollection(authToken,ws,'locationBalances',500),
    warehouseAdminListCollection(authToken,ws,'lots',500),
  ]);
  const targetLocation=locations.find(x=>x.path===path(ws,'locations',archiveId));
  if(!isDepot&&(!targetLocation||targetLocation.data.kind!==data.kind)){
    return fail('WAREHOUSE_ARCHIVE_LOCATION_NOT_FOUND',404);
  }
  const depotId=isDepot?data.id:targetLocation!.data.depotId;
  if(typeof depotId!=='string')return fail('WAREHOUSE_ARCHIVE_DEPOT_INVALID');
  const dp=path(ws,'depots',depotId);
  if(!depots.some(x=>x.path===dp))return fail('WAREHOUSE_ARCHIVE_DEPOT_NOT_FOUND',404);
  const inDepot=locations.filter(x=>x.data.depotId===depotId);
  const positions=(r:Record<string,unknown>)=>{
    const pos=r.position;
    return pos&&typeof pos==='object'&&!Array.isArray(pos)?pos as Record<string,unknown>:null;
  };
  const affects=(pos:Record<string,unknown>|null):boolean=>{
    if(!pos||pos.kind==='UNASSIGNED'||pos.depotId!==depotId)return false;
    if(isDepot)return true;
    return data.kind==='LOCAL'?pos.locationId===data.id
      :pos.kind==='SUBPOSITION'&&pos.subpositionId===data.id;
  };
  const relevantBalances=balances.filter(x=>affects(positions(x.data)));
  const relevantLots=lots.filter(x=>affects(positions(x.data)));
  const toArchive=inDepot.filter(x=>x.data.status==='active'&&(isDepot
    ||x.data.id===data.id
    ||(data.kind==='LOCAL'&&x.data.kind==='SUBPOSITION'&&x.data.parentLocationId===data.id)));
  const reads=[dp,...inDepot.map(x=>x.path),...relevantBalances.map(x=>x.path),...relevantLots.map(x=>x.path)];
  if(reads.length>450||toArchive.length+(isDepot?1:0)>430){
    return fail('WAREHOUSE_ARCHIVE_TOO_LARGE');
  }
  return warehouseAdminTransaction(authToken,[...new Set(reads)],rows=>{
    const depot=rows.get(dp);
    if(!depot)return fail('WAREHOUSE_ARCHIVE_DEPOT_NOT_FOUND');
    sameScope(access,depot,'depot');
    if(!isDepot){
      const loc=rows.get(path(ws,'locations',archiveId));
      if(!loc||loc.data.status!=='active')return fail('WAREHOUSE_ARCHIVE_LOCATION_NOT_ACTIVE');
      sameScope(access,loc,'location');
    }
    for(const p of relevantBalances.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      const id=p.split('/').at(-1)||'';
      const r=validateWarehouseLocationBalance(warehouseCanonicalLocationBalanceReadInput(id,row.data),{
        expectedWorkspaceId:ws,
      });
      if(!r.ok||r.data.ug!==access.ug)return fail('WAREHOUSE_ARCHIVE_INVALID_BALANCE');
      if(r.data.quantity>0&&affects(r.data.position as unknown as Record<string,unknown>)){
        return fail('WAREHOUSE_ARCHIVE_OCCUPIED');
      }
    }
    for(const p of relevantLots.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      const id=p.split('/').at(-1)||'';
      const r=validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!r.ok)return fail('WAREHOUSE_ARCHIVE_INVALID_LOT');
      if(r.data.status==='active'&&r.data.quantity>0
        &&affects(r.data.position as unknown as Record<string,unknown>)){
        return fail('WAREHOUSE_ARCHIVE_ACTIVE_LOT');
      }
    }
    const now=new Date(),writes:Array<{path:string;data:Record<string,unknown>}>=[];
    for(const p of toArchive.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      if(row.data.status==='active'){
        sameScope(access,row,'location');
        writes.push({path:p,data:{...row.data,status:'inactive',updatedBy:access.uid,updatedAt:now}});
      }
    }
    if(isDepot&&depot.data.status==='active'){
      writes.push({path:dp,data:{...depot.data,status:'inactive',updatedBy:access.uid,updatedAt:now}});
    }
    return {result:{ok:true as const},writes};
  });
}
