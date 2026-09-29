import type { ResolvedWorkspaceContext } from './workspaceContext';

/**
 * Registro neutro de acesso a módulos opcionais.
 *
 * A identidade/workspace continua sendo resolvida pela camada de plataforma.
 * A Central de Depósitos fica disponível para qualquer contexto operacional de
 * setor já autenticado e validado, sem criar exceções por organização.
 */
export const warehouseModuleEnabled = true;

export function canAccessWarehouseModule(
  context: ResolvedWorkspaceContext
): boolean {
  return warehouseModuleEnabled
    && context.status === 'sector'
    && context.canLoadOperationalData
    && Boolean(context.workspaceId);
}
