import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { timingSafeEqual } from 'node:crypto';
import ts from 'typescript';

// Exercise the ACTUAL Next.js GET/POST handler, with external services replaced
// by deterministic fixtures. No Firebase credentials, paid calls, or Vercel.
const portalSource = readFileSync('app/api/billing/portal/route.ts', 'utf8');
const code = ts.transpileModule(portalSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness({ status = 'active', authorized = true, delayMs = 0 } = {}) {
  const stats = { directoryResolutions: 0, privilegedHistoryQueries: 0, providerCalls: 0 };
  const ledger = [{ referenceMonth: '2026-10', amountCents: 7000, dueDate: '2026-10-30', status: 'pending' }];
  const dependencies = {
    'node:crypto': { timingSafeEqual },
    '../../../../lib/server/platformBillingAdminStore': {
      BillingAdminError: class BillingAdminError extends Error { constructor(code, status = 403) { super(code); this.code = code; this.status = status; } },
      acceptNewCustomerRamp() { throw Error('not expected in billing portal efficiency GET test'); },
      readSectorBillingAccess() { throw Error('access engine not under test here'); },
      requestSectorGrace48() { throw Error('grace engine not under test here'); },
      createSectorSubscriptionCheckout() { throw Error('checkout must not run in this test'); },
      reconcileSectorSubscriptionPayment() { throw Error('payment must not run in this test'); },
      reconcileInfinitePayWebhook() { throw Error('webhook must not run in this test'); },
    },
    'next/server': {
      NextResponse: {
        json(value, options = {}) {
          return { status: options.status ?? 200, body: value, headers: options.headers };
        },
      },
    },
    '../../../../lib/server/billingPortalIdentity': {
      BillingPortalFailure: class BillingPortalFailure extends Error {
        constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
      },
      async resolveBillingPortalSession() {
        stats.directoryResolutions++;
        if (!authorized) {
          const err = new Error('BILLING_AUTH_REQUIRED');
          err.code = 'BILLING_AUTH_REQUIRED';
          err.status = 401;
          // Same outcome as a real denied auth: no ledger fetch.
          throw err;
        }
        return { uid: 'uid-a', email: 'a@example.com',
          workspace: { id: 'workspace-a', name: 'Workspace A' },
          account: { status, monthlyPriceCents: status === 'exempt' ? 0 : 7000 },
        };
      },
    },
    '../../../../lib/server/payments/infinitepayPortalPilot.mjs': {
      pilotEnabledFor() { return false; },
      pilotOrderForDate() { throw Error('pilot disabled'); },
      pilotCheckoutRequest() { throw Error('pilot disabled'); },
      readCheckoutUrl() { throw Error('pilot disabled'); },
      pilotReturnBelongsToSession() { return false; },
      verifyPilotResponse() { return { verified: false }; },
    },
    '../../../../lib/server/billingRecentCycles': {
      async readBillingCycleHistory() {
        stats.privilegedHistoryQueries++;
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { available: true, cycles: ledger };
      },
    },
    '../../../../lib/server/payments/infinitepayCheckout.mjs': {
      async callInfinitePay() { stats.providerCalls++; throw Error('must not call external provider'); },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw Error('Unexpected import: ' + name);
      return dependencies[name];
    },
    URL, Buffer, process: { env: {} }, setTimeout,
  }, { filename: 'app/api/billing/portal/route.ts' });
  return { handler: exports, stats };
}

test('payments tab never launches the privileged Firestore billing-cycle query', async () => {
  const { handler, stats } = harness();
  const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal?view=payments'));
  assert.equal(response.status, 200);
  assert.equal(response.body.history.available, false);
  assert.deepEqual(Array.from(response.body.history.cycles), []);
  assert.equal(response.body.pilot.enabled, false);
  assert.equal(stats.directoryResolutions, 1);
  assert.equal(stats.privilegedHistoryQueries, 0);
  assert.equal(stats.providerCalls, 0);
});

test('history tab still reads only the verified workspace ledger', async () => {
  const { handler, stats } = harness();
  const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal?view=history'));
  assert.equal(response.status, 200);
  assert.equal(response.body.history.available, true);
  assert.equal(response.body.history.cycles[0].referenceMonth, '2026-10');
  assert.equal(stats.privilegedHistoryQueries, 1);
  assert.equal(stats.providerCalls, 0);
});

