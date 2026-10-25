import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RAMP_POLICY_ID,
  LEGACY_PLAN_CENTS,
  RAMP_TIERS,
  quoteIndividualRamp,
  proposeNewCustomerEnrollment,
  evaluateBillableCyclePrice,
} from '../lib/server/payments/emprovexRampPricing.mjs';
import {
  prepareWorkspaceCheckout, prepareVerification, planVerifiedSettlement,
} from '../lib/server/payments/infinitepayBillingBridge.mjs';

const NOW = '2026-10-25T15:00:00Z';
const BASE = {
  workspaceId: 'new-customer-01',
  status: 'active',
  monthlyPriceCents: 7000,
};
const CYCLE = {
  id: 'new-customer-01__2027-01', workspaceId: 'new-customer-01',
  referenceMonth: '2027-01', status: 'pending', amountCents: 2990,
};
const CONFIG = { monthlyPriceCents: 7000, billingMode: 'observe', requirePayment: false, automaticSuspension: false };
const ACCEPTED = '2026-12-01T10:00:00.000Z';
const ENROLLED = {
  ...BASE,
  pricingPolicyId: RAMP_POLICY_ID,
  firstPaidReferenceMonth: '2027-01',
  pricingTermsAcceptedAt: ACCEPTED,
  monthlyPriceCents: 2990,
};
const checkoutForMonth = (referenceMonth, amountCents, account = ENROLLED) => {
  const [year, month] = referenceMonth.split('-').map(Number);
  const precedingMonth = new Date(Date.UTC(year, month - 2, 25, 15)).toISOString();
  const expiresInBilledMonth = new Date(Date.UTC(year, month - 1, 15, 22)).toISOString();
  const cycle = {
    ...CYCLE,
    referenceMonth,
    id: BASE.workspaceId + '__' + referenceMonth,
    amountCents,
  };
  const result = prepareWorkspaceCheckout({
    authorized: true, account, cycle, config: CONFIG,
    orderIdSecret: 'fake-only-price-progression-secret-0000000000',
    redirectUrl: 'https://emprovex.com.br/regularizacao',
    webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
    now: precedingMonth, validUntil: expiresInBilledMonth,
  });
  return { cycle, result };
};

test('per-customer schedule exactly matches the requested 5 price tiers', () => {
  assert.deepEqual(RAMP_TIERS.map(t => [t.fromMonth, t.toMonth, t.amountCents]), [
    [1, 3, 2990],
    [4, 6, 3990],
    [7, 9, 4990],
    [10, 12, 5990],
    [13, null, 6990],
  ]);
});

test('first billable month is relative to each customer, not the global calendar', () => {
  assert.equal(quoteIndividualRamp({
    firstPaidReferenceMonth: '2026-11', referenceMonth: '2026-11',
  }).amountCents, 2990);
  assert.equal(quoteIndividualRamp({
    firstPaidReferenceMonth: '2027-03', referenceMonth: '2027-03',
  }).amountCents, 2990);
  assert.equal(quoteIndividualRamp({
    firstPaidReferenceMonth: '2027-03', referenceMonth: '2028-03',
  }).amountCents, 6990);
});

test('month boundaries 3->4, 6->7, 9->10, 12->13 are deterministic', () => {
  const amounts = [
    ['2027-01', 2990], ['2027-03', 2990], ['2027-04', 3990],
    ['2027-06', 3990], ['2027-07', 4990], ['2027-09', 4990],
    ['2027-10', 5990], ['2027-12', 5990], ['2028-01', 6990],
    ['2030-01', 6990],
  ];
  for (const [month, expected] of amounts) {
    const price = quoteIndividualRamp({
      firstPaidReferenceMonth: '2027-01', referenceMonth: month,
    });
    assert.equal(price.amountCents, expected, month);
  }
});

test('bad dates and months before the first paid cycle fail closed', () => {
  assert.equal(quoteIndividualRamp({ firstPaidReferenceMonth: '2027-01', referenceMonth: '2026-12' }).code,
    'BEFORE_FIRST_PAID_MONTH');
  assert.equal(quoteIndividualRamp({ firstPaidReferenceMonth: '2027-13', referenceMonth: '2027-03' }).code,
    'INVALID_REFERENCE_MONTH');
});

