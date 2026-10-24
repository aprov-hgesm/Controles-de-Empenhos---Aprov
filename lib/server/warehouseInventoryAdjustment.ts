import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { verifyItem,verifySession } from './warehouseInventoryLifecycle';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, warehouseAdminListByField,
  WarehouseStoreError,type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  createWarehouseMovementId,validateWarehouseMovement,validateWarehouseBalance,
  applyWarehouseMovementToBalance,WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  normalizeWarehouseQuantity,type WarehouseBalance,
  type WarehousePhysicalInventoryMovementSource,type WarehouseMovement,
} from '../warehouse/movement';
import {
  applyWarehouseLocationDelta,validateWarehouseLocationBalance,
  warehouseStockPositionsEqual,type WarehouseLocationBalance,
} from '../warehouse/location';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseLot,type WarehouseLot } from '../warehouse/lot';
import {
  warehouseCanonicalLocationBalanceReadInput,warehouseCanonicalLotReadInput,
  warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';
import type {ApplyWarehouseInventoryAdjustmentResult} from '../warehouse/inventoryRepository';

const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const path=(ws:string,kind:string,id:string)=>`warehouse/${ws}/${kind}/${id}`;
function parseMovement(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseMovement {
  const d=row.data;
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseMovement({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId??null,
    note:d.note??null,source:d.source??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_INVENTORY_MOVEMENT_INVALID');
  return r.data;
}

export async function adjustWarehouseInventoryServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<ApplyWarehouseInventoryAdjustmentResult> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_INVENTORY_INPUT_INVALID',400);
  const cmd=raw as Record<string,unknown>;
  const inventoryId=cmd.inventoryId,itemId=cmd.itemId;
  if(typeof inventoryId!=='string'||!/^inv_[a-f0-9]{32}$/.test(inventoryId)
    ||typeof itemId!=='string'||!/^invit_[a-f0-9]{64}$/.test(itemId)) {
    return fail('WAREHOUSE_INVENTORY_INVALID_ID',400);
  }
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const sessionPath=path(access.workspaceId,'inventories',inventoryId);
  const itemPath=sessionPath+'/items/'+itemId;
  const preliminary=await warehouseAdminTransaction(token,[sessionPath,itemPath],rows=>({
    result:{session:rows.get(sessionPath),item:rows.get(itemPath)},writes:[],
  }));
  if(!preliminary.session||!preliminary.item)return fail('WAREHOUSE_INVENTORY_NOT_FOUND',404);
  const oldItem=verifyItem(access,inventoryId,preliminary.item);
  if(oldItem.position.kind==='UNASSIGNED')return fail('WAREHOUSE_INVENTORY_PHYSICAL_POSITION_REQUIRED');
  const materialId=oldItem.materialId;
  const movementId=await createWarehouseMovementId(
    access.workspaceId,'phase10:inventory:'+inventoryId+':'+itemId
  );
  const materialPath=path(access.workspaceId,'materials',materialId);
  const balancePath=path(access.workspaceId,'balances',materialId);
  const locationPath=path(access.workspaceId,'locationBalances',oldItem.locationBalanceId);
  const movementPath=path(access.workspaceId,'movements',movementId);
  const queriedLots=await warehouseAdminListByField(
    token,access.workspaceId,'lots','materialId',materialId,90
  );
  const lockPath=path(access.workspaceId,'lotAttributionLocks',materialId);
  const reads=[...new Set([
    sessionPath,itemPath,materialPath,balancePath,locationPath,movementPath,
    lockPath,...queriedLots.map(row=>row.path),
  ])];
  return warehouseAdminTransaction<ApplyWarehouseInventoryAdjustmentResult>(
    token,reads,rows=>{
      const session=rows.get(sessionPath),itemDoc=rows.get(itemPath);
      if(!session||!itemDoc)return fail('WAREHOUSE_INVENTORY_NOT_FOUND',404);
      const knownSession=verifySession(access,session);
      const item=verifyItem(access,inventoryId,itemDoc);
      if(item.materialId!==materialId||item.locationBalanceId!==oldItem.locationBalanceId
        ||JSON.stringify(item.position)!==JSON.stringify(oldItem.position)) {
        return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      }
      // Um movimento gravado pode ser consultado novamente mesmo após
      // a confirmação final; novas movimentações só em CONFIRMING.
      if(knownSession.status!=='CONFIRMING'&&knownSession.status!=='CONFIRMED') {
        return fail('WAREHOUSE_INVENTORY_NOT_CONFIRMING');
      }
      if(item.status==='MATCHED')return fail('WAREHOUSE_INVENTORY_ZERO_DIFFERENCE');
      if(item.status==='STALE')return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      if(item.countedQuantity===null||item.difference===null||item.difference===0) {
        return fail('WAREHOUSE_INVENTORY_INVALID_DIVERGENCE');
      }
      const material=rows.get(materialPath);
      const global=rows.get(balancePath);
      const location=rows.get(locationPath);
      if(!material||!global||!location)return fail('WAREHOUSE_INVENTORY_REFERENCE_MISSING');
      const mr=validateWarehouseMaterial(
        warehouseCanonicalMaterialReadInput(materialId,material.data),
        {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
      if(!mr.ok||mr.data.status!=='active')return fail('WAREHOUSE_INVENTORY_MATERIAL_INVALID');
      const b=global.data;
      const br=validateWarehouseBalance({
        schemaVersion:b.schemaVersion,workspaceId:b.workspaceId,ug:b.ug,
        materialId:b.materialId,quantity:b.quantity,
        revision:b.revision,lastMovementId:b.lastMovementId,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId});
      const lr=validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(item.locationBalanceId,location.data),
        {expectedWorkspaceId:access.workspaceId,expectedMaterialId:materialId});
      if(!br.ok||!lr.ok||lr.data.ug!==access.ug)return fail('WAREHOUSE_INVENTORY_BALANCE_INVALID');
      const balance:WarehouseBalance=br.data;
      const position:WarehouseLocationBalance=lr.data;
      // Invariantes de posição devem valer inclusive para replay.
      if(!warehouseStockPositionsEqual(position.position,item.position)) {
        return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      }
      const source:WarehousePhysicalInventoryMovementSource={
        kind:'PHYSICAL_INVENTORY',actorUid:access.uid,inventoryId,
        inventoryItemId:itemId,expectedQuantity:item.expectedQuantity,
        countedQuantity:item.countedQuantity,position:item.position,
        locationBalanceId:item.locationBalanceId,
        expectedLocationRevision:item.expectedLocationRevision,
        expectedLocationLastMovementId:item.expectedLocationLastMovementId,
      };
      const candidate=validateWarehouseMovement({
        schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id:movementId,
        workspaceId:access.workspaceId,ug:access.ug,materialId,
        type:'INVENTORY_ADJUSTMENT',quantityDelta:item.difference,
        idempotencyKeyHash:movementId.slice(4),reversesMovementId:null,
        note:'Ajuste confirmado no inventário físico '+inventoryId,source,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId});
      if(!candidate.ok)return fail('WAREHOUSE_INVENTORY_MOVEMENT_INVALID');
      const old=rows.get(movementPath);
      if(old){
        const saved=parseMovement(access,old);
        if(saved.type!=='INVENTORY_ADJUSTMENT'
          ||saved.materialId!==materialId
          ||JSON.stringify(saved.source)!==JSON.stringify(candidate.data.source)
          ||item.status!=='ADJUSTED'||item.adjustmentMovementId!==movementId){
          return fail('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        return {result:{
          applied:false,movement:saved,balance,locationBalance:position,
        },writes:[]};
      }
      // Replay idempotente já foi verificado acima contra o movimento persistido.
      // Exigir a revisão do snapshot somente ANTES da primeira aplicação:
      // após um ajuste válido ela naturalmente avança e não pode bloquear o replay.
      if(knownSession.status!=='CONFIRMING')return fail('WAREHOUSE_INVENTORY_NOT_CONFIRMING');
      if(position.revision!==item.expectedLocationRevision
        ||position.lastMovementId!==item.expectedLocationLastMovementId) {
        return fail('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE');
      }
      if(item.status!=='DIVERGENT')return fail('WAREHOUSE_INVENTORY_ITEM_NOT_DIVERGENT');
      const nextBalance=applyWarehouseMovementToBalance(candidate.data,balance);
      const nextPosition=applyWarehouseLocationDelta(position,{
        id:item.locationBalanceId,workspaceId:access.workspaceId,ug:access.ug,
        materialId,position:item.position,quantityDelta:item.difference,movementId,
      });
      if(nextBalance.quantity<0||nextPosition.quantity<0)return fail('WAREHOUSE_INVENTORY_NEGATIVE_STOCK');

      // Se a contagem física reduziu o saldo, as referências de validade
      // devem acompanhar o novo saldo. Conciliar em ordem de ID estável,
      // sem priorizar vencimento, no mesmo commit atômico.
      const active: Array<{row:WarehouseAdminDocument;lot:WarehouseLot}>=[];
      for(const result of queriedLots){
        const row=rows.get(result.path);
        if(!row)return fail('WAREHOUSE_INVENTORY_LOT_QUERY_RACE');
        const id=row.path.split('/').at(-1)||'';
        const check=validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
          expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
          expectedMaterialId:materialId});
        if(!check.ok)return fail('WAREHOUSE_INVENTORY_LOT_INVALID');
        if(check.data.status==='active'&&warehouseStockPositionsEqual(check.data.position,item.position)) {
          active.push({row,lot:check.data});
        }
      }
      const assigned=active.reduce((sum,x)=>sum+x.lot.quantity,0);
      if(assigned>position.quantity+0.000001) {
        return fail('WAREHOUSE_INVENTORY_EXISTING_LOT_MISMATCH');
      }
      let requiredReduction=normalizeWarehouseQuantity(Math.max(0,assigned-nextPosition.quantity));
      if(requiredReduction===null)return fail('WAREHOUSE_INVENTORY_LOT_REDUCTION_INVALID');
      const now=new Date();
      const writes:Array<{path:string;data:Record<string,unknown>}>= [
        {path:movementPath,data:{...candidate.data,createdAt:now}},
        {path:balancePath,data:{...nextBalance,updatedAt:now}},
        {path:locationPath,data:{...nextPosition,updatedAt:now}},
        {path:itemPath,data:{...itemDoc.data,status:'ADJUSTED',
          adjustmentMovementId:movementId,adjustedBy:access.uid,adjustedAt:now}},
      ];
      if(requiredReduction>0){
        active.sort((a,b)=>a.lot.id.localeCompare(b.lot.id));
        for(const entry of active){
          if(requiredReduction<=0)break;
          const deduction=Math.min(entry.lot.quantity,requiredReduction);
          const left=normalizeWarehouseQuantity(entry.lot.quantity-deduction);
          const remaining=normalizeWarehouseQuantity(requiredReduction-deduction);
          if(left===null||remaining===null)return fail('WAREHOUSE_INVENTORY_LOT_QUANTITY_INVALID');
          writes.push({path:entry.row.path,data:{
            ...entry.row.data,quantity:left,updatedBy:access.uid,updatedAt:now,
          }});
          requiredReduction=remaining;
        }
        if(requiredReduction>0)return fail('WAREHOUSE_INVENTORY_LOT_PROJECTION_INVALID');
        const lock=rows.get(lockPath);
        if(lock &&(lock.data.workspaceId!==access.workspaceId||lock.data.ug!==access.ug)) {
          return fail('WAREHOUSE_INVENTORY_LOT_LOCK_SCOPE');
        }
        writes.push({path:lockPath,data:{
          workspaceId:access.workspaceId,ug:access.ug,materialId,
          revision:(typeof lock?.data.revision==='number'?lock.data.revision:0)+1,
          updatedBy:access.uid,updatedAt:now,
        }});
      }
      return {result:{applied:true,movement:candidate.data,balance:nextBalance,
        locationBalance:nextPosition},writes};
    }
  );
}
