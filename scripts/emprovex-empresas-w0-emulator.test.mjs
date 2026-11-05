/**
 * W0 R1-M: exercita serviços reais de provisionamento/sessão/guard contra
 * Firebase Auth + Firestore Emulator em localhost (projeto demo-*).
 * Execute SOMENTE via firebase emulators:exec, nunca no projeto real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { decodeJwt } from 'jose';

const require = createRequire(import.meta.url);
const projectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || 'demo-emprovex-company-w0';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(projectId, /^demo-[a-z0-9-]+$/);
assert.equal(authHost, '127.0.0.1:9099');
assert.equal(firestoreHost, '127.0.0.1:8080');
assert.ok(!process.env.K_SERVICE && !process.env.VERCEL && !process.env.GAE_SERVICE);
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID = projectId;
process.env.EMPROVEX_E2E_SERVER_AUTH = '1';

const authRoot = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
const fsRoot = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents`;
const demoConfig = { projectId, apiKey: 'fake-emprovex-emulator', firestoreDatabaseId: '(default)' };
let intercept = (url, options) => globalThis.fetch(url, options);
const deps = {};
function loadTs(path, imports = {}) {
  const code = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    require(id) {
      if (Object.hasOwn(imports, id)) return imports[id];
      if (id.startsWith('node:')) return require(id);
      throw new Error(`Import inesperado de ${id} em ${path}`);
    },
    fetch: (url, options) => intercept(url, options),
    process,
    AbortSignal,
    TextEncoder,
    URL,
    URLSearchParams,
    Buffer,
    console,
  };
  runInNewContext(transpiled, context, { filename: path });
  return exports;
}
deps.identity = loadTs('lib/platformIdentity.ts');
deps.provision = loadTs('lib/companyProvisioning.ts', {
  './platformIdentity': deps.identity,
});
deps.serverProvision = loadTs('lib/server/companyProvisioningAdmin.ts', {
  '../../firebase-applet-config.json': demoConfig,
  '../companyProvisioning': deps.provision,
  '../platformIdentity': deps.identity,
  './sectorProvisioningAdmin': { getGoogleAccessToken: () => { throw new Error('REAL_GCP_FORBIDDEN'); } },
});

class StubFounderAuthError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
// O ID token é emitido pelo Auth Emulator; a checagem criptográfica de JWT
// do Next fica em lib/server/firebaseFounderAuth.ts e exige smoke HTTP separado.
// Aqui o lookup REAL do Auth Emulator na rotina de sessão confirma UID/status.
async function localVerifiedRequest(header) {
  if (!header?.startsWith('Bearer ')) throw new StubFounderAuthError('no token', 401);
  const idToken = header.slice(7);
  let payload;
  try { payload = decodeJwt(idToken); } catch { throw new StubFounderAuthError('bad token', 401); }
  if (
    payload.iss !== `https://securetoken.google.com/${projectId}`
    || payload.aud !== projectId || !payload.sub
    || typeof payload.exp !== 'number' || payload.exp <= Date.now() / 1000
    || payload.email_verified !== true
  ) throw new StubFounderAuthError('invalid token', 401);
  return {
    idToken, uid: payload.sub, email: deps.identity.normalizePlatformEmail(payload.email),
    signInProvider: payload.firebase?.sign_in_provider || '',
  };
}
deps.session = loadTs('lib/server/companySession.ts', {
  '../../firebase-applet-config.json': demoConfig,
  '../platformIdentity': deps.identity,
  './firebaseFounderAuth': {
    FounderAuthError: StubFounderAuthError,
    verifyFirebaseRequest: localVerifiedRequest,
  },
  './sectorProvisioningAdmin': { getGoogleAccessToken: () => { throw new Error('REAL_GCP_FORBIDDEN'); } },
});
deps.contracts = loadTs('lib/company/contracts/index.ts', {
  '../../platformIdentity': deps.identity,
});
deps.guard = loadTs('lib/server/companyAuthz/index.ts', {
  '../../company/contracts': deps.contracts,
  '../companySession': deps.session,
});

async function emulatorJson(url, body, method = 'POST') {
  const response = await globalThis.fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`EMULATOR_${response.status}: ${JSON.stringify(value).slice(0,300)}`);
  return value;
}
function cnpj(base) {
  const digit = (s, weights) => {
    const sum = [...s].reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return String(mod < 2 ? 0 : 11 - mod);
  };
  const first = base + digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first + digit(first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}
function fixture(n, workspaceId = `company-demo-${n}`, email = `company-${n}@example.invalid`, tax = cnpj(String(112223330000 + n))) {
  return {
    workspaceId, legalName: `Empresa Demo ${n}`, cnpj: tax,
    responsibleName: 'Responsável Demo', authorizedEmail: email,
    initialPassword: 'FakePassDemoW0-2026!', city: 'Cidade Demo', state: 'RS',
  };
}
const founder = { uid: 'founder-demo-uid', email: 'founder@example.invalid' };
function request(token) {
  return new Request('http://localhost/api/company/resource', {
    headers: token ? { authorization: 'Bearer ' + token } : {},
  });
}
async function signIn(email) {
  const signed = await emulatorJson(
    `${authRoot}/accounts:signInWithPassword?key=${demoConfig.apiKey}`,
    { email, password: 'FakePassDemoW0-2026!', returnSecureToken: true }
  );
  assert.ok(signed.idToken && signed.localId);
  return signed;
}
async function authDirectory() {
  const response = await globalThis.fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`);
  assert.equal(response.status, 200);
  const data = await response.json();
  return data.users || [];
}
async function updateDoc(path, fields) {
  const params = new URLSearchParams();
  for (const key of Object.keys(fields)) params.append('updateMask.fieldPaths', key);
  return emulatorJson(
    `${fsRoot}/${path}?${params.toString()}`,
    { fields: Object.fromEntries(Object.entries(fields).map(([key, val]) => [key, { stringValue: val }])) },
    'PATCH',
  );
}

test('pilot OFF: nem reserva, nem Auth, nem API empresarial', async () => {
  process.env.EMPROVEX_COMPANY_PILOT_ENABLED = '0';
  const baseline = (await authDirectory()).length;
  await assert.rejects(deps.serverProvision.provisionCompanyWorkspaceWithAuth(fixture(1), founder),
    error => error.code === 'PILOT_DISABLED' && error.httpStatus === 503);
  await assert.rejects(deps.guard.requireCompanyContext(request(), { action: 'publicCustomers:read' }),
    error => error.code === 'COMPANY_PILOT_DISABLED' && error.status === 503);
  assert.equal((await authDirectory()).length, baseline);
});

let a, b, tokenA, tokenB;
test('piloto ON: empresas A/B criadas e autenticadas via Auth Emulator + Firestore', async () => {
  process.env.EMPROVEX_COMPANY_PILOT_ENABLED = '1';
  a = await deps.serverProvision.provisionCompanyWorkspaceWithAuth(fixture(2), founder);
  b = await deps.serverProvision.provisionCompanyWorkspaceWithAuth(fixture(3), founder);
  assert.notEqual(a.account.firebaseUid, b.account.firebaseUid);
  assert.notEqual(a.account.workspaceId, b.account.workspaceId);
  tokenA = (await signIn(a.account.email)).idToken;
  tokenB = (await signIn(b.account.email)).idToken;
  const ctxA = await deps.session.verifyCompanySession('Bearer ' + tokenA);
  const ctxB = await deps.session.verifyCompanySession('Bearer ' + tokenB);
  assert.equal(ctxA.workspaceId, a.account.workspaceId);
  assert.equal(ctxB.workspaceId, b.account.workspaceId);
  assert.equal(ctxA.firebaseUid, a.account.firebaseUid);
});

test('guard nega IDOR A/B, titular errado e papéis não concedidos pelo cliente', async () => {
  const allowed = await deps.guard.requireCompanyContext(request(tokenA), {
    action: 'customerOrders:read', companyId: a.account.workspaceId,
    resource: { companyId: a.account.workspaceId, workspaceId: a.account.workspaceId },
  });
  assert.equal(allowed.role, 'owner');
  assert.equal(allowed.rootPath, 'supplierCompanyWorkspaces/' + a.account.workspaceId);
  await assert.rejects(deps.guard.requireCompanyContext(request(tokenA), {
    action: 'customerOrders:write', resource: { companyId: b.account.workspaceId },
  }), e => e.code === 'COMPANY_SCOPE_FORBIDDEN' && e.status === 403);
  await assert.rejects(deps.guard.requireCompanyContext(request(tokenB), {
    action: 'documents:read', companyId: a.account.workspaceId,
  }), e => e.code === 'COMPANY_SCOPE_FORBIDDEN');
  await assert.rejects(deps.guard.requireCompanyContext(request(tokenA), {
    action: 'documents:write', requireCreator: true,
    resource: { companyId: a.account.workspaceId, createdByUid: b.account.firebaseUid },
  }), e => e.code === 'COMPANY_SCOPE_FORBIDDEN');
  assert.equal(deps.contracts.companyDocumentPath(a.account.workspaceId, 'documents', 'demo-1'),
    `supplierCompanyWorkspaces/${a.account.workspaceId}/documents/demo-1`);
  assert.throws(() => deps.contracts.companyDocumentPath(a.account.workspaceId, 'documents', '../other'));
});

test('401, timeout 503, sem escalada para setor', async () => {
  await assert.rejects(deps.guard.requireCompanyContext(request(), { action: 'documents:read' }),
    e => e.status === 401);
  const prior = intercept;
  try {
    intercept = (url, options) => {
      if (String(url).includes('/platformAccounts/')) throw new DOMException('timeout', 'TimeoutError');
      return globalThis.fetch(url, options);
    };
    await assert.rejects(deps.guard.requireCompanyContext(request(tokenA), {
      action: 'documents:read',
    }), e => e.status === 503);
  } finally {
    intercept = prior;
  }
});

test('conta suspensa e divergência de UID são negadas com 403', async () => {
  await updateDoc('workspaces/' + a.account.workspaceId, { status: 'disabled' });
  await assert.rejects(deps.guard.requireCompanyContext(request(tokenA), {
    action: 'company:read',
  }), e => e.status === 403);
  await updateDoc('platformAuthUidIndex/' + b.account.firebaseUid, {
    workspaceId: a.account.workspaceId,
  });
  await assert.rejects(deps.guard.requireCompanyContext(request(tokenB), {
    action: 'company:read',
  }), e => e.status === 403);
});

test('cadastros simultâneos mesmo CNPJ/e-mail/workspace são serializados sem Auth órfão', async () => {
  const cases = [
    [fixture(11), fixture(11)],
    [fixture(12), fixture(13, 'company-demo-13', 'company-12@example.invalid')],
    [fixture(14), fixture(15, 'company-demo-15', 'company-15@example.invalid', cnpj(String(112223330014)))],
    [fixture(16), fixture(17, 'company-demo-16')],
  ];
  for (const [left, right] of cases) {
    const before = (await authDirectory()).length;
    const settled = await Promise.allSettled([
      deps.serverProvision.provisionCompanyWorkspaceWithAuth(left, founder),
      deps.serverProvision.provisionCompanyWorkspaceWithAuth(right, founder),
    ]);
    assert.equal(settled.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(settled.filter(x => x.status === 'rejected').length, 1);
    assert.equal((await authDirectory()).length, before + 1);
  }
});

test('falha de commit após Auth: rollback impede usuário órfão', async () => {
  const candidate = fixture(21);
  const baseline = (await authDirectory()).length;
  const prior = intercept;
  let inject = true;
  try {
    intercept = async (url, options) => {
      if (
        inject && String(url).endsWith(':commit')
        && String(options?.body || '').includes('platformAuthUidIndex/')
      ) {
        inject = false;
        return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'injected commit failure' } }),
          { status: 503, headers: { 'content-type': 'application/json' } });
      }
      return globalThis.fetch(url, options);
    };
    await assert.rejects(deps.serverProvision.provisionCompanyWorkspaceWithAuth(candidate, founder),
      e => e.code === 'UPSTREAM_ERROR' || e.code === 'RECOVERY_REQUIRED');
  } finally {
    intercept = prior;
  }
  assert.equal((await authDirectory()).length, baseline,
    'O cadastro falho não pode deixar usuário Auth ativo ou órfão.');
});
