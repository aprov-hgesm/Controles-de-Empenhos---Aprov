import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WlgError, normalizeCnpj, assertBoundConnection, publicConnection,
  assertProviderIssuer, createWlgProvider,
} from './index.mjs';

const flags = ['EMPROVEX_COMPANY_WLG_HOMOLOGATION_ENABLED', 'EMPROVEX_COMPANY_PILOT_ENABLED'];
const A = {
  provider: 'wlg', companyId: 'company-A', workspaceId: 'company-A',
  cnpj: '11.222.333/0001-81', providerEmpresaId: 'wlg-A',
  environment: 'homologacao', status: 'connected',
  credentialRef: 'projects/demo/secrets/wlg-A/versions/1', credentialVersion: 1,
  verification: {
    issuerCnpj: '11222333000181', providerEmpresaId: 'wlg-A', credentialVersion: 1,
    verifiedAt: '2026-11-06T00:00:00Z', verificationMethod: 'verified_offline_demo',
  },
  createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z', revision: 1,
};
const B = {
  ...A, companyId: 'company-B', workspaceId: 'company-B',
  cnpj: '11.444.777/0001-61', providerEmpresaId: 'wlg-B',
  credentialRef: 'projects/demo/secrets/wlg-B/versions/1',
  verification: { ...A.verification, issuerCnpj: '11444777000161', providerEmpresaId: 'wlg-B' },
};
const actorA = { companyId: A.companyId, workspaceId: A.workspaceId, uid: 'uid-AB' };
const actorB = { companyId: B.companyId, workspaceId: B.workspaceId, uid: 'uid-AB' };
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});
const xml = cnpj => new Response('<nfeProc><NFe><infNFe><emit><CNPJ>' + cnpj
  + '</CNPJ></emit></infNFe></NFe></nfeProc>');
