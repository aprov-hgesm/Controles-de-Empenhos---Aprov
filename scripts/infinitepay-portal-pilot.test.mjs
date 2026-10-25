import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pilotEnabledFor, pilotOrderForDate, pilotReturnBelongsToSession,
  pilotCheckoutRequest, verifyPilotResponse, PILOT_CENTS,
} from '../lib/server/payments/infinitepayPortalPilot.mjs';

const env = () => ({
  INFINITEPAY_PILOT_ENABLED: '1',
  INFINITEPAY_PILOT_EMAIL: 'owner@example.com',
  INFINITEPAY_PILOT_WORKSPACE: 'test-sector',
  INFINITEPAY_API_KEY: 'a'.repeat(38),
  INFINITEPAY_HANDLE: 'testhandle',
  INFINITEPAY_ORDER_SECRET: 's'.repeat(64),
});
const session = { email: 'owner@example.com', workspaceId: 'test-sector' };

test('pilot is disabled without explicit env flag, allowlist and secret configuration', () => {
  for (const patch of [
    { INFINITEPAY_PILOT_ENABLED: '0' },
    { INFINITEPAY_PILOT_EMAIL: 'other@example.com' },
    { INFINITEPAY_PILOT_WORKSPACE: 'other-tenant' },
    { INFINITEPAY_API_KEY: '' },
    { INFINITEPAY_HANDLE: '' },
    { INFINITEPAY_ORDER_SECRET: '' },
  ]) {
    assert.equal(Boolean(pilotEnabledFor({ ...session, env: { ...env(), ...patch } })), false);
  }
  assert.equal(Boolean(pilotEnabledFor({ ...session, env: env() })), true);
});

test('pilot never lets caller select any amount or exposes tenant in provider order', () => {
  const now = new Date('2026-10-25T12:00:00.000Z');
  const order = pilotOrderForDate({ uid: 'uid-x', workspaceId: 'test-sector', env: env(), now });
  const req = pilotCheckoutRequest({ orderNsu: order, now });
  assert.equal(req.items[0].price, PILOT_CENTS);
  assert.equal(PILOT_CENTS, 100);
  assert.match(req.items[0].description, /teste tecnico de Pix, sem assinatura/);
  assert.equal(req.options.single_payment, true);
  assert.deepEqual(req.options.payment_methods_enabled, ['pix']);
  assert.doesNotMatch(order, /test-sector|uid-x|owner/);
  assert.equal(req.redirect_url, 'https://emprovex.com.br/regularizacao');
  assert.equal(req.webhook, undefined);
});

test('pilot return is bound to signed in UID and workspace even after midnight', () => {
  const yesterday = new Date('2026-10-24T23:55:00.000Z');
  const orderNsu = pilotOrderForDate({ uid: 'uid-x', workspaceId: 'test-sector', env: env(), now: yesterday });
  const args = { orderNsu, uid: 'uid-x', workspaceId: 'test-sector', env: env(), now: new Date('2026-10-25T00:05:00.000Z') };
  assert.equal(pilotReturnBelongsToSession(args), true);
  assert.equal(pilotReturnBelongsToSession({ ...args, uid: 'uid-y' }), false);
  assert.equal(pilotReturnBelongsToSession({ ...args, workspaceId: 'other-sector' }), false);
  assert.equal(pilotReturnBelongsToSession({ ...args, orderNsu: 'epx-202610-'.padEnd(35,'a') }), false);
});

test('verify never gives subscription settlement even for a genuinely paid Pix', () => {
  const correct = { success: true, paid: true, amount: 100, paid_amount: 100, capture_method: 'pix' };
  assert.deepEqual(verifyPilotResponse({ paymentCheck: correct }), {
    verified: true, code: 'PILOT_PIX_AUTHENTICATED', affectsBilling: false,
  });
  for (const bad of [
    { ...correct, paid: false }, { ...correct, paid_amount: 99 },
    { ...correct, amount: 200 }, { ...correct, capture_method: 'credit_card' },
  ]) {
    assert.equal(verifyPilotResponse({ paymentCheck: bad }).verified, false);
  }
});

test('API endpoints keep explicit user opt-in and no Firestore billing modifications', async () => {
  const { readFile } = await import('node:fs/promises');
  const create = await readFile('app/api/billing/pilot-checkout/route.ts', 'utf8');
  const verify = await readFile('app/api/billing/pilot-verify/route.ts', 'utf8');
  const portal = await readFile('app/api/billing/portal/route.ts', 'utf8');
  const identity = await readFile('lib/server/billingPortalIdentity.ts', 'utf8');
  assert.match(create, /confirmRealPix !== true/);
  assert.match(create, /resolveBillingPortalSession\(request\)/);
  assert.match(create, /pilotEnabledFor/);
  assert.match(verify, /pilotReturnBelongsToSession/);
  assert.match(verify, /callInfinitePay/);
  assert.match(identity, /platformAccounts/);
  assert.match(identity, /workspaces/);
  assert.match(identity, /billingAccounts/);
  assert.doesNotMatch(create + verify + portal, /setDoc\(|writeBatch\(|runTransaction\(|commitVerifiedSettlementWithStore/);
});

test('UI does not silently create a real checkout and requires consent', async () => {
  const { readFile } = await import('node:fs/promises');
  const panel = await readFile('components/billing/InfinitePayPilotPanel.tsx', 'utf8');
  assert.match(panel, /data-testid="infinitepay-pilot-consent"/);
  assert.match(panel, /if \(!confirmed \|\| busy \|\| checkout \|\| !available\) return/);
  assert.match(panel, /setCheckout\(result\)/);
  assert.match(panel, /settlesSubscription: false/);
  assert.match(panel, /auth\.currentUser/);
  assert.match(panel, /'Authorization'|Authorization:/);
});
