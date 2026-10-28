/**
 * Pré-validação da planilha executada exclusivamente no servidor com IAM.
 * Nenhuma consulta de catálogo é feita pelo SDK Firebase do navegador.
 */
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { WarehouseStoreError, warehouseAdminListFullStockCatalog } from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { BulkStockRow } from './warehouseBulkStockWorkbook';
import { validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import { validateWarehouseDepot, validateWarehouseLocation, type WarehouseLocation, type WarehouseStockPosition } from '../warehouse/location';
import {
  warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput,
  warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';
import { matchBulkStockLocal, matchBulkStockSubposition } from '../warehouse/bulkStockLocationMatcher';
import { indexBulkStockMaterials, bulkMaterialGroupKey } from '../warehouse/bulkStockMaterialMatcher';

export interface BulkStockCandidate {
  id:string;description:string;unit:WarehouseMaterial['unit'];
}
export interface BulkStockPreflightLine extends BulkStockRow {
  position:WarehouseStockPosition|null;materialId:string|null;group:string;
  candidates:BulkStockCandidate[];errors:string[];matchedLocation:string|null;
}

const invalid=(code:string):never=>{throw new WarehouseStoreError(code,409);};
const idOf=(path:string)=>path.split('/').at(-1)||'';

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
  const materialIndex=indexBulkStockMaterials(materials);
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
  const locals=locations.filter(l=>l.kind==='LOCAL'&&l.depotId===depotId);
  const subs=locations.filter(l=>l.kind==='SUBPOSITION'&&l.depotId===depotId);
  return rows.map(item=>{
    const errors:string[]=[];
    const matches=matchBulkStockLocal(locals,depotId,item.localType,item.localNumber);
    if(matches.length!==1)errors.push(matches.length?'Localização ambígua':'Local não cadastrado');
    const local=matches.length===1?matches[0]:null;
    let matchedLocation=local?.name||null;
    let position:WarehouseStockPosition|null=null;
    if(local) {
      if(!item.subposition)
        position={kind:'LOCATION',depotId,locationId:local.id,subpositionId:null};
      else {
        const found=matchBulkStockSubposition(subs,depotId,local.id,item.subposition);
        if(found.length!==1)
          errors.push(found.length?'Subposição ambígua':'Subposição não cadastrada');
        else {
          position={kind:'SUBPOSITION',depotId,locationId:local.id,subpositionId:found[0].id};
          matchedLocation=local.name+' / '+found[0].name;
        }
      }
    }
    const group=bulkMaterialGroupKey(item.material,item.unit);
    const candidates=(materialIndex.get(group)||[])
      .map(m=>({id:m.id,description:m.description,unit:m.unit}));
    const materialId=candidates.length===1?candidates[0].id:null;
    if(candidates.length>1)errors.push('Selecione o cadastro do material na prévia');
    return {...item,position,materialId,group,candidates,errors,matchedLocation};
  });
}
