/**
 * W13 — WLG fiscal adapter. Server-only, zero persisted credentials.
 * Public API reference: https://wlgsistemas.com.br/api-emissao-nfe
 * All company bindings must come from W10's live server authorization.
 * Swagger schema, remote issuer proof, idempotency and commercial use remain unverified.
 */
const WLG_ORIGIN = 'https://fiscal.wlgsistemas.com.br';
const MAX_JSON_BYTES = 65536;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export class WlgError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = 'WlgError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeCnpj(value) {
  const digits = typeof value === 'string' ? value.replace(/[.\-\/\s]/g, '') : '';
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) throw new WlgError('WLG_CNPJ_INVALID', 422);
  const calc = length => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  if (Number(digits[12]) !== calc(12) || Number(digits[13]) !== calc(13)) throw new WlgError('WLG_CNPJ_INVALID', 422);
  return digits;
}
function nonempty(value, limit = 128) {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && /^[a-zA-Z0-9_:/.-]+$/.test(value);
}
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** This is an authorization guard, not a browser-provided tenant selector. */
export function assertBoundConnection(connection, actor) {
  if (!plain(connection) || !plain(actor) || connection.provider !== 'wlg'
    || !nonempty(connection.companyId) || connection.companyId !== actor.companyId
    || connection.workspaceId !== actor.workspaceId || connection.companyId !== connection.workspaceId
    || !nonempty(actor.uid) || !nonempty(connection.providerEmpresaId, 100)) {
    throw new WlgError('WLG_TENANT_FORBIDDEN', 403);
  }
  const cnpj = normalizeCnpj(connection.cnpj);
  if (connection.status !== 'connected') throw new WlgError('WLG_CONNECTION_INACTIVE', 409);
  if (!['homologacao', 'producao'].includes(connection.environment)) throw new WlgError('WLG_ENVIRONMENT_INVALID', 422);
  if (!Number.isSafeInteger(connection.credentialVersion) || connection.credentialVersion < 1
    || !nonempty(connection.credentialRef, 240)
    || !/^projects\/[a-zA-Z0-9_-]+\/secrets\/[a-zA-Z0-9_-]+\/versions\/[1-9][0-9]*$/.test(connection.credentialRef)) throw new WlgError('WLG_SECRET_REFERENCE_INVALID', 503);
  // A manual/official provider validation must have been stored by W10 separately.
  // Never treat an arbitrary browser field as proof of issuer ownership.
  if (!plain(connection.verification)
    || normalizeCnpj(connection.verification.issuerCnpj) !== cnpj
    || connection.verification.providerEmpresaId !== connection.providerEmpresaId
    || connection.verification.credentialVersion !== connection.credentialVersion
    || !Number.isFinite(Date.parse(connection.verification.verifiedAt || ''))) {
    throw new WlgError('WLG_ISSUER_UNVERIFIED', 403);
  }
  return connection;
}
/** Explicit safe projection. No credentialRef, token, clientId or clientSecret. */
export function publicConnection(connection, actor) {
  const bound = assertBoundConnection(connection, actor);
  return Object.freeze({
    provider: 'wlg', companyId: bound.companyId, environment: bound.environment,
    status: bound.status, issuerCnpj: normalizeCnpj(bound.cnpj),
    verifiedAt: bound.verification.verifiedAt,
    credentialVersion: bound.credentialVersion,
  });
}
export function assertProviderIssuer(connection, providerIssuerCnpj) {
  if (normalizeCnpj(providerIssuerCnpj) !== normalizeCnpj(connection.cnpj)) {
    throw new WlgError('WLG_ISSUER_MISMATCH', 409);
  }
  return true;
}
function responseError(status) {
  if (status === 401) return new WlgError('WLG_UNAUTHORIZED', 401);
  if (status === 403) return new WlgError('WLG_FORBIDDEN', 403);
  if (status === 429) return new WlgError('WLG_RATE_LIMIT', 429);
  if (status >= 500) return new WlgError('WLG_REMOTE_UNAVAILABLE', 503);
  return new WlgError('WLG_REMOTE_REJECTED', 422);
}

/**
 * The secret reader has to verify the tenant, environment and version and
 * return {clientId,clientSecret} from a server-side vault. Not a Firestore field.
 * No user-supplied URL or remote document path is ever fetched.
 */
