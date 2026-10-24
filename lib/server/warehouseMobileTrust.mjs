/**
 * Piloto da politica de confianca do Operador Movel.
 * Sem novas leituras, tokens ou sessoes: so vincula o contexto JA verificado
 * por verifyWarehouseRequest a uma operacao expressamente permitida.
 */

/**
 * @typedef {{
 *   uid: string,
 *   email: string,
 *   workspaceId: string,
 *   ug: string,
 *   claimsUpdated: boolean
 * }} VerifiedWarehouseScope
 */

export class WarehouseMobileTrustError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = 'WarehouseMobileTrustError';
    this.status = 403;
  }
}

/**
 * @param {VerifiedWarehouseScope} access Escopo verificado no servidor.
 * @param {{workspaceId: unknown, action: unknown}} requested Solicitação.
 * @returns {Readonly<VerifiedWarehouseScope>}
 */
export function bindWarehouseMobileTrust(access, requested) {
  // NUNCA usar uid, email ou ug enviados pelo navegador.
  if (!access
    || typeof access.uid !== 'string' || !access.uid.trim()
    || typeof access.email !== 'string' || !access.email.trim()
    || typeof access.workspaceId !== 'string' || !access.workspaceId
    || typeof access.ug !== 'string' || !/^[0-9]{6}$/.test(access.ug)
    || typeof access.claimsUpdated !== 'boolean') {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_UNVERIFIED');
  }
  if (!requested || requested.action !== 'BARCODE_READ') {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_ACTION_DENIED');
  }
  if (typeof requested.workspaceId !== 'string'
    || requested.workspaceId !== access.workspaceId) {
    throw new WarehouseMobileTrustError('WAREHOUSE_MOBILE_TRUST_SCOPE_DENIED');
  }

  // Uma unica identidade e autorizacao, consumida por todos os servicos
  // desta chamada. Nenhuma leitura de Firestore nem Rule extra aqui.
  return Object.freeze({
    uid: access.uid,
    email: access.email,
    workspaceId: access.workspaceId,
    ug: access.ug,
    claimsUpdated: access.claimsUpdated,
  });
}
