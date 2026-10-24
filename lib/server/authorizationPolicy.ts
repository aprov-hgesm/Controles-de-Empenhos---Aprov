/**
 * Autorização do EMPROVEX no servidor. Sem Firebase SDK, sem estados do navegador.
 * Todas as operações administrativas/operacionais devem negar por padrão.
 * Regras de saldo, lotes e estado permanecem nos motores transacionais existentes.
 */
export type ServerRole = 'founder' | 'sector';
export type ServerCapability = 'warehouse.read' | 'warehouse.command' | 'platform.admin' | 'core.parse' | 'core.suppliers.read' | 'core.suppliers.write' | 'core.empenho.write' | 'core.comissoes.delete';
export interface ServerPrincipal {
  uid: string;
  email: string;
  role: ServerRole;
  workspaceId: string;
  ug: string;
}
export interface ServerAuthorizationRequest {
  capability: ServerCapability;
  workspaceId?: unknown;
  ug?: unknown;
  operation?: unknown;
}

/** Lista positiva das ações existentes. Não inclui LEDGER_MOVEMENT genérico. */
export const WAREHOUSE_ALLOWED_OPERATIONS = [
  'TRANSFER', 'MATERIAL_SAVE', 'DESTINATION_CREATE', 'DESTINATION_STATUS',
  'STRUCTURE', 'LANDING_VISUAL_SAVE', 'LOGISTICS_SETTINGS_SAVE',
  'QUEUE_EXCLUDE', 'LOT_CREATE', 'LOT_UPDATE', 'EXPRESS_OUTBOUND',
  'STOCK_RETURN', 'WITHDRAWAL_FINALIZE', 'INVENTORY_COUNT',
  'INVENTORY_REVIEW', 'INVENTORY_REOPEN', 'INVENTORY_BEGIN_CONFIRM',
  'INVENTORY_FINISH_CONFIRM', 'INVENTORY_CANCEL', 'INVENTORY_STALE',
  'INVENTORY_ADJUST', 'INVENTORY_START', 'LEGACY_INTAKE_POSTED',
  'CONSUMPTION_SISCOFIS_STATUS', 'BARCODE_SAVE', 'BARCODE_STATUS',
  'BARCODE_REPLACE', 'LAYOUT_SAVE', 'STRUCTURE_LAYOUT_APPLY',
  'CROQUI_READ', 'INTAKE_STATE_SAVE', 'STRUCTURE_ARCHIVE',
  'QUEUE_INDEX_UPSERT', 'QUEUE_INDEX_STATE', 'QUEUE_INDEX_DEACTIVATE',
  'LOGISTICS_ALERT_UPSERT', 'LOGISTICS_ALERT_RESOLVE', 'SISCOFIS_CONFIRM',
  'MANUAL_ENTRY', 'ALLOCATE', 'IMMEDIATE_CONSUMPTION',
] as const;

const permittedWarehouseOperations: ReadonlySet<string> =
  new Set<string>(WAREHOUSE_ALLOWED_OPERATIONS);

export type ServerDenial = 'INVALID_PRINCIPAL' | 'INVALID_SCOPE' |
  'SCOPE_MISMATCH' | 'OPERATION_DENIED' | 'FORBIDDEN';

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: ServerDenial };

const deny = (reason: ServerDenial): AuthorizationDecision => ({ allowed: false, reason });

/**
 * Política pura, testável sem credenciais. O principal é criado SOMENTE por
 * verificadores server-side após validar o Firebase JWT e o diretório autoritativo.
 */
export function evaluateServerAuthorization(
  principal: ServerPrincipal,
  request: ServerAuthorizationRequest,
): AuthorizationDecision {
  if (!principal || !principal.uid || !principal.email ||
      (principal.role !== 'founder' && principal.role !== 'sector')) {
    return deny('INVALID_PRINCIPAL');
  }

  if (request.capability === 'platform.admin') {
    return principal.role === 'founder' ? { allowed: true } : deny('FORBIDDEN');
  }

  if (request.capability !== 'warehouse.read' &&
      request.capability !== 'warehouse.command' &&
      request.capability !== 'core.parse' &&
      request.capability !== 'core.suppliers.read' &&
      request.capability !== 'core.suppliers.write' &&
      request.capability !== 'core.empenho.write' &&
      request.capability !== 'core.comissoes.delete') {
    return deny('FORBIDDEN');
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(principal.workspaceId) ||
      !/^\d{6}$/.test(principal.ug)) {
    return deny('INVALID_PRINCIPAL');
  }

  if (request.workspaceId !== undefined &&
      (typeof request.workspaceId !== 'string' ||
       request.workspaceId !== principal.workspaceId)) {
    return deny('SCOPE_MISMATCH');
  }
  if (request.ug !== undefined &&
      (typeof request.ug !== 'string' || request.ug !== principal.ug)) {
    return deny('SCOPE_MISMATCH');
  }

  if (request.capability === 'core.parse' || request.capability === 'core.suppliers.read' ||
      request.capability === 'core.suppliers.write' || request.capability === 'core.empenho.write' ||
      request.capability === 'core.comissoes.delete' ||
      request.capability === 'warehouse.read') {
    return request.operation === undefined ? { allowed: true } : deny('OPERATION_DENIED');
  }

  if (typeof request.workspaceId !== 'string' || !request.workspaceId) {
    return deny('INVALID_SCOPE');
  }
  if (typeof request.operation !== 'string' ||
      !permittedWarehouseOperations.has(request.operation)) {
    return deny('OPERATION_DENIED');
  }
  return { allowed: true };
}