export function createWlgProvider({ secretResolver, fetchImpl = fetch, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 8000, minIntervalMs = 100 } = {}) {
  if (typeof secretResolver !== 'function' || typeof fetchImpl !== 'function') {
    throw new WlgError('WLG_SERVER_CONFIGURATION_REQUIRED', 503);
  }
  const tokens = new Map();
  const tokenFlights = new Map();
  const lanes = new Map();
  const lastRequest = new Map();
  const boundedTimeout = Math.max(100, Math.min(15000, Number(timeoutMs) || 8000));
  const boundedInterval = Math.max(0, Math.min(5000, Number(minIntervalMs) || 0));
  const keyOf = c => [c.companyId, c.environment, c.credentialVersion, c.credentialRef].join('|');

  async function throttle(key) {
    const earlier = lanes.get(key) || Promise.resolve();
    const turn = earlier.catch(() => {}).then(async () => {
      const gap = boundedInterval - (now() - (lastRequest.get(key) || -Infinity));
      if (gap > 0) await sleep(gap);
      lastRequest.set(key, now());
    });
    lanes.set(key, turn);
    await turn;
    if (lanes.get(key) === turn) lanes.delete(key);
  }
  async function rawRequest(key, path, { method = 'GET', token, body, binary = false } = {}) {
    // Only fixed paths on the pinned WLG origin. No user-supplied URL.
    if (!/^\/api\/v1\/[a-zA-Z0-9/-]+$/.test(path)) throw new WlgError('WLG_PATH_FORBIDDEN', 403);
    await throttle(key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), boundedTimeout);
    try {
      const response = await fetchImpl(WLG_ORIGIN + path, {
        method, headers: {
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          Accept: binary ? 'application/octet-stream' : 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        redirect: 'error', cache: 'no-store',
      });
      if (!response.ok) throw responseError(response.status);
      const limit = binary ? MAX_DOCUMENT_BYTES : MAX_JSON_BYTES;
      const advertised = Number(response.headers.get('content-length') || 0);
      if (advertised > limit) throw new WlgError(
        binary ? 'WLG_DOCUMENT_TOO_LARGE' : 'WLG_RESPONSE_TOO_LARGE', 502);
      // The timeout includes body read; no unchecked stream can hold a worker forever.
      if (binary) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > limit) throw new WlgError('WLG_DOCUMENT_TOO_LARGE', 502);
        return { status: response.status, bytes, mime: response.headers.get('content-type') || '' };
      }
      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > limit) throw new WlgError('WLG_RESPONSE_TOO_LARGE', 502);
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new WlgError('WLG_RESPONSE_INVALID', 502); }
      if (!plain(parsed)) throw new WlgError('WLG_RESPONSE_INVALID', 502);
      return { status: response.status, data: parsed };
    } catch (error) {
      if (error instanceof WlgError) throw error;
      // POST network failures might occur after WLG accepted the note.
      throw new WlgError(method === 'POST' && path === '/api/v1/nfe'
        ? 'WLG_SUBMISSION_UNCERTAIN' : 'WLG_NETWORK_UNAVAILABLE', 503);
    } finally {
      clearTimeout(timer);
    }
  }
  async function tokenFor(c) {
    const key = keyOf(c);
    const cached = tokens.get(key);
    if (cached && cached.expiresAt > now() + 5000) return cached.value;
    if (tokenFlights.has(key)) return tokenFlights.get(key);
    const flight = (async () => {
      const secret = await secretResolver({
        companyId: c.companyId, workspaceId: c.workspaceId, environment: c.environment,
        credentialRef: c.credentialRef, credentialVersion: c.credentialVersion,
      });
      if (!plain(secret) || !nonempty(secret.clientId, 240) || typeof secret.clientSecret !== 'string'
        || !secret.clientSecret.length) throw new WlgError('WLG_CREDENTIAL_UNAVAILABLE', 503);
      const result = await rawRequest(key, '/api/v1/auth/token', {
        method: 'POST', body: { clientId: secret.clientId, clientSecret: secret.clientSecret },
      });
      if (!nonempty(result.data.accessToken, 8192) || result.data.tokenType !== 'Bearer'
        || !Number.isFinite(result.data.expiresIn) || result.data.expiresIn <= 0) {
        throw new WlgError('WLG_TOKEN_INVALID', 502);
      }
      tokens.set(key, { value: result.data.accessToken,
        expiresAt: now() + Math.max(0, result.data.expiresIn - 60) * 1000 });
      return result.data.accessToken;
    })();
    tokenFlights.set(key, flight);
    try { return await flight; } finally { tokenFlights.delete(key); }
  }
  async function authorizedRequest(c, path, options = {}) {
    const key = keyOf(c);
    let token = await tokenFor(c);
    const safe = options.method !== 'POST'; // Never retry a fiscal POST.
    for (let attempt = 0; attempt <= (safe ? 1 : 0); attempt++) {
      try { return await rawRequest(key, path, { ...options, token }); }
      catch (err) {
        if (safe && attempt === 0 && err.code === 'WLG_UNAUTHORIZED') {
          tokens.delete(key); token = await tokenFor(c); continue;
        }
        if (safe && attempt === 0 && ['WLG_RATE_LIMIT', 'WLG_REMOTE_UNAVAILABLE'].includes(err.code)) {
          await sleep(250); continue;
        }
        throw err;
      }
    }
    throw new WlgError('WLG_REMOTE_UNAVAILABLE');
  }
  function bound(c, ctx) { return assertBoundConnection(c, ctx); }
  return Object.freeze({
    provider: 'wlg',
    async getOperation(connection, actor, operationId) {
      const c = bound(connection, actor);
      if (!nonempty(operationId, 128) || !/^[a-zA-Z0-9-]+$/.test(operationId)) throw new WlgError('WLG_OPERATION_ID_INVALID', 422);
      const { data } = await authorizedRequest(c, '/api/v1/operacoes/' + operationId);
      if (data.emitenteCnpj) assertProviderIssuer(c, data.emitenteCnpj);
      if (data.status === 'ERRO') return { kind: 'rejected', reason: typeof data.motivoErro === 'string' ? data.motivoErro.slice(0, 300) : 'WLG_REJECTED' };
      if (data.status === 'SUCCESSO') {
        if (typeof data.chaveNfe !== 'string' || !/^\d{44}$/.test(data.chaveNfe)) throw new WlgError('WLG_RESPONSE_INVALID', 502);
        // The operation response is not an authenticated XML/protocol proof.
        return { kind: 'provider_success_unverified', chaveNfe: data.chaveNfe,
          dataAutorizacao: typeof data.dataAutorizacao === 'string' ? data.dataAutorizacao : null };
      }
      return { kind: 'processing', rawStatus: String(data.status || 'DESCONHECIDO').slice(0, 40) };
    },
    async submitHomologation(connection, actor, command) {
      const c = bound(connection, actor);
      if (c.environment !== 'homologacao' || process.env.EMPROVEX_COMPANY_WLG_HOMOLOGATION_ENABLED !== '1'
        || process.env.EMPROVEX_COMPANY_PILOT_ENABLED !== '1') throw new WlgError('WLG_ISSUANCE_DISABLED', 503);
      if (!plain(command) || command.humanApprovalVerified !== true
        || !nonempty(command.reviewedIntentId) || !nonempty(command.reservationId)
        || command.reviewedByUid !== actor.uid || !plain(command.payload)) throw new WlgError('WLG_REVIEW_REQUIRED', 403);
      const draft = command.payload;
      // These two authority fields MUST be injected from trusted connection.
      if ('empresaId' in draft || 'tipoAmbiente' in draft || !plain(draft.emitente)
        || ![55,65].includes(draft.ide?.modelo) || !Array.isArray(draft.itens)
        || !plain(draft.destinatario) || !plain(draft.totais) || !plain(draft.pagamento)) {
        throw new WlgError('WLG_PAYLOAD_INVALID', 422);
      }
      assertProviderIssuer(c, draft.emitente.cnpj || draft.emitente.CNPJ);
      const body = { ...draft, empresaId: c.providerEmpresaId, tipoAmbiente: 2 };
      const result = await authorizedRequest(c, '/api/v1/nfe', { method: 'POST', body });
      if (result.status !== 202 || !nonempty(result.data.operationId)
        || result.data.status !== 'PROCESSANDO') throw new WlgError('WLG_RESPONSE_INVALID', 502);
      // Not authorized, even if WLG returned 202. W14 persists durable command before POST.
      return { kind: 'processing', operationId: result.data.operationId };
    },
    async downloadXml(connection, actor, chaveNfe) {
      const c = bound(connection, actor);
      if (!/^\d{44}$/.test(chaveNfe || '')) throw new WlgError('WLG_KEY_INVALID', 422);
      const { bytes } = await authorizedRequest(c, '/api/v1/nfe/' + chaveNfe + '/xml', { binary: true });
      const xml = new TextDecoder().decode(bytes);
      // Reject mismatched or ambiguous provider XML. W14 must still verify
      // signature, access key, protocol, environment and persist private hash.
      const emits = [...xml.matchAll(/<emit(?:\s[^>]*)?>([\s\S]*?)<\/emit>/gi)];
      if (emits.length !== 1) throw new WlgError('WLG_ISSUER_UNVERIFIED', 409);
      const ids = [...emits[0][1].matchAll(/<CNPJ>(\d{14})<\/CNPJ>/gi)];
      if (ids.length !== 1) throw new WlgError('WLG_ISSUER_UNVERIFIED', 409);
      assertProviderIssuer(c, ids[0][1]);
      return { bytes, mime: 'application/xml', verifiedIssuerCnpj: normalizeCnpj(ids[0][1]) };
    },
    /** Explicitly invalidate local token after revocation/rotation. */
    revokeLocalToken(connection) { tokens.delete(keyOf(connection)); },
  });
}
