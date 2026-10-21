import { createHash } from 'node:crypto';

import type { VerifiedWarehouseRequest } from './warehouseAccess';
import {
  warehouseAdminListByField,
  warehouseAdminTransaction,
  WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

import {
  createWarehouseMovementId, validateWarehouseMovement,
  validateWarehouseBalance, warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance, type WarehouseMovement,
} from '../warehouse/movement';
import {
  createWarehouseLocationBalanceId, validateWarehouseStockPosition,
  validateWarehouseLocationBalance, applyWarehouseLocationDelta,
  normalizeWarehouseLocationQuantity, warehouseStockPositionsEqual,
  validateWarehouseDepot, validateWarehouseLocation,
  type WarehouseStockPosition, type WarehouseLocationBalance,
} from '../warehouse/location';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseLot, WAREHOUSE_LOT_SCHEMA_VERSION, type WarehouseLot } from '../warehouse/lot';
import { isWarehousePhysicalStockPosition, planWarehouseTransferLots } from '../warehouse/transfer';
import type { TransferWarehouseStockResult } from '../warehouse/locationRepository';
import {
  warehouseCanonicalMaterialReadInput,
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,
  warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';

type Read = ReadonlyMap<string, WarehouseAdminDocument | null>;
type PhysicalPosition = Exclude<WarehouseStockPosition, {kind:'UNASSIGNED'}>;
const root = (workspaceId:string, domain:string, id:string) => `warehouse/${workspaceId}/${domain}/${id}`;
const fail = (code:string, status=409): never => { throw new WarehouseStoreError(code,status); };
function valid<T>(item:{ok:boolean;data?:T},code:string):T {
  if (!item.ok || !item.data) return fail(code);
  return item.data;
}
function readDocument(read: Read, path:string): WarehouseAdminDocument | null {
  return read.get(path) || null;
}
function requireDoc(read:Read,path:string,code:string):WarehouseAdminDocument {
  return readDocument(read,path) || fail(code);
}
function checkPosition(
  access:VerifiedWarehouseRequest, position:PhysicalPosition, read:Read
) {
  const depotDoc = requireDoc(read,root(access.workspaceId,'depots',position.depotId),'WAREHOUSE_TRANSFER_DEPOT_NOT_FOUND');
  const locationDoc = requireDoc(read,root(access.workspaceId,'locations',position.locationId),'WAREHOUSE_TRANSFER_LOCATION_NOT_FOUND');
  const depot=valid(validateWarehouseDepot(
    warehouseCanonicalDepotReadInput(position.depotId,depotDoc.data),
    {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
  ),'WAREHOUSE_TRANSFER_DEPOT_INVALID');
  const location=valid(validateWarehouseLocation(
    warehouseCanonicalLocationReadInput(position.locationId,locationDoc.data),
    {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
  ),'WAREHOUSE_TRANSFER_LOCATION_INVALID');
  if (depot.status!=='active' || location.status!=='active'
    || location.kind!=='LOCAL' || location.depotId!==depot.id) {
    fail('WAREHOUSE_TRANSFER_INACTIVE_POSITION');
  }
  if (position.kind==='SUBPOSITION') {
    const subDoc=requireDoc(read,root(access.workspaceId,'locations',position.subpositionId),'WAREHOUSE_TRANSFER_SUBPOSITION_NOT_FOUND');
    const sub=valid(validateWarehouseLocation(
      warehouseCanonicalLocationReadInput(position.subpositionId,subDoc.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
    ),'WAREHOUSE_TRANSFER_SUBPOSITION_INVALID');
    if (sub.status!=='active' || sub.kind!=='SUBPOSITION'
      || sub.depotId!==depot.id || sub.parentLocationId!==location.id) {
      fail('WAREHOUSE_TRANSFER_INACTIVE_SUBPOSITION');
    }
  }
}
function unwrapMovement(row:WarehouseAdminDocument):WarehouseMovement {
  const d=row.data;
  return valid(validateWarehouseMovement({
    schemaVersion:d.schemaVersion, id:d.id,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId,
    note:d.note,source:d.source,
  }), 'WAREHOUSE_TRANSFER_MOVEMENT_INVALID');
}
function unwrapBalance(row:WarehouseAdminDocument):WarehouseBalance {
  const d=row.data;
  return valid(validateWarehouseBalance({
    schemaVersion:d.schemaVersion,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,quantity:d.quantity,revision:d.revision,
    lastMovementId:d.lastMovementId,
  }), 'WAREHOUSE_TRANSFER_BALANCE_INVALID');
}
function located(row:WarehouseAdminDocument|null,id:string,access:VerifiedWarehouseRequest) {
  if (!row) return null;
  return valid(validateWarehouseLocationBalance(
    warehouseCanonicalLocationBalanceReadInput(id,row.data),
    {expectedWorkspaceId:access.workspaceId}
  ),'WAREHOUSE_TRANSFER_LOCATION_BALANCE_INVALID');
}
function lot(row:WarehouseAdminDocument,materialId:string,access:VerifiedWarehouseRequest) {
  const id=row.path.split('/').at(-1) || '';
  return valid(validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:materialId,
  }), 'WAREHOUSE_TRANSFER_LOT_INVALID');
}

export async function transferWarehouseStockServer(
  access: VerifiedWarehouseRequest,
  raw:unknown
):Promise<TransferWarehouseStockResult> {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) fail('WAREHOUSE_TRANSFER_INVALID_REQUEST',400);
  const input=raw as Record<string,unknown>;
  const materialId=typeof input.materialId==='string'?input.materialId:'';
  const operationKey=typeof input.idempotencyKey==='string'?input.idempotencyKey:'';
  if (!/^mat_[a-f0-9]{32}$/.test(materialId)
    || !/^[A-Za-z0-9_:.-]{8,200}$/.test(operationKey)) {
    fail('WAREHOUSE_TRANSFER_INVALID_ID',400);
  }
  const fromCandidate=validateWarehouseStockPosition(input.from);
  const toCandidate=validateWarehouseStockPosition(input.to);
  if (!fromCandidate || !toCandidate || !isWarehousePhysicalStockPosition(fromCandidate)
    || !isWarehousePhysicalStockPosition(toCandidate)
    || warehouseStockPositionsEqual(fromCandidate,toCandidate)) {
    return fail('WAREHOUSE_TRANSFER_INVALID_POSITION',400);
  }
  const from:PhysicalPosition=fromCandidate as PhysicalPosition;
  const to:PhysicalPosition=toCandidate as PhysicalPosition;
  const candidateQuantity=normalizeWarehouseLocationQuantity(input.quantity);
  if (candidateQuantity===null || candidateQuantity<=0) {
    return fail('WAREHOUSE_TRANSFER_INVALID_QUANTITY',400);
  }
  const quantity:number=candidateQuantity;
  const note=typeof input.note==='string' ? input.note.trim() : null;
  if (note && note.length>240) fail('WAREHOUSE_TRANSFER_NOTE_TOO_LONG',400);
  // Never accept arbitrary lots or prepared balances from the browser.
  if (input.relocateLotIds || input.lotAllocations) {
    fail('WAREHOUSE_TRANSFER_CLIENT_LOT_PLAN_FORBIDDEN',400);
  }
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ? 'emulator' : await getGoogleAccessToken();
  const sourceLots=await warehouseAdminListByField(
    token, access.workspaceId, 'lots', 'materialId', materialId, 40
  );
  const movementId=await createWarehouseMovementId(access.workspaceId,operationKey);
  const fromId=await createWarehouseLocationBalanceId(access.workspaceId,materialId,from);
  const toId=await createWarehouseLocationBalanceId(access.workspaceId,materialId,to);
  const p={
    material:root(access.workspaceId,'materials',materialId),
    movement:root(access.workspaceId,'movements',movementId),
    balance:root(access.workspaceId,'balances',materialId),
    from:root(access.workspaceId,'locationBalances',fromId),
    to:root(access.workspaceId,'locationBalances',toId),
  };
  const checks=[from,to].flatMap(position=>[
    root(access.workspaceId,'depots',position.depotId),
    root(access.workspaceId,'locations',position.locationId),
    ...(position.kind==='SUBPOSITION'?[root(access.workspaceId,'locations',position.subpositionId)]:[]),
  ]);
  const splitIds=sourceLots.map(row=>{
    const id=row.path.split('/').at(-1)||'';
    return 'lot_'+createHash('sha256').update(movementId+'\n'+id+'\nLOT_SPLIT').digest('hex').slice(0,32);
  });
  const splitPaths=splitIds.map(id=>root(access.workspaceId,'lots',id));
  const reads=[...new Set([...Object.values(p),...checks,...sourceLots.map(row=>row.path),...splitPaths])];

  return warehouseAdminTransaction<TransferWarehouseStockResult>(token,reads,(rows)=>{
    checkPosition(access,from,rows);
    checkPosition(access,to,rows);
    const mr=requireDoc(rows,p.material,'WAREHOUSE_MATERIAL_NOT_FOUND');
    const material=valid(validateWarehouseMaterial(
      warehouseCanonicalMaterialReadInput(materialId,mr.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
    ),'WAREHOUSE_TRANSFER_INVALID_MATERIAL');
    if (material.status!=='active') fail('WAREHOUSE_MATERIAL_INACTIVE');
    const balance=unwrapBalance(requireDoc(rows,p.balance,'WAREHOUSE_BALANCE_NOT_FOUND'));
    if (balance.materialId!==materialId || balance.ug!==access.ug) fail('WAREHOUSE_TRANSFER_BALANCE_SCOPE_INVALID');
    const source=located(readDocument(rows,p.from),fromId,access)
      || fail('WAREHOUSE_TRANSFER_SOURCE_BALANCE_MISMATCH');
    const destination=located(readDocument(rows,p.to),toId,access);
    if (!warehouseStockPositionsEqual(source.position,from)
      || (destination && !warehouseStockPositionsEqual(destination.position,to))) {
      return fail('WAREHOUSE_TRANSFER_SOURCE_BALANCE_MISMATCH');
    }
    const src={kind:'LOCATION_TRANSFER' as const,actorUid:access.uid,quantity,
      from,to,fromBalanceId:fromId,toBalanceId:toId};
    const candidate=valid(validateWarehouseMovement({
      schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
      id:movementId,workspaceId:access.workspaceId,ug:access.ug,materialId,
      type:'TRANSFER',quantityDelta:0,idempotencyKeyHash:movementId.slice(4),
      reversesMovementId:null,note,source:src,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:materialId}),
    'WAREHOUSE_TRANSFER_MOVEMENT_INVALID');
    const old=readDocument(rows,p.movement);
    if (old) {
      const replay=unwrapMovement(old);
      if (!warehouseMovementMatchesReplay(replay,candidate)) fail('WAREHOUSE_IDEMPOTENCY_CONFLICT');
      const replayDestination=destination
        || fail('WAREHOUSE_TRANSFER_PROJECTION_INCONSISTENT');
      return {result:{applied:false,movement:replay,balance,
        fromBalance:source,toBalance:replayDestination},writes:[]};
    }
    const lots:WarehouseLot[]=sourceLots.map(item=>lot(requireDoc(rows,item.path,'WAREHOUSE_TRANSFER_LOT_NOT_FOUND'),materialId,access));
    const plan=planWarehouseTransferLots({materialId,source:from,quantity,availableQuantity:source.quantity,lots});
    if (plan.ok===false) {
      // Stable public errors (also checked by Mobile-D and QA fixtures).
      if(plan.error==='INSUFFICIENT_STOCK') return fail('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');
      if(plan.error==='LOT_ATTRIBUTION_EXCEEDS_STOCK') return fail('WAREHOUSE_TRANSFER_LOT_ATTRIBUTION_EXCEEDS_STOCK');
      if(plan.error==='TOO_MANY_ACTIVE_LOTS') return fail('WAREHOUSE_TRANSFER_TOO_MANY_ACTIVE_LOTS');
      return fail('WAREHOUSE_TRANSFER_INVALID_LOT_PLAN');
    }
    const nextFrom=applyWarehouseLocationDelta(source,{
      id:fromId,workspaceId:access.workspaceId,ug:access.ug,materialId,position:from,
      quantityDelta:-quantity,movementId,
    });
    const nextTo=applyWarehouseLocationDelta(destination,{
      id:toId,workspaceId:access.workspaceId,ug:access.ug,materialId,position:to,
      quantityDelta:quantity,movementId,
    });
    const now=new Date();
    const writes:Array<{path:string;data:Record<string,unknown>}>= [
      {path:p.movement,data:{...candidate,createdAt:now}},
      {path:p.from,data:{...nextFrom,updatedAt:now}},
      {path:p.to,data:{...nextTo,updatedAt:now}},
    ];
    for(const allocation of plan.lotAllocations) {
      const index=sourceLots.findIndex(row=>row.path.endsWith('/'+allocation.lotId));
      if(index<0)fail('WAREHOUSE_TRANSFER_LOT_NOT_FOUND');
      const current=lots[index];
      if(current.status!=='active'|| !warehouseStockPositionsEqual(current.position,from)
        || allocation.quantity>current.quantity+0.000001) {
        fail('WAREHOUSE_TRANSFER_LOT_POSITION_MISMATCH');
      }
      const original=sourceLots[index];
      const originalTime=original.data.createdAt;
      const createdAt=typeof originalTime==='string' && !Number.isNaN(Date.parse(originalTime))
        ?new Date(originalTime):now;
      const whole=Math.abs(allocation.quantity-current.quantity)<=0.000001;
      if(whole) {
        writes.push({path:original.path,data:{...current,position:to,
          updatedBy:access.uid,createdAt,updatedAt:now}});
      } else {
        const rest=normalizeWarehouseLocationQuantity(current.quantity-allocation.quantity);
        if(rest===null||rest<=0)fail('WAREHOUSE_TRANSFER_SPLIT_INVALID');
        const destId=splitIds[index];
        const destPath=splitPaths[index];
        if(readDocument(rows,destPath))fail('WAREHOUSE_TRANSFER_SPLIT_LOT_CONFLICT');
        const split=valid(validateWarehouseLot({
          schemaVersion:WAREHOUSE_LOT_SCHEMA_VERSION,
          id:destId,workspaceId:access.workspaceId,ug:access.ug,
          materialId,code:current.code,expiresOn:current.expiresOn,
          quantity:allocation.quantity,position:to,origin:current.origin,
          status:'active',createdBy:access.uid,updatedBy:access.uid,
        },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
          expectedMaterialId:materialId}), 'WAREHOUSE_TRANSFER_SPLIT_LOT_INVALID');
        writes.push(
          {path:original.path,data:{...current,quantity:rest,
            updatedBy:access.uid,createdAt,updatedAt:now}},
          {path:destPath,data:{...split,createdAt:now,updatedAt:now}},
        );
      }
    }
    return {result:{applied:true,movement:candidate,balance,fromBalance:nextFrom,toBalance:nextTo},writes};
  });
}
