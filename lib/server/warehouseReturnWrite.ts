import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, WarehouseStoreError, type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  applyWarehouseLocationDelta, createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance, warehouseStockPositionsEqual,
} from '../warehouse/location';
import {
  applyWarehouseMovementToBalance, createWarehouseMovementId,
  normalizeWarehouseQuantity, validateWarehouseMovement, validateWarehouseBalance,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION, type WarehouseMovement,
} from '../warehouse/movement';
import { validateWarehouseLot, type WarehouseLot } from '../warehouse/lot';
import {
  warehouseCanonicalLocationBalanceReadInput, warehouseCanonicalLotReadInput,
} from '../warehouse/readCompatibility';
import type {
  ReturnWarehouseStockOutboundInput, ReturnWarehouseStockOutboundResult,
} from '../warehouse/withdrawalRepository';
import type { WarehouseConsumptionRecord } from '../warehouse/withdrawal';

const p=(ws:string,type:string,id:string)=>`warehouse/${ws}/${type}/${id}`;
const fail=(message:string,status=409):never=>{throw new WarehouseStoreError(message,status);};
function parseMovement(row:WarehouseAdminDocument,access:VerifiedWarehouseRequest) {
  const d=row.data;
  const id=row.path.split('/').at(-1)||'';
  const result=validateWarehouseMovement({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId??null,
    note:d.note??null,source:d.source??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!result.ok)return fail('WAREHOUSE_RETURN_MOVEMENT_INVALID');
  return result.data;
}
function preflightConsumption(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument) {
  const d=row.data;
  if(d.workspaceId!==access.workspaceId||d.ug!==access.ug
    ||d.schemaVersion!=='warehouse_consumption_record_v1'
    ||d.origin!=='STOCK_OUTBOUND'
    ||typeof d.materialId!=='string'||!/^mat_[a-f0-9]{32}$/.test(d.materialId)
    ||typeof d.movementId!=='string'||!/^mov_[a-f0-9]{64}$/.test(d.movementId)
    ||typeof d.quantity!=='number'||d.quantity<=0){
    return fail('WAREHOUSE_OUTBOUND_RETURN_CONSUMPTION_INVALID');
  }
  return d;
}

export async function returnWarehouseStockOutboundServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<ReturnWarehouseStockOutboundResult>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_REQUEST',400);
  const input=raw as Partial<ReturnWarehouseStockOutboundInput>;
  const consumptionId=typeof input.consumptionId==='string'?input.consumptionId.trim().toLowerCase():'';
  const quantity=normalizeWarehouseQuantity(input.quantity);
  const reason=typeof input.reason==='string'?input.reason.trim().replace(/\s+/g,' '):'';
  const operationId=typeof input.operationId==='string'?input.operationId.trim():'';
  if(!/^cons_[a-f0-9]{64}$/.test(consumptionId))return fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_CONSUMPTION',400);
  if(quantity===null||quantity<=0)return fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_QUANTITY',400);
  if(!reason||reason.length>180)return fail('WAREHOUSE_OUTBOUND_RETURN_REASON_REQUIRED',400);
  if(operationId.length<8||operationId.length>96||!/^[a-zA-Z0-9:_-]+$/.test(operationId)) {
    return fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_OPERATION',400);
  }
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const consumptionPath=p(access.workspaceId,'consumptions',consumptionId);
  const summaryPath=p(access.workspaceId,'outboundReturns',consumptionId);
  const first=await warehouseAdminTransaction(token,[consumptionPath],rows=>({
    result:rows.get(consumptionPath),writes:[],
  }));
  if(!first)return fail('WAREHOUSE_OUTBOUND_RETURN_CONSUMPTION_NOT_FOUND',404);
  const initial=preflightConsumption(access,first);
  const originalPath=p(access.workspaceId,'movements',initial.movementId as string);
  const initialMovement=await warehouseAdminTransaction(token,[originalPath],rows=>({
    result:rows.get(originalPath),writes:[],
  }));
  if(!initialMovement)return fail('WAREHOUSE_OUTBOUND_RETURN_ORIGINAL_MOVEMENT_NOT_FOUND',404);
  const movement=parseMovement(initialMovement,access);
  const source=movement.source;
  if(movement.type!=='OUTBOUND'||source?.kind!=='EXPRESS_OUTBOUND'
    ||movement.materialId!==initial.materialId||source.position.kind==='UNASSIGNED'){
    return fail('WAREHOUSE_OUTBOUND_RETURN_ORIGINAL_INVALID');
  }
  const materialId=initial.materialId as string;
  const movementId=await createWarehouseMovementId(
    access.workspaceId,'outbound-return:'+consumptionId+':'+operationId
  );
  const locationBalanceId=await createWarehouseLocationBalanceId(
    access.workspaceId,materialId,source.position
  );
  const newMovementPath=p(access.workspaceId,'movements',movementId);
  const balancePath=p(access.workspaceId,'balances',materialId);
  const locationPath=p(access.workspaceId,'locationBalances',locationBalanceId);
  const originalLotPath=source.lotId?p(access.workspaceId,'lots',source.lotId):null;
  const rowsToRead=[consumptionPath,originalPath,newMovementPath,summaryPath,
    balancePath,locationPath,...(originalLotPath?[originalLotPath]:[])];

  return warehouseAdminTransaction<ReturnWarehouseStockOutboundResult>(
    token,rowsToRead,rows=>{
      const freshConsumption=rows.get(consumptionPath);
      const freshOriginal=rows.get(originalPath);
      if(!freshConsumption||!freshOriginal)return fail('WAREHOUSE_OUTBOUND_RETURN_RECONCILIATION_REQUIRED');
      const c=preflightConsumption(access,freshConsumption);
      if(c.movementId!==initial.movementId||c.materialId!==materialId)return fail('WAREHOUSE_OUTBOUND_RETURN_CHANGED');
      const original=parseMovement(freshOriginal,access);
      if(original.id!==movement.id||original.type!=='OUTBOUND'
        ||JSON.stringify(original.source)!==JSON.stringify(movement.source)){
        return fail('WAREHOUSE_OUTBOUND_RETURN_ORIGINAL_CHANGED');
      }
      const former=rows.get(summaryPath);
      const summary=former?.data;
      if(summary && (summary.workspaceId!==access.workspaceId||summary.ug!==access.ug
        ||summary.consumptionId!==consumptionId||summary.materialId!==materialId)) {
        return fail('WAREHOUSE_OUTBOUND_RETURN_SUMMARY_SCOPE');
      }
      if(summary?.pendingOperationId && summary.pendingOperationId!==operationId) {
        return fail('WAREHOUSE_OUTBOUND_RETURN_LEGACY_PENDING_RECONCILIATION');
      }
      const balanceData=rows.get(balancePath)?.data;
      const locationData=rows.get(locationPath)?.data;
      if(!balanceData||!locationData)return fail('WAREHOUSE_OUTBOUND_RETURN_BALANCE_MISSING');
      const bal=validateWarehouseBalance({
        schemaVersion:balanceData.schemaVersion,workspaceId:balanceData.workspaceId,
        ug:balanceData.ug,materialId:balanceData.materialId,quantity:balanceData.quantity,
        revision:balanceData.revision,lastMovementId:balanceData.lastMovementId,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId});
      const located=validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(locationBalanceId,locationData),
        {expectedWorkspaceId:access.workspaceId}
      );
      if(!bal.ok||!located.ok
        ||!warehouseStockPositionsEqual(located.data.position,source.position)){
        return fail('WAREHOUSE_OUTBOUND_RETURN_BALANCE_INVALID');
      }
      const originalLot=originalLotPath?rows.get(originalLotPath):null;
      let lot:WarehouseLot|null=null;
      if(originalLot){
        const checked=validateWarehouseLot(warehouseCanonicalLotReadInput(
          source.lotId!,originalLot.data),{
            expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
            expectedMaterialId:materialId,
          });
        if(!checked.ok||checked.data.status!=='active'
          ||!warehouseStockPositionsEqual(checked.data.position,source.position)){
          return fail('WAREHOUSE_OUTBOUND_RETURN_LOT_RECONCILIATION_REQUIRED');
        }
        lot=checked.data;
      } else if(originalLotPath){
        return fail('WAREHOUSE_OUTBOUND_RETURN_LOT_NOT_FOUND');
      }
      const exists=rows.get(newMovementPath);
      if(exists){
        const replay=parseMovement(exists,access);
        if(replay.type!=='OUTBOUND_RETURN'||replay.materialId!==materialId
          ||replay.source?.kind!=='OUTBOUND_RETURN'||replay.source.consumptionId!==consumptionId
          ||replay.source.quantity!==quantity||replay.source.reason!==reason
          ||summary?.lastReturnMovementId!==movementId) {
          return fail('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        return {result:{
          movement:replay,
          consumption:{...c,legacy:false} as unknown as WarehouseConsumptionRecord,
          balance:bal.data,locationBalance:located.data,lot,warnings:[],
        },writes:[]};
      }
      const previousReturn=typeof c.returnedQuantity==='number'?c.returnedQuantity:0;
      const summarized=typeof summary?.returnedQuantity==='number'?summary.returnedQuantity:0;
      const previouslyReturned=Math.max(previousReturn,summarized);
      const consumptionTotal=typeof c.quantity==='number'?c.quantity:fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_TOTAL');
      const afterReturn=normalizeWarehouseQuantity(previouslyReturned+quantity);
      if(afterReturn===null||afterReturn>consumptionTotal+0.000001) {
        return fail('WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING');
      }
      const candidate=validateWarehouseMovement({
        schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id:movementId,
        workspaceId:access.workspaceId,ug:access.ug,materialId,
        type:'OUTBOUND_RETURN',quantityDelta:quantity,idempotencyKeyHash:movementId.slice(4),
        reversesMovementId:null,note:reason,
        source:{kind:'OUTBOUND_RETURN',actorUid:access.uid,consumptionId,
          originalMovementId:movement.id,quantity,position:source.position,
          locationBalanceId,lotId:lot?.id||null,reason},
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId});
      if(!candidate.ok)return fail('WAREHOUSE_OUTBOUND_RETURN_INVALID_MOVEMENT');
      const nextBalance=applyWarehouseMovementToBalance(candidate.data,bal.data);
      const nextPosition=applyWarehouseLocationDelta(located.data,{
        id:locationBalanceId,workspaceId:access.workspaceId,ug:access.ug,
        materialId,position:source.position,quantityDelta:quantity,movementId,
      });
      const now=new Date();
      const nowIso=now.toISOString();
      const nextConsumption={...c,returnedQuantity:afterReturn,
        lastReturnMovementId:movementId,lastReturnAt:nowIso,
        lastReturnBy:access.uid,lastReturnReason:reason,updatedAt:nowIso};
      const nextSummary={
        ...(summary||{}),schemaVersion:'warehouse_outbound_return_v1',
        id:consumptionId,workspaceId:access.workspaceId,ug:access.ug,consumptionId,
        materialId,originalQuantity:consumptionTotal,returnedQuantity:afterReturn,
        pendingOperationId:null,pendingQuantity:null,pendingReason:null,pendingBy:null,
        lastReturnOperationId:operationId,lastReturnMovementId:movementId,
        lastReturnAt:nowIso,lastReturnBy:access.uid,lastReturnReason:reason,
        createdAt:summary?.createdAt??nowIso,updatedAt:nowIso,
      };
      const writes:Array<{path:string;data:Record<string,unknown>}>= [
        {path:newMovementPath,data:{...candidate.data,createdAt:now}},
        {path:balancePath,data:{...nextBalance,updatedAt:now}},
        {path:locationPath,data:{...nextPosition,updatedAt:now}},
        {path:consumptionPath,data:nextConsumption},
        {path:summaryPath,data:nextSummary},
      ];
      let nextLot=lot;
      if(lot&&originalLotPath&&originalLot){
        const newQty=normalizeWarehouseQuantity(lot.quantity+quantity);
        if(newQty===null)return fail('WAREHOUSE_OUTBOUND_RETURN_LOT_OVERFLOW');
        nextLot={...lot,quantity:newQty,updatedBy:access.uid};
        writes.push({path:originalLotPath,data:{
          ...originalLot.data,...nextLot,updatedAt:now,
        }});
      }
      return {result:{
        movement:candidate.data,consumption:{...nextConsumption,legacy:false} as unknown as WarehouseConsumptionRecord,
        balance:nextBalance,locationBalance:nextPosition,lot:nextLot,warnings:[],
      },writes};
    }
  );
}
