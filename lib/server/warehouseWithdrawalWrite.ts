import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { applyWarehouseExpressOutboundServer } from './warehouseOutboundWrite';
import {
  WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
  WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
  WAREHOUSE_WITHDRAWAL_MAX_LINES,
  normalizeWarehouseWithdrawnBy,
  type WarehouseMaterialWithdrawal,
  type WarehouseWithdrawalLineInput,
} from '../warehouse/withdrawal';
import type {
  FinalizeWarehouseMaterialWithdrawalInput,
  FinalizeWarehouseMaterialWithdrawalResult,
} from '../warehouse/withdrawalRepository';
import { normalizeWarehouseQuantity } from '../warehouse/movement';

const path=(ws:string,type:string,id:string)=>`warehouse/${ws}/${type}/${id}`;
const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function isLine(line:unknown):line is WarehouseWithdrawalLineInput {
  if(!line||typeof line!=='object'||Array.isArray(line))return false;
  const v=line as Partial<WarehouseWithdrawalLineInput>;
  return typeof v.lineId==='string' && /^wline_[a-f0-9]{32}$/.test(v.lineId)
    && typeof v.materialId==='string' && /^mat_[a-f0-9]{32}$/.test(v.materialId)
    && typeof v.requestedQuantity==='number' && v.requestedQuantity>0
    && Number.isFinite(v.requestedQuantity)
    && typeof v.baseQuantity==='number' && v.baseQuantity>0
    && Number.isFinite(v.baseQuantity)
    && v.presentation!==null && typeof v.presentation==='object';
}
function payloadHash(lines:WarehouseWithdrawalLineInput[]) {
  return digest(JSON.stringify(lines.map(line=>({
    lineId:line.lineId,materialId:line.materialId,
    requestedQuantity:normalizeWarehouseQuantity(line.requestedQuantity),
    baseQuantity:normalizeWarehouseQuantity(line.baseQuantity),
    presentation:line.presentation,position:line.position,
    barcodeId:line.barcodeAssociation?.id||null,
    barcode:line.barcode||null,lotId:line.lotId,
  }))));
}
function parseHeader(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseMaterialWithdrawal {
  const d=row.data;
  if(d.schemaVersion!==WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION
    ||d.workspaceId!==access.workspaceId || d.ug!==access.ug
    ||typeof d.expectedLineCount!=='number' ||typeof d.appliedLineCount!=='number'
    ||typeof d.payloadHash!=='string')return fail('WAREHOUSE_WITHDRAWAL_HEADER_INVALID');
  return {
    schemaVersion:WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
    id:d.id as string,workspaceId:access.workspaceId,ug:access.ug,
    destinationId:d.destinationId as string,destinationName:d.destinationName as string,
    withdrawnBy:d.withdrawnBy as string,payloadHash:d.payloadHash,
    expectedLineCount:d.expectedLineCount,appliedLineCount:d.appliedLineCount,
    status:d.status as WarehouseMaterialWithdrawal['status'],createdBy:d.createdBy as string,
    createdAt:typeof d.createdAt==='string'?d.createdAt:null,
    updatedAt:typeof d.updatedAt==='string'?d.updatedAt:null,
    finalizedAt:typeof d.finalizedAt==='string'?d.finalizedAt:null,
  };
}
export async function finalizeWarehouseWithdrawalServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<FinalizeWarehouseMaterialWithdrawalResult>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_WITHDRAWAL_INPUT_INVALID',400);
  const input=raw as Partial<FinalizeWarehouseMaterialWithdrawalInput>;
  if(typeof input.withdrawalId!=='string'||!/^wd_[a-f0-9]{32}$/.test(input.withdrawalId)
    ||typeof input.destinationId!=='string'||!/^dest_[a-f0-9]{32}$/.test(input.destinationId)
    ||typeof input.withdrawnBy!=='string'||!Array.isArray(input.lines)
    ||input.lines.length<1||input.lines.length>WAREHOUSE_WITHDRAWAL_MAX_LINES
    ||input.lines.some(line=>!isLine(line)))return fail('WAREHOUSE_WITHDRAWAL_INPUT_INVALID',400);
  const lines=input.lines as WarehouseWithdrawalLineInput[];
  if(new Set(lines.map(line=>line.lineId)).size!==lines.length) {
    return fail('WAREHOUSE_WITHDRAWAL_DUPLICATE_LINE_ID',400);
  }
  const withdrawnBy=normalizeWarehouseWithdrawnBy(input.withdrawnBy);
  if(!withdrawnBy)return fail('WAREHOUSE_WITHDRAWN_BY_REQUIRED',400);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const destinationPath=path(access.workspaceId,'destinations',input.destinationId);
  const headerPath=path(access.workspaceId,'withdrawals',input.withdrawalId);
  const expectedHash=payloadHash(lines);
  let header=await warehouseAdminTransaction(token,[destinationPath,headerPath],rows=>{
    const destination=rows.get(destinationPath);
    if(!destination || destination.data.status!=='active'
      ||destination.data.workspaceId!==access.workspaceId||destination.data.ug!==access.ug) {
      return fail('WAREHOUSE_DESTINATION_INACTIVE');
    }
    const name=destination.data.name;
    if(typeof name!=='string'||!name.trim())return fail('WAREHOUSE_DESTINATION_INVALID');
    const old=rows.get(headerPath);
    if(old){
      const h=parseHeader(access,old);
      if(h.destinationId!==input.destinationId||h.destinationName!==name
        ||h.withdrawnBy!==withdrawnBy||h.payloadHash!==expectedHash
        ||h.expectedLineCount!==lines.length) return fail('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
      return {result:h,writes:[]};
    }
    const now=new Date().toISOString();
    const candidate:WarehouseMaterialWithdrawal={
      schemaVersion:WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,id:input.withdrawalId!,
      workspaceId:access.workspaceId,ug:access.ug,
      destinationId:input.destinationId!,destinationName:name,
      withdrawnBy,payloadHash:expectedHash,expectedLineCount:lines.length,
      appliedLineCount:0,status:'FINALIZING',createdBy:access.uid,
      createdAt:now,updatedAt:now,finalizedAt:null,
    };
    return {result:candidate,writes:[{path:headerPath,data:candidate}]};
  });
  if(header.status==='FINALIZED')return {withdrawal:header,movementIds:[]};
  const movementIds:string[]=[];
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    const outbound=await applyWarehouseExpressOutboundServer(access,{
      materialId:line.materialId,requestedQuantity:line.requestedQuantity,
      presentation:line.presentation,position:line.position,
      barcodeAssociation:line.barcodeAssociation,lotId:line.lotId,
      idempotencyKey:'material-withdrawal:'+input.withdrawalId+':'+line.lineId,
      note:'Saída de Material · '+input.withdrawalId+' · '+line.lineId,
    });
    movementIds.push(outbound.movement.id);
    const consumptionId='cons_'+digest(
      access.workspaceId+'\n'+'stock:'+input.withdrawalId+':'+line.lineId
    );
    const consumptionPath=path(access.workspaceId,'consumptions',consumptionId);
    // Identity-critical fields come from the server's committed movement,
    // material and authenticated header, not browser-provided balances.
    const materialPath=path(access.workspaceId,'materials',line.materialId);
    await warehouseAdminTransaction(token,[headerPath,consumptionPath,materialPath],rows=>{
      const current=rows.get(headerPath);
      const storedMat=rows.get(materialPath);
      if(!current||!storedMat)return fail('WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED');
      const h=parseHeader(access,current);
      if(h.payloadHash!==expectedHash||h.destinationId!==input.destinationId) {
        return fail('WAREHOUSE_WITHDRAWAL_CONCURRENT_MODIFICATION');
      }
      const existing=rows.get(consumptionPath);
      if(existing){
        if(existing.data.movementId!==outbound.movement.id
          ||existing.data.withdrawalId!==input.withdrawalId
          ||existing.data.lineId!==line.lineId||existing.data.ug!==access.ug){
          return fail('WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT');
        }
        return {result:null,writes:[]};
      }
      if(storedMat.data.workspaceId!==access.workspaceId||storedMat.data.ug!==access.ug) {
        return fail('WAREHOUSE_WITHDRAWAL_MATERIAL_SCOPE');
      }
      const description=storedMat.data.description;
      const unit=storedMat.data.unit as Record<string,unknown>|undefined;
      if(typeof description!=='string'||!unit)return fail('WAREHOUSE_WITHDRAWAL_MATERIAL_INVALID');
      const now=new Date();
      return {result:null,writes:[{path:consumptionPath,data:{
        schemaVersion:WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
        id:consumptionId,workspaceId:access.workspaceId,ug:access.ug,
        origin:'STOCK_OUTBOUND',materialId:line.materialId,
        materialDescription:description,unitLabel:
          typeof unit.label==='string'?unit.label:typeof unit.code==='string'?unit.code:'',
        quantity:outbound.plan.baseQuantity,requestedQuantity:outbound.plan.requestedQuantity,
        presentationLabel:line.presentationLabel,
        destinationId:header.destinationId,destinationName:header.destinationName,
        withdrawnBy:header.withdrawnBy,operatorUid:access.uid,
        movementId:outbound.movement.id,withdrawalId:input.withdrawalId,
        lineId:line.lineId,intakeId:null,invoiceRecordKey:null,
        barcode:outbound.plan.barcodeAssociation?.barcode??null,
        lotCode:outbound.lot?.code??null,positionLabel:line.positionLabel,
        siscofisStatus:'PENDING',occurredAt:now,updatedAt:now,
        siscofisUpdatedBy:null,siscofisUpdatedAt:null,
        returnedQuantity:0,lastReturnMovementId:null,lastReturnAt:null,
        lastReturnBy:null,lastReturnReason:null,
      }}]};
    });
    header=await warehouseAdminTransaction(token,[headerPath],rows=>{
      const row=rows.get(headerPath);
      if(!row)return fail('WAREHOUSE_WITHDRAWAL_HEADER_MISSING');
      const prior=parseHeader(access,row);
      if(prior.payloadHash!==expectedHash)return fail('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
      if(prior.status==='FINALIZED'||prior.appliedLineCount>=index+1) {
        return {result:prior,writes:[]};
      }
      const updated={...prior,
        appliedLineCount:index+1,status:'PARTIALLY_APPLIED' as const,
        updatedAt:new Date().toISOString(),
      };
      return {result:updated,writes:[{path:headerPath,data:updated}]};
    });
  }
  header=await warehouseAdminTransaction(token,[headerPath],rows=>{
    const row=rows.get(headerPath);
    if(!row)return fail('WAREHOUSE_WITHDRAWAL_HEADER_MISSING');
    const prior=parseHeader(access,row);
    if(prior.payloadHash!==expectedHash||prior.appliedLineCount!==lines.length) {
      return fail('WAREHOUSE_WITHDRAWAL_INCOMPLETE');
    }
    if(prior.status==='FINALIZED')return {result:prior,writes:[]};
    const now=new Date().toISOString();
    const done:WarehouseMaterialWithdrawal={
      ...prior,status:'FINALIZED',updatedAt:now,finalizedAt:now,
    };
    return {result:done,writes:[{path:headerPath,data:done}]};
  });
  return {withdrawal:header,movementIds};
}
