import assert from 'node:assert/strict';
import test from 'node:test';
import {
  makeOrderNsu,
  buildCheckoutRequest,
  classifyPaymentNotification,
  eventFingerprint,
  assessPaymentCheck,
  callInfinitePay,
} from '../lib/server/payments/infinitepayCheckout.mjs';

const FIXTURE = {
  workspaceId: 'workspace-with-sensitive-ug',
  referenceMonth: '2026-11',
  orderIdSecret: 'super-long-test-only-secret-0000000000000000',
};
const orderNsu = makeOrderNsu(FIXTURE);
const request = () => buildCheckoutRequest({
  orderNsu,
  referenceMonth: FIXTURE.referenceMonth,
  amountCents: 7000,
  redirectUrl: 'https://emprovex.com.br/regularizacao',
  webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
  validUntil: '2027-01-10T23:59:00-03:00',
});

test('external order is stable and conceals internal workspace identity', () => {
  assert.equal(makeOrderNsu(FIXTURE), orderNsu);
  assert.match(orderNsu, /^epx-202611-[a-f0-9]{24}$/);
  assert.equal(orderNsu.includes(FIXTURE.workspaceId), false);
  assert.notEqual(makeOrderNsu({ ...FIXTURE, workspaceId: 'another' }), orderNsu);
  assert.notEqual(makeOrderNsu({ ...FIXTURE, referenceMonth: '2026-12' }), orderNsu);
});

test('order generation rejects weak secret, missing workspace and invalid month', () => {
  assert.throws(() => makeOrderNsu({ ...FIXTURE, orderIdSecret: 'short' }));
  assert.throws(() => makeOrderNsu({ ...FIXTURE, workspaceId: '' }));
  assert.throws(() => makeOrderNsu({ ...FIXTURE, referenceMonth: '2026-13' }));
});

test('checkout request charges the real SaaS and limits each link to one payment', () => {
  const value = request();
  assert.equal(value.items.length, 1);
  assert.equal(value.items[0].price, 7000);
  assert.match(value.items[0].description, /Plano Completo/);
  assert.equal(value.options.single_payment, true);
  assert.deepEqual(value.webhook.events, ['paid', 'settled', 'refunded', 'canceled', 'payment_failed']);
  assert.equal(JSON.stringify(value).includes(FIXTURE.workspaceId), false);
});

test('checkout rejects invalid values and insecure URLs', () => {
  const input = {
    orderNsu,
    referenceMonth: FIXTURE.referenceMonth,
    amountCents: 7000,
    redirectUrl: 'https://emprovex.com.br/regularizacao',
    webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
    validUntil: '2027-01-10T23:59:00-03:00',
  };
  assert.throws(() => buildCheckoutRequest({ ...input, amountCents: 70.5 }));
  assert.throws(() => buildCheckoutRequest({ ...input, redirectUrl: 'http://emprovex.com.br' }));
  assert.throws(() => buildCheckoutRequest({ ...input, webhookUrl: 'https://user:secret@emprovex.com.br' }));
  assert.throws(() => buildCheckoutRequest({ ...input, referenceMonth: '2026-12' }));
  assert.throws(() => buildCheckoutRequest({ ...input, validUntil: 'tomorrow' }));
});

test('webhook event is only a signal and never proof of payment', () => {
  const value = classifyPaymentNotification({
    event: 'paid', order_nsu: orderNsu, transaction_nsu: 'transaction-01',
  });
  assert.equal(value.accepted, true);
  assert.equal(value.needsAuthenticatedReconciliation, true);
  assert.equal(value.mayAutoGrantAccess, false);
});

test('unknown webhook data are rejected fail-closed', () => {
  assert.equal(classifyPaymentNotification(null).accepted, false);
  assert.equal(classifyPaymentNotification({ event: 'paid', order_nsu: orderNsu }).accepted, false);
  assert.equal(classifyPaymentNotification({
    event: 'paid', order_nsu: 'random', transaction_nsu: 'tx',
  }).accepted, false);
  assert.equal(classifyPaymentNotification({
    event: 'grant_admin', order_nsu: orderNsu, transaction_nsu: 'tx',
  }).accepted, false);
});

test('event fingerprint is deterministic and differs per event and transaction', () => {
  const base = { orderNsu, transactionNsu: 'tx-1', event: 'paid' };
  assert.equal(eventFingerprint(base), eventFingerprint(base));
  assert.notEqual(eventFingerprint(base), eventFingerprint({ ...base, event: 'refunded' }));
  assert.notEqual(eventFingerprint(base), eventFingerprint({ ...base, transactionNsu: 'tx-2' }));
});

test('authenticated paid result must match full amount and payment method', () => {
  const check = { success: true, paid: true, amount: 7000, paid_amount: 7000, capture_method: 'pix' };
  assert.deepEqual(assessPaymentCheck({ amountCents: 7000, paymentCheck: check }),
    { verified: true, reason: 'PAID_VERIFIED' });
  assert.equal(assessPaymentCheck({ amountCents: 7000, paymentCheck: { ...check, paid: false } }).verified, false);
  assert.equal(assessPaymentCheck({ amountCents: 7000, paymentCheck: { ...check, success: false } }).verified, false);
  assert.equal(assessPaymentCheck({ amountCents: 7000, paymentCheck: { ...check, amount: 6000 } }).verified, false);
  assert.equal(assessPaymentCheck({ amountCents: 7000, paymentCheck: { ...check, paid_amount: 4000 } }).verified, false);
  assert.equal(assessPaymentCheck({ amountCents: 7000, paymentCheck: { ...check, capture_method: 'other' } }).verified, false);
});

test('no external request is possible unless explicitly enabled', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(callInfinitePay({
    operation: 'links', apiKey: 'inchk_test_key_123456789', payload: request(), fetchImpl,
  }), /disabled/);
  assert.equal(calls, 0);
});

test('explicit mock checkout uses official URL, method and auth header', async () => {
  let requested;
  const fetchImpl = async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => ({ mock: true }) };
  };
  const result = await callInfinitePay({
    operation: 'links',
    apiKey: 'inchk_test_key_123456789',
    payload: request(),
    allowExternalCall: true,
    fetchImpl,
  });
  assert.deepEqual(result, { mock: true });
  assert.equal(requested.url, 'https://api.checkout.infinitepay.io/links');
  assert.equal(requested.options.method, 'POST');
  assert.equal(requested.options.headers['X-Api-Key'], 'inchk_test_key_123456789');
  assert.equal(JSON.parse(requested.options.body).items[0].price, 7000);
});

test('failed third-party responses never echo upstream secrets', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'secret_token_here' });
  await assert.rejects(
    callInfinitePay({
      operation: 'payment_check',
      apiKey: 'inchk_test_key_123456789',
      payload: { order_nsu: orderNsu },
      allowExternalCall: true,
      fetchImpl,
    }),
    (error) => !String(error).includes('secret_token_here')
  );
});
