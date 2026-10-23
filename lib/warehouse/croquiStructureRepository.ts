import { warehouseServerCommand } from './serverCommandClient';
import { invalidateWarehouseLocationReadCache } from './locationRepository';
import type {
  CroquiStructureApplyInput, CroquiStructureApplyResult,
} from '../server/warehouseStructureLayoutApply';

/** Escrita unica de geometria, locais e subposicoes, validada no servidor. */
export async function applyWarehouseCroquiStructure(
  workspaceId:string, input:CroquiStructureApplyInput
):Promise<CroquiStructureApplyResult>{
  const result=await warehouseServerCommand<CroquiStructureApplyResult>(
    workspaceId,'STRUCTURE_LAYOUT_APPLY',input
  );
  invalidateWarehouseLocationReadCache(workspaceId);
  return result;
}
export type { CroquiStructureApplyInput, CroquiStructureApplyResult };
