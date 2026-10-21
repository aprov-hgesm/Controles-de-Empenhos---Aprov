import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import {
  createWarehouseDestinationId,
  normalizeWarehouseDestinationName,
  WAREHOUSE_DESTINATION_SCHEMA_VERSION,
  type WarehouseDestination,
} from '../warehouse/withdrawal';

const fail=(code:string,status=400):never=>{throw new WarehouseStoreError(code,status);};
const path=(workspaceId:string,id:string)=>`warehouse/${workspaceId}/destinations/${id}`;

export async function warehouseDestinationCreateServer(
  access:VerifiedWarehouseRequest,
  input:unknown
):Promise<WarehouseDestination> {
  if(!input || typeof input!=='object' || Array.isArray(input)) {
    return fail('WAREHOUSE_DESTINATION_INPUT_INVALID');
  }
  const name=(input as Record<string,unknown>).name;
  if(typeof name!=='string') return fail('WAREHOUSE_DESTINATION_NAME_REQUIRED');
  const normalized=normalizeWarehouseDestinationName(name);
  if(!normalized || name.trim().length>120) return fail('WAREHOUSE_DESTINATION_NAME_REQUIRED');
  const id=createWarehouseDestinationId();
  const candidate:WarehouseDestination={
    schemaVersion:WAREHOUSE_DESTINATION_SCHEMA_VERSION,
    id,workspaceId:access.workspaceId,ug:access.ug,name:normalized,
    status:'active',createdBy:access.uid,updatedBy:access.uid,
  };
  const docPath=path(access.workspaceId,id);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  return warehouseAdminTransaction(token,[docPath],rows=>{
    if(rows.get(docPath)) return fail('WAREHOUSE_DESTINATION_ID_CONFLICT',409);
    return {result:candidate,writes:[{path:docPath,data:{
      ...candidate,createdAt:new Date(),updatedAt:new Date(),
    }}]};
  });
}

export async function warehouseDestinationSetStatusServer(
  access:VerifiedWarehouseRequest,
  input:unknown
):Promise<{ok:true}> {
  if(!input || typeof input!=='object'||Array.isArray(input)) {
    return fail('WAREHOUSE_DESTINATION_INPUT_INVALID');
  }
  const obj=input as Record<string,unknown>;
  const id=obj.destinationId;
  const status=obj.status;
  if(typeof id!=='string' || !/^dest_[a-f0-9]{32}$/.test(id)
    || (status!=='active' && status!=='inactive')) {
    return fail('WAREHOUSE_DESTINATION_INPUT_INVALID');
  }
  const docPath=path(access.workspaceId,id);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  return warehouseAdminTransaction(token,[docPath],rows=>{
    const doc=rows.get(docPath);
    if(!doc) return fail('WAREHOUSE_DESTINATION_NOT_FOUND',404);
    if(doc.data.workspaceId!==access.workspaceId || doc.data.ug!==access.ug
      || doc.data.schemaVersion!==WAREHOUSE_DESTINATION_SCHEMA_VERSION) {
      return fail('WAREHOUSE_DESTINATION_SCOPE_MISMATCH',403);
    }
    const createdAt=typeof doc.data.createdAt==='string'
      ?new Date(doc.data.createdAt):new Date();
    return {result:{ok:true as const},writes:[{path:docPath,data:{
      ...doc.data,status,updatedBy:access.uid,createdAt,updatedAt:new Date(),
    }}]};
  });
}
