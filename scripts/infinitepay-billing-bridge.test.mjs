import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareWorkspaceCheckout,
  prepareVerification,
  planVerifiedSettlement,
  planFinancialException,
} from '../lib/server/payments/infinitepayBillingBridge.mjs';

const NOW = '2026-10-25T15:00:00.000Z';
const SECRET = 'test-only-synthetic-order-secret-123456789012';
const CONFIG = {
  billingMode: 'observe', requirePayment: false,
  automaticSuspension: false, monthlyPriceCents: 7000,
};
const ACCOUNT = {
  workspaceId: 'workspace-A', status: 'active',
  monthlyPriceCents: 7000, authorizedEmail: 'fake@example.test',
};
const CYCLE = {
  id: 'workspace-A__2026-11', workspaceId: 'workspace-A',
  referenceMonth: '2026-11', amountCents: 7000, status: 'pending',
  dueDate: '2026-11-09',
};
const INPUT = {
  authorized: true, account: ACCOUNT, cycle: CYCLE, config: CONFIG,
  orderIdSecret: SECRET,
  redirectUrl: 'https://emprovex.com.br/regularizacao',
  webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
  validUntil: '2026-11-15T22:00:00-03:00', now: NOW,
};
const prepared = () => prepareWorkspaceCheckout(INPUT);
const signal = (intent = prepared().intent, overrides = {}) => ({
  event: 'paid', order_nsu: intent.orderNsu, transaction_nsu: 'mock-tx-1',
  invoice_slug: 'invoice-mock-01', ...overrides,
});
const CHECK = {
  success: true, paid: true, amount: 7000, paid_amount: 7000,
  capture_method: 'pix', installments: 1,
};
const verified = () => {
  const intent = prepared().intent;
  const verification = prepareVerification({ intent, notification: signal(intent), handle: 'handle-demo' });
  return { intent, verification };
};

test('offline bridge prepares checkout for a real pending R$70 SaaS cycle', () => {
  const result = prepared();
  assert.equal(result.allowed, true);
  assert.equal(result.intent.cycleId, CYCLE.id);
  assert.equal(result.intent.amountCents, 7000);
  assert.equal(result.checkoutRequest.order_nsu, result.intent.orderNsu);
  assert.match(result.checkoutRequest.items[0].description, /Plano Completo/);
  assert.equal(result.checkoutRequest.options.single_payment, true);
  assert.doesNotMatch(JSON.stringify(result.checkoutRequest), /workspace-A|fake@example/);
});

test('checkout fails closed without trusted caller authorization', () => {
  assert.deepEqual(prepareWorkspaceCheckout({ ...INPUT, authorized: false }),
    { allowed: false, code: 'NOT_AUTHORIZED' });
});

test('founder and VIP billing are never converted to checkout', () => {
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, account: { ...ACCOUNT, workspaceId: 'hgesm-aprov' },
    cycle: { ...CYCLE, id: 'hgesm-aprov__2026-11', workspaceId: 'hgesm-aprov' },
  }).code, 'EXEMPT');
  for (const exemptionSource of ['founder', 'legacy_vip', 'manual']) {
    assert.equal(prepareWorkspaceCheckout({
      ...INPUT, account: { ...ACCOUNT, status: 'exempt', exemptionSource },
    }).code, 'EXEMPT');
  }
});

test('trial, canceled and already paid/waived cycles cannot create a checkout', () => {
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, account: { ...ACCOUNT, status: 'trial' },
  }).code, 'TRIAL_NOT_BILLABLE');
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, account: { ...ACCOUNT, status: 'canceled' },
  }).code, 'ACCOUNT_NOT_BILLABLE');
  for (const status of ['paid', 'waived']) {
    assert.equal(prepareWorkspaceCheckout({
      ...INPUT, cycle: { ...CYCLE, status },
    }).code, 'ALREADY_RESOLVED');
  }
});

test('cross-workspace checkout and malformed cycle are rejected', () => {
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, cycle: { ...CYCLE, workspaceId: 'workspace-B' },
  }).code, 'WORKSPACE_MISMATCH');
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, cycle: { ...CYCLE, id: 'wrong-id' },
  }).code, 'INVALID_CYCLE_ID');
});

test('modified price and an unsafe billing gate fail closed', () => {
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, cycle: { ...CYCLE, amountCents: 100 },
  }).code, 'PRICE_MISMATCH');
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, config: { ...CONFIG, requirePayment: true },
  }).code, 'UNSAFE_BILLING_CONFIG');
  assert.equal(prepareWorkspaceCheckout({
    ...INPUT, config: { ...CONFIG, automaticSuspension: true },
  }).code, 'UNSAFE_BILLING_CONFIG');
});

test('expiry is time-bounded and must be in the future', () => {
  assert.equal(prepareWorkspaceCheckout({ ...INPUT, validUntil: '2026-10-01T00:00:00Z' }).code,
    'CHECKOUT_VALIDITY_OUT_OF_RANGE');
  assert.equal(prepareWorkspaceCheckout({ ...INPUT, validUntil: '2028-10-25T00:00:00Z' }).code,
    'CHECKOUT_VALIDITY_OUT_OF_RANGE');
  assert.equal(prepareWorkspaceCheckout({ ...INPUT, validUntil: 'tomorrow' }).code,
    'INVALID_CHECKOUT_VALIDITY');
});