function setup(impl, extra = {}) {
  let credentialsRead = 0;
  const api = createWlgProvider({
    secretResolver: async selector => {
      credentialsRead++;
      return { clientId: selector.companyId, clientSecret: 'DO-NOT-LEAK-' + selector.companyId };
    },
    fetchImpl: impl,
    minIntervalMs: 0,
    sleep: async () => {},
    ...extra,
  });
  return { api, credentialsRead: () => credentialsRead };
}
function command(cnpj = A.cnpj) {
  return {
    humanApprovalVerified: true, reviewedByUid: 'uid-AB',
    reviewedIntentId: 'intent-1', reservationId: 'reservation-1',
    payload: {
      ide: { modelo: 55, serie: 1, numero: 1 }, emitente: { cnpj },
      destinatario: {}, itens: [{}], totais: {}, pagamento: {},
    },
  };
}
async function withFlags(fn) {
  const old = flags.map(key => process.env[key]);
  try {
    for (const key of flags) process.env[key] = '1';
    return await fn();
  } finally {
    flags.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    });
  }
}
function mockedApi(steps, trace = []) {
  return async (url, options = {}) => {
    trace.push({ url: String(url), options });
    assert.match(String(url), /^https:\/\/fiscal\.wlgsistemas\.com\.br\/api\/v1\//);
    const step = steps.shift();
    assert.ok(step, 'Unexpected WLG HTTP call');
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step(url, options) : step;
  };
}

test('CNPJ checksum and normalized data reject malformed identifiers', () => {
  assert.equal(normalizeCnpj(A.cnpj), '11222333000181');
  assert.equal(normalizeCnpj(B.cnpj), '11444777000161');
  assert.throws(() => normalizeCnpj('11.222.333/0001-82'), e => e.code === 'WLG_CNPJ_INVALID');
  assert.throws(() => normalizeCnpj('11111111111111'), WlgError);
});
test('one UID with A/B remains strictly segregated; forged B from A denied', () => {
  assert.equal(assertBoundConnection(A, actorA).providerEmpresaId, 'wlg-A');
  assert.equal(assertBoundConnection(B, actorB).providerEmpresaId, 'wlg-B');
  assert.throws(() => assertBoundConnection(B, actorA), e => e.status === 403);
  assert.throws(() => assertBoundConnection(A, { ...actorA, workspaceId: 'company-B' }), WlgError);
});
test('disconnected/revoked, unverified, stale credential and wrong issuer fail closed', () => {
  for (const status of ['disconnected', 'revoked', 'pending_verification']) {
    assert.throws(() => assertBoundConnection({ ...A, status }, actorA), WlgError);
  }
  assert.throws(() => assertBoundConnection({ ...A, verification: { ...A.verification, providerEmpresaId: 'wlg-B' } }, actorA), WlgError);
  assert.throws(() => assertBoundConnection({ ...A, credentialVersion: 2 }, actorA), WlgError);
  assert.throws(() => assertProviderIssuer(A, B.cnpj), e => e.code === 'WLG_ISSUER_MISMATCH');
});
test('public projection never serializes secretRef, secret or token', () => {
  const projection = JSON.stringify(publicConnection({ ...A, clientSecret: 'LEAK', accessToken: 'LEAK' }, actorA));
  for (const word of ['credentialRef', 'clientSecret', 'accessToken', 'LEAK', 'providerEmpresaId']) {
    assert.equal(projection.includes(word), false, word);
  }
  assert.equal(JSON.parse(projection).issuerCnpj, '11222333000181');
});
test('token fetch is scoped by tenant and cached per credential version', async () => {
  const trace = [];
  const steps = [
    (url, request) => json({ accessToken: 'token-A', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    (url, request) => json({ accessToken: 'token-B', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    json({ status: 'PROCESSANDO' }),
  ];
  const { api, credentialsRead } = setup(mockedApi(steps, trace));
  await api.getOperation(A, actorA, 'op-A');
  await api.getOperation(B, actorB, 'op-B');
  await api.getOperation(A, actorA, 'op-A');
  assert.equal(credentialsRead(), 2);
  assert.equal(trace.filter(t => t.url.endsWith('/auth/token')).length, 2);
  assert.equal(trace[1].options.headers.Authorization, 'Bearer token-A');
  assert.equal(trace[3].options.headers.Authorization, 'Bearer token-B');
});
test('token expiration causes re-auth; concurrent requests share one auth flight', async () => {
  let tick = 0;
  const trace = [];
  const steps = [
    json({ accessToken: 't1', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    json({ accessToken: 't2', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    json({ status: 'PROCESSANDO' }),
  ];
  const { api } = setup(mockedApi(steps, trace), { now: () => tick });
  await api.getOperation(A, actorA, 'op1');
  tick = 3700 * 1000;
  await Promise.all([api.getOperation(A, actorA, 'op2'), api.getOperation(A, actorA, 'op3')]);
  assert.equal(trace.filter(t => t.url.endsWith('/auth/token')).length, 2);
});
test('401 on safe GET refreshes token once; 403 stays denied', async () => {
  const steps = [
    json({ accessToken: 't1', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ code: 'invalid' }, 401),
    json({ accessToken: 't2', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    json({ status: 'PROCESSANDO' }, 403),
  ];
  const trace = [];
  const { api } = setup(mockedApi(steps, trace));
  assert.equal((await api.getOperation(A, actorA, 'op1')).kind, 'processing');
  await assert.rejects(api.getOperation(A, actorA, 'op1'), e => e.code === 'WLG_FORBIDDEN');
  assert.equal(trace.filter(t => t.url.endsWith('/auth/token')).length, 2);
});
test('429 on GET retries once with bounded backoff; never client-controlled URLs', async () => {
  const steps = [
    json({ accessToken: 't1', tokenType: 'Bearer', expiresIn: 3600 }),
    json({}, 429), json({ status: 'PROCESSANDO' }),
  ];
  const trace = [];
  const { api } = setup(mockedApi(steps, trace));
  assert.equal((await api.getOperation(A, actorA, 'safe-op')).kind, 'processing');
  assert.equal(trace.length, 3);
  await assert.rejects(api.getOperation(A, actorA, 'https://evil.example/x'), e => e.code === 'WLG_OPERATION_ID_INVALID');
});
test('provider success remains unverified until W14 checks XML + protocol', async () => {
  const { api } = setup(mockedApi([
    json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'SUCCESSO', chaveNfe: '1'.repeat(44), dataAutorizacao: '2026-11-06T01:00:00Z' }),
  ]));
  const result = await api.getOperation(A, actorA, 'op');
  assert.equal(result.kind, 'provider_success_unverified');
  assert.equal('authorized' in result, false);
});
test('provider issuer mismatch on operation result blocks successful response', async () => {
  const { api } = setup(mockedApi([
    json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'SUCCESSO', chaveNfe: '1'.repeat(44), emitenteCnpj: B.cnpj }),
  ]));
  await assert.rejects(api.getOperation(A, actorA, 'op'), e => e.code === 'WLG_ISSUER_MISMATCH');
});
test('prolonged PROCESSANDO, ERRO and invalid remote responses are distinguished', async () => {
  const { api } = setup(mockedApi([
    json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }), json({ status: 'ERRO', motivoErro: 'Rejected by test' }),
    json({ status: 'SUCCESSO', chaveNfe: 'invalid' }),
  ]));
  assert.equal((await api.getOperation(A, actorA, 'x')).kind, 'processing');
  assert.equal((await api.getOperation(A, actorA, 'x')).kind, 'rejected');
  await assert.rejects(api.getOperation(A, actorA, 'x'), e => e.code === 'WLG_RESPONSE_INVALID');
});
test('default policy blocks all fiscal POSTs and production even if homologation enabled', async () => {
  let outbound = 0;
  const { api } = setup(async () => { outbound++; throw new Error('should not call'); });
  await assert.rejects(api.submitHomologation(A, actorA, command()), e => e.code === 'WLG_ISSUANCE_DISABLED');
  await withFlags(async () => {
    await assert.rejects(api.submitHomologation({ ...A, environment: 'producao' }, actorA, command()),
      e => e.code === 'WLG_ISSUANCE_DISABLED');
  });
  assert.equal(outbound, 0);
});
test('202 means processing; provider empresaId/env override not accepted from browser payload', async () => {
  await withFlags(async () => {
    const trace = [];
    const { api } = setup(mockedApi([
      json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
      json({ operationId: 'op-A', status: 'PROCESSANDO' }, 202),
    ], trace));
    await assert.rejects(api.submitHomologation(A, actorA, {
      ...command(), payload: { ...command().payload, empresaId: 'wlg-B' },
    }), e => e.code === 'WLG_PAYLOAD_INVALID');
    await assert.rejects(api.submitHomologation(A, actorA, command(B.cnpj)),
      e => e.code === 'WLG_ISSUER_MISMATCH');
    const result = await api.submitHomologation(A, actorA, command());
    assert.deepEqual(result, { kind: 'processing', operationId: 'op-A' });
    const sent = JSON.parse(trace[1].options.body);
    assert.equal(sent.empresaId, 'wlg-A');
    assert.equal(sent.tipoAmbiente, 2);
    assert.equal(trace[1].options.headers.Authorization, 'Bearer t');
  });
});
test('review, idempotency reservation and current UID are required', async () => {
  await withFlags(async () => {
    const { api } = setup(async () => { throw new Error('forbidden outbound'); });
    for (const patch of [
      { humanApprovalVerified: false }, { reservationId: '' },
      { reviewedIntentId: '' }, { reviewedByUid: 'another-user' },
    ]) {
      await assert.rejects(api.submitHomologation(A, actorA, { ...command(), ...patch }),
        e => e.code === 'WLG_REVIEW_REQUIRED');
    }
  });
});
test('POST remote 503 never retried; ambiguous timeout results in uncertain state', async () => {
  await withFlags(async () => {
    const trace = [];
    const { api } = setup(mockedApi([
      json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
      json({}, 503),
    ], trace));
    await assert.rejects(api.submitHomologation(A, actorA, command()), e => e.code === 'WLG_REMOTE_UNAVAILABLE');
    assert.equal(trace.filter(t => t.url.endsWith('/nfe')).length, 1);
    const { api: timed } = setup(mockedApi([
      json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
      new Error('uncertain network'),
    ]));
    await assert.rejects(timed.submitHomologation(A, actorA, command()),
      e => e.code === 'WLG_SUBMISSION_UNCERTAIN');
  });
});
test('XML downloaded is tenant-bound and rejected for issuer mismatch or ambiguity', async () => {
  const { api } = setup(mockedApi([
    json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 }),
    xml('11222333000181'), xml('11444777000161'), xml('11222333000181' + '<CNPJ>11444777000161'),
  ]));
  const key = '1'.repeat(44);
  assert.equal((await api.downloadXml(A, actorA, key)).verifiedIssuerCnpj, '11222333000181');
  await assert.rejects(api.downloadXml(A, actorA, key), e => e.code === 'WLG_ISSUER_MISMATCH');
  await assert.rejects(api.downloadXml(A, actorA, key), WlgError);
});
test('credential revocation invalidates scoped cached token', async () => {
  const trace = [];
  const { api } = setup(mockedApi([
    json({ accessToken: 'old', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
    json({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 3600 }),
    json({ status: 'PROCESSANDO' }),
  ], trace));
  await api.getOperation(A, actorA, 'x');
  api.revokeLocalToken(A);
  await api.getOperation(A, actorA, 'x');
  assert.equal(trace[3].options.headers.Authorization, 'Bearer new');
});
test('timeout aborts bounded GET and does not expose secrets or remote errors', async () => {
  const impl = async (url, options) => {
    if (String(url).endsWith('/auth/token'))
      return json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 });
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted SECRET')), { once: true });
    });
  };
  const { api } = setup(impl, { timeoutMs: 100 });
  await assert.rejects(api.getOperation(A, actorA, 'long'), e =>
    e.code === 'WLG_NETWORK_UNAVAILABLE' && !e.message.includes('SECRET'));
});
