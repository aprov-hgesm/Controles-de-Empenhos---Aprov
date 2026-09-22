import { HGESM_SECTOR_EMAIL, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import { normalizePlatformEmail } from '../platformIdentity';
import type { ResolvedWorkspaceContext } from '../workspaceContext';

/**
 * FASE 0 / DEP-0
 *
 * Flag mestre do Módulo ADM Depósito. A flag permanece ligada durante o piloto,
 * porém a autorização efetiva continua restrita à identidade fundadora e ao
 * workspace fundador. A expansão por UG só poderá alterar esta política em fase
 * futura explicitamente autorizada.
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
