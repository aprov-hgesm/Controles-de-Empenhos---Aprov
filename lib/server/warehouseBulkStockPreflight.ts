/**
 * Pré-validação da planilha executada exclusivamente no servidor com IAM.
 * Nenhuma consulta de catálogo é feita pelo SDK Firebase do navegador.
 */
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { WarehouseStoreError, warehouseAdminListFullStockCatalog } from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { BulkStockRow } from './warehouseBulkStockWorkbook';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseDepot, validateWarehouseLocation, type WarehouseLocation } from '../warehouse/location';
import {
  warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput,
  warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';
import { resolveBulkStockRows, type BulkStockPreflightLine } from '../warehouse/bulkStockResolve';

const invalid=(code:string):never=>{throw new WarehouseStoreError(code,409);};
const idOf=(path:string)=>path.split('/').at(-1)||'';

/** Depósitos para o seletor Excel, via IAM, sem depender de Rules de leitura SDK. */
export async function listWarehouseBulkStockDepots(access:VerifiedWarehouseRequest) {
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const docs=await warehouseAdminListFullStockCatalog(token,access.workspaceId,'depots',250);
  return docs.map(row=>{
    const result=validateWarehouseDepot(
      warehouseCanonicalDepotReadInput(idOf(row.path),row.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!result.ok)return invalid('STOCK_IMPORT_DEPOT_CATALOG_INVALID');
    return result.data;
  }).filter(depot=>depot.status==='active')
    .map(depot=>({id:depot.id,name:depot.name,code:depot.code}))
    .sort((a,b)=>a.code.localeCompare(b.code,'pt-BR',{numeric:true}));
}

export async function preflightWarehouseBulkStock(
  access:VerifiedWarehouseRequest,depotId:string,rows:BulkStockRow[],
):Promise<BulkStockPreflightLine[]> {
  if(!/^dep_[a-f0-9]{32}$/.test(depotId)||!rows.length||rows.length>1500)
    throw new WarehouseStoreError('STOCK_IMPORT_DESTINATION_INVALID',400);
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ? 'emulator' : await getGoogleAccessToken();
  const [materialDocs,depotDocs,locationDocs]=await Promise.all([
    warehouseAdminListFullStockCatalog(token,access.workspaceId,'materials'),
    warehouseAdminListFullStockCatalog(token,access.workspaceId,'depots',250),
    warehouseAdminListFullStockCatalog(token,access.workspaceId,'locations'),
  ]);
  const materials=materialDocs.map(row=>{
    const result=validateWarehouseMaterial(
      warehouseCanonicalMaterialReadInput(idOf(row.path),row.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!result.ok)return invalid('STOCK_IMPORT_MATERIAL_CATALOG_INVALID');
    return result.data;
  });
  const depots=depotDocs.map(row=>{
    const result=validateWarehouseDepot(
      warehouseCanonicalDepotReadInput(idOf(row.path),row.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!result.ok)return invalid('STOCK_IMPORT_DEPOT_CATALOG_INVALID');
    return result.data;
  });
  if(!depots.some(depot=>depot.id===depotId&&depot.status==='active'))
    throw new WarehouseStoreError('STOCK_IMPORT_DESTINATION_NOT_FOUND',404);
  const locations:WarehouseLocation[]=locationDocs.map(row=>{
    const result=validateWarehouseLocation(
      warehouseCanonicalLocationReadInput(idOf(row.path),row.data),
      {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!result.ok)return invalid('STOCK_IMPORT_LOCATION_CATALOG_INVALID');
    return result.data;
  });
  return resolveBulkStockRows(rows,depotId,materials,locations);
}
