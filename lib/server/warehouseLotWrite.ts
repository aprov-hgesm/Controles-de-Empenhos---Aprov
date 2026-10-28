import { randomUUID } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminListByField, warehouseAdminTransaction, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  createWarehouseLocationBalanceId, validateWarehouseLocationBalance,
  validateWarehouseStockPosition, warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from '../warehouse/location';
import {
  createWarehouseLotId, validateWarehouseLot,
  WAREHOUSE_LOT_SCHEMA_VERSION, type WarehouseLot,
  type WarehouseLotOrigin,
} from '../warehouse/lot';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseBalance } from '../warehouse/movement';
import {
  warehouseCanonicalLotReadInput,
  warehouseCanonicalMaterialReadInput,
  warehouseCanonicalLocationBalanceReadInput,
} from '../warehouse/readCompatibility';
import type {
  CreateWarehouseLotInput, UpdateWarehouseLotInput,
} from '../warehouse/lotRepository';

type UpdateCommand={lotId:string;input:UpdateWarehouseLotInput};
const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const docPath=(ws:string,domain:string,id:string)=>`warehouse/${ws}/${domain}/${id}`;
const manualOrigin=():WarehouseLotOrigin=>({
  kind:'MANUAL_ENRICHMENT',movementId:null,invoiceRecordKey:null,
  invoiceId:null,supplier:null,supplierCnpj:null,
});
function checkCurrentLot(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument) {
  const id=row.path.split('/').at(-1)||'';
  const result=validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!result.ok) return fail('WAREHOUSE_LOT_STORED_INVALID');
  return result.data;
}
function canonicalLot(access:VerifiedWarehouseRequest,value:unknown,materialId:string) {
  const result=validateWarehouseLot(value,{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
    expectedMaterialId:materialId,
  });
  if(!result.ok)return fail('WAREHOUSE_LOT_INVALID',400);
  return result.data;
}
function lotInput(input:unknown):Record<string,unknown> {
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('WAREHOUSE_LOT_INPUT_INVALID',400);
  return input as Record<string,unknown>;
}
function physical(raw:unknown):WarehouseStockPosition {
  const position=validateWarehouseStockPosition(raw);
  if(!position||position.kind==='UNASSIGNED')return fail('WAREHOUSE_LOT_PHYSICAL_POSITION_REQUIRED',400);
  return position;
}

