import { warehouseServerCommand } from './serverCommandClient';
import type { CroquiReadResult } from '../server/warehouseCroquiRead';
import type { WarehouseDepotListItem, WarehouseLocationListItem } from './locationRepository';
import type { WarehouseDepotLayoutListItem } from './layoutRepository';

/**
 * Na Central de Edicao, todas as leituras estruturais usam o mesmo
 * endpoint autenticado que executa as gravacoes. Firestore fica apenas
 * como armazenamento; o cliente nao faz queries diretas da estrutura.
 */
export async function readWarehouseCroquiCatalog(workspaceId:string):Promise<{
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
}> {
  const result=await warehouseServerCommand<CroquiReadResult>(
    workspaceId,'CROQUI_READ',{kind:'CATALOG'}
  );
  if(result.kind!=='CATALOG')throw new Error('WAREHOUSE_CROQUI_READ_RESPONSE_INVALID');
  return {depots:result.depots,locations:result.locations};
}

export async function readWarehouseCroquiLayouts(workspaceId:string,depotId:string):Promise<{
  active:WarehouseDepotLayoutListItem|null;
  layouts:WarehouseDepotLayoutListItem[];
}> {
  const result=await warehouseServerCommand<CroquiReadResult>(
    workspaceId,'CROQUI_READ',{kind:'LAYOUTS',depotId}
  );
  if(result.kind!=='LAYOUTS')throw new Error('WAREHOUSE_CROQUI_READ_RESPONSE_INVALID');
  return {active:result.active,layouts:result.layouts};
}
