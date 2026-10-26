import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  prepareIsolatedPixTest, readCheckoutUrl,
  makePixCheckFromReturn, assessIsolatedPixResult,
  SMOKE_REDIRECT_URL,
} from '../lib/server/payments/infinitepaySmokeHarness.mjs';

const prep = () => prepareIsolatedPixTest({
  workspaceId: 'test-workspace-controlled-by-owner',
  amountCents: 100,
  now: new Date('2026-10-25T15:00:00.000Z'),
  secret: 'isolated-test-fixture-entropy-01234567890123',
});
const redirect = (state, overrides = {}) => {
  const query = new URLSearchParams({
    order_nsu: state.orderNsu,
    transaction_nsu: 'uuid-test-123',
    slug: 'slug-test-456',
    capture_method: 'pix',
    ...overrides,
  });
  return SMOKE_REDIRECT_URL + '?' + query;
};

test('isolated payment has one realistic Pix-priced item, no app status changes', () => {
  const value = prep();
  assert.equal(value.state.amountCents, 100);
  assert.equal(value.request.items[0].price, 100);
  assert.equal(value.request.items[0].quantity, 1);
  assert.match(value.request.items[0].description, /teste tecnico/);
  assert.match(value.request.items[0].description, /sem assinatura/);
  assert.equal(value.request.options.single_payment, true);
  assert.deepEqual(value.request.options.payment_methods_enabled, ['pix']);
  assert.equal(value.request.webhook, undefined);
  assert.equal(value.request.redirect_url, SMOKE_REDIRECT_URL);
  assert.equal(value.state.mode, 'isolated_infinitepay_pix_smoke');
  assert.equal(value.state.status, 'prepared');
  assert.equal(value.state.pricingPolicyId, undefined);
  assert.equal(value.state.checkoutUrl, undefined);
  assert.equal(value.state.workspaceFingerprint.length, 64);
  assert.doesNotMatch(JSON.stringify(value), /test-workspace-controlled-by-owner/);
});

test('each test uses an independent opaque NSU and time-limited checkout', () => {
  const first = prep();
  const second = prepareIsolatedPixTest({
    workspaceId: 'test-workspace-controlled-by-owner',
    amountCents: 100,
    now: new Date('2026-10-25T15:00:00.000Z'),
    secret: 'an-independent-test-secret-01234567890123',
  });
  assert.notEqual(first.state.orderNsu, second.state.orderNsu);
  assert.match(first.state.orderNsu, /^epx-202610-[a-f0-9]{24}$/);
  assert.equal(Date.parse(first.state.validUntil) - Date.parse(first.state.createdAt), 30 * 60_000);
});

test('amount has tight range; arbitrary input and workspace injection are rejected', () => {
  for (const amountCents of [-1, 0, 99, 2991, 100.5, '100']) {
    assert.throws(() => prepareIsolatedPixTest({ workspaceId: 'test', amountCents }));
  }
  assert.equal(prepareIsolatedPixTest({ workspaceId: 'test', amountCents: 2990 }).request.items[0].price, 2990);
  for (const workspaceId of ['', '../test', 'teste com espaco', 'x'.repeat(121)]) {
    assert.throws(() => prepareIsolatedPixTest({ workspaceId }));
  }
});

test('provider checkout link is accepted only from trusted HTTPS InfinitePay hosts', () => {
  assert.equal(readCheckoutUrl({ url: 'https://checkout.infinitepay.io/link/123' }),
    'https://checkout.infinitepay.io/link/123');
  assert.equal(readCheckoutUrl({ data: { checkout_url: 'https://www.infinitepay.io/pay/123' } }),
    'https://www.infinitepay.io/pay/123');
  assert.equal(readCheckoutUrl({ url: 'https://checkout.infinitepay.com.br/pay/123' }),
    'https://checkout.infinitepay.com.br/pay/123');
  for (const url of [
    'http://checkout.infinitepay.io/link', 'https://infinitepay.io.evil.example/fake',
    'https://user:pass@checkout.infinitepay.io/test', 'https://attacker.example/checkout',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => readCheckoutUrl({ url }));
  }
  assert.throws(() => readCheckoutUrl({ success: true }));
});

