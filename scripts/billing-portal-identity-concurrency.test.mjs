import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { validateBillingIdentity } from '../lib/billing/billingWorkspaceIdentity.mjs';

// Transpile the real server resolver to CJS so only the remote Firebase service
// is replaced with a deterministic, no-network fake. The real tenant-domain
// validator is used, unlike source-regex-only tests.
const code = ts.transpileModule(
  readFileSync('lib/server/billingPortalIdentity.ts', 'utf8'),
  { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, resolveJsonModule: true,
  }},
).outputText;
const token = 'a'.repeat(180);
const principal = 'client@example.com';
const workspaceId = 'workspace-a';
const project = 'emprovex-fixture';

const workspace = { id: workspaceId, status: 'active', authorizedEmail: principal, ug: '123456' };
const directory = {
  accountType: 'sector', status: 'active', authProvider: 'password',
  email: principal, firebaseUid: 'uid-a', workspaceId, ug: '123456',
};
const billing = { workspaceId, authorizedEmail: principal, ug: '123456', status: 'active', monthlyPriceCents: 7000 };

function encodeDoc(source) {
  return { fields: Object.fromEntries(Object.entries(source).map(([key, value]) =>
    [key, typeof value === 'string' ? { stringValue: value }
      : typeof value === 'boolean' ? { booleanValue: value }
        : { integerValue: String(value) }])) };
}

function harness({ workspaceOverride = {}, accountOverride = {} } = {}) {
  const calls = [];
  const pending = {};
  const modules = {
    'jose': { decodeJwt() { return {
      aud: project, iss: 'https://securetoken.google.com/' + project,
      sub: 'uid-a', email: principal, email_verified: true,
      firebase: { sign_in_provider: 'password' },
    }; }},
    '../../firebase-applet-config.json': {
      projectId: project, apiKey: 'public-firebase-client-key', firestoreDatabaseId: '(default)',
    },
    '../platformIdentity': {
      normalizePlatformEmail(value) { return String(value || '').trim().toLowerCase(); },
    },
    '../billing/billingWorkspaceIdentity.mjs': { validateBillingIdentity },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (!Object.hasOwn(modules, name)) throw Error('Unexpected import: ' + name);
      return modules[name];
    },
    URL, console,
  }, { filename: 'lib/server/billingPortalIdentity.ts' });
  const fakeFetch = async (url, options) => {
    calls.push({ url, auth: options?.headers?.authorization });
    if (url.includes('accounts:lookup')) {
      assert.equal(options.method, 'POST');
      assert.equal(JSON.parse(options.body).idToken, token);
      return { ok: true, json: async () => ({
        users: [{ localId: 'uid-a', email: principal, emailVerified: true, disabled: false }],
      }) };
    }
    const document = decodeURIComponent(url.split('/').at(-1));
    if (url.includes('/platformAccounts/')) {
      assert.equal(document, principal);
      assert.equal(options.headers.authorization, 'Bearer ' + token);
      return { ok: true, json: async () => encodeDoc(directory) };
    }
    if (url.includes('/workspaces/')) {
      assert.equal(document, workspaceId);
      assert.equal(options.headers.authorization, 'Bearer ' + token);
      return new Promise((resolve) => {
        pending.workspace = () => resolve({ ok: true, json: async () => encodeDoc({ ...workspace, ...workspaceOverride }) });
        if (pending.billing) { pending.workspace(); pending.billing(); }
      });
    }
    if (url.includes('/billingAccounts/')) {
      assert.equal(document, workspaceId);
      assert.equal(options.headers.authorization, 'Bearer ' + token);
      return new Promise((resolve) => {
        pending.billing = () => resolve({ ok: true, json: async () => encodeDoc({ ...billing, ...accountOverride }) });
        if (pending.workspace) { pending.workspace(); pending.billing(); }
      });
    }
    throw Error('unexpected remote request: ' + url);
  };
  return { resolve: () => exports.resolveBillingPortalSession(new Request('https://emprovex.com.br/api/billing/portal', {
    headers: { authorization: 'Bearer ' + token },
  }), { fetchImpl: fakeFetch }), calls };
}

async function bounded(promise) {
  return await Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Error('Parallel reads failed to start together')), 1000)),
  ]);
}

test('actual identity resolver starts account-linked workspace and billing reads concurrently', async () => {
  const scenario = harness();
  const result = await bounded(scenario.resolve());
  assert.equal(result.uid, 'uid-a');
  assert.equal(result.workspace.id, workspaceId);
  assert.equal(result.account.workspaceId, workspaceId);
  assert.equal(scenario.calls.length, 4); // auth lookup + directory + 2 concurrent reads
  assert.equal(scenario.calls.filter((c) => c.auth === 'Bearer ' + token).length, 3);
});

test('real validator refuses unauthorized workspace even after parallel reads', async () => {
  const scenario = harness({ workspaceOverride: { authorizedEmail: 'other@example.com' } });
  await assert.rejects(bounded(scenario.resolve()), (error) => error.code === 'BILLING_IDENTITY_MISMATCH');
  assert.equal(scenario.calls.length, 4);
});

test('parallel billing read cannot leak a billing document from a different workspace', async () => {
  const scenario = harness({ accountOverride: { workspaceId: 'other-workspace' } });
  await assert.rejects(bounded(scenario.resolve()), (error) => error.code === 'BILLING_ACCOUNT_TENANT_MISMATCH');
  assert.equal(scenario.calls.length, 4);
});
