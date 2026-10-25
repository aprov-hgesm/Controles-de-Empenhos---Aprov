/**
 * INDIVIDUAL launch-price progression for NEW EMPROVEX subscribers only.
 * Pure, offline and not connected to production onboarding/Firestore.
 *
 * Month 1 means the first invoice reference month AFTER the trial, not signup.
 * Existing clients and VIPs are never auto-enrolled or repriced.
 */
export const RAMP_POLICY_ID = 'emprovex_individual_ramp_v1';
export const LEGACY_PLAN_CENTS = 7000;
export const RAMP_TIERS = Object.freeze([
  Object.freeze({ fromMonth: 1, toMonth: 3, amountCents: 2990 }),
  Object.freeze({ fromMonth: 4, toMonth: 6, amountCents: 3990 }),
  Object.freeze({ fromMonth: 7, toMonth: 9, amountCents: 4990 }),
  Object.freeze({ fromMonth: 10, toMonth: 12, amountCents: 5990 }),
  Object.freeze({ fromMonth: 13, toMonth: null, amountCents: 6990 }),
]);

function validMonth(value) {
  return typeof value === 'string'
    && /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(value);
}

function index(value) {
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month;
}

function fail(code) {
  return Object.freeze({ allowed: false, code });
}

export function quoteIndividualRamp({ firstPaidReferenceMonth, referenceMonth }) {
  if (!validMonth(firstPaidReferenceMonth) || !validMonth(referenceMonth)) {
    return fail('INVALID_REFERENCE_MONTH');
  }
  const elapsedMonths = index(referenceMonth) - index(firstPaidReferenceMonth);
  if (elapsedMonths < 0) return fail('BEFORE_FIRST_PAID_MONTH');
  const paidMonthNumber = elapsedMonths + 1;
  const tier = RAMP_TIERS.find((item) =>
    paidMonthNumber >= item.fromMonth
    && (item.toMonth === null || paidMonthNumber <= item.toMonth)
  );
  return Object.freeze({
    allowed: true,
    policyId: RAMP_POLICY_ID,
    paidMonthNumber,
    amountCents: tier.amountCents,
    tierFromMonth: tier.fromMonth,
    tierToMonth: tier.toMonth,
  });
}

/**
 * Off-line proposal, NOT a database write.
 * New customers must explicitly accept every future tier at contracting.
 * No migration of old accounts and no enrollment of VIPs/founder.
 */
export function proposeNewCustomerEnrollment({
  account, firstPaidReferenceMonth, pricingTermsAcceptedAt, existingCycleCount = 0,
}) {
  if (!account || typeof account !== 'object' || typeof account.workspaceId !== 'string'
      || !account.workspaceId || account.workspaceId === 'hgesm-aprov'
      || account.status === 'exempt' || account.exemptionSource) {
    return fail('NOT_AN_ELIGIBLE_NEW_CUSTOMER');
  }
  if (!['trial', 'active'].includes(account.status)
      || account.pricingPolicyId
      || !Number.isSafeInteger(existingCycleCount) || existingCycleCount !== 0) {
    return fail('EXISTING_CUSTOMER_OR_CYCLES');
  }
  if (!validMonth(firstPaidReferenceMonth)) {
    return fail('INVALID_FIRST_PAID_MONTH');
  }
  if (typeof pricingTermsAcceptedAt !== 'string'
      || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(pricingTermsAcceptedAt)
      || !Number.isFinite(Date.parse(pricingTermsAcceptedAt))) {
    return fail('PRICE_SCHEDULE_NOT_ACCEPTED');
  }
  return Object.freeze({
    allowed: true,
    accountPatch: Object.freeze({
      pricingPolicyId: RAMP_POLICY_ID,
      firstPaidReferenceMonth,
      pricingTermsAcceptedAt,
      monthlyPriceCents: RAMP_TIERS[0].amountCents,
    }),
  });
}

/**
 * Determine the immutable per-cycle price from a frozen enrollment.
 * For legacy accounts keep the historical R$70 contract unchanged.
 * Caller must create cycle and price update atomically on the server.
 */
export function evaluateBillableCyclePrice({ account, cycle, config }) {
  if (!account || !cycle || !config || typeof account !== 'object') {
    return fail('MISSING_PRICING_INPUT');
  }
  if (config.monthlyPriceCents !== LEGACY_PLAN_CENTS) {
    return fail('LEGACY_PRICE_CONFIG_CHANGED');
  }
  if (!account.pricingPolicyId) {
    if (account.monthlyPriceCents !== LEGACY_PLAN_CENTS
        || cycle.amountCents !== LEGACY_PLAN_CENTS) {
      return fail('LEGACY_PRICE_MISMATCH');
    }
    return Object.freeze({ allowed: true, amountCents: LEGACY_PLAN_CENTS, policyId: 'legacy' });
  }
  if (account.pricingPolicyId !== RAMP_POLICY_ID) return fail('UNKNOWN_PRICING_POLICY');
  if (typeof account.pricingTermsAcceptedAt !== 'string'
      || !Number.isFinite(Date.parse(account.pricingTermsAcceptedAt))
      || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(account.pricingTermsAcceptedAt)) {
    return fail('PRICE_SCHEDULE_NOT_ACCEPTED');
  }
  const quote = quoteIndividualRamp({
    firstPaidReferenceMonth: account.firstPaidReferenceMonth,
    referenceMonth: cycle.referenceMonth,
  });
  if (!quote.allowed) return quote;
  if (cycle.amountCents !== quote.amountCents) {
    return fail('CYCLE_PRICE_MISMATCH');
  }
  // The account price may be its original contract value or current tier.
  // Cycle amount is the immutable source of truth once materialized;
  // it must match the pre-agreed individual schedule above.
  return quote;
}
