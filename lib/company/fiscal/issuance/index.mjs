/**
 * W14 — NF-e issuance engine. SERVER-ONLY, adapter-driven and deliberately
 * non-operational until W10 supplies durable CAS, live fiscal RBAC, issuer
 * verification, XML signature verification and tenant-private document storage.
 *
 * No real WLG call is performed by importing this module.
 */
import { createHash, randomUUID } from 'node:crypto';
import { assertBoundConnection, normalizeCnpj } from '../wlg/index.mjs';

export const ISSUE_STATES = Object.freeze([
  'draft', 'ready_for_review', 'approved', 'submitted',
  'processing', 'authorized', 'rejected', 'uncertain',
]);
const CAN_MOVE = Object.freeze({
  draft: ['ready_for_review'],
  ready_for_review: ['approved'],
  approved: ['submitted'],
  submitted: ['processing', 'uncertain'],
  processing: ['processing', 'authorized', 'rejected', 'uncertain'],
  rejected: [], uncertain: [], authorized: [],
});
const ID = /^[a-zA-Z0-9_-]{2,100}$/;
const MAX_POLLS = 12;
const MAX_XML_BYTES = 4 * 1024 * 1024;
export class NfeIssueError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.name = 'NfeIssueError';
    this.code = code;
    this.status = status;
  }
}
const fail = (code, status) => { throw new NfeIssueError(code, status); };
const okId = s => typeof s === 'string' && ID.test(s);
const text = (s, max = 256) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const object = s => s !== null && typeof s === 'object' && !Array.isArray(s);
const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
const iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const hash = s => createHash('sha256').update(s).digest('hex');
const clean = x => JSON.parse(JSON.stringify(x));
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function transition(issue, next, patch, time, uid) {
  if (!CAN_MOVE[issue.status]?.includes(next)) fail('NFE_TRANSITION_FORBIDDEN', 409);
  return {
    ...issue, ...patch, status: next, revision: issue.revision + 1, updatedAt: time,
    audit: [...issue.audit, { type: 'state_changed', from: issue.status, to: next,
      uid, at: time, revision: issue.revision + 1 }],
  };
}
function requireScope(ctx) {
  if (!object(ctx) || ctx.active !== true || ctx.emailVerified !== true
    || !okId(ctx.uid) || !okId(ctx.companyId) || ctx.companyId !== ctx.workspaceId
    || !text(ctx.cnpj)) fail('NFE_LIVE_CONTEXT_REQUIRED', 403);
  return normalizeCnpj(ctx.cnpj);
}
function checkIssue(issue, ctx) {
  if (!object(issue) || issue.companyId !== ctx.companyId
    || issue.workspaceId !== ctx.workspaceId
    || normalizeCnpj(issue.issuerCnpj) !== normalizeCnpj(ctx.cnpj)) {
    fail('NFE_TENANT_FORBIDDEN', 403);
  }
  if (!ISSUE_STATES.includes(issue.status) || !integer(issue.revision, 1, 9999999)) {
    fail('NFE_CORRUPTED_RECORD', 503);
  }
}
function fiscalFields(payload, expectedIssuerCnpj) {
  // Never synthesize taxation or recipient from sales or historical costs.
  if (!object(payload) || !object(payload.emitente) || !object(payload.ide)
    || payload.ide.modelo !== 55 || !object(payload.destinatario)
    || !object(payload.totais) || !object(payload.pagamento)
    || !Array.isArray(payload.itens) || payload.itens.length < 1 || payload.itens.length > 990
    || !text(payload.naturezaOperacao, 100)
    || !text(payload.destinatario.cnpj || payload.destinatario.cpf, 18)) {
    fail('NFE_FISCAL_REVIEW_REQUIRED', 422);
  }
  if (Object.hasOwn(payload, 'empresaId') || Object.hasOwn(payload, 'tipoAmbiente')) {
    fail('NFE_CLIENT_AUTHORITY_FORBIDDEN', 403);
  }
  const submittedIssuer = payload.emitente.cnpj || payload.emitente.CNPJ;
  if (!text(submittedIssuer, 18) || normalizeCnpj(submittedIssuer) !== expectedIssuerCnpj) {
    fail('NFE_ISSUER_MISMATCH', 403);
  }
  for (const item of payload.itens) {
    if (!object(item) || !text(item.descricao, 300) || !text(item.ncm, 8)
      || !/^\d{8}$/.test(item.ncm) || !/^\d{4}$/.test(item.cfop || '')
      || !text(item.cst || item.csosn, 4) || !text(String(item.quantidade ?? ''), 32)
      || !object(item.icms) || !object(item.pis) || !object(item.cofins)) {
      fail('NFE_TAX_FIELDS_REQUIRED', 422);
    }
  }
  return true;
}
export function validNfeAccessKey(key, issuerCnpj, series, number) {
  if (!/^\d{44}$/.test(key || '')) return false;
  const weights = Array.from({ length: 43 }, (_, i) => 2 + ((42 - i) % 8));
  const sum = weights.reduce((n, weight, i) => n + Number(key[i]) * weight, 0);
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return Number(key[43]) === check
    && key.slice(6, 20) === normalizeCnpj(issuerCnpj)
    && key.slice(20, 22) === '55'
    && Number(key.slice(22, 25)) === series
    && Number(key.slice(25, 34)) === number;
}
/**
 * This is only strict lexical crosschecking. A separate trusted validator
 * MUST prove the XML signature, protocol authenticity, certificate chain
 * and SEFAZ authorization before this engine may authorize an issue.
 */
