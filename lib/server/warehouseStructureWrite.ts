import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminListByField, warehouseAdminTransaction,
  WarehouseStoreError, type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  WAREHOUSE_DEPOT_SCHEMA_VERSION, WAREHOUSE_LOCATION_SCHEMA_VERSION,
  createWarehouseDepotId, createWarehouseLocationId,
  isValidWarehouseDepotId, isValidWarehouseLocationId, isValidWarehouseSubpositionId,
  normalizeWarehouseLogicalCode, validateWarehouseDepot, validateWarehouseLocation,
  type WarehouseDepot, type WarehouseLocation,
} from '../warehouse/location';
import type {
  CreateWarehouseDepotInput, UpdateWarehouseDepotInput,
  CreateWarehouseLocationInput, UpdateWarehouseLocationInput,
} from '../warehouse/locationRepository';
import {
  warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';

type StructureCommand =
  | {kind:'DEPOT_CREATE'; input:CreateWarehouseDepotInput}
  | {kind:'DEPOT_UPDATE'; depotId:string; input:UpdateWarehouseDepotInput}
  | {kind:'LOCATION_CREATE'; input:CreateWarehouseLocationInput}
  | {kind:'LOCATION_UPDATE'; locationId:string; input:UpdateWarehouseLocationInput};
type StructureResult = WarehouseDepot | WarehouseLocation | {ok:true};
const fail=(code:string,status=409):never => {throw new WarehouseStoreError(code,status);};
const path=(ws:string,domain:string,id:string)=>`warehouse/${ws}/${domain}/${id}`;
function expected<T>(r:{ok:boolean;data?:T},code:string):T {
  if(!r.ok || !r.data) return fail(code,400);
  return r.data;
}
function claimId(scope:string):string{
  return 'claim_'+createHash('sha256').update(scope).digest('hex');
}
function activeRecord(d:WarehouseAdminDocument) {
  return d.data.status==='active';
}
function depotData(access:VerifiedWarehouseRequest,id:string,row:WarehouseAdminDocument):WarehouseDepot {
  return expected(validateWarehouseDepot(
    warehouseCanonicalDepotReadInput(id,row.data),
    {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
  ),'WAREHOUSE_DEPOT_INVALID_EXISTING');
}
function locationData(access:VerifiedWarehouseRequest,id:string,row:WarehouseAdminDocument):WarehouseLocation {
  return expected(validateWarehouseLocation(
    warehouseCanonicalLocationReadInput(id,row.data),
    {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
  ),'WAREHOUSE_LOCATION_INVALID_EXISTING');
}
function stableCreation(row:WarehouseAdminDocument,updated:Record<string,unknown>):Record<string,unknown>{
  const stamp=row.data.createdAt;
  return {...updated,createdAt:typeof stamp==='string' && !Number.isNaN(Date.parse(stamp))
    ?new Date(stamp):new Date(),updatedAt:new Date()};
}
function validateScope(access:VerifiedWarehouseRequest, object:Record<string,unknown>) {
  if(object.workspaceId!==access.workspaceId || object.ug!==access.ug) {
    return fail('WAREHOUSE_STRUCTURE_SCOPE_MISMATCH',403);
  }
}

export async function warehouseStructureServer(
  access:VerifiedWarehouseRequest, proposed:unknown
):Promise<StructureResult> {
  if(!proposed||typeof proposed!=='object'||Array.isArray(proposed)) {
    return fail('WAREHOUSE_STRUCTURE_INPUT_INVALID',400);
  }
  const command=proposed as Record<string,unknown>;
  if(!['DEPOT_CREATE','DEPOT_UPDATE','LOCATION_CREATE','LOCATION_UPDATE'].includes(String(command.kind))) {
    return fail('WAREHOUSE_STRUCTURE_OPERATION_INVALID',400);
  }
  const input=command.input;
  if(!input||typeof input!=='object'||Array.isArray(input)) {
    return fail('WAREHOUSE_STRUCTURE_INPUT_INVALID',400);
  }
  const data=input as Record<string,unknown>;
  const kind=command.kind as StructureCommand['kind'];
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const now=new Date();
  if(kind==='DEPOT_CREATE') {
    if(typeof data.code!=='string'||typeof data.name!=='string') {
      return fail('WAREHOUSE_DEPOT_INVALID',400);
    }
    const code=normalizeWarehouseLogicalCode(data.code);
    if(!code) return fail('WAREHOUSE_DEPOT_CODE_INVALID',400);
    const duplicates=await warehouseAdminListByField(token,access.workspaceId,'depots','code',code,250);
    if(duplicates.some(activeRecord)) return fail('WAREHOUSE_DEPOT_DUPLICATE_CODE');
    const id=createWarehouseDepotId();
    const candidate=expected(validateWarehouseDepot({
      schemaVersion:WAREHOUSE_DEPOT_SCHEMA_VERSION,id,
      workspaceId:access.workspaceId,ug:access.ug,
      code,name:data.name,description:data.description??null,
      visualType:data.visualType??'STANDARD',sizeProfile:data.sizeProfile??'MEDIUM',
      status:'active',createdBy:access.uid,updatedBy:access.uid,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}), 'WAREHOUSE_DEPOT_INVALID');
    const depotPath=path(access.workspaceId,'depots',id);
    const indexPath=path(access.workspaceId,'structureCodeClaims',claimId('DEPOT:'+code));
    // A reivindicação de código pode pertencer a depósito já inativo.
    // Ler o antigo titular DENTRO da mesma transação impede reutilização
    // indevida por concorrência com a reativação.
    const existingClaim=await warehouseAdminTransaction(token,[indexPath],rows=>({
      result:rows.get(indexPath),writes:[],
    }));
    const existingOwnerId=existingClaim?.data.entityId;
    if(existingClaim && (typeof existingOwnerId!=='string'
      || !isValidWarehouseDepotId(existingOwnerId))) {
      return fail('WAREHOUSE_DEPOT_CODE_CLAIM_INVALID');
    }
    const ownerPath=typeof existingOwnerId==='string'
      ?path(access.workspaceId,'depots',existingOwnerId):null;
    const readSet=[depotPath,indexPath,...(ownerPath?[ownerPath]:[])];
    return warehouseAdminTransaction(token,readSet,rows=>{
      if(rows.get(depotPath)) return fail('WAREHOUSE_DEPOT_ID_CONFLICT');
      const claim=rows.get(indexPath);
      if(claim) {
        if(!ownerPath || claim.data.entityId!==existingOwnerId) {
          return fail('WAREHOUSE_DEPOT_DUPLICATE_CODE');
        }
        const owner=rows.get(ownerPath);
        if(owner && depotData(access,existingOwnerId as string,owner).status==='active') {
          return fail('WAREHOUSE_DEPOT_DUPLICATE_CODE');
        }
      }
      return {result:candidate,writes:[
        {path:depotPath,data:{...candidate,createdAt:now,updatedAt:now}},
        {path:indexPath,data:{workspaceId:access.workspaceId,ug:access.ug,
          entityId:id,entityKind:'DEPOT',code,createdAt:now}},
      ]};
    });
  }
  if(kind==='DEPOT_UPDATE') {
    const id=command.depotId;
    if(typeof id!=='string'||!isValidWarehouseDepotId(id)) return fail('WAREHOUSE_DEPOT_ID_INVALID',400);
    const depotPath=path(access.workspaceId,'depots',id);
    // Recuperar o código antes de escolher o lock de unicidade.
    const row=await warehouseAdminTransaction(token,[depotPath],rows=>({
      result:rows.get(depotPath),writes:[],
    }));
    if(!row) return fail('WAREHOUSE_DEPOT_NOT_FOUND',404);
    const current=depotData(access,id,row);
    if(data.code!==undefined && normalizeWarehouseLogicalCode(data.code)!==current.code) {
      return fail('WAREHOUSE_DEPOT_CODE_IMMUTABLE');
    }
    const desiredStatus=data.status??current.status;
    if(desiredStatus!=='active'&&desiredStatus!=='inactive') return fail('WAREHOUSE_DEPOT_STATUS_INVALID',400);
    // A inativação exige varredura transacional de locais, saldos e lotes.
    // Até a migração do archiveWarehouseStructure, não aceitar bypass
    // por DEPOT_UPDATE (o fluxo SDK antigo permanece isolado no Draft).
    if(desiredStatus==='inactive' && current.status==='active') {
      return fail('WAREHOUSE_ARCHIVE_SERVER_FLOW_REQUIRED');
    }
    if(desiredStatus==='active' && current.status!=='active') {
      const duplicates=await warehouseAdminListByField(token,access.workspaceId,'depots','code',current.code,250);
      if(duplicates.some(doc=>activeRecord(doc)&&doc.path!==depotPath)) return fail('WAREHOUSE_DEPOT_DUPLICATE_CODE');
    }
    const indexPath=path(access.workspaceId,'structureCodeClaims',claimId('DEPOT:'+current.code));
    const deletedPath=path(access.workspaceId,'depotDeletions',id);
    return warehouseAdminTransaction(token,[depotPath,indexPath,deletedPath],rows=>{
      const present=rows.get(depotPath);
      if(!present) return fail('WAREHOUSE_DEPOT_NOT_FOUND',404);
      const fresh=depotData(access,id,present);
      // O status de um depósito excluído não pode ser reativado por uma rota antiga.
      if(rows.get(deletedPath))return fail('WAREHOUSE_DEPOT_PERMANENTLY_DELETED',409);
      const next=expected(validateWarehouseDepot({
        ...fresh, name:data.name??fresh.name,
        description:data.description===undefined?fresh.description:data.description,
        visualType:data.visualType??fresh.visualType,
        sizeProfile:data.sizeProfile??fresh.sizeProfile,
        status:desiredStatus,updatedBy:access.uid,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}),'WAREHOUSE_DEPOT_UPDATE_INVALID');
      const claim=rows.get(indexPath);
      if(desiredStatus==='active' && claim && claim.data.entityId!==id) {
        return fail('WAREHOUSE_DEPOT_DUPLICATE_CODE');
      }
      const writes=[{path:depotPath,data:stableCreation(present,next as unknown as Record<string,unknown>)}];
      // Não reassumir uma reivindicação perdida por um depósito inativo.
      if(desiredStatus==='active' && !claim) writes.push({path:indexPath,data:{
        workspaceId:access.workspaceId,ug:access.ug,entityId:id,entityKind:'DEPOT',
        code:fresh.code,createdAt:now,
      }});
      return {result:{ok:true as const},writes};
    });
  }
  if(kind==='LOCATION_CREATE') {
    if(typeof data.depotId!=='string'||!isValidWarehouseDepotId(data.depotId)
      ||(data.kind!=='LOCAL'&&data.kind!=='SUBPOSITION')
      ||typeof data.code!=='string'||typeof data.name!=='string') {
      return fail('WAREHOUSE_LOCATION_INVALID',400);
    }
    const depotId=data.depotId, locKind=data.kind;
    const code=normalizeWarehouseLogicalCode(data.code);
    if(!code)return fail('WAREHOUSE_LOCATION_CODE_INVALID',400);
    const parentId=locKind==='SUBPOSITION'?data.parentLocationId:null;
    if(locKind==='SUBPOSITION'&&(typeof parentId!=='string'||!isValidWarehouseLocationId(parentId))) {
      return fail('WAREHOUSE_PARENT_LOCATION_INVALID',400);
    }
    const duplicates=await warehouseAdminListByField(token,access.workspaceId,'locations','code',code,500);
    if(duplicates.some(doc=>activeRecord(doc)&&doc.data.kind===locKind
      &&doc.data.depotId===depotId&&doc.data.parentLocationId===(parentId??null))) {
      return fail('WAREHOUSE_LOCATION_DUPLICATE_CODE');
    }
    const id=createWarehouseLocationId(locKind);
    const candidate=expected(validateWarehouseLocation({
      schemaVersion:WAREHOUSE_LOCATION_SCHEMA_VERSION,id,
      workspaceId:access.workspaceId,ug:access.ug,
      depotId,kind:locKind,parentLocationId:parentId,code,
      name:data.name,description:data.description??null,status:'active',
      createdBy:access.uid,updatedBy:access.uid,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}), 'WAREHOUSE_LOCATION_INVALID');
    const target=path(access.workspaceId,'locations',id);
    const depotPath=path(access.workspaceId,'depots',depotId);
    const parentPath=typeof parentId==='string'?path(access.workspaceId,'locations',parentId):null;
    const indexPath=path(access.workspaceId,'structureCodeClaims',
      claimId('LOCATION:'+locKind+':'+depotId+':'+(parentId??'')+':'+code));
    const reads=[target,depotPath,indexPath,...(parentPath?[parentPath]:[])];
    return warehouseAdminTransaction(token,reads,rows=>{
      const depot=rows.get(depotPath);
      if(!depot || depotData(access,depotId,depot).status!=='active') return fail('WAREHOUSE_DEPOT_INACTIVE');
      if(parentPath) {
        const parent=rows.get(parentPath);
        if(!parent) return fail('WAREHOUSE_PARENT_LOCATION_NOT_FOUND');
        const known=locationData(access,parentId as string,parent);
        if(known.kind!=='LOCAL'||known.depotId!==depotId||known.status!=='active') {
          return fail('WAREHOUSE_PARENT_LOCATION_INVALID');
        }
      }
      if(rows.get(target)||rows.get(indexPath)) return fail('WAREHOUSE_LOCATION_DUPLICATE_CODE');
      return {result:candidate,writes:[
        {path:target,data:{...candidate,createdAt:now,updatedAt:now}},
        {path:indexPath,data:{workspaceId:access.workspaceId,ug:access.ug,
          entityId:id,entityKind:locKind,depotId,parentLocationId:parentId,code,createdAt:now}},
      ]};
    });
  }
  const locationId=command.locationId;
  if(typeof locationId!=='string'
    || (!isValidWarehouseLocationId(locationId)&&!isValidWarehouseSubpositionId(locationId))) {
    return fail('WAREHOUSE_LOCATION_ID_INVALID',400);
  }
  const target=path(access.workspaceId,'locations',locationId);
  const row=await warehouseAdminTransaction(token,[target],rows=>({
    result:rows.get(target),writes:[],
  }));
  if(!row) return fail('WAREHOUSE_LOCATION_NOT_FOUND',404);
  const current=locationData(access,locationId,row);
  if(data.code!==undefined && normalizeWarehouseLogicalCode(data.code)!==current.code) {
    return fail('WAREHOUSE_LOCATION_CODE_IMMUTABLE');
  }
  const desiredStatus=data.status??current.status;
  if(desiredStatus!=='active'&&desiredStatus!=='inactive') return fail('WAREHOUSE_LOCATION_STATUS_INVALID',400);
  if(desiredStatus==='inactive' && current.status==='active') {
    return fail('WAREHOUSE_ARCHIVE_SERVER_FLOW_REQUIRED');
  }
  if(desiredStatus==='active'&&current.status!=='active') {
    const duplicates=await warehouseAdminListByField(token,access.workspaceId,'locations','code',current.code,500);
    if(duplicates.some(doc=>doc.path!==target&&activeRecord(doc)
      &&doc.data.kind===current.kind&&doc.data.depotId===current.depotId
      &&doc.data.parentLocationId===current.parentLocationId)) {
      return fail('WAREHOUSE_LOCATION_DUPLICATE_CODE');
    }
  }
  const indexPath=path(access.workspaceId,'structureCodeClaims',claimId(
    'LOCATION:'+current.kind+':'+current.depotId+':'+(current.parentLocationId??'')+':'+current.code));
  return warehouseAdminTransaction(token,[target,indexPath],rows=>{
    const freshRow=rows.get(target);
    if(!freshRow)return fail('WAREHOUSE_LOCATION_NOT_FOUND',404);
    const fresh=locationData(access,locationId,freshRow);
    const next=expected(validateWarehouseLocation({
      ...fresh,name:data.name??fresh.name,
      description:data.description===undefined?fresh.description:data.description,
      status:desiredStatus,updatedBy:access.uid,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}),'WAREHOUSE_LOCATION_UPDATE_INVALID');
    const claim=rows.get(indexPath);
    if(claim && claim.data.entityId!==locationId)return fail('WAREHOUSE_LOCATION_DUPLICATE_CODE');
    const writes=[{path:target,data:stableCreation(freshRow,next as unknown as Record<string,unknown>)}];
    if(!claim) writes.push({path:indexPath,data:{workspaceId:access.workspaceId,
      ug:access.ug,entityId:locationId,entityKind:fresh.kind,depotId:fresh.depotId,
      parentLocationId:fresh.parentLocationId,code:fresh.code,createdAt:now}});
    return {result:{ok:true as const},writes};
  });
}
