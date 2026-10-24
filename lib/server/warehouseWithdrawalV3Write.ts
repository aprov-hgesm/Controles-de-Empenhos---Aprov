/**
 * Adaptador v3 de intenção mínima -> retirada atômica canônica.
 * Planejamento no servidor, sem FEFO ou lotId vindo do navegador.
 * A fotografia dos documentos de atribuição, inclusive mutex, é verificada
 * DENTRO da transação antes da primeira escrita: falhas não causam baixa parcial.
 */
import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import {
  warehouseAdminBatchRead, warehouseAdminListByField, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { finalizeWarehouseWithdrawalAtomicServer } from './warehouseWithdrawalAtomicWrite';
import {
  parseWarehouseWithdrawalV3, type WarehouseWithdrawalV3Command,
} from '../warehouse/withdrawalV3';
import { validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import { validateWarehouseBalance, type WarehouseBalance } from '../warehouse/movement';
import {
  createWarehouseLocationBalanceId, validateWarehouseLocationBalance,
  warehouseStockPositionsEqual, warehouseStockPositionKey,
  type WarehouseLocationBalance,
} from '../warehouse/location';
import { validateWarehouseBarcodeAssociation, type WarehouseBarcodeAssociation } from '../warehouse/barcode';
import { validateWarehouseLot, type WarehouseLot } from '../warehouse/lot';
import { prepareWarehouseExpressOutbound } from '../warehouse/outbound';
import { warehouseCanonicalBarcodeReadInput, warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput, warehouseCanonicalMaterialReadInput } from '../warehouse/readCompatibility';
import { planMobileOutboundAutomaticLots } from '../warehouse/mobileOutboundPlan.mjs';
import { WAREHOUSE_WITHDRAWAL_MAX_LINES, type WarehouseWithdrawalLineInput,
  type WarehouseMaterialWithdrawal } from '../warehouse/withdrawal';
import type { FinalizeWarehouseMaterialWithdrawalResult } from '../warehouse/withdrawalRepository';

const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
function valid<T>(validation:{ok:boolean;data?:T},code:string):T {
  if(!validation.ok||!validation.data)return fail(code);
  return validation.data;
}
async function readMany(token:string,names:string[]):Promise<Map<string,WarehouseAdminDocument|null>> {
  const result=new Map<string,WarehouseAdminDocument|null>();
  for(let i=0;i<names.length;i+=30) {
    for(const [name,row] of await warehouseAdminBatchRead(token,names.slice(i,i+30)))
      result.set(name,row);
  }
  return result;
}
function required(rows:ReadonlyMap<string,WarehouseAdminDocument|null>,name:string) {
  return rows.get(name)??fail('WAREHOUSE_WITHDRAWAL_V3_REFERENCE_MISSING');
}
/** Identidade de intenção: versão + destino + campos operacionais normalizados. */
export function warehouseWithdrawalV3IntentHash(command:WarehouseWithdrawalV3Command):string {
  return sha('warehouse_withdrawal_intent_v3\n'+JSON.stringify({
    destinationId:command.destinationId,
    lines:command.lines.map(line=>({
      materialId:line.materialId,
      position:line.position,
      requestedQuantity:line.requestedQuantity,
      presentationCode:line.presentationCode??null,
      barcodeId:line.barcodeId??null,
    })),
  }));
}
export function warehouseWithdrawalV3DerivedLineId(withdrawalId:string,index:number,part:number):string {
  return 'wline_'+sha('warehouse_withdrawal_line_v3\n'+withdrawalId+'\n'+index+'\n'+part).slice(0,32);
}
function replay(
  access:VerifiedWarehouseRequest,command:WarehouseWithdrawalV3Command,
  hash:string,row:WarehouseAdminDocument
):FinalizeWarehouseMaterialWithdrawalResult {
  const h=row.data;
  if(h.atomicVersion!==3||h.id!==command.withdrawalId
    ||h.workspaceId!==access.workspaceId||h.ug!==access.ug
    ||h.destinationId!==command.destinationId||h.payloadHash!==hash
    ||h.intentLineCount!==command.lines.length)
    return fail('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
  if(h.status!=='FINALIZED'||h.appliedLineCount!==h.expectedLineCount
    ||typeof h.expectedLineCount!=='number'||h.expectedLineCount<1
    ||h.expectedLineCount>WAREHOUSE_WITHDRAWAL_MAX_LINES)
    return fail('WAREHOUSE_WITHDRAWAL_ATOMIC_HEADER_INVALID');
  return {withdrawal:h as unknown as WarehouseMaterialWithdrawal,movementIds:[]};
}

export async function finalizeWarehouseWithdrawalV3Server(
  access:VerifiedWarehouseRequest,raw:unknown,
):Promise<FinalizeWarehouseMaterialWithdrawalResult> {
  let command:WarehouseWithdrawalV3Command;
  try{command=parseWarehouseWithdrawalV3(raw);}
  catch{return fail('WAREHOUSE_WITHDRAWAL_V3_INPUT_INVALID',400);}
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const ws=access.workspaceId;
  const headerPath=path(ws,'withdrawals',command.withdrawalId);
  const hash=warehouseWithdrawalV3IntentHash(command);
  const existing=(await warehouseAdminBatchRead(token,[headerPath])).get(headerPath);
  // Replay não consulta saldos, material, códigos nem validades: não transforma
  // alterações ocorridas após o commit em nova operação.
  if(existing)return replay(access,command,hash,existing);

  const materialIds=[...new Set(command.lines.map(line=>line.materialId))];
  const mutexPaths=materialIds.map(id=>path(ws,'lotAttributionLocks',id));
  const beforeLocks=await readMany(token,mutexPaths);
  const lotResults=await Promise.all(materialIds.map(id=>
    warehouseAdminListByField(token,ws,'lots','materialId',id,120)));
  const afterLocks=await readMany(token,mutexPaths);
  for(const name of mutexPaths) {
    if((beforeLocks.get(name)?.updateTime||null)!==(afterLocks.get(name)?.updateTime||null))
      return fail('WAREHOUSE_WITHDRAWAL_V3_ATTRIBUTION_CHANGED');
  }
  // Listagens não transacionais são apenas candidatas. Os snapshots serão
  // confrontados na transação que efetivamente grava saldo/ledger.
  const lotRows=lotResults.flat();
  const balances=await Promise.all(command.lines.map(line=>
    createWarehouseLocationBalanceId(ws,line.materialId,line.position)));
  const requestedPaths=[...new Set([
    ...materialIds.flatMap(id=>[path(ws,'materials',id),path(ws,'balances',id)]),
    ...balances.map(id=>path(ws,'locationBalances',id)),
    ...command.lines.flatMap(line=>line.barcodeId?[path(ws,'barcodes',line.barcodeId)]:[]),
  ])];
  // Cap estrito ANTES de qualquer mutação: reserva folga para os derivados.
  if(requestedPaths.length+lotRows.length+mutexPaths.length
    +command.lines.length*3+25>450)
    return fail('WAREHOUSE_WITHDRAWAL_ATOMIC_TOO_MANY_DOCUMENTS',400);
  const docs=await readMany(token,requestedPaths);
  const snapshots:Record<string,string|null>={};
  for(const [name,row] of docs)snapshots[name]=row?.updateTime||null;
  for(const row of lotRows)snapshots[row.path]=row.updateTime;
  for(const name of mutexPaths)snapshots[name]=beforeLocks.get(name)?.updateTime||null;

  const mats=new Map<string,WarehouseMaterial>();
  const globalBalances=new Map<string,WarehouseBalance>();
  const lotsByMaterial=new Map<string,WarehouseLot[]>();
  for(let i=0;i<materialIds.length;i++) {
    const id=materialIds[i];
    const m=required(docs,path(ws,'materials',id)).data;
    const material=valid(validateWarehouseMaterial(
      warehouseCanonicalMaterialReadInput(id,m),
      {expectedWorkspaceId:ws,expectedUg:access.ug}),'WAREHOUSE_INVALID_MATERIAL');
    if(material.status!=='active')return fail('WAREHOUSE_MATERIAL_INACTIVE');
    mats.set(id,material);
    const b=required(docs,path(ws,'balances',id)).data;
    globalBalances.set(id,valid(validateWarehouseBalance({
      schemaVersion:b.schemaVersion,workspaceId:b.workspaceId,ug:b.ug,
      materialId:b.materialId,quantity:b.quantity,revision:b.revision,
      lastMovementId:b.lastMovementId,
    },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:id}),
    'WAREHOUSE_INVALID_BALANCE'));
    lotsByMaterial.set(id,lotResults[i].map(row=>
      valid(validateWarehouseLot(
        warehouseCanonicalLotReadInput(row.path.split('/').at(-1)!,row.data),
        {expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:id}),
      'WAREHOUSE_WITHDRAWAL_V3_LOT_INVALID')));
  }

  const reservedByMaterial=new Map<string,number>();
  const reservedByPosition=new Map<string,number>();
  const reservedByLot=new Map<string,number>();
  const lines:WarehouseWithdrawalLineInput[]=[];
  for(let index=0;index<command.lines.length;index++) {
    const line=command.lines[index],material=mats.get(line.materialId)!;
    const balance=globalBalances.get(line.materialId)!;
    const locPath=path(ws,'locationBalances',balances[index]);
    const location=valid(validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(balances[index],required(docs,locPath).data),
      {expectedWorkspaceId:ws,expectedMaterialId:line.materialId}),
    'WAREHOUSE_INVALID_LOCATION_BALANCE');
    if(location.ug!==access.ug||!warehouseStockPositionsEqual(location.position,line.position))
      return fail('WAREHOUSE_OUTBOUND_LOCATION_SCOPE_MISMATCH');
    const positionKey=line.materialId+':'+warehouseStockPositionKey(line.position);
    let barcode:WarehouseBarcodeAssociation|null=null;
    if(line.barcodeId) {
      barcode=valid(validateWarehouseBarcodeAssociation(
        warehouseCanonicalBarcodeReadInput(line.barcodeId,
          required(docs,path(ws,'barcodes',line.barcodeId)).data),
        {expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
      'WAREHOUSE_INVALID_BARCODE');
      if(barcode.status!=='active')return fail('WAREHOUSE_BARCODE_INACTIVE');
    }
    const presentations=[material.unit,...material.conversions.map(x=>x.presentation)];
    const candidates=presentations.filter(x=>x.code===(line.presentationCode??barcode?.presentation.code??material.unit.code));
    if(candidates.length!==1)return fail('WAREHOUSE_WITHDRAWAL_V3_PRESENTATION_AMBIGUOUS',400);
    const presentation=barcode?.presentation??candidates[0];
    if(line.presentationCode&&presentation.code!==line.presentationCode)
      return fail('WAREHOUSE_BARCODE_PRESENTATION_MISMATCH',400);
    const used=reservedByMaterial.get(line.materialId)||0;
    const currentGlobal={...balance,quantity:balance.quantity-used};
    let plan:ReturnType<typeof prepareWarehouseExpressOutbound>;
    try {
      plan=prepareWarehouseExpressOutbound({
        material,balance:currentGlobal,requestedQuantity:line.requestedQuantity,
        presentation,position:line.position,barcodeAssociation:barcode,
      });
    }catch(error) {
      return fail(error instanceof Error?error.message:'WAREHOUSE_WITHDRAWAL_V3_PLAN_INVALID');
    }
    const consumedAtPosition=reservedByPosition.get(positionKey)||0;
    const physicalQuantity=location.quantity-consumedAtPosition;
    if(plan.baseQuantity>physicalQuantity+0.000001)
      return fail('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
    const positionLots=(lotsByMaterial.get(line.materialId)||[])
      .filter(lot=>warehouseStockPositionsEqual(lot.position,line.position))
      .map(lot=>({...lot,quantity:lot.quantity-(reservedByLot.get(lot.id)||0)}));
    let allocation:Array<{lotId:string|null;quantity:number}>;
    try {
      allocation=planMobileOutboundAutomaticLots({
        quantity:plan.baseQuantity,physicalQuantity,
        lots:positionLots.map(lot=>({
          id:lot.id,code:lot.code,quantity:lot.quantity,
          status:lot.status,expiresOn:lot.expiresOn,
        })),
      });
    }catch(error){
      return fail(error instanceof Error?error.message:'WAREHOUSE_WITHDRAWAL_V3_ALLOCATION_INVALID');
    }
    reservedByMaterial.set(line.materialId,used+plan.baseQuantity);
    reservedByPosition.set(positionKey,consumedAtPosition+plan.baseQuantity);
    for(let part=0;part<allocation.length;part++){
      const allocationPart=allocation[part];
      if(allocationPart.lotId)reservedByLot.set(allocationPart.lotId,
        (reservedByLot.get(allocationPart.lotId)||0)+allocationPart.quantity);
      // IDs de linhas repetidas não dependem de material, lote ou descrição.
      lines.push({
        lineId:warehouseWithdrawalV3DerivedLineId(command.withdrawalId,index,part),
        materialId:material.id,materialDescription:material.description,
        requestedQuantity:allocationPart.quantity,baseQuantity:allocationPart.quantity,
        presentation:material.unit,presentationLabel:presentation.label||presentation.code,
        unitLabel:material.unit.label||material.unit.code,
        position:line.position,positionLabel:'',
        barcodeAssociation:null,barcode:barcode?.barcode||null,
        lotId:allocationPart.lotId,
        lotCode:positionLots.find(x=>x.id===allocationPart.lotId)?.code||null,
      });
    }
    if(lines.length>WAREHOUSE_WITHDRAWAL_MAX_LINES)
      return fail('WAREHOUSE_WITHDRAWAL_LINE_LIMIT',400);
  }
  if(!lines.length)return fail('WAREHOUSE_WITHDRAWAL_V3_EMPTY_PLAN',400);
  return finalizeWarehouseWithdrawalAtomicServer(access,{
    withdrawalId:command.withdrawalId,destinationId:command.destinationId,
    withdrawnBy:access.email,lines,
  },{
    intentHash:hash,intentLineCount:command.lines.length,snapshotVersions:snapshots,
  });
}