export function inspectAuthorizedXml(bytes, expected) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 50
    || bytes.byteLength > MAX_XML_BYTES) fail('NFE_XML_INVALID', 422);
  let xml;
  try { xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('NFE_XML_INVALID', 422); }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('NFE_XML_UNSAFE', 422);
  const one = (source, pattern) => {
    const all = [...source.matchAll(pattern)];
    if (all.length !== 1) fail('NFE_XML_AMBIGUOUS', 422);
    return all[0][1];
  };
  const emit = one(xml, /<(?:\w+:)?emit\b[^>]*>([\s\S]*?)<\/(?:\w+:)?emit>/gi);
  const ide = one(xml, /<(?:\w+:)?ide\b[^>]*>([\s\S]*?)<\/(?:\w+:)?ide>/gi);
  const inf = one(xml, /<(?:\w+:)?infNFe\b[^>]*\bId=["']NFe(\d{44})["'][^>]*>/gi);
  const prot = one(xml, /<(?:\w+:)?infProt\b[^>]*>([\s\S]*?)<\/(?:\w+:)?infProt>/gi);
  const field = (body, tag) => one(body,
    new RegExp('<(?:\\w+:)?' + tag + '>([^<]+)<\\/(?:\\w+:)?' + tag + '>', 'gi'));
  const cnpj = field(emit, 'CNPJ');
  const key = field(prot, 'chNFe');
  const environment = field(ide, 'tpAmb');
  const status = field(prot, 'cStat');
  const protocol = field(prot, 'nProt');
  const at = field(prot, 'dhRecbto');
  if (cnpj !== expected.issuerCnpj || key !== inf || key !== expected.key
    || !validNfeAccessKey(key, expected.issuerCnpj, expected.series, expected.number)
    || environment !== '2' || status !== '100'
    || field(ide, 'mod') !== '55'
    || Number(field(ide, 'serie')) !== expected.series
    || Number(field(ide, 'nNF')) !== expected.number
    || !/^\d{10,20}$/.test(protocol) || !iso(at)
    || !/<(?:\w+:)?Signature\b/i.test(xml)) fail('NFE_XML_NOT_AUTHORIZED', 422);
  return Object.freeze({ key, issuerCnpj: cnpj, environment: 'homologacao',
    protocol, authorizedAt: at, sha256: hash(bytes) });
}
function assertAdapter(deps) {
  for (const name of ['authorize', 'resolveConnection', 'verifyOrder',
    'store', 'provider', 'verifyXml', 'archivePrivate']) {
    if (!deps || !deps[name]) fail('NFE_INTEGRATION_REQUIRED', 503);
  }
  for (const name of ['reserve', 'read', 'cas']) {
    if (typeof deps.store[name] !== 'function') fail('NFE_DURABLE_STORE_REQUIRED', 503);
  }
  for (const name of ['submitHomologation', 'getOperation', 'downloadXml']) {
    if (typeof deps.provider[name] !== 'function') fail('NFE_PROVIDER_REQUIRED', 503);
  }
  for (const name of ['authorize', 'resolveConnection', 'verifyOrder', 'verifyXml', 'archivePrivate']) {
    if (typeof deps[name] !== 'function') fail('NFE_INTEGRATION_REQUIRED', 503);
  }
}
/** No durable implementation is bundled; only W10 can wire a real server adapter. */
export function createNfeIssuanceEngine(deps) {
  assertAdapter(deps);
  const now = typeof deps.now === 'function' ? deps.now : () => new Date().toISOString();
  const newId = typeof deps.newId === 'function' ? deps.newId : randomUUID;
  async function context(action) {
    const ctx = await deps.authorize(action);
    requireScope(ctx);
    return ctx;
  }
  async function existing(id, ctx) {
    if (!okId(id)) fail('NFE_INVALID_ID', 422);
    const record = await deps.store.read(ctx.companyId, id);
    if (!record) fail('NFE_NOT_FOUND', 404);
    checkIssue(record, ctx);
    return record;
  }
  async function cas(ctx, record, next) {
    const result = await deps.store.cas(ctx.companyId, record.id, record.revision, next);
    if (!result) fail('NFE_CAS_CONFLICT', 409);
    return result;
  }
  async function connection(ctx, record) {
    const c = await deps.resolveConnection(ctx);
    if (!c || c.connectionId !== record.connectionId
      || c.companyId !== record.companyId
      || c.workspaceId !== record.workspaceId
      || normalizeCnpj(c.cnpj) !== record.issuerCnpj
      || c.environment !== record.environment) fail('NFE_CONNECTION_MISMATCH', 403);
    assertBoundConnection(c, ctx);
    return c;
  }
  return Object.freeze({
    async createDraft(input) {
      const ctx = await context('fiscal:write');
      if (!object(input) || !okId(input.idempotencyKey)
        || (input.companyId && input.companyId !== ctx.companyId)
        || (input.workspaceId && input.workspaceId !== ctx.workspaceId)
        || !integer(input.series, 1, 999)
        || !integer(input.number, 1, 999999999)
        || !okId(input.orderId) || !object(input.payload)) fail('NFE_INVALID_INPUT', 422);
      const c = await deps.resolveConnection(ctx);
      if (!c || !okId(c.connectionId) || c.environment !== 'homologacao') {
        fail('NFE_HOMOLOGATION_ONLY', 503);
      }
      assertBoundConnection(c, ctx);
      if (normalizeCnpj(c.cnpj) !== normalizeCnpj(ctx.cnpj)) fail('NFE_CONNECTION_MISMATCH', 403);
      const ownedOrder = await deps.verifyOrder(ctx, input.orderId);
      if (!ownedOrder || ownedOrder.companyId !== ctx.companyId
        || ownedOrder.workspaceId !== ctx.workspaceId) fail('NFE_ORDER_FORBIDDEN', 403);
      const request = { issuerCnpj: normalizeCnpj(ctx.cnpj), companyId: ctx.companyId,
        connectionId: c.connectionId, environment: c.environment,
        series: input.series, number: input.number, orderId: input.orderId, payload: input.payload };
      const fingerprint = hash(stable(request));
      const time = now();
      const record = {
        id: newId(), companyId: ctx.companyId, workspaceId: ctx.workspaceId,
        issuerCnpj: normalizeCnpj(ctx.cnpj), connectionId: c.connectionId,
        environment: 'homologacao', series: input.series, number: input.number,
        orderId: input.orderId, payload: clean(input.payload), status: 'draft', revision: 1,
        idempotencyKey: input.idempotencyKey, fingerprint,
        reservationId: newId(), createdByUid: ctx.uid,
        createdAt: time, updatedAt: time, pollCount: 0, nextPollAt: null,
        audit: [{ type: 'created', uid: ctx.uid, at: time, revision: 1 }],
      };
      // W10 store.reserve MUST be one atomic durable transaction on
      // company+environment+CNPJ+series+number AND idempotencyKey+fingerprint.
      const result = await deps.store.reserve(record, {
        numberKey: [ctx.companyId, record.issuerCnpj, c.environment, input.series, input.number].join(':'),
        idempotencyKey: input.idempotencyKey, fingerprint,
      });
      if (!result) fail('NFE_RESERVATION_FAILED', 503);
      checkIssue(result, ctx);
      if (result.fingerprint !== fingerprint || result.idempotencyKey !== input.idempotencyKey) {
        fail('NFE_IDEMPOTENCY_CONFLICT', 409);
      }
      return result;
    },
    async getStatus(id) {
      const ctx = await context('fiscal:read');
      const issue = await existing(id, ctx);
      // No provider secrets or unreviewed tax/PFE payload in response.
      const { payload, ...safe } = issue;
      return safe;
    },
    async requestReview(id) {
      const ctx = await context('fiscal:write');
      const issue = await existing(id, ctx);
      if (issue.status !== 'draft') fail('NFE_TRANSITION_FORBIDDEN', 409);
      fiscalFields(issue.payload, issue.issuerCnpj);
      await connection(ctx, issue);
      return cas(ctx, issue, transition(issue, 'ready_for_review',
        { fiscalReviewedByUid: ctx.uid, fiscalReviewedAt: now() }, now(), ctx.uid));
    },
    async approve(id, confirmation) {
      const ctx = await context('fiscal:approve');
      const issue = await existing(id, ctx);
      if (issue.status !== 'ready_for_review') fail('NFE_TRANSITION_FORBIDDEN', 409);
      if (!object(confirmation) || confirmation.confirmed !== true
        || confirmation.fingerprint !== issue.fingerprint
        || confirmation.issuerCnpj !== issue.issuerCnpj) fail('NFE_HUMAN_APPROVAL_REQUIRED', 403);
      fiscalFields(issue.payload, issue.issuerCnpj);
      await connection(ctx, issue);
      return cas(ctx, issue, transition(issue, 'approved',
        { approvedByUid: ctx.uid, approvedAt: now(), approvalFingerprint: issue.fingerprint },
        now(), ctx.uid));
    },
    async submit(id) {
      const ctx = await context('fiscal:issue');
      const issue = await existing(id, ctx);
      if (issue.status !== 'approved') {
        // No second POST, even after timeout or concurrent retries.
        if (['submitted', 'processing', 'uncertain', 'authorized', 'rejected'].includes(issue.status)) return issue;
        fail('NFE_TRANSITION_FORBIDDEN', 409);
      }
      if (ctx.uid !== issue.approvedByUid || issue.approvalFingerprint !== issue.fingerprint) {
        fail('NFE_APPROVAL_ACTOR_REQUIRED', 403);
      }
      const c = await connection(ctx, issue);
      fiscalFields(issue.payload, issue.issuerCnpj);
      const submitted = await cas(ctx, issue, transition(issue, 'submitted',
        { submitAttempt: 1 }, now(), ctx.uid));
      // This committed CAS happens BEFORE any fiscal POST. In a crash between
      // CAS and HTTP, only reconciliation/manual review can resolve submission.
      try {
        const response = await deps.provider.submitHomologation(c, ctx, {
          humanApprovalVerified: true, reviewedIntentId: issue.id,
          reservationId: issue.reservationId, reviewedByUid: ctx.uid,
          payload: clean(issue.payload),
        });
        if (response.kind !== 'processing' || !text(response.operationId, 128)) {
          fail('NFE_PROVIDER_RESPONSE_UNVERIFIED', 503);
        }
        return cas(ctx, submitted, transition(submitted, 'processing',
          { operationId: response.operationId, nextPollAt: Date.parse(now()) + 10000 },
          now(), ctx.uid));
      } catch {
        // Even a non-202 or timeout may have taken effect remotely.
        // An uncertain state never authorizes automatic re-submission.
        const fresh = await deps.store.read(ctx.companyId, id);
        if (fresh?.status === 'submitted') {
          return cas(ctx, fresh, transition(fresh, 'uncertain',
            { reconciliationRequired: true }, now(), ctx.uid));
        }
        if (fresh) { checkIssue(fresh, ctx); return fresh; }
        fail('NFE_RECONCILIATION_REQUIRED', 503);
      }
    },
    async poll(id) {
      const ctx = await context('fiscal:read');
      const issue = await existing(id, ctx);
      if (issue.status !== 'processing') return issue;
      if (!text(issue.operationId, 128)) fail('NFE_RECONCILIATION_REQUIRED', 503);
      if (Date.parse(now()) < (issue.nextPollAt || 0)) return issue;
      const c = await connection(ctx, issue);
      let response;
      try { response = await deps.provider.getOperation(c, ctx, issue.operationId); }
      catch {
        return cas(ctx, issue, transition(issue, 'uncertain',
          { reconciliationRequired: true }, now(), ctx.uid));
      }
      if (response.kind === 'rejected') {
        return cas(ctx, issue, transition(issue, 'rejected',
          { rejectionReason: String(response.reason || 'NFE_REJECTED').slice(0, 150) },
          now(), ctx.uid));
      }
      if (response.kind === 'processing') {
        const count = issue.pollCount + 1;
        return cas(ctx, issue, transition(issue, count >= MAX_POLLS ? 'uncertain' : 'processing', {
          pollCount: count, nextPollAt: Date.parse(now()) + Math.min(300000, 10000 * 2 ** Math.min(count, 5)),
          ...(count >= MAX_POLLS ? { reconciliationRequired: true } : {}),
        }, now(), ctx.uid));
      }
      if (response.kind !== 'provider_success_unverified'
        || !validNfeAccessKey(response.chaveNfe, issue.issuerCnpj, issue.series, issue.number)) {
        return cas(ctx, issue, transition(issue, 'uncertain',
          { reconciliationRequired: true }, now(), ctx.uid));
      }
      // WLG SUCCESSO is NOT authorization. W10 must supply independent
      // signature+protocol verifier and private document store.
      try {
        const { bytes, verifiedIssuerCnpj } = await deps.provider.downloadXml(c, ctx, response.chaveNfe);
        if (normalizeCnpj(verifiedIssuerCnpj) !== issue.issuerCnpj) fail('NFE_XML_ISSUER_MISMATCH', 403);
        const lexical = inspectAuthorizedXml(bytes, {
          key: response.chaveNfe, issuerCnpj: issue.issuerCnpj,
          series: issue.series, number: issue.number,
        });
        const proof = await deps.verifyXml(bytes, lexical, ctx);
        if (!proof || proof.signatureValid !== true || proof.protocolValid !== true
          || proof.trustedSefaz !== true || proof.key !== lexical.key
          || proof.issuerCnpj !== lexical.issuerCnpj
          || proof.protocol !== lexical.protocol || proof.authorizedAt !== lexical.authorizedAt) {
          fail('NFE_XML_PROOF_REQUIRED', 503);
        }
        const receipt = await deps.archivePrivate(ctx, issue, {
          kind: 'authorized_xml', bytes, mime: 'application/xml', sha256: lexical.sha256,
        });
        if (!receipt || receipt.sha256 !== lexical.sha256
          || !text(receipt.privateRef, 500)
          || !receipt.privateRef.startsWith('private/' + ctx.companyId + '/')
          || receipt.privateRef.includes('..')) {
          fail('NFE_PRIVATE_ARCHIVE_REQUIRED', 503);
        }
        return cas(ctx, issue, transition(issue, 'authorized', {
          accessKey: lexical.key, authorizationProtocol: lexical.protocol,
          authorizedAt: lexical.authorizedAt,
          documents: [{ kind: 'authorized_xml', sha256: lexical.sha256, privateRef: receipt.privateRef }],
        }, now(), ctx.uid));
      } catch {
        return cas(ctx, issue, transition(issue, 'uncertain',
          { reconciliationRequired: true, evidence: 'provider_success_unverified' },
          now(), ctx.uid));
      }
    },
    async archiveDanfe(id, bytes) {
      const ctx = await context('fiscal:read');
      const issue = await existing(id, ctx);
      if (issue.status !== 'authorized') fail('NFE_XML_AUTHORIZATION_REQUIRED', 409);
      if (!(bytes instanceof Uint8Array) || bytes.length < 5 || bytes.length > MAX_XML_BYTES
        || String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') fail('NFE_DANFE_INVALID', 422);
      if (issue.documents.some(d => d.kind === 'danfe')) return issue;
      const digest = hash(bytes);
      const receipt = await deps.archivePrivate(ctx, issue,
        { kind: 'danfe', bytes, mime: 'application/pdf', sha256: digest });
      if (!receipt || receipt.sha256 !== digest || !text(receipt.privateRef, 500)
        || !receipt.privateRef.startsWith('private/' + ctx.companyId + '/')
        || receipt.privateRef.includes('..')) fail('NFE_PRIVATE_ARCHIVE_REQUIRED', 503);
      return cas(ctx, issue, { ...issue, revision: issue.revision + 1, updatedAt: now(),
        documents: [...issue.documents, { kind: 'danfe', sha256: digest, privateRef: receipt.privateRef }],
        audit: [...issue.audit, { type: 'danfe_archived', uid: ctx.uid, at: now() }] });
    },
    async cancelOrCorrect() {
      // No fabricated WLG endpoints until official Swagger and legal windows.
      fail('NFE_EVENTS_UNSUPPORTED_PENDING_CONTRACT', 503);
    },
  });
}
