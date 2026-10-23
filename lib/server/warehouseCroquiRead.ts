/**
 * Consultas estritamente escopadas da Central de Edicao.
 * O cliente nunca escolhe colecao/caminho Firestore nem filtra por UG.
 * Apenas o servidor (identidade IAM) consulta o banco Warehouse.
 */
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminListCollection, warehouseAdminListByField,
  WarehouseStoreError, type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput } from '../warehouse/readCompatibility';
import { validateWarehouseDepot, validateWarehouseLocation } from '../warehouse/location';
import { validateWarehouseDepotLayout } from '../warehouse/layout';
import type { WarehouseDepotListItem, WarehouseLocationListItem } from '../warehouse/locationRepository';
import type { WarehouseDepotLayoutListItem } from '../warehouse/layoutRepository';

export type CroquiReadInput = { kind:'CATALOG' } | {kind:'LAYOUTS';depotId:string};
export type CroquiReadResult =
  | {kind:'CATALOG'; depots:WarehouseDepotListItem[];locations:WarehouseLocationListItem[]}
  | {kind:'LAYOUTS'; layouts:WarehouseDepotLayoutListItem[];active:WarehouseDepotLayoutListItem|null};

function fail(code:string):never{throw new WarehouseStoreError(code,409);}
const timestamp=(raw:unknown):string|null=>
  typeof raw==='string'&&Number.isFinite(Date.parse(raw))?new Date(raw).toISOString():null;
const idOf=(row:WarehouseAdminDocument)=>row.path.split('/').at(-1)||'';

export async function warehouseCroquiReadServer(
  access:VerifiedWarehouseRequest,input:unknown
):Promise<CroquiReadResult>{
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('WAREHOUSE_CROQUI_READ_INVALID');
  const request=input as Record<string,unknown>;
  const ws=access.workspaceId;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  if(request.kind==='CATALOG'&&Object.keys(request).length===1){
    const [depotDocs,locationDocs]=await Promise.all([
      warehouseAdminListCollection(token,ws,'depots',250),
      warehouseAdminListCollection(token,ws,'locations',500),
    ]);
    const depots=depotDocs.map(row=>{
      const id=idOf(row);
      const check=validateWarehouseDepot(
        warehouseCanonicalDepotReadInput(id,row.data),
        {expectedWorkspaceId:ws,expectedUg:access.ug});
      if(!check.ok)return fail('WAREHOUSE_CROQUI_DEPOT_INVALID');
      return {depot:check.data,createdAt:timestamp(row.data.createdAt),
        updatedAt:timestamp(row.data.updatedAt)};
    }).sort((a,b)=>a.depot.code.localeCompare(b.depot.code,'pt-BR'));
    const locations=locationDocs.map(row=>{
      const id=idOf(row);
      const check=validateWarehouseLocation(
        warehouseCanonicalLocationReadInput(id,row.data),
        {expectedWorkspaceId:ws,expectedUg:access.ug});
      if(!check.ok)return fail('WAREHOUSE_CROQUI_LOCATION_INVALID');
      return {location:check.data,createdAt:timestamp(row.data.createdAt),
        updatedAt:timestamp(row.data.updatedAt)};
    }).sort((a,b)=>a.location.code.localeCompare(b.location.code,'pt-BR',{numeric:true}));
    return {kind:'CATALOG',depots,locations};
  }
  if(request.kind==='LAYOUTS'&&Object.keys(request).length===2
    &&typeof request.depotId==='string'
    &&/^dep_[a-f0-9]{32}$/.test(request.depotId)){
    const depotId=request.depotId;
    const docs=await warehouseAdminListByField(token,ws,'layouts','depotId',depotId,500);
    const layouts=docs.map(row=>{
      const id=idOf(row);
      const d=row.data;
      const check=validateWarehouseDepotLayout({
        schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
        name:d.name,depotId:d.depotId??null,
        logicalWidth:d.logicalWidth,logicalHeight:d.logicalHeight,
        objects:d.objects,version:d.version,status:d.status,
        previousVersionId:d.previousVersionId??null,
        createdBy:d.createdBy,updatedBy:d.updatedBy,
      },{expectedWorkspaceId:ws,expectedUg:access.ug});
      if(!check.ok||check.data.depotId!==depotId)return fail('WAREHOUSE_CROQUI_LAYOUT_INVALID');
      return {layout:check.data,createdAt:timestamp(row.data.createdAt),
        updatedAt:timestamp(row.data.updatedAt)};
    }).sort((a,b)=>b.layout.version-a.layout.version);
    const active=layouts.filter(item=>item.layout.status==='active');
    if(active.length>1)return fail('WAREHOUSE_CROQUI_MULTIPLE_ACTIVE_LAYOUTS');
    return {kind:'LAYOUTS',layouts:layouts.slice(0,100),active:active[0]||null};
  }
  return fail('WAREHOUSE_CROQUI_READ_INVALID');
}