test('builds payment_check using the actual order + transaction + slug + handle', () => {
  const { intent, verification } = verified();
  assert.equal(verification.allowed, true);
  assert.deepEqual(verification.checkRequest, {
    handle: 'handle-demo', order_nsu: intent.orderNsu,
    transaction_nsu: 'mock-tx-1', slug: 'invoice-mock-01',
  });
});

test('signal mismatch, forged slug and missing transaction are rejected', () => {
  const intent = prepared().intent;
  assert.equal(prepareVerification({
    intent, notification: signal(intent, { order_nsu: 'epx-202611-' + 'a'.repeat(24) }), handle: 'demo',
  }).code, 'ORDER_INTENT_MISMATCH');
  assert.equal(prepareVerification({
    intent, notification: signal(intent), handle: 'demo', storedInvoiceSlug: 'another-slug',
  }).code, 'SLUG_MISMATCH');
  assert.equal(prepareVerification({
    intent, notification: signal(intent, { transaction_nsu: '' }), handle: 'demo',
  }).allowed, false);
});

test('settlement candidate requires actual paid event; refund cannot mark paid', () => {
  const intent = prepared().intent;
  assert.equal(prepareVerification({
    intent, notification: signal(intent, { event: 'refunded' }), handle: 'demo',
  }).code, 'NOT_SETTLEMENT_EVENT');
});

test('realistic paid status generates a proposed cycle update, not side effects', () => {
  const { intent, verification } = verified();
  const result = planVerifiedSettlement({
    intent, verification, paymentCheck: CHECK, account: ACCOUNT,
    cycle: CYCLE, now: NOW,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mutate, true);
  assert.equal(result.action, 'MARK_PAID');
  assert.equal(result.nextCycle.status, 'paid');
  assert.equal(result.nextCycle.amountCents, 7000);
  assert.equal(result.nextCycle.confirmedBy, 'provider:infinitepay');
  assert.equal(result.audit.workspaceId, ACCOUNT.workspaceId);
  assert.equal(CYCLE.status, 'pending', 'original state is not modified');
});

test('provider rejection, amount mismatch and missing verification cannot mark paid', () => {
  const { intent, verification } = verified();
  const common = {
    intent, verification, account: ACCOUNT, cycle: CYCLE, now: NOW,
  };
  assert.equal(planVerifiedSettlement({ ...common,
    paymentCheck: { ...CHECK, paid: false },
  }).allowed, false);
  assert.equal(planVerifiedSettlement({ ...common,
    paymentCheck: { ...CHECK, paid_amount: 6999 },
  }).code, 'UNDERPAID');
  assert.equal(planVerifiedSettlement({ ...common,
    paymentCheck: { ...CHECK, amount: 6000 },
  }).code, 'AMOUNT_MISMATCH');
  assert.equal(planVerifiedSettlement({ ...common,
    verification: { ...verification, checkRequest: { ...verification.checkRequest, order_nsu: 'wrong' } },
    paymentCheck: CHECK,
  }).code, 'VERIFICATION_NOT_LINKED');
});

test('settlement refuses different tenant, modified price, VIP and canceled account', () => {
  const { intent, verification } = verified();
  const common = { intent, verification, paymentCheck: CHECK, account: ACCOUNT, cycle: CYCLE, now: NOW };
  assert.equal(planVerifiedSettlement({ ...common,
    cycle: { ...CYCLE, workspaceId: 'workspace-B' },
  }).code, 'BILLING_IDENTITY_MISMATCH');
  assert.equal(planVerifiedSettlement({ ...common,
    cycle: { ...CYCLE, amountCents: 8000 },
  }).code, 'AMOUNT_OR_PRICE_CHANGED');
  assert.equal(planVerifiedSettlement({ ...common,
    account: { ...ACCOUNT, status: 'exempt' },
  }).code, 'EXEMPT');
  assert.equal(planVerifiedSettlement({ ...common,
    account: { ...ACCOUNT, status: 'canceled' },
  }).code, 'ACCOUNT_NOT_BILLABLE');
});

test('repeated paid event and waiver result in no mutation', () => {
  const { intent, verification } = verified();
  const common = { intent, verification, paymentCheck: CHECK, account: ACCOUNT, cycle: CYCLE, now: NOW };
  assert.deepEqual(planVerifiedSettlement({
    ...common, cycle: { ...CYCLE, status: 'paid' },
  }), { allowed: true, action: 'ALREADY_PAID', mutate: false });
  assert.deepEqual(planVerifiedSettlement({
    ...common, cycle: { ...CYCLE, status: 'waived' },
  }), { allowed: true, action: 'WAIVED', mutate: false });
});

test('refund and cancel are review-only, never automatic suspension', () => {
  const intent = prepared().intent;
  for (const event of ['refunded', 'canceled', 'payment_failed']) {
    const result = planFinancialException({ intent, notification: signal(intent, { event }) });
    assert.equal(result.action, 'FLAG_FOR_REVIEW');
    assert.equal(result.affectsWorkspaceAccess, false);
    assert.equal(result.changesCyclePaidStatus, false);
  }
});