test('return URL is correlated to the exact locally saved order', () => {
  const { state } = prep();
  const result = makePixCheckFromReturn({
    state,
    returnUrl: redirect(state),
    handle: 'infinite-tag',
  });
  assert.deepEqual(result.checkRequest, {
    handle: 'infinite-tag',
    order_nsu: state.orderNsu,
    transaction_nsu: 'uuid-test-123',
    slug: 'slug-test-456',
  });
  assert.equal(result.amountCents, 100);
  assert.match(result.transactionFingerprint, /^[a-f0-9]{64}$/);
});

test('forged/malformed callback cannot invoke authenticated check', () => {
  const { state } = prep();
  for (const url of [
    'https://evil.example/regularizacao?' + new URL(redirect(state)).searchParams,
    'http://emprovex.com.br/regularizacao?' + new URL(redirect(state)).searchParams,
    redirect(state).replace('/regularizacao', '/fake'),
    redirect(state, { order_nsu: 'epx-202610-' + 'a'.repeat(24) }),
    redirect(state, { transaction_nsu: '' }),
    redirect(state, { slug: '../not-safe' }),
  ]) {
    assert.throws(() => makePixCheckFromReturn({ state, returnUrl: url, handle: 'valid-handle' }));
  }
  assert.throws(() => makePixCheckFromReturn({ state, returnUrl: redirect(state), handle: 'invalid @ tag' }));
});

test('copying the original checkout URL yields an actionable error and no payment check', () => {
  const { state } = prep();
  assert.throws(
    () => makePixCheckFromReturn({
      state,
      returnUrl: 'https://checkout.infinitepay.io/example-tag/example-token',
      handle: 'example-tag',
    }),
    /link inicial do checkout.*Nao pague novamente.*Continuar/
  );
});

test('provider must confirm exact amount, Pix method and paid status', () => {
  const valid = {
    success: true, paid: true, amount: 100, paid_amount: 100,
    capture_method: 'pix',
  };
  assert.deepEqual(assessIsolatedPixResult({ amountCents: 100, paymentCheck: valid }),
    { verified: true, reason: 'PIX_CONFIRMED_WITH_PROVIDER' });
  for (const paymentCheck of [
    { ...valid, paid: false }, { ...valid, success: false },
    { ...valid, amount: 200 }, { ...valid, paid_amount: 50 },
    { ...valid, capture_method: 'credit_card' },
  ]) {
    assert.equal(assessIsolatedPixResult({ amountCents: 100, paymentCheck }).verified, false);
  }
});

test('CLI dry-run requires no key and never reaches provider', () => {
  const out = spawnSync(process.execPath, [
    'scripts/infinitepay-live-smoke.mjs', 'dry-run',
    '--workspace', 'test-workspace-controlled-by-owner',
    '--amount-cents', '100',
  ], { encoding: 'utf8', timeout: 8_000, env: { ...process.env, INFINITEPAY_API_KEY: '' } });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /DRY_RUN_NO_NETWORK/);
  assert.match(out.stdout, /"willCallInfinitePay": false/);
  assert.match(out.stdout, /"willModifyBilling": false/);
});

test('CLI create refuses network requests without explicit authorization', () => {
  const out = spawnSync(process.execPath, [
    'scripts/infinitepay-live-smoke.mjs', 'create',
    '--workspace', 'test-workspace-controlled-by-owner',
    '--amount-cents', '100',
  ], { encoding: 'utf8', timeout: 8_000, env: { ...process.env, INFINITEPAY_API_KEY: '' } });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /--authorize-real-pix-test/);
  assert.doesNotMatch(out.stdout, /CHECKOUT CRIADO/);
});
