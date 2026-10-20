import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';

type SiscofisStatus = 'PENDING'|'PREPARED'|'POSTED';
const allowed = new Set<string>(['PENDING','PREPARED','POSTED']);

export async function setWarehouseConsumptionSiscofisStatusServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{status:SiscofisStatus;changed:boolean}>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){
    throw new WarehouseStoreError('WAREHOUSE_CONSUMPTION_STATUS_INPUT_INVALID',400);
  }
  const input=raw as Record<string,unknown>;
  const id=input.consumptionId;
  const requested=input.status;
  if(typeof id!=='string'||!/^cons_[a-f0-9]{64}$/.test(id)
    ||typeof requested!=='string'||!allowed.has(requested)){
    throw new WarehouseStoreError('WAREHOUSE_CONSUMPTION_STATUS_INPUT_INVALID',400);
  }
  const status=requested as SiscofisStatus;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const path='warehouse/'+access.workspaceId+'/consumptions/'+id;
  return warehouseAdminTransaction<{status:SiscofisStatus;changed:boolean}>(
    token,[path],rows=>{
      const old=rows.get(path);
      if(!old)throw new WarehouseStoreError('WAREHOUSE_CONSUMPTION_NOT_FOUND',404);
      const data=old.data;
      if(data.workspaceId!==access.workspaceId||data.ug!==access.ug){
        throw new WarehouseStoreError('WAREHOUSE_CONSUMPTION_STATUS_SCOPE',403);
      }
      if(data.schemaVersion!=='warehouse_consumption_record_v1'
        ||!allowed.has(String(data.siscofisStatus))){
        throw new WarehouseStoreError('WAREHOUSE_CONSUMPTION_STATUS_INVALID',409);
      }
      if(data.siscofisStatus===status){
        return {result:{status,changed:false},writes:[]};
      }
      const now=new Date();
      return {result:{status,changed:true},writes:[{path,data:{
        ...data,siscofisStatus:status,updatedAt:now,
        siscofisUpdatedBy:access.uid,siscofisUpdatedAt:now,
      }}]};
    }
  );
}