test('new subscriber enrollment is proposal-only, requires consent and no previous cycles', () => {
  const trial = { ...BASE, status: 'trial' };
  const result = proposeNewCustomerEnrollment({
    account: trial,
    firstPaidReferenceMonth: '2027-01',
    pricingTermsAcceptedAt: ACCEPTED,
    existingCycleCount: 0,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.accountPatch.pricingPolicyId, RAMP_POLICY_ID);
  assert.equal(result.accountPatch.monthlyPriceCents, 2990);
  assert.equal(trial.pricingPolicyId, undefined, 'not a database write or mutation');
  assert.equal(trial.status, 'trial', 'preserves trial until expiry');
});

test('no opt-in, existing cycles, legacy enrollment, founder and VIP cannot enroll', () => {
  const initial = {
    account: BASE, firstPaidReferenceMonth: '2027-01', pricingTermsAcceptedAt: ACCEPTED,
  };
  assert.equal(proposeNewCustomerEnrollment({ ...initial, pricingTermsAcceptedAt: '' }).code,
    'PRICE_SCHEDULE_NOT_ACCEPTED');
  assert.equal(proposeNewCustomerEnrollment({ ...initial, existingCycleCount: 1 }).code,
    'EXISTING_CUSTOMER_OR_CYCLES');
  assert.equal(proposeNewCustomerEnrollment({ ...initial, account: ENROLLED }).code,
    'EXISTING_CUSTOMER_OR_CYCLES');
  assert.equal(proposeNewCustomerEnrollment({ ...initial, account: { ...BASE, status: 'exempt', exemptionSource: 'legacy_vip' } }).code,
    'NOT_AN_ELIGIBLE_NEW_CUSTOMER');
  assert.equal(proposeNewCustomerEnrollment({ ...initial, account: { ...BASE, workspaceId: 'hgesm-aprov' } }).code,
    'NOT_AN_ELIGIBLE_NEW_CUSTOMER');
});

test('legacy R$70 account is untouched and cannot be silently repriced', () => {
  const oldCycle = { ...CYCLE, amountCents: 7000 };
  assert.equal(evaluateBillableCyclePrice({ account: BASE, cycle: oldCycle, config: CONFIG }).amountCents,
    LEGACY_PLAN_CENTS);
  assert.equal(evaluateBillableCyclePrice({ account: BASE, cycle: CYCLE, config: CONFIG }).code,
    'LEGACY_PRICE_MISMATCH');
  assert.equal(evaluateBillableCyclePrice({ account: ENROLLED, cycle: oldCycle, config: CONFIG }).code,
    'CYCLE_PRICE_MISMATCH');
});

test('the checkout uses the tier stored in the actual monthly billing cycle', () => {
  for (const [month, cents, monthNumber] of [
    ['2027-01', 2990, 1],
    ['2027-04', 3990, 4],
    ['2027-07', 4990, 7],
    ['2027-10', 5990, 10],
    ['2028-01', 6990, 13],
  ]) {
    const { result } = checkoutForMonth(month, cents);
    assert.equal(result.allowed, true, JSON.stringify(result));
    assert.equal(result.checkoutRequest.items[0].price, cents);
    assert.equal(result.intent.amountCents, cents);
    assert.equal(result.intent.pricingPolicyId, RAMP_POLICY_ID);
    assert.equal(result.intent.paidMonthNumber, monthNumber);
    assert.equal(result.checkoutRequest.options.single_payment, true);
  }
});

test('invoice with wrong price or policy lacking signed price table cannot pass checkout', () => {
  assert.equal(checkoutForMonth('2027-04', 2990).result.code, 'CYCLE_PRICE_MISMATCH');
  assert.equal(checkoutForMonth('2027-04', 7000).result.code, 'CYCLE_PRICE_MISMATCH');
  assert.equal(checkoutForMonth('2027-01', 2990, { ...ENROLLED, pricingTermsAcceptedAt: '' }).result.code,
    'PRICE_SCHEDULE_NOT_ACCEPTED');
  assert.equal(checkoutForMonth('2026-12', 2990).result.code, 'BEFORE_FIRST_PAID_MONTH');
});

test('checkout must remain valid until the billing month begins', () => {
  const first = checkoutForMonth('2027-04', 3990);
  const invalid = prepareWorkspaceCheckout({
    authorized: true,
    account: ENROLLED,
    cycle: first.cycle,
    config: CONFIG,
    orderIdSecret: 'fake-only-price-progression-secret-0000000000',
    redirectUrl: 'https://emprovex.com.br/regularizacao',
    webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
    now: '2027-03-20T10:00:00Z',
    validUntil: '2027-03-30T22:00:00Z',
  });
  assert.equal(invalid.code, 'CHECKOUT_EXPIRES_BEFORE_CYCLE');
});

test('existing paid invoice amount remains immutable after client moves tiers', () => {
  const old = checkoutForMonth('2027-03', 2990);
  const later = checkoutForMonth('2027-04', 3990);
  assert.equal(old.cycle.amountCents, 2990);
  assert.equal(later.cycle.amountCents, 3990);
  assert.equal(old.result.intent.amountCents, 2990);
});

test('verified payment for 29.90 is accepted, while 39.90 is not underpaid', () => {
  const { cycle, result } = checkoutForMonth('2027-01', 2990);
  const signal = {
    event: 'paid',
    order_nsu: result.intent.orderNsu,
    transaction_nsu: 'synthetic-price-tx1',
    invoice_slug: 'synthetic-price-slug1',
  };
  const verification = prepareVerification({ intent: result.intent, notification: signal, handle: 'fake-handle' });
  assert.equal(verification.allowed, true);
  const common = {
    intent: result.intent, verification, account: ENROLLED, cycle, now: NOW,
  };
  const good = planVerifiedSettlement({
    ...common,
    paymentCheck: {
      paid: true, success: true, amount: 2990, paid_amount: 2990, capture_method: 'pix',
    },
  });
  assert.equal(good.action, 'MARK_PAID');
  assert.equal(good.nextCycle.amountCents, 2990);
  const bad = planVerifiedSettlement({
    ...common,
    paymentCheck: {
      paid: true, success: true, amount: 3990, paid_amount: 3990, capture_method: 'pix',
    },
  });
  assert.equal(bad.code, 'AMOUNT_MISMATCH');
});

test('a different tenant and an unknown pricing policy cannot reuse the quote', () => {
  assert.equal(checkoutForMonth('2027-01', 2990, { ...ENROLLED, pricingPolicyId: 'future_price_unknown' }).result.code,
    'UNKNOWN_PRICING_POLICY');
  const { cycle, result } = checkoutForMonth('2027-01', 2990);
  const copied = prepareWorkspaceCheckout({
    authorized: true,
    account: { ...ENROLLED, workspaceId: 'other-workspace' },
    cycle,
    config: CONFIG,
  });
  assert.equal(copied.code, 'WORKSPACE_MISMATCH');
  assert.equal(result.allowed, true);
});
