/** W15 — UI boundary only. Authentication and authorization remain exclusively server-side. */
export class FiscalUiError extends Error {
  constructor(code, message = 'Operação fiscal indisponível.') {
    super(message); this.name = 'FiscalUiError'; this.code = code;
  }
}
export const FISCAL_STATES = Object.freeze({
  draft: 'Rascunho', ready_for_review: 'Aguardando revisão',
  approved: 'Aprovada para envio', submitted: 'Envio iniciado',
  processing: 'Em processamento (sem autorização)',
  authorized: 'Autorizada (conferir XML e protocolo)',
  rejected: 'Rejeitada', uncertain: 'Verificação pendente — não reenviar',
});
const digits = value => String(value || '').replace(/\D/g, '');
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
export function selectVerifiedProfile(payload, sessionWorkspaceId) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.profiles) ||
      typeof payload.activeCompanyId !== 'string' ||
      payload.activeCompanyId !== sessionWorkspaceId) {
    throw new FiscalUiError('PROFILE_MISMATCH', 'Sessão e empresa ativa divergentes. Reabra o portal.');
  }
  const profile = payload.profiles.find(p => p && p.companyId === payload.activeCompanyId);
  if (!profile || profile.workspaceId !== profile.companyId ||
      !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(profile.companyId) ||
      digits(profile.cnpj).length !== 14 ||
      typeof profile.name !== 'string' || !profile.name.trim()) {
    throw new FiscalUiError('PROFILE_INVALID', 'Não foi possível validar a identidade fiscal ativa.');
  }
  return Object.freeze({
    companyId: profile.companyId, workspaceId: profile.workspaceId,
    cnpj: digits(profile.cnpj), name: profile.name.trim(),
    legalName: String(profile.legalName || profile.name).trim(),
  });
}
export function safeConnection(payload, profile) {
  if (!profile || !payload || payload.ok !== true) return Object.freeze({state:'unavailable'});
  if (!payload.connection) return Object.freeze({state:'not_configured'});
  const connection = payload.connection;
  if (connection.provider !== 'wlg' || digits(connection.issuerCnpj) !== profile.cnpj ||
      !['homologacao', 'producao'].includes(connection.environment) ||
      !['connected','pending_verification','disconnected','revoked'].includes(connection.status)) {
    return Object.freeze({state:'integrity_error'});
  }
  return Object.freeze({
    state: connection.status, environment: connection.environment,
    verifiedAt: typeof connection.verifiedAt === 'string' ? connection.verifiedAt : null,
    credentialVersion: Number.isSafeInteger(connection.credentialVersion) ? connection.credentialVersion : null,
  });
}
export function displayIssueState(issue) {
  if (!issue || typeof issue !== 'object' || !own(FISCAL_STATES, issue.status)) {
    return 'Estado fiscal não verificado';
  }
  // Unverified provider state alone MUST NEVER be displayed as SEFAZ authorization.
  if (issue.status === 'authorized' && !issueIsAuthorized(issue)) {
    return 'Autorização fiscal pendente de comprovação';
  }
  return FISCAL_STATES[issue.status];
}
export function issueIsAuthorized(issue) {
  return Boolean(issue && issue.status === 'authorized' &&
    issue.authorizationVerified === true &&
    typeof issue.accessKey === 'string' && /^\d{44}$/.test(issue.accessKey) &&
    typeof issue.authorizationProtocol === 'string' && issue.authorizationProtocol.length > 0);
}
export function fiscalSubmissionGate({profile, connection, capabilities, draft, confirmed, busy, uncertain}) {
  const deny = (code, message) => ({allowed:false, code, message});
  if (!profile) return deny('NO_PROFILE', 'Selecione uma empresa validada.');
  if (!connection || connection.state !== 'connected' ||
      !connection.verifiedAt || connection.environment !== 'homologacao') {
    return deny('WLG_UNAVAILABLE', 'Conexão WLG homologada e validada ainda indisponível.');
  }
  // A frontend flag never grants permission. Server must additionally guard each POST live.
  if (!capabilities || capabilities.canIssue !== true ||
      capabilities.companyId !== profile.companyId ||
      capabilities.issuerCnpj !== profile.cnpj ||
      capabilities.environment !== 'homologacao') {
    return deny('BACKEND_DISABLED', 'Emissão aguardando habilitação do backend autorizado.');
  }
  if (busy || uncertain) return deny('IN_FLIGHT', 'Já existe envio ou resultado inconclusivo. Consulte o status.');
  if (!confirmed || !draft || draft.companyId !== profile.companyId ||
      draft.issuerCnpj !== profile.cnpj) {
    return deny('REVIEW_REQUIRED', 'Confirme novamente emitente e destinatário deste CNPJ.');
  }
  if (typeof draft.orderId !== 'string' || !draft.orderId.trim() ||
      digits(draft.recipientCnpj).length !== 14 ||
      typeof draft.recipientName !== 'string' || !draft.recipientName.trim() ||
      !Number.isSafeInteger(draft.series) || draft.series < 0 ||
      !Number.isSafeInteger(draft.number) || draft.number <= 0 ||
      !Array.isArray(draft.items) || !draft.items.length) {
    return deny('DRAFT_INVALID', 'Preencha pedido, destinatário, série, número e itens fiscais.');
  }
  return {allowed:true, code:'READY', message:'Pronto para solicitação de envio em homologação.'};
}
/** Scoped generation + cancellation; never allows an older CNPJ response into the new view. */
export function createTenantRequestBoundary() {
  let scope = null; let generation = 0; let controller = new AbortController();
  const pending = new Set();
  return Object.freeze({
    rotate(companyId) {
      controller.abort(); controller = new AbortController();
      generation += 1; scope = companyId || null; pending.clear();
      return generation;
    },
    capture(companyId) {
      if (!companyId || scope !== companyId) throw new FiscalUiError('STALE_TENANT');
      const current = generation;
      return {signal: controller.signal,
        current: () => scope === companyId && generation === current && !controller.signal.aborted};
    },
    lockSubmission(companyId, key) {
      if (!companyId || scope !== companyId || !key ||
          pending.size > 0 || pending.has(key)) return null;
      pending.add(key);
      const current = generation; let released = false;
      return () => {
        if (released) return;
        released = true;
        if (current === generation && scope === companyId) pending.delete(key);
      };
    },
    get activeCompanyId() { return scope; },
  });
}
export function safeIssues(payload, profile) {
  if (!payload || payload.ok !== true || !profile || !Array.isArray(payload.items)) return [];
  return payload.items.filter(issue =>
    issue && issue.companyId === profile.companyId &&
    issue.issuerCnpj === profile.cnpj &&
    typeof issue.id === 'string' && own(FISCAL_STATES, issue.status))
    .slice(0, 25).map(issue => ({
      id: issue.id, companyId: issue.companyId, issuerCnpj: issue.issuerCnpj,
      status: issue.status, createdAt: typeof issue.createdAt === 'string' ? issue.createdAt : '',
      accessKey: issueIsAuthorized(issue) ? issue.accessKey : null,
      authorizationProtocol: issueIsAuthorized(issue) ? issue.authorizationProtocol : null,
      authorizationVerified: issueIsAuthorized(issue),
    }));
}