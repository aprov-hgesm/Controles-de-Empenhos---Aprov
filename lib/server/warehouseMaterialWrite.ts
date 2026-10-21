import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import {
  validateWarehouseMaterial, type WarehouseMaterial,
} from '../warehouse/material';
import { warehouseCanonicalMaterialReadInput } from '../warehouse/readCompatibility';

function reject(code: string, status = 409): never {
  throw new WarehouseStoreError(code, status);
}

/** Canonical material writes: tenant/UG fixed by Auth server claims. */
export async function saveWarehouseMaterialServer(
  access: VerifiedWarehouseRequest,
  proposed: unknown
): Promise<WarehouseMaterial> {
  const valid=validateWarehouseMaterial(proposed,{
    expectedWorkspaceId:access.workspaceId, expectedUg:access.ug,
  });
  if(!valid.ok) return reject('WAREHOUSE_MATERIAL_INVALID',400);
  const material=valid.data;
  if(material.workspaceId!==access.workspaceId||material.ug!==access.ug) {
    return reject('WAREHOUSE_MATERIAL_SCOPE_MISMATCH',403);
  }
  const materialPath=`warehouse/${access.workspaceId}/materials/${material.id}`;
  const balancePath=`warehouse/${access.workspaceId}/balances/${material.id}`;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ? 'emulator' : await getGoogleAccessToken();

  return warehouseAdminTransaction(token,[materialPath,balancePath],rows=>{
    const row=rows.get(materialPath);
    if(row) {
      const current=validateWarehouseMaterial(
        warehouseCanonicalMaterialReadInput(material.id,row.data),
        {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
      );
      if(!current.ok) return reject('WAREHOUSE_MATERIAL_HISTORICAL_INVALID');
      // Alterações de unidade de base após movimentação comprometem saldos e lotes.
      if(rows.get(balancePath)
        && JSON.stringify(current.data.unit)!==JSON.stringify(material.unit)) {
        return reject('WAREHOUSE_MATERIAL_UNIT_LOCKED');
      }
      if(current.data.id!==material.id ||current.data.ug!==access.ug) {
        return reject('WAREHOUSE_MATERIAL_ID_IMMUTABLE');
      }
    }
    return {result:material,writes:[{path:materialPath,data:material as unknown as Record<string,unknown>}]};
  });
}
