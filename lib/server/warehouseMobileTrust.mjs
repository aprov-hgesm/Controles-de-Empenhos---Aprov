/**
 * Motor de Confianca Warehouse — piloto das oito jornadas do Operador Movel.
 * Nada de segundo login, cache de permissoes ou leitura extra de Rule.
 * Entrada obrigatoriamente derivada de verifyWarehouseRequest no servidor.
 */
const ACTIONS = new Set([
  'BARCODE_READ', 'MOBILE_READ', 'QUEUE_READ', 'MATERIAL_READ', 'POSITION_READ',
  'POSITION_BALANCES_READ', 'STOCK_READ', 'INVENTORY_READ',
  'POSITION_CHECK', 'POSITION_CONTENTS',
  'ALLOCATE', 'IMMEDIATE_CONSUMPTION', 'MANUAL_ENTRY', 'TRANSFER', 'WITHDRAWAL_FINALIZE', 'WITHDRAWAL_FINALIZE_MOBILE',
  'DESTINATION_CREATE', 'INVENTORY_START', 'INVENTORY_COUNT',
  'INVENTORY_REVIEW', 'INVENTORY_REOPEN', 'INVENTORY_BEGIN_CONFIRM',
  'INVENTORY_ADJUST', 'INVENTORY_STALE',
  'INVENTORY_FINISH_CONFIRM', 'INVENTORY_CANCEL',
]);

/** @typedef {{uid:string,email:string,workspaceId:string,ug:string,claimsUpdated:boolean}} VerifiedWarehouseScope */

export class WarehouseMobileTrustError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = 'WarehouseMobileTrustError';
    this.status = 403;
  }
}

/**
 * @param {VerifiedWarehouseScope} access contexto verificado via Firebase e cadastro do setor
 * @param {{ workspaceId:unknown, action:unknown }} requested
 * @returns {Readonly<VerifiedWarehouseScope>}
 */
export function bindWarehouseMobileTrust(access, requested) {
  if (!access || typeof access.uid !== 'string' || !access.uid.trim()
    || typeof access.email !== 'string' || !access.email.trim()
    || typeof access.workspaceId !== 'string' || !access.workspaceId
    || typeof access.ug !== 'string' || !/^\d{6}$/.test(access.ug)
    || typeof access.claimsUpdated !== 'boolean') {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_UNVERIFIED');
  }
  if (!requested || typeof requested.action !== 'string' || !ACTIONS.has(requested.action)) {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_ACTION_DENIED');
  }
  if (typeof requested.workspaceId !== 'string' || requested.workspaceId !== access.workspaceId) {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_SCOPE_DENIED');
  }
  // A policy NAO decide saldo nem altera estoque. Isso pertence aos
  // validadores e transacoes canonicos do servidor, apos a autorizacao.
  return Object.freeze({
    uid: access.uid, email: access.email,
    workspaceId: access.workspaceId, ug: access.ug,
    claimsUpdated: access.claimsUpdated,
  });
}

/** Aplicar apenas às operações de piloto sem restringir comandos desktop não migrados. */
export function isWarehouseMobilePilotAction(action) {
  return typeof action === 'string' && ACTIONS.has(action);
}
