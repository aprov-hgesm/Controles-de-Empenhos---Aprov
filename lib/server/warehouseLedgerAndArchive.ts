import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction,warehouseAdminListCollection,WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { validateWarehouseMaterial } from '../warehouse/material';
import {
  createWarehouseMovementId,validateWarehouseMovement,validateWarehouseBalance,
  warehouseMovementMatchesReplay,applyWarehouseMovementToBalance,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,type WarehouseBalance,
  type WarehouseMovement,
} from '../warehouse/movement';
import {
  createWarehouseLocationBalanceId,validateWarehouseLocationBalance,
  applyWarehouseLocationDelta,validateWarehouseDepot,validateWarehouseLocation,
  type WarehouseStockPosition,
} from '../warehouse/location';
import { validateWarehouseLot } from '../warehouse/lot';
import {
  warehouseCanonicalMaterialReadInput,warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';
import type { ApplyWarehouseMovementInput,ApplyWarehouseMovementResult } from '../warehouse/ledgerRepository';

const fail=(s:string,code=409):never=>{throw new WarehouseStoreError(s,code)};
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
const obj=(v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return fail('WAREHOUSE_COMMAND_INVALID',400);
  return v as Record<string,unknown>;
};
function movement(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseMovement {
  const d=row.data;
  const r=validateWarehouseMovement({
    schemaVersion:d.schemaVersion,id:row.path.split('/').at(-1),workspaceId:d.workspaceId,
    ug:d.ug,materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId??null,
    note:d.note??null,source:d.source??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_MOVEMENT_INVALID');
  return r.data;
}
function balance(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument,materialId:string){
  const d=row.data;
  const r=validateWarehouseBalance({
    schemaVersion:d.schemaVersion,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,quantity:d.quantity,revision:d.revision,lastMovementId:d.lastMovementId,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:materialId});
  if(!r.ok)return fail('WAREHOUSE_BALANCE_INVALID');
  return r.data;
}
export async function warehouseLedgerMovementServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<ApplyWarehouseMovementResult>{
  const v=obj(raw);
  if(typeof v.materialId!=='string'||!/^mat_[a-f0-9]{32}$/.test(v.materialId)
    ||typeof v.idempotencyKey!=='string'||v.idempotencyKey.length<1
    ||v.idempotencyKey.length>240||v.type==='TRANSFER')return fail('WAREHOUSE_LEDGER_INVALID_INPUT',400);
  if(v.reversesMovementId!==undefined&&v.reversesMovementId!==null
    &&(typeof v.reversesMovementId!=='string'||!/^mov_[a-f0-9]{64}$/.test(v.reversesMovementId))){
    return fail('WAREHOUSE_LEDGER_INVALID_REVERSAL',400);
  }
  const input=v as unknown as ApplyWarehouseMovementInput;
  const ws=access.workspaceId,id=await createWarehouseMovementId(ws,input.idempotencyKey);
  const unassigned:WarehouseStockPosition={kind:'UNASSIGNED'};
  const locId=await createWarehouseLocationBalanceId(ws,input.materialId,unassigned);
  const paths={
    material:path(ws,'materials',input.materialId),movement:path(ws,'movements',id),
    balance:path(ws,'balances',input.materialId),location:path(ws,'locationBalances',locId),
    ...(input.reversesMovementId?{reversal:path(ws,'movements',input.reversesMovementId)}:{}),
  };
  const authToken=await token();
  return warehouseAdminTransaction<ApplyWarehouseMovementResult>(
    authToken,Object.values(paths),rows=>{
      const matRow=rows.get(paths.material);if(!matRow)return fail('WAREHOUSE_MATERIAL_NOT_FOUND',404);
      const mat=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(input.materialId,matRow.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!mat.ok)return fail('WAREHOUSE_MATERIAL_INVALID');
      const check=validateWarehouseMovement({
        schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id,workspaceId:ws,
        ug:access.ug,materialId:input.materialId,type:input.type,
        quantityDelta:input.quantityDelta,idempotencyKeyHash:id.slice(4),
        reversesMovementId:input.reversesMovementId??null,note:input.note??null,
        source:input.source??null,
      },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:input.materialId});
      if(!check.ok)return fail('WAREHOUSE_MOVEMENT_INVALID',400);
      const candidate=check.data;
      const balRow=rows.get(paths.balance);
      const oldBalance=balRow?balance(access,balRow,input.materialId):null;
      const oldMovement=rows.get(paths.movement);
      if(oldMovement){
        const replay=movement(access,oldMovement);
        if(!warehouseMovementMatchesReplay(replay,candidate))return fail('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        if(!oldBalance)return fail('WAREHOUSE_LEDGER_BALANCE_INCONSISTENT');
        return {result:{applied:false,movement:replay,balance:oldBalance},writes:[]};
      }
      if(mat.data.status!=='active')return fail('WAREHOUSE_MATERIAL_INACTIVE');
      if(candidate.type==='REVERSAL'){
        const reversed=paths.reversal?rows.get(paths.reversal):null;
        if(!reversed)return fail('WAREHOUSE_REVERSAL_TARGET_NOT_FOUND',404);
        const prior=movement(access,reversed);
        if(prior.materialId!==candidate.materialId
          ||candidate.quantityDelta!==-prior.quantityDelta){
          return fail('WAREHOUSE_INVALID_REVERSAL');
        }
      }
      if(candidate.type==='OUTBOUND'&&(!oldBalance||oldBalance.quantity+candidate.quantityDelta< -0.000001)){
        return fail('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
      }
      const nextBalance=applyWarehouseMovementToBalance(candidate,oldBalance);
      const locRow=rows.get(paths.location);
      const oldLocation=locRow?validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(locId,locRow.data),{
          expectedWorkspaceId:ws,
        }):null;
      if(oldLocation&&!oldLocation.ok)return fail('WAREHOUSE_LOCATION_BALANCE_INVALID');
      if(oldLocation?.ok&&oldLocation.data.ug!==access.ug)return fail('WAREHOUSE_LOCATION_SCOPE_MISMATCH',403);
      const nextLocation=applyWarehouseLocationDelta(oldLocation?.ok?oldLocation.data:null,{
        id:locId,workspaceId:ws,ug:access.ug,materialId:input.materialId,
        position:unassigned,quantityDelta:candidate.quantityDelta,movementId:id,
        initialQuantity:oldLocation?.ok?0:(oldBalance?.quantity||0),
      });
      if(nextBalance.quantity<0||nextLocation.quantity<0)return fail('WAREHOUSE_NEGATIVE_STOCK');
      const now=new Date();
      return {result:{applied:true,movement:candidate,balance:nextBalance},writes:[
        {path:paths.movement,data:{...candidate,createdAt:now}},
        {path:paths.balance,data:{...nextBalance,updatedAt:now}},
        {path:paths.location,data:{...nextLocation,updatedAt:now}},
      ]};
    }
  );
}
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
  const ws=access.workspaceId,authToken=await token();
  const [depots,locations,balances,lots]=await Promise.all([
    warehouseAdminListCollection(authToken,ws,'depots',500),
    warehouseAdminListCollection(authToken,ws,'locations',500),
    warehouseAdminListCollection(authToken,ws,'locationBalances',500),
    warehouseAdminListCollection(authToken,ws,'lots',500),
  ]);
  const targetLocation=locations.find(x=>x.path===path(ws,'locations',data.id));
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
      const loc=rows.get(path(ws,'locations',data.id));
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
