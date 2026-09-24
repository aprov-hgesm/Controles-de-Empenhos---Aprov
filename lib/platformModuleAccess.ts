import { HGESM_SECTOR_EMAIL, HGESM_WORKSPACE_ID } from './hgesmWorkspace';
import { normalizePlatformEmail } from './platformIdentity';
import type { ResolvedWorkspaceContext } from './workspaceContext';

/**
 * Registro neutro de acesso a módulos opcionais.
 *
 * Regra de proteção: o shell operacional do EMPROVEX pode consultar esta camada,
 * mas não deve importar implementações de módulos opcionais como lib/warehouse.
 */
export const warehouseModuleEnabled = true;

export function canAccessWarehouseModule(
  context: ResolvedWorkspaceContext
): boolean {
  return warehouseModuleEnabled
    && context.status === 'sector'
    && context.workspaceId === HGESM_WORKSPACE_ID
    && normalizePlatformEmail(context.email || '') === HGESM_SECTOR_EMAIL
    && context.resolutionSource === 'legacy-hgesm-bootstrap';
}
