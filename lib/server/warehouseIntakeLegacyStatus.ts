import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction,WarehouseStoreError } from './warehouseFirestoreTransaction';

export async function markWarehouseLegacyIntakePostedServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true}> {
  if(typeof raw!=='string'||!/^intake_[a-f0-9]{64}$/.test(raw)) {
    throw new WarehouseStoreError('WAREHOUSE_INTAKE_INVALID_ID',400);
  }
  const path=`warehouse/${access.workspaceId}/intakes/${raw}`;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  return warehouseAdminTransaction(token,[path],rows=>{
    const old=rows.get(path);
    if(!old)throw new WarehouseStoreError('WAREHOUSE_INTAKE_NOT_FOUND',404);
    const d=old.data;
    if(d.workspaceId!==access.workspaceId||d.ug!==access.ug
      ||d.id!==raw||d.schemaVersion!=='warehouse_item_intake_v1') {
      throw new WarehouseStoreError('WAREHOUSE_INTAKE_SCOPE_MISMATCH',403);
    }
    if(d.mode!=='IMMEDIATE_CONSUMPTION') {
      throw new WarehouseStoreError('WAREHOUSE_INTAKE_NOT_IMMEDIATE',409);
    }
    if(d.siscofisStatus==='POSTED')return {result:{ok:true as const},writes:[]};
    return {result:{ok:true as const},writes:[{path,data:{
      ...d,siscofisStatus:'POSTED',updatedBy:access.uid,updatedAt:new Date(),
    }}]};
  });
}
