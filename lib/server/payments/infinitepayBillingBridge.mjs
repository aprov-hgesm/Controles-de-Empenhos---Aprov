/**
 * Offline bridge: EMPROVEX billingCycles -> InfinitePay checkout -> verified settlement plan.
 * NO network, NO Firestore mutation, NO public route and NO activation flags.
 * Callers must enforce founder/admin authorization before invoking any future live flow.
 */
import {
  makeOrderNsu,
  buildCheckoutRequest,
  classifyPaymentNotification,
  eventFingerprint,
  assessPaymentCheck,
} from './infinitepayCheckout.mjs';
import { evaluateBillableCyclePrice, LEGACY_PLAN_CENTS } from './emprovexRampPricing.mjs';

const PROVIDER = 'infinitepay';
const FOUNDER_ID = 'hgesm-aprov';
const ALLOWED_BILLING_ACCOUNT_STATES = new Set(['active', 'pending']);

function reject(code) {
  return Object.freeze({ allowed: false, code });
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isMonth(value) {
  return /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(str(value));
}

function validIsoInstant(date) {
  return typeof date === 'string'
    && /(Z|[+-][0-9]{2}:[0-9]{2})$/.test(date)
    && Number.isFinite(Date.parse(date));
}

/**
 * Decide a payment intent against EXISTING materialized billing state.
 * Authorization must come from a trusted server-side caller.
 */
export function prepareWorkspaceCheckout({
  authorized = false, account, cycle, config, orderIdSecret,
  redirectUrl, webhookUrl, validUntil, now = new Date().toISOString(),
}) {
  if (authorized !== true) return reject('NOT_AUTHORIZED');
  if (!isObject(account) || !isObject(cycle) || !isObject(config)) {
    return reject('BILLING_RECORD_MISSING');
  }
  if (!str(account.workspaceId) || account.workspaceId !== cycle.workspaceId) {
    return reject('WORKSPACE_MISMATCH');
  }
  if (account.workspaceId === FOUNDER_ID
      || account.status === 'exempt'
      || ['founder', 'legacy_vip', 'manual'].includes(account.exemptionSource)) {
    return reject('EXEMPT');
  }
  if (account.status === 'trial') return reject('TRIAL_NOT_BILLABLE');
  if (!ALLOWED_BILLING_ACCOUNT_STATES.has(account.status)) {
    return reject('ACCOUNT_NOT_BILLABLE');
  }
  if (config.billingMode !== 'observe'
      || config.requirePayment !== false
      || config.automaticSuspension !== false) {
    return reject('UNSAFE_BILLING_CONFIG');
  }
  if (!isMonth(cycle.referenceMonth) || str(cycle.id) !==
    account.workspaceId + '__' + cycle.referenceMonth) {
    return reject('INVALID_CYCLE_ID');
  }
  if (cycle.status === 'paid' || cycle.status === 'waived') {
    return reject('ALREADY_RESOLVED');
  }
  if (cycle.status !== 'pending' && cycle.status !== 'open') {
    return reject('CYCLE_NOT_BILLABLE');
  }
  const price = evaluateBillableCyclePrice({ account, cycle, config });
  if (!price.allowed) {
    return reject(price.code === 'LEGACY_PRICE_MISMATCH'
      ? 'PRICE_MISMATCH' : price.code);
  }
  if (!validIsoInstant(now) || !validIsoInstant(validUntil)) {
    return reject('INVALID_CHECKOUT_VALIDITY');
  }
  const ttl = Date.parse(validUntil) - Date.parse(now);
  if (ttl <= 0 || ttl > 365 * 86400 * 1000) {
    return reject('CHECKOUT_VALIDITY_OUT_OF_RANGE');
  }
  if (Date.parse(validUntil) <= Date.parse(cycle.referenceMonth + '-01T00:00:00.000Z')) {
    return reject('CHECKOUT_EXPIRES_BEFORE_CYCLE');
  }

  // Server-only validated inputs; invalid keys/URLs cause a clear refusal.
  const orderNsu = makeOrderNsu({
    workspaceId: account.workspaceId,
    referenceMonth: cycle.referenceMonth,
    orderIdSecret,
  });
  const request = buildCheckoutRequest({
    orderNsu,
    referenceMonth: cycle.referenceMonth,
    amountCents: cycle.amountCents,
    redirectUrl,
    webhookUrl,
    validUntil,
  });
  return Object.freeze({
    allowed: true,
    provider: PROVIDER,
    intent: Object.freeze({
      provider: PROVIDER,
      orderNsu,
      workspaceId: account.workspaceId,
      cycleId: cycle.id,
      referenceMonth: cycle.referenceMonth,
      amountCents: cycle.amountCents,
      pricingPolicyId: price.policyId,
      paidMonthNumber: price.paidMonthNumber ?? null,
      status: 'prepared',
    }),
    // This is a REQUEST BODY ONLY. No checkout is created here.
    checkoutRequest: request,
  });
}

/**
 * Build the provider's documented payment_check request.
 * Webhook and redirect parameters are untrusted. This never marks billing paid.
 */
export function prepareVerification({
  intent, notification, handle, storedInvoiceSlug,
}) {
  if (!isObject(intent) || intent.provider !== PROVIDER) {
    return reject('INVALID_STORED_INTENT');
  }
  const signal = classifyPaymentNotification(notification);
  if (!signal.accepted) return reject(signal.reason);
  if (!['paid', 'settled'].includes(signal.event)) {
    return reject('NOT_SETTLEMENT_EVENT');
  }
  if (intent.orderNsu !== signal.orderNsu
      || !str(intent.cycleId)
      || !str(intent.workspaceId)) {
    return reject('ORDER_INTENT_MISMATCH');
  }
  const slug = str(notification.invoice_slug || notification.slug);
  if (!slug || slug.length > 200) return reject('MISSING_INVOICE_SLUG');
  if (storedInvoiceSlug && storedInvoiceSlug !== slug) {
    return reject('SLUG_MISMATCH');
  }
  if (!str(handle) || str(handle).length > 100
      || !/^[a-zA-Z0-9_.-]+$/.test(str(handle))) {
    return reject('INVALID_HANDLE');
  }
  const fingerprint = eventFingerprint({
    orderNsu: signal.orderNsu,
    transactionNsu: signal.transactionNsu,
    event: signal.event,
  });
  return Object.freeze({
    allowed: true,
    provider: PROVIDER,
    fingerprint,
    transactionNsu: signal.transactionNsu,
    invoiceSlug: slug,
    // The server must send this to /payment_check via authenticated X-Api-Key.
    checkRequest: Object.freeze({
      handle: str(handle),
      order_nsu: intent.orderNsu,
      transaction_nsu: signal.transactionNsu,
      slug,
    }),
  });
}

/**
 * Produce a settlement decision, NOT a database write.
 * The future Firestore adapter must reload and CAS-write the account/cycle/ledger
 * atomically; never commit based only on stale snapshots or webhook payloads.
 */
export function planVerifiedSettlement({
  intent, verification, paymentCheck, account, cycle, now,
}) {
  if (!isObject(intent) || !isObject(verification)
      || verification.allowed !== true
      || verification.checkRequest?.order_nsu !== intent.orderNsu
      || intent.provider !== PROVIDER) {
    return reject('VERIFICATION_NOT_LINKED');
  }
  if (!isObject(account) || !isObject(cycle)
      || account.workspaceId !== intent.workspaceId
      || cycle.workspaceId !== intent.workspaceId
      || cycle.id !== intent.cycleId
      || cycle.referenceMonth !== intent.referenceMonth) {
    return reject('BILLING_IDENTITY_MISMATCH');
  }
  if (account.workspaceId === FOUNDER_ID || account.status === 'exempt'
      || account.exemptionSource) {
    return reject('EXEMPT');
  }
  if (!ALLOWED_BILLING_ACCOUNT_STATES.has(account.status)) {
    return reject('ACCOUNT_NOT_BILLABLE');
  }
  const price = evaluateBillableCyclePrice({
    account, cycle, config: { monthlyPriceCents: LEGACY_PLAN_CENTS },
  });
  if (cycle.amountCents !== intent.amountCents
      || !price.allowed
      || intent.pricingPolicyId !== price.policyId
      || (intent.paidMonthNumber ?? null) !== (price.paidMonthNumber ?? null)) {
    return reject('AMOUNT_OR_PRICE_CHANGED');
  }
  if (cycle.status === 'paid') return Object.freeze({ allowed: true, action: 'ALREADY_PAID', mutate: false });
  if (cycle.status === 'waived') return Object.freeze({ allowed: true, action: 'WAIVED', mutate: false });
  if (!['pending', 'open'].includes(cycle.status)) {
    return reject('INVALID_CYCLE_STATUS');
  }
  const check = assessPaymentCheck({ amountCents: intent.amountCents, paymentCheck });
  if (check.verified !== true) return reject(check.reason);
  if (!validIsoInstant(now)) return reject('INVALID_SETTLEMENT_TIME');
  const nextCycle = Object.freeze({
    ...cycle,
    status: 'paid',
    confirmedAt: now,
    confirmedBy: 'provider:infinitepay',
    note: 'InfinitePay - pagamento validado via payment_check',
    updatedAt: now,
    updatedBy: 'provider:infinitepay',
  });
  const audit = Object.freeze({
    provider: PROVIDER,
    workspaceId: intent.workspaceId,
    cycleId: intent.cycleId,
    orderNsu: intent.orderNsu,
    transactionNsu: verification.transactionNsu,
    invoiceSlug: verification.invoiceSlug,
    eventFingerprint: verification.fingerprint,
    amountCents: intent.amountCents,
    captureMethod: paymentCheck.capture_method,
    confirmedAt: now,
  });
  return Object.freeze({ allowed: true, action: 'MARK_PAID', mutate: true, nextCycle, audit });
}

/**
 * Reversals are review-only. Never automatically delete user data, remove VIPs
 * or suspend a workspace based on one provider event.
 */
export function planFinancialException({ intent, notification }) {
  const signal = classifyPaymentNotification(notification);
  if (!isObject(intent) || !signal.accepted || signal.orderNsu !== intent.orderNsu) {
    return reject('UNKNOWN_EVENT_OR_ORDER');
  }
  if (!['refunded', 'canceled', 'payment_failed'].includes(signal.event)) {
    return reject('NOT_AN_EXCEPTION');
  }
  return Object.freeze({
    allowed: true,
    action: 'FLAG_FOR_REVIEW',
    affectsWorkspaceAccess: false,
    changesCyclePaidStatus: false,
    provider: PROVIDER,
    event: signal.event,
    fingerprint: eventFingerprint({
      orderNsu: signal.orderNsu,
      transactionNsu: signal.transactionNsu,
      event: signal.event,
    }),
  });
}