test('historical API consumers without view keep their original behavior', async () => {
  const { handler, stats } = harness();
  const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal'));
  assert.equal(response.status, 200);
  assert.equal(stats.privilegedHistoryQueries, 1);
  assert.equal(response.body.history.cycles.length, 1);
});

test('exempt account never incurs a privileged ledger query', async () => {
  const { handler, stats } = harness({ status: 'exempt' });
  const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal?view=history'));
  assert.equal(response.status, 200);
  assert.equal(response.body.accountExempt, true);
  assert.equal(response.body.accountMonthlyCents, 0);
  assert.equal(stats.privilegedHistoryQueries, 0);
});

test('denied identity fails closed before querying financial records', async () => {
  const { handler, stats } = harness({ authorized: false });
  const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal?view=history'));
  assert.equal(response.status, 503); // unexpected stub errors fail closed, no payload leak
  assert.equal(response.body.code, 'BILLING_PORTAL_UNAVAILABLE');
  assert.equal(stats.privilegedHistoryQueries, 0);
  assert.equal(stats.providerCalls, 0);
});

test('unauthorized pilot and unrelated POST actions cannot call real payment provider', async () => {
  const { handler, stats } = harness();
  const create = await handler.POST(new Request('https://emprovex.com.br/api/billing/portal?action=create-pilot', {
    method: 'POST', body: JSON.stringify({ confirmRealPix: true, amountCents: 100 }),
  }));
  assert.equal(create.status, 403);
  assert.equal(create.body.code, 'PILOT_NOT_ENABLED');
  const unknown = await handler.POST(new Request('https://emprovex.com.br/api/billing/portal?action=paid', {
    method: 'POST',
  }));
  assert.equal(unknown.status, 404);
  assert.equal(stats.providerCalls, 0);
});

test('simulated repeated payment-tab views save all privileged history queries', async () => {
  const { handler, stats } = harness();
  for (let i = 0; i < 12; i++) {
    const response = await handler.GET(new Request('https://emprovex.com.br/api/billing/portal?view=payments'));
    assert.equal(response.status, 200);
  }
  assert.equal(stats.directoryResolutions, 12);
  assert.equal(stats.privilegedHistoryQueries, 0);
  // Baseline without view filtering: one privileged query per navigation (12).
  // This is a deterministic request-count comparison, NOT real network latency.
});

test('client cache is short-lived, scoped by Firebase UID and workspace, no persistent storage', () => {
  const panel = readFileSync('components/billing/InfinitePayPilotPanel.tsx', 'utf8');
  const readiness = readFileSync('components/billing/InfinitePayReadinessPanel.tsx', 'utf8');
  assert.match(panel, /auth\.currentUser\.uid \+ ':' \+ workspaceId/);
  assert.match(panel, /portalCacheRef\.current\.principal !== principal/);
  assert.match(panel, /age < 30_000/);
  assert.match(panel, /view=' \+ \(needsHistory \? 'history' : 'payments'\)/);
  assert.match(panel, /if \(needsHistory\) setHistory\(/);
  assert.match(panel, /verifiedKeyRef\.current = ''/);
  assert.match(readiness, /workspaceId=\{workspaceResolved \? context\.workspaceId : null\}/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB|setDoc\(|updateDoc\(/);
});

test('Firestore identity checks remain mandatory after parallelizing authorized reads', () => {
  const identity = readFileSync('lib/server/billingPortalIdentity.ts', 'utf8');
  assert.match(identity, /const \[workspaceData, billingData\] = await Promise\.all/);
  assert.match(identity, /firestoreGet\(token, 'workspaces', platformAccount\.workspaceId, fetchImpl\)/);
  assert.match(identity, /firestoreGet\(token, 'billingAccounts', platformAccount\.workspaceId, fetchImpl\)/);
  assert.match(identity, /validateBillingIdentity/);
  assert.match(identity, /BILLING_ACCOUNT_TENANT_MISMATCH/);
  assert.match(identity, /Bearer \$\{token\}/);
  assert.doesNotMatch(identity, /getGoogleAccessToken\(/);
});

test('unreleased future pricing is not present in any of the public subscription views', () => {
  const paths = [
    'components/billing/InfinitePayReadinessPanel.tsx',
    'components/billing/InfinitePayPilotPanel.tsx',
    'components/billing/BillingPortalShell.tsx',
    'app/regularizacao/page.tsx',
  ];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /Escalonamento previsto para novos clientes|Simular novo assinante|1º ao 3º|13º em diante/);
  }
});
