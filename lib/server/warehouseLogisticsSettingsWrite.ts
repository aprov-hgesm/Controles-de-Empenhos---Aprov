import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import {
  WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
  validateWarehouseLogisticsSettings,
  type WarehouseLogisticsSettings,
} from '../warehouse/logistics';

export async function saveWarehouseLogisticsSettingsServer(
  access:VerifiedWarehouseRequest,input:unknown
):Promise<WarehouseLogisticsSettings>{
  if(input!==null && (typeof input!=='number'||!Number.isFinite(input))) {
    throw new WarehouseStoreError('WAREHOUSE_LOGISTICS_INVALID_THRESHOLD',400);
  }
  let canonical:WarehouseLogisticsSettings;
  try {
    canonical=validateWarehouseLogisticsSettings({
      schemaVersion:WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
      workspaceId:access.workspaceId,
      ug:access.ug,
      lowStockThreshold:input,
      updatedBy:access.uid,
      updatedAt:null,
    },access.workspaceId);
  }catch{
    throw new WarehouseStoreError('WAREHOUSE_LOGISTICS_INVALID_THRESHOLD',400);
  }
  const p=`warehouse/${access.workspaceId}/settings/logistics-alerts`;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const now=new Date().toISOString();
  return warehouseAdminTransaction(token,[p],rows=>{
    const existing=rows.get(p);
    if(existing && (existing.data.workspaceId!==access.workspaceId
      || existing.data.ug!==access.ug)) {
      throw new WarehouseStoreError('WAREHOUSE_LOGISTICS_SCOPE_MISMATCH',403);
    }
    const unchanged=existing?.data.schemaVersion===canonical.schemaVersion
      && existing.data.lowStockThreshold===canonical.lowStockThreshold;
    return {
      result:{...canonical,updatedAt:unchanged && typeof existing.data.updatedAt==='string'
        ?existing.data.updatedAt:now,updatedBy:unchanged && typeof existing.data.updatedBy==='string'
        ?existing.data.updatedBy:access.uid},
      writes:unchanged?[]:[{path:p,data:{...canonical,updatedAt:now}}],
    };
  });
}
