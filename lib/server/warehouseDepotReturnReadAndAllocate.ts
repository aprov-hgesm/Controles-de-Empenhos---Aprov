import {createHash,randomUUID} from 'node:crypto';
import type {VerifiedWarehouseRequest} from './warehouseAccess';
import {getGoogleAccessToken} from './sectorProvisioningAdmin';
import {
  warehouseAdminListCollection,warehouseAdminTransaction,WarehouseStoreError,
} from './warehouseFirestoreTransaction';
import {
  createWarehouseLocationBalanceId,applyWarehouseLocationDelta,
  validateWarehouseLocationBalance,validateWarehouseStockPosition,
  warehouseStockPositionsEqual,validateWarehouseDepot,validateWarehouseLocation,
  type WarehouseStockPosition,
} from '../warehouse/location';
import {
  createWarehouseMovementId,validateWarehouseMovement,WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
} from '../warehouse/movement';
import {validateWarehouseMaterial} from '../warehouse/material';
import {validateWarehouseLot,WAREHOUSE_LOT_SCHEMA_VERSION} from '../warehouse/lot';
import {
  warehouseCanonicalLocationBalanceReadInput,warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationReadInput,warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';

const root=(ws:string,collection:string,id:string)=>'warehouse/'+ws+'/'+collection+'/'+id;
const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
type PhysicalPosition=Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>;
interface ReturnLot {id:string;quantity:number;code:string;expiresOn:string|null;origin:unknown}
export interface WarehouseDepotReturnPending {
  id:string;materialId:string;depotId:string;depotCode:string;depotName:string;
  quantity:number;pendingQuantity:number;sourcePosition:PhysicalPosition;
  lotReferences:ReturnLot[];status:'PENDING'|'ARCHIVED';
}
export async function listWarehouseDepotReturnsServer(
  access:VerifiedWarehouseRequest,raw:unknown={}
):Promise<WarehouseDepotReturnPending[]>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return fail('WAREHOUSE_DEPOT_RETURNS_LIST_INVALID',400);
  const input=raw as Record<string,unknown>;
  if(input.includeArchived!==undefined&&typeof input.includeArchived!=='boolean')
    return fail('WAREHOUSE_DEPOT_RETURNS_LIST_INVALID',400);
  const includeArchived=input.includeArchived===true;
  const rows=await warehouseAdminListCollection(await token(),access.workspaceId,'depotReturns',500);
  if(rows.length===500)return fail('WAREHOUSE_DEPOT_RETURNS_CATALOG_LIMIT');
  return rows.filter(row=>row.data.status==='PENDING'
    ||(includeArchived&&row.data.status==='ARCHIVED')).map(row=>{
    const d=row.data;
    if(d.workspaceId!==access.workspaceId||d.ug!==access.ug
      ||d.schemaVersion!=='warehouse_depot_return_v1')
      return fail('WAREHOUSE_DEPOT_RETURNS_INVALID_SCOPE');
    const position=validateWarehouseStockPosition(d.sourcePosition);
    if(!position||position.kind==='UNASSIGNED'||!Array.isArray(d.lotReferences)
      ||typeof d.quantity!=='number'||d.quantity<=0)
      return fail('WAREHOUSE_DEPOT_RETURNS_INVALID');
    return {
      id:row.path.split('/').at(-1)||'',
      materialId:String(d.materialId),depotId:String(d.depotId),
      depotCode:String(d.depotCode),depotName:String(d.depotName),
      quantity:d.quantity,pendingQuantity:Number(d.pendingQuantity),
      sourcePosition:position as PhysicalPosition,
      lotReferences:d.lotReferences as ReturnLot[],
      status:d.status as 'PENDING'|'ARCHIVED',
    };
  });
}

/**
 * Ação administrativa sobre a VISIBILIDADE da fila, não sobre estoque.
 * Preserva o UNASSIGNED, movimentos, lote original, retorno e auditoria.
 * ARCHIVE somente oculta da fila ativa; RESTORE permite realocar depois.
 * O grupo inteiro é confirmado numa única transação com preconditions.
 */
export async function bulkWarehouseDepotReturnQueueServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true;changed:number;unchanged:number;action:'ARCHIVE'|'RESTORE'}>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return fail('WAREHOUSE_DEPOT_RETURNS_BULK_INVALID',400);
  const input=raw as Record<string,unknown>;
  const action=input.action;
  const ids=input.returnIds;
  if((action!=='ARCHIVE'&&action!=='RESTORE')||!Array.isArray(ids)
    ||ids.length===0||ids.length>400
    ||ids.some(id=>typeof id!=='string'||!/^dr_[a-f0-9]{32}$/.test(id))
    ||new Set(ids).size!==ids.length)
    return fail('WAREHOUSE_DEPOT_RETURNS_BULK_INVALID',400);
  const ws=access.workspaceId;
  const paths=ids.map(id=>root(ws,'depotReturns',id as string));
  const now=new Date();
  const target=action==='ARCHIVE'?'ARCHIVED':'PENDING';
  const expected=action==='ARCHIVE'?'PENDING':'ARCHIVED';
  return warehouseAdminTransaction<{
    ok:true;changed:number;unchanged:number;action:'ARCHIVE'|'RESTORE'
  }>(await token(),paths,rows=>{
    const writes:Array<{path:string;data:Record<string,unknown>}>=[];
    let unchanged=0;
    for(const path of paths){
      const row=rows.get(path);
      if(!row)return fail('WAREHOUSE_DEPOT_RETURN_NOT_FOUND',404);
      const d=row.data;
      if(d.workspaceId!==ws||d.ug!==access.ug
        ||d.schemaVersion!=='warehouse_depot_return_v1')
        return fail('WAREHOUSE_DEPOT_RETURN_SCOPE_MISMATCH',403);
      if(typeof d.pendingQuantity!=='number'||d.pendingQuantity<=0
        ||typeof d.quantity!=='number'||d.quantity<d.pendingQuantity)
        return fail('WAREHOUSE_DEPOT_RETURNS_BULK_QUANTITY_MISMATCH');
      if(d.status===target){unchanged++;continue;}
      if(d.status!==expected)return fail('WAREHOUSE_DEPOT_RETURNS_BULK_STATE_CONFLICT');
      writes.push({path,data:{
        ...d,status:target,
        archivedAt:action==='ARCHIVE'?now:null,
        archivedBy:action==='ARCHIVE'?access.uid:null,
        updatedAt:now,updatedBy:access.uid,
      }});
    }
    return {result:{ok:true,changed:writes.length,unchanged,
      action:action as 'ARCHIVE'|'RESTORE'},writes};
  });
}

/**
 * Corrige a validade documental de uma referência devolvida ao recebimento.
 * O documento de retorno é a fonte para futura realocação. Não reativa lotes
 * arquivados e mantém auditoria imutável da correção.
 */
export async function updateWarehouseDepotReturnExpiryServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true;returnId:string;lotId:string;expiresOn:string|null}>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return fail('WAREHOUSE_DEPOT_RETURN_EXPIRY_INPUT_INVALID',400);
  const input=raw as Record<string,unknown>;
  const returnId=input.returnId,lotId=input.lotId,expiresOn=input.expiresOn,
    reason=input.reason;
  if(typeof returnId!=='string'||!/^dr_[a-f0-9]{32}$/.test(returnId)
    ||typeof lotId!=='string'||!/^lot_[a-f0-9]{32}$/.test(lotId)
    ||typeof expiresOn!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expiresOn)
    ||new Date(expiresOn+'T00:00:00Z').toISOString().slice(0,10)!==expiresOn
    ||typeof reason!=='string'||reason.trim().length<5||reason.length>180)
    return fail('WAREHOUSE_DEPOT_RETURN_EXPIRY_INPUT_INVALID',400);
  const ws=access.workspaceId,authToken=await token();
  const returnPath=root(ws,'depotReturns',returnId);
  const auditId='expreturn_'+randomUUID().replace(/-/g,'');
  const auditPath=root(ws,'depotReturnExpiryAudits',auditId);
  return warehouseAdminTransaction<{ok:true;returnId:string;lotId:string;expiresOn:string|null}>(
    authToken,[returnPath,auditPath],rows=>{
      const row=rows.get(returnPath);
      if(!row)return fail('WAREHOUSE_DEPOT_RETURN_NOT_FOUND',404);
      const d=row.data;
      if(d.workspaceId!==ws||d.ug!==access.ug||d.schemaVersion!=='warehouse_depot_return_v1')
        return fail('WAREHOUSE_DEPOT_RETURN_SCOPE_MISMATCH',403);
      if(d.status!=='PENDING'&&d.status!=='ARCHIVED')
        return fail('WAREHOUSE_DEPOT_RETURN_EXPIRY_ALREADY_ALLOCATED');
      if(!Array.isArray(d.lotReferences))
        return fail('WAREHOUSE_DEPOT_RETURN_LOT_INVALID');
      const index=(d.lotReferences as Array<Record<string,unknown>>)
        .findIndex(item=>item.id===lotId);
      if(index<0)return fail('WAREHOUSE_DEPOT_RETURN_LOT_NOT_FOUND',404);
      const original=d.lotReferences as Array<Record<string,unknown>>;
      const previous=original[index].expiresOn??null;
      if(previous===expiresOn)
        return {result:{ok:true,returnId,lotId,expiresOn},writes:[]};
      if(rows.get(auditPath))return fail('WAREHOUSE_DEPOT_RETURN_EXPIRY_AUDIT_CONFLICT');
      const next=original.map((item,i)=>i===index?{...item,expiresOn}:item);
      const now=new Date();
      return {result:{ok:true,returnId,lotId,expiresOn},writes:[
        {path:returnPath,data:{...d,lotReferences:next,updatedBy:access.uid,updatedAt:now}},
        {path:auditPath,data:{
          schemaVersion:'warehouse_depot_return_expiry_audit_v1',id:auditId,
          workspaceId:ws,ug:access.ug,returnId,lotId,materialId:d.materialId,
          previousExpiresOn:previous,nextExpiresOn:expiresOn,
          reason:reason.trim(),changedBy:access.uid,changedAt:now,
        }},
      ]};
    }
  );
}

export async function allocateWarehouseDepotReturnServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true;applied:boolean;quantity:number;materialId:string}> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return fail('WAREHOUSE_DEPOT_RETURN_ALLOCATION_INVALID',400);
  const input=raw as Record<string,unknown>;
  const returnId=input.returnId;
  const to=validateWarehouseStockPosition(input.position);
  if(typeof returnId!=='string'||!/^dr_[a-f0-9]{32}$/.test(returnId)
    ||!to||to.kind==='UNASSIGNED')
    return fail('WAREHOUSE_DEPOT_RETURN_ALLOCATION_INVALID',400);
  const dest=to as PhysicalPosition;
  const ws=access.workspaceId,authToken=await token();
  const receiptPath=root(ws,'depotReturns',returnId);
  // O cabeçalho é lido no servidor, nunca confiamos em material/quantidade enviados pelo navegador.
  const header=await warehouseAdminTransaction(authToken,[receiptPath],rows=>{
    const row=rows.get(receiptPath);
    if(!row)return fail('WAREHOUSE_DEPOT_RETURN_NOT_FOUND',404);
    if(row.data.workspaceId!==ws||row.data.ug!==access.ug
      ||row.data.schemaVersion!=='warehouse_depot_return_v1')
      return fail('WAREHOUSE_DEPOT_RETURN_SCOPE_MISMATCH',403);
    return {result:row.data,writes:[]};
  });
  const materialId=String(header.materialId||'');
  const qty=header.quantity;
  if(!/^mat_[a-f0-9]{32}$/.test(materialId)
    ||typeof qty!=='number'||qty<=0
    ||!Array.isArray(header.lotReferences)||header.lotReferences.length>50)
    return fail('WAREHOUSE_DEPOT_RETURN_INVALID');
  const lotReferences=header.lotReferences as ReturnLot[];
  const from={kind:'UNASSIGNED' as const};
  const receiveId=await createWarehouseLocationBalanceId(ws,materialId,from);
  const destId=await createWarehouseLocationBalanceId(ws,materialId,dest);
  const movementId=await createWarehouseMovementId(ws,'depot-return-allocate:'+returnId);
  const lotIds=lotReferences.map(item=>'lot_'+createHash('sha256').update(
    ws+'\n'+returnId+'\n'+item.id).digest('hex').slice(0,32));
  const paths=[
    receiptPath,root(ws,'materials',materialId),root(ws,'balances',materialId),
    root(ws,'locationBalances',receiveId),root(ws,'locationBalances',destId),
    root(ws,'movements',movementId),
    root(ws,'depots',dest.depotId),root(ws,'locations',dest.locationId),
    ...(dest.kind==='SUBPOSITION'?[root(ws,'locations',dest.subpositionId)]:[]),
    ...lotIds.map(id=>root(ws,'lots',id)),
    ...(lotIds.length?[root(ws,'lotAttributionLocks',materialId)]:[]),
  ];
  return warehouseAdminTransaction<{ok:true;applied:boolean;quantity:number;materialId:string}>(authToken,[...new Set(paths)],rows=>{
    const entry=rows.get(receiptPath);
    if(!entry)return fail('WAREHOUSE_DEPOT_RETURN_NOT_FOUND',404);
    if(entry.data.workspaceId!==ws||entry.data.ug!==access.ug)
      return fail('WAREHOUSE_DEPOT_RETURN_SCOPE_MISMATCH',403);
    const state=entry.data.status;
    if(state==='ALLOCATED'){
      const prior=validateWarehouseStockPosition(entry.data.allocatedPosition);
      if(!prior||!warehouseStockPositionsEqual(prior,dest))
        return fail('WAREHOUSE_DEPOT_RETURN_ALREADY_ALLOCATED');
      return {result:{ok:true as const,applied:false,quantity:qty,materialId},writes:[]};
    }
    if(state!=='PENDING'||entry.data.pendingQuantity!==qty
      ||entry.data.materialId!==materialId
      ||!Array.isArray(entry.data.lotReferences)
      ||entry.data.lotReferences.length!==lotReferences.length
      ||entry.data.lotReferences.some((raw,index)=>{
        const item=raw as Record<string,unknown>;
        const expected=lotReferences[index];
        return !item||item.id!==expected.id||item.quantity!==expected.quantity
          ||item.code!==expected.code||item.expiresOn!==expected.expiresOn;
      }))
      return fail('WAREHOUSE_DEPOT_RETURN_CHANGED');
    const materialRow=rows.get(root(ws,'materials',materialId));
    if(!materialRow)return fail('WAREHOUSE_MATERIAL_NOT_FOUND');
    const material=validateWarehouseMaterial(
      warehouseCanonicalMaterialReadInput(materialId,materialRow.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug});
    if(!material.ok||material.data.status!=='active')
      return fail('WAREHOUSE_DEPOT_RETURN_MATERIAL_INACTIVE');
    const depotRow=rows.get(root(ws,'depots',dest.depotId));
    const locationRow=rows.get(root(ws,'locations',dest.locationId));
    if(!depotRow||!locationRow)return fail('WAREHOUSE_DEPOT_RETURN_TARGET_MISSING');
    const depot=validateWarehouseDepot(
      warehouseCanonicalDepotReadInput(dest.depotId,depotRow.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug});
    const location=validateWarehouseLocation(
      warehouseCanonicalLocationReadInput(dest.locationId,locationRow.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug});
    if(!depot.ok||!location.ok||depot.data.status!=='active'
      ||location.data.status!=='active'||location.data.kind!=='LOCAL'
      ||location.data.depotId!==dest.depotId)
      return fail('WAREHOUSE_DEPOT_RETURN_TARGET_INACTIVE');
    if(dest.kind==='SUBPOSITION'){
      const subRow=rows.get(root(ws,'locations',dest.subpositionId));
      if(!subRow)return fail('WAREHOUSE_DEPOT_RETURN_TARGET_MISSING');
      const sub=validateWarehouseLocation(
        warehouseCanonicalLocationReadInput(dest.subpositionId,subRow.data),{
          expectedWorkspaceId:ws,expectedUg:access.ug});
      if(!sub.ok||sub.data.kind!=='SUBPOSITION'||sub.data.status!=='active'
        ||sub.data.depotId!==dest.depotId||sub.data.parentLocationId!==dest.locationId)
        return fail('WAREHOUSE_DEPOT_RETURN_TARGET_INACTIVE');
    }
    const fromPath=root(ws,'locationBalances',receiveId);
    const source=rows.get(fromPath);
    if(!source)return fail('WAREHOUSE_DEPOT_RETURN_RECEIVING_MISSING');
    const validatedSource=validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(receiveId,source.data),
      {expectedWorkspaceId:ws});
    if(!validatedSource.ok||validatedSource.data.ug!==access.ug
      ||validatedSource.data.materialId!==materialId
      ||!warehouseStockPositionsEqual(validatedSource.data.position,from)
      ||validatedSource.data.quantity+0.000001<qty)
      return fail('WAREHOUSE_DEPOT_RETURN_RECEIVING_INSUFFICIENT');
    const destPath=root(ws,'locationBalances',destId);
    const existing=rows.get(destPath);
    const validatedDest=existing?validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(destId,existing.data),
      {expectedWorkspaceId:ws}):null;
    if(validatedDest&&!validatedDest.ok)return fail('WAREHOUSE_DEPOT_RETURN_TARGET_BALANCE_INVALID');
    if(validatedDest?.ok&&(validatedDest.data.ug!==access.ug
      ||validatedDest.data.materialId!==materialId
      ||!warehouseStockPositionsEqual(validatedDest.data.position,dest)))
      return fail('WAREHOUSE_DEPOT_RETURN_TARGET_BALANCE_INVALID');
    const movementPath=root(ws,'movements',movementId);
    if(rows.get(movementPath))return fail('WAREHOUSE_DEPOT_RETURN_MOVEMENT_CONFLICT');
    const candidate=validateWarehouseMovement({
      schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id:movementId,
      workspaceId:ws,ug:access.ug,materialId,
      type:'TRANSFER',quantityDelta:0,idempotencyKeyHash:movementId.slice(4),
      reversesMovementId:null,note:'Realocação do recebimento após exclusão de depósito',
      source:{kind:'LOCATION_TRANSFER',actorUid:access.uid,quantity:qty,
        from,to:dest,fromBalanceId:receiveId,toBalanceId:destId},
    },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:materialId});
    if(!candidate.ok)return fail('WAREHOUSE_DEPOT_RETURN_MOVEMENT_INVALID');
    const nextFrom=applyWarehouseLocationDelta(validatedSource.data,{
      id:receiveId,workspaceId:ws,ug:access.ug,materialId,
      position:from,quantityDelta:-qty,movementId});
    const nextTo=applyWarehouseLocationDelta(validatedDest?.ok?validatedDest.data:null,{
      id:destId,workspaceId:ws,ug:access.ug,materialId,
      position:dest,quantityDelta:qty,movementId});
    const now=new Date();
    const writes:Array<{path:string;data:Record<string,unknown>}>=[
      {path:fromPath,data:{...nextFrom,updatedAt:now}},
      {path:destPath,data:{...nextTo,updatedAt:now}},
      {path:movementPath,data:{...candidate.data,createdAt:now}},
      {path:receiptPath,data:{...entry.data,
        pendingQuantity:0,status:'ALLOCATED',allocatedPosition:dest,
        allocationMovementId:movementId,updatedBy:access.uid,updatedAt:now}},
    ];
    let totalLots=0;
    for(let index=0;index<lotReferences.length;index++){
      const reference=lotReferences[index];
      if(!reference||typeof reference.quantity!=='number'||reference.quantity<=0
        ||typeof reference.code!=='string'
        ||typeof reference.id!=='string'||!/^lot_[a-f0-9]{32}$/.test(reference.id))
        return fail('WAREHOUSE_DEPOT_RETURN_LOT_INVALID');
      totalLots+=reference.quantity;
      const lotId=lotIds[index],lotPath=root(ws,'lots',lotId);
      if(rows.get(lotPath))return fail('WAREHOUSE_DEPOT_RETURN_LOT_IDEMPOTENCY_CONFLICT');
      const created=validateWarehouseLot({
        schemaVersion:WAREHOUSE_LOT_SCHEMA_VERSION,id:lotId,
        workspaceId:ws,ug:access.ug,materialId,
        code:reference.code,expiresOn:reference.expiresOn,
        quantity:reference.quantity,position:dest,origin:reference.origin,
        status:'active',createdBy:access.uid,updatedBy:access.uid,
      },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:materialId});
      if(!created.ok)return fail('WAREHOUSE_DEPOT_RETURN_LOT_INVALID');
      writes.push({path:lotPath,data:{...created.data,createdAt:now,updatedAt:now}});
    }
    if(totalLots>qty+0.000001)return fail('WAREHOUSE_DEPOT_RETURN_LOT_EXCEEDS_STOCK');
    if(lotIds.length){
      const lockPath=root(ws,'lotAttributionLocks',materialId);
      const lock=rows.get(lockPath);
      if(lock&&(lock.data.workspaceId!==ws||lock.data.ug!==access.ug
        ||lock.data.materialId!==materialId))
        return fail('WAREHOUSE_DEPOT_RETURN_LOT_LOCK_INVALID');
      const rev=typeof lock?.data.revision==='number'?
        lock.data.revision as number:0;
      if(!Number.isSafeInteger(rev)||rev<0||rev>=Number.MAX_SAFE_INTEGER)
        return fail('WAREHOUSE_DEPOT_RETURN_LOT_LOCK_INVALID');
      writes.push({path:lockPath,data:{workspaceId:ws,ug:access.ug,
        materialId,revision:rev+1,updatedBy:access.uid,updatedAt:now}});
    }
    return {result:{ok:true as const,applied:true,quantity:qty,materialId},writes};
  });
}