export async function writeWarehouseLotServer(
  access:VerifiedWarehouseRequest,
  action:'CREATE'|'UPDATE',raw:unknown
):Promise<WarehouseLot> {
  const input=lotInput(raw);
  const isCreate=action==='CREATE';
  const payload=isCreate?input:lotInput(input.input);
  const suppliedId=isCreate?null:input.lotId;
  if(!isCreate && (typeof suppliedId!=='string'||!/^lot_[a-f0-9]{32}$/.test(suppliedId))) {
    return fail('WAREHOUSE_LOT_INVALID_ID',400);
  }
  const requestedPosition=isCreate?physical(payload.position):null;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  // For UPDATE the server resolves the materialId from the persisted lot.
  const preliminaryId=isCreate?createWarehouseLotId():suppliedId as string;
  const selectedPath=docPath(access.workspaceId,'lots',preliminaryId);
  const persisted=isCreate?null:await warehouseAdminTransaction(token,[selectedPath],rows=>({
    result:rows.get(selectedPath),writes:[],
  }));
  if(!isCreate && !persisted)return fail('WAREHOUSE_LOT_NOT_FOUND',404);
  const current=persisted?checkCurrentLot(access,persisted):null;
  const materialId=isCreate?payload.materialId:current?.materialId;
  if(typeof materialId!=='string'||!/^mat_[a-f0-9]{32}$/.test(materialId)) {
    return fail('WAREHOUSE_LOT_MATERIAL_INVALID',400);
  }
  const fromPosition=current?.position||null;
  const position=isCreate?requestedPosition as WarehouseStockPosition:
    payload.position===undefined?fromPosition as WarehouseStockPosition:physical(payload.position);
  const fromBalanceId=fromPosition&&fromPosition.kind!=='UNASSIGNED'
    ?await createWarehouseLocationBalanceId(access.workspaceId,materialId,fromPosition):null;
  const destBalanceId=await createWarehouseLocationBalanceId(access.workspaceId,materialId,position);
  const materialPath=docPath(access.workspaceId,'materials',materialId);
  const balancePath=docPath(access.workspaceId,'balances',materialId);
  const destPath=docPath(access.workspaceId,'locationBalances',destBalanceId);
  const sourcePath=fromBalanceId?docPath(access.workspaceId,'locationBalances',fromBalanceId):null;
  const mutexPath=docPath(access.workspaceId,'lotAttributionLocks',materialId);
  // Uma trilha imutável por alteração, escrita na mesma transação do lote.
  const expiryAuditId='expiry_'+randomUUID().replace(/-/g,'');
  const expiryAuditPath=docPath(access.workspaceId,'lotExpiryAudits',expiryAuditId);
  const candidates=await warehouseAdminListByField(
    token,access.workspaceId,'lots','materialId',materialId,100
  );
  const paths=[...new Set([
    selectedPath,materialPath,balancePath,destPath,mutexPath,
    ...(!isCreate?[expiryAuditPath]:[]),
    ...(sourcePath?[sourcePath]:[]),
    ...candidates.map(row=>row.path),
  ])];
  return warehouseAdminTransaction(token,paths,rows=>{
    const mat=rows.get(materialPath);
    if(!mat)return fail('WAREHOUSE_MATERIAL_NOT_FOUND',404);
    const verifiedMaterial=validateWarehouseMaterial(
      warehouseCanonicalMaterialReadInput(materialId,mat.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
    );
    if(!verifiedMaterial.ok||verifiedMaterial.data.status!=='active') {
      return fail('WAREHOUSE_MATERIAL_INACTIVE');
    }
    const global=rows.get(balancePath);
    if(!global)return fail('WAREHOUSE_BALANCE_NOT_FOUND');
    const b=global.data;
    const validatedBalance=validateWarehouseBalance({
      schemaVersion:b.schemaVersion,workspaceId:b.workspaceId,ug:b.ug,
      materialId:b.materialId,quantity:b.quantity,revision:b.revision,
      lastMovementId:b.lastMovementId,
    },{
      expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
      expectedMaterialId:materialId,
    });
    if(!validatedBalance.ok||validatedBalance.data.ug!==access.ug) {
      return fail('WAREHOUSE_LOT_BALANCE_INVALID');
    }
    const location=rows.get(destPath);
    if(!location)return fail('WAREHOUSE_LOT_POSITION_WITHOUT_STOCK');
    const validatedLocation=validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(destBalanceId,location.data),
      {expectedWorkspaceId:access.workspaceId}
    );
    if(!validatedLocation.ok || validatedLocation.data.ug!==access.ug
      ||!warehouseStockPositionsEqual(validatedLocation.data.position,position)
      ||validatedLocation.data.materialId!==materialId) {
      return fail('WAREHOUSE_LOT_LOCATION_BALANCE_INVALID');
    }
    const oldRow=rows.get(selectedPath);
    if(isCreate && oldRow)return fail('WAREHOUSE_LOT_ID_CONFLICT');
    if(!isCreate && !oldRow)return fail('WAREHOUSE_LOT_NOT_FOUND',404);
    const old=oldRow?checkCurrentLot(access,oldRow):null;
    if(!isCreate&&old?.materialId!==materialId)return fail('WAREHOUSE_LOT_SCOPE_CHANGED');
    const origin=isCreate
      ?payload.origin===undefined?manualOrigin():payload.origin
      :payload.origin??old?.origin;
    // Lot origin can only be generated by the authenticated stock/intake
    // engines. Operators may enrich a manually attributed lot but cannot
    // forge a new invoice-linked origin.
    if(isCreate && (typeof origin!=='object'||origin===null
      ||(origin as WarehouseLotOrigin).kind!=='MANUAL_ENRICHMENT'
      ||(origin as WarehouseLotOrigin).movementId)) {
      return fail('WAREHOUSE_LOT_ORIGIN_FORBIDDEN',400);
    }
    if(!isCreate && payload.origin!==undefined
      && JSON.stringify(payload.origin)!==JSON.stringify(old?.origin)) {
      return fail('WAREHOUSE_LOT_ORIGIN_IMMUTABLE',403);
    }
    const proposed=canonicalLot(access,{
      schemaVersion:WAREHOUSE_LOT_SCHEMA_VERSION,
      id:preliminaryId,workspaceId:access.workspaceId,ug:access.ug,
      materialId,
      code:payload.code??old?.code,
      expiresOn:payload.expiresOn===undefined?(old?.expiresOn??null):payload.expiresOn,
      quantity:payload.quantity??old?.quantity,
      position,origin,
      status:isCreate?'active':(payload.status??old?.status),
      createdBy:old?.createdBy??access.uid,updatedBy:access.uid,
    },materialId);
    if(proposed.quantity>validatedBalance.data.quantity+0.000001) {
      return fail('WAREHOUSE_LOT_QUANTITY_EXCEEDS_BALANCE');
    }
    if(proposed.quantity>validatedLocation.data.quantity+0.000001) {
      return fail('WAREHOUSE_LOT_QUANTITY_EXCEEDS_LOCATION');
    }
    let total=proposed.status==='active'?proposed.quantity:0;
    for(const queryLot of candidates) {
      if(queryLot.path===selectedPath)continue;
      const row=rows.get(queryLot.path);
      if(!row)return fail('WAREHOUSE_LOT_QUERY_RACE');
      const item=checkCurrentLot(access,row);
      if(item.status==='active'&&warehouseStockPositionsEqual(item.position,position)) {
        total+=item.quantity;
      }
    }
    if(total>validatedLocation.data.quantity+0.000001) {
      return fail('WAREHOUSE_LOT_ATTRIBUTION_EXCEEDS_STOCK');
    }
    const mutex=rows.get(mutexPath);
    if(mutex && (mutex.data.workspaceId!==access.workspaceId
      ||mutex.data.ug!==access.ug||mutex.data.materialId!==materialId)) {
      return fail('WAREHOUSE_LOT_LOCK_SCOPE_MISMATCH',403);
    }
    const nextRevision=(typeof mutex?.data.revision==='number'
      &&Number.isSafeInteger(mutex.data.revision)?mutex.data.revision:0)+1;
    const now=new Date();
    const createdAt=typeof oldRow?.data.createdAt==='string'
      && !Number.isNaN(Date.parse(oldRow.data.createdAt))?
      new Date(oldRow.data.createdAt):now;
    const expiryChanged=!isCreate&&(old?.expiresOn??null)!==(proposed.expiresOn??null);
    if(expiryChanged&&rows.get(expiryAuditPath))
      return fail('WAREHOUSE_LOT_EXPIRY_AUDIT_CONFLICT');
    return {result:proposed,writes:[
      {path:selectedPath,data:{...proposed,createdAt,updatedAt:now}},
      {path:mutexPath,data:{
        workspaceId:access.workspaceId,ug:access.ug,materialId,
        revision:nextRevision,updatedBy:access.uid,updatedAt:now,
      }},
      ...(expiryChanged?[{path:expiryAuditPath,data:{
        schemaVersion:'warehouse_lot_expiry_audit_v1',id:expiryAuditId,
        workspaceId:access.workspaceId,ug:access.ug,materialId,
        lotId:preliminaryId,oldExpiresOn:old?.expiresOn??null,
        newExpiresOn:proposed.expiresOn??null,
        updatedBy:access.uid,changedAt:now,
        reason:typeof payload.changeReason==='string'&&payload.changeReason.trim()
          ?payload.changeReason.trim().slice(0,180)
          :'Correção administrativa de validade',
      }}]:[]),
    ]};
  });
}
