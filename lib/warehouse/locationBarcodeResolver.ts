import {
  getWarehouseDepot,
  getWarehouseLocation,
} from './locationRepository';
import {
  resolveWarehousePhysicalIdentityCode,
  resolveWarehouseStockPositionCode,
  type WarehousePhysicalIdentityResolveResult,
  type WarehouseStockPositionResolveResult,
} from './locationBarcode';

function createAuthoritativeSource(workspaceId: string) {
  return {
    async getDepot(depotId: string) {
      return (await getWarehouseDepot(workspaceId, depotId))?.depot ?? null;
    },
    async getLocation(locationId: string) {
      return (await getWarehouseLocation(workspaceId, locationId))?.location ?? null;
    },
  };
}

/**
 * Resolve uma etiqueta física contra as entidades autoritativas atuais.
 *
 * Usa leituras uncached de propósito: a resolução operacional precisa revalidar
 * status/hierarquia no momento do scan. O repository já exige usuário autenticado
 * e escopo operacional compatível com o workspace informado.
 */
export async function resolveWarehousePhysicalIdentityBarcode(input: {
  code: string;
  workspaceId: string;
  ug: string | number;
}): Promise<WarehousePhysicalIdentityResolveResult> {
  return resolveWarehousePhysicalIdentityCode(
    input,
    createAuthoritativeSource(input.workspaceId)
  );
}

/**
 * Converte apenas LOCAL/SUBPOSITION em WarehouseStockPosition.
 * DEPOT é uma identidade física válida, mas não é uma posição de estoque no
 * contrato warehouse_location_v1 e por isso falha fechado.
 */
export async function resolveWarehouseStockPositionBarcode(input: {
  code: string;
  workspaceId: string;
  ug: string | number;
}): Promise<WarehouseStockPositionResolveResult> {
  return resolveWarehouseStockPositionCode(
    input,
    createAuthoritativeSource(input.workspaceId)
  );
}
