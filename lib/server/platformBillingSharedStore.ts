/**
 * EMPROVEX shared monthly payment — server-only, opt-in and workspace-bound.
 * Does not create identities or change the workspace access model.
 * Each slot has an independent InfinitePay order; the cycle is paid only once
 * all individually checked settlements are committed in Firestore transactions.
 */
import { createHash } from 'node:crypto';
import type { BillingAccount, BillingCycle, PlatformBillingConfig, SharedBillingPart, SharedBillingPayment } from '../billing';
import { billingCycleId, buildBillingCycle, buildPlatformBillingConfig,
  paidServicePeriod, paidServiceAccessUntil, EMPROVEX_NEW_CUSTOMER_RAMP_ID } from '../billing';
import { HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { quoteIndividualRamp } from './payments/emprovexRampPricing.mjs';
import { makeOrderNsu, assessPaymentCheck, callInfinitePay } from './payments/infinitepayCheckout.mjs';
import { readCheckoutUrl } from './payments/infinitepaySmokeHarness.mjs';
import { createSharedPayment, applySharedPayment } from './payments/sharedBilling.mjs';
import {
  BillingAdminError, get, transaction, audit, validWorkspaceId, existingWorkspace,
  existingAccount, assertAccountWorkspace, requireCheckoutConfig,
  requireCheckoutWorkspace, configuredBillingOrigin,
  reconcileSectorSubscriptionPayment, reconcileInfinitePayWebhook,
} from './platformBillingAdminStore';
import type { Actor } from './platformBillingAdminStore';

type PaymentReturn = { orderNsu: string; transactionNsu: string; slug: string };
type SharedCheckoutResult = {
  status: 'reserved' | 'ready' | 'paid' | 'pending_review';
  orderNsu: string;
  checkoutUrl: string;
  amountCents: number;
  referenceMonth: string;
};
const CONFIG_PATH = 'platformBillingConfig/main';
const codePattern = /^epx-[0-9]{6}-[a-f0-9]{24}$/;

function requireSharedEnabled(): void {
  if (process.env.EMPROVEX_SHARED_BILLING_ENABLED !== '1')
    throw new BillingAdminError('BILLING_SHARED_DISABLED', 503);
}
function authorize(actor: Actor, workspaceId: string, email: string): void {
  validWorkspaceId(workspaceId);
  if (workspaceId === HGESM_WORKSPACE_ID || actor.email !== email)
    throw new BillingAdminError('BILLING_SHARED_NOT_AUTHORIZED', 403);
}
function verifyCustomer(workspace: { id: string; authorizedEmail: string }, account: BillingAccount, email: string,
  allowSuspended = false) {
  assertAccountWorkspace(account, workspace as Parameters<typeof assertAccountWorkspace>[1]);
  if (workspace.authorizedEmail !== email
    || account.status === 'exempt' || account.exemptionSource
    || !['active','pending','trial', ...(allowSuspended ? ['suspended'] : [])].includes(account.status)
    || account.pricingPolicyId !== EMPROVEX_NEW_CUSTOMER_RAMP_ID
    || !account.pricingTermsAcceptedAt) {
    throw new BillingAdminError('BILLING_SHARED_NOT_ELIGIBLE', 409);
  }
}
function activeMonth(account: BillingAccount): string {
  const period = paidServicePeriod(account);
  if (!period) throw new BillingAdminError('BILLING_TRIAL_ACTIVE', 409);
  return period.referenceMonth;
}
function quoteFor(account: BillingAccount, month: string): number {
  const quote = quoteIndividualRamp({ firstPaidReferenceMonth: account.firstPaidReferenceMonth, referenceMonth: month });
  if (!quote.allowed || !Number.isSafeInteger(quote.amountCents) || quote.amountCents <= 0)
    throw new BillingAdminError('BILLING_SHARED_QUOTE_INVALID', 409);
  return quote.amountCents as number;
}
function checkShared(cycle: BillingCycle, month: string, amount: number): SharedBillingPayment {
  if (cycle.referenceMonth !== month || cycle.amountCents !== amount || cycle.workspaceId === ''
    || cycle.sharedPayment?.version !== 'shared_v1'
    || cycle.sharedPayment.amountCents !== amount
    || cycle.sharedPayment.parts.length !== cycle.sharedPayment.count)
    throw new BillingAdminError('BILLING_SHARED_CYCLE_MISMATCH', 409);
  return cycle.sharedPayment;
}
function replacePart(shared: SharedBillingPayment, part: SharedBillingPart): SharedBillingPayment {
  return { ...shared, parts: shared.parts.map(p => p.number === part.number ? part : p) };
}
function linkResponse(part: SharedBillingPart, month: string) {
  return {
    status: (part.status === 'paid' ? 'paid' : part.checkoutUrl ? 'ready' : 'pending_review') as
      'paid' | 'ready' | 'pending_review',
    orderNsu: part.orderNsu || '',
    checkoutUrl: part.status === 'paid' ? '' : part.checkoutUrl || '',
    amountCents: part.amountCents, referenceMonth: month,
  };
}

/** Read-only: authenticated workspace session is revalidated against IAM documents. */
export async function readSectorSharedPayment(workspaceId: string, email: string) {
  validWorkspaceId(workspaceId);
  const token = await getGoogleAccessToken();
  const wp = 'workspaces/' + workspaceId, ap = 'billingAccounts/' + workspaceId;
  const [workspaceDoc, accountDoc] = await Promise.all([get(token, wp), get(token, ap)]);
  const workspace = existingWorkspace(workspaceDoc, workspaceId);
  const account = existingAccount(accountDoc);
  assertAccountWorkspace(account, workspace);
  if (workspace.authorizedEmail !== email) throw new BillingAdminError('BILLING_SHARED_NOT_AUTHORIZED', 403);
  if (account.status === 'exempt' || account.exemptionSource || workspaceId === HGESM_WORKSPACE_ID)
    return { enabled: false, eligible: false, shared: null, amountCents: 0, referenceMonth: null };
  if (account.pricingPolicyId !== EMPROVEX_NEW_CUSTOMER_RAMP_ID || !account.firstPaidReferenceMonth)
    return { enabled: false, eligible: false, shared: null, amountCents: 0, referenceMonth: null };
  const period = paidServicePeriod(account);
  if (!period) return { enabled: process.env.EMPROVEX_SHARED_BILLING_ENABLED === '1',
    eligible: false, shared: null, amountCents: 0, referenceMonth: null };
  const month = period.referenceMonth;
  const cycleDoc = await get(token, 'billingCycles/' + billingCycleId(workspaceId, month));
  const cycle = cycleDoc?.value as BillingCycle | undefined;
  const amountCents = quoteFor(account, month);
  // Return persisted split even when the feature flag is subsequently disabled,
  // so confirmed charges never disappear from the customer's view.
  return {
    enabled: process.env.EMPROVEX_SHARED_BILLING_ENABLED === '1',
    eligible: !!account.pricingTermsAcceptedAt && !cycle?.checkoutOrderNsu
      && cycle?.status !== 'paid' && cycle?.status !== 'waived',
    referenceMonth: month, amountCents,
    shared: cycle?.sharedPayment || null,
    cycleStatus: cycle?.status || null,
  };
}

/** Freeze the equal split and explicit fee consent for this service month. */
export async function configureSectorSharedPayment(
  actor: Actor, workspaceId: string, email: string, participantNames: string[], accepted: boolean,
) {
  authorize(actor, workspaceId, email); requireSharedEnabled(); requireCheckoutConfig();
  requireCheckoutWorkspace(workspaceId);
  if (accepted !== true) throw new BillingAdminError('BILLING_SHARED_TERMS_REQUIRED', 400);
  if (!Array.isArray(participantNames) || participantNames.length > 20)
    throw new BillingAdminError('BILLING_SHARED_PARTICIPANTS_INVALID', 400);
  const token = await getGoogleAccessToken();
  const wp = 'workspaces/' + workspaceId, ap = 'billingAccounts/' + workspaceId;
  const account = existingAccount(await get(token, ap));
  const month = activeMonth(account);
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  return transaction(token, [wp, ap, cp], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const currentAccount = existingAccount(docs.get(ap) ?? null);
    verifyCustomer(workspace, currentAccount, email);
    if (activeMonth(currentAccount) !== month) throw new BillingAdminError('BILLING_SHARED_PERIOD_CHANGED', 409);
    const amount = quoteFor(currentAccount, month);
    let shared: SharedBillingPayment;
    try {
      shared = createSharedPayment({ amountCents: amount, participantNames, acceptedAt: new Date().toISOString() }) as SharedBillingPayment;
    } catch {
      throw new BillingAdminError('BILLING_SHARED_PARTICIPANTS_INVALID', 400);
    }
    const previous = docs.get(cp)?.value as BillingCycle | undefined;
    if (previous && (previous.amountCents !== amount || previous.checkoutOrderNsu
      || previous.checkoutState || !['open','pending'].includes(previous.status))) {
      throw new BillingAdminError('BILLING_SHARED_EXISTING_PAYMENT', 409);
    }
    if (previous?.sharedPayment) {
      const existing = previous.sharedPayment;
      if (existing.count === shared.count && existing.parts.every((p,i) => p.name === shared.parts[i].name))
        return { result: { shared: existing, referenceMonth: month }, updates: [] };
      throw new BillingAdminError('BILLING_SHARED_ALREADY_FROZEN', 409);
    }
    const fallback: PlatformBillingConfig = { ...buildPlatformBillingConfig(actor.email), gracePeriodDays: 10 };
    const cycle = previous || { ...buildBillingCycle(currentAccount, month, fallback, actor.email), amountCents: amount };
    const now = new Date().toISOString();
    return {
      result: { shared, referenceMonth: month },
      updates: [
        { path: cp, data: { ...cycle, amountCents: amount, sharedPayment: shared, status: 'pending',
          updatedAt: now, updatedBy: actor.email } },
        audit(actor, 'billing.shared_configured', 'billing_cycle', cycle.id, workspaceId, workspace.ug || null,
          { shared: false }, { shared: true, count: shared.count, feeCents: shared.feeCents },
          { consentVersion: shared.termsVersion, acceptedAt: shared.acceptedAt }),
      ],
    };
  });
}

/** One link per frozen slot, never repeated blindly after an ambiguous dispatch. */
export async function createSectorSharedCheckout(
  actor: Actor, workspaceId: string, email: string, number: number,
) {
  authorize(actor, workspaceId, email); requireSharedEnabled();
  const secret = requireCheckoutConfig(); requireCheckoutWorkspace(workspaceId);
  if (!Number.isSafeInteger(number) || number < 1 || number > 20)
    throw new BillingAdminError('BILLING_SHARED_PART_INVALID', 400);
  const origin = configuredBillingOrigin();
  const token = await getGoogleAccessToken();
  const wp = 'workspaces/' + workspaceId, ap = 'billingAccounts/' + workspaceId;
  const account = existingAccount(await get(token, ap));
  const month = activeMonth(account);
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  const orderNsu = makeOrderNsu({
    workspaceId: workspaceId + '-shared-part-' + number, referenceMonth: month, orderIdSecret: secret,
  });
  const ip = 'billingPaymentIntents/' + orderNsu;
  const prepared = await transaction<SharedCheckoutResult>(token, [wp, ap, cp, ip], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const currentAccount = existingAccount(docs.get(ap) ?? null);
    verifyCustomer(workspace, currentAccount, email);
    if (activeMonth(currentAccount) !== month) throw new BillingAdminError('BILLING_SHARED_PERIOD_CHANGED', 409);
    const cycle = docs.get(cp)?.value as BillingCycle | undefined;
    if (!cycle) throw new BillingAdminError('BILLING_SHARED_NOT_CONFIGURED', 409);
    const shared = checkShared(cycle, month, quoteFor(currentAccount, month));
    const part = shared.parts[number-1];
    if (!part || part.number !== number || part.amountCents !== shared.partAmountCents
      || (part.orderNsu && part.orderNsu !== orderNsu))
      throw new BillingAdminError('BILLING_SHARED_PART_INVALID', 409);
    if (cycle.status === 'paid' || part.status === 'paid')
      return { result: { ...linkResponse(part, month), status: 'paid' as const }, updates: [] };
    if (cycle.status === 'waived') throw new BillingAdminError('BILLING_SHARED_CYCLE_CLOSED', 409);
    const priorIntent = docs.get(ip)?.value as Record<string, unknown> | undefined;
    if (priorIntent && (priorIntent.workspaceId !== workspaceId || priorIntent.sharedPartNumber !== number
        || priorIntent.referenceMonth !== month || priorIntent.amountCents !== part.amountCents))
      throw new BillingAdminError('BILLING_SHARED_ORDER_CONFLICT', 409);
    if (part.checkoutUrl) {
      if (part.checkoutValidUntil && Date.parse(part.checkoutValidUntil) <= Date.now())
        return { result: { ...linkResponse(part, month), status: 'pending_review' as const,
          checkoutUrl: '' }, updates: [] };
      return { result: { ...linkResponse(part, month), status: 'ready' as const }, updates: [] };
    }
    if (part.checkoutState === 'dispatching' || part.checkoutState === 'linked')
      return { result: { ...linkResponse(part, month), status: 'pending_review' as const }, updates: [] };
    if (part.checkoutState === 'prepared') {
      if (!part.checkoutValidUntil || Date.parse(part.checkoutValidUntil) <= Date.now())
        return { result: { ...linkResponse(part, month), status: 'pending_review' as const }, updates: [] };
      return { result: { ...linkResponse(part, month), status: 'reserved' as const,
        checkoutUrl: '' }, updates: [] };
    }
    const validUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    const next = { ...part, orderNsu, checkoutState: 'prepared' as const, checkoutValidUntil: validUntil };
    return {
      result: { status: 'reserved' as const, orderNsu, amountCents: part.amountCents,
        referenceMonth: month, checkoutUrl: '' },
      updates: [
        { path: cp, data: { ...cycle, sharedPayment: replacePart(shared, next), updatedAt: new Date().toISOString() } },
        { path: ip, data: { orderNsu, workspaceId, referenceMonth: month,
          amountCents: part.amountCents, sharedPartNumber: number, status: 'prepared' } },
      ],
    };
  });
  if (prepared.status !== 'reserved') return prepared;
  // Claim the prepared slot in a second transaction: one outbound attempt per order.
  const claimed = await transaction(token, [cp, ip], docs => {
    const cycle = docs.get(cp)?.value as BillingCycle | undefined;
    const intent = docs.get(ip)?.value as Record<string, unknown> | undefined;
    const part = cycle?.sharedPayment?.parts[number-1];
    if (!cycle || !part || !intent || intent.orderNsu !== orderNsu || part.orderNsu !== orderNsu)
      throw new BillingAdminError('BILLING_SHARED_INTENT_CHANGED', 409);
    if (part.status === 'paid' || cycle.status === 'paid')
      return { result: 'paid', updates: [] };
    if (part.checkoutUrl) return { result: 'ready', updates: [] };
    if (part.checkoutState !== 'prepared') return { result: 'pending_review', updates: [] };
    return {
      result: 'claimed',
      updates: [
        { path: cp, data: { ...cycle, sharedPayment: replacePart(cycle.sharedPayment!,
          { ...part, checkoutState: 'dispatching' as const }) } },
        { path: ip, data: { ...intent, status: 'dispatching' } },
      ],
    };
  });
  if (claimed !== 'claimed') {
    const latest = (await get(token, cp))?.value as BillingCycle | undefined;
    const part = latest?.sharedPayment?.parts[number-1];
    return part ? linkResponse(part, month) : { ...prepared, status: 'pending_review' as const };
  }
  // A network timeout after this call is ambiguous: do not retry /links automatically.
  const validUntil = (await get(token, cp))?.value?.sharedPayment?.parts[number-1]?.checkoutValidUntil as string | undefined;
  if (!validUntil) throw new BillingAdminError('BILLING_SHARED_VALIDITY_MISSING', 503);
  let url: string;
  try {
    const response = await callInfinitePay({
      operation: 'links', apiKey: process.env.INFINITEPAY_API_KEY, allowExternalCall: true,
      payload: {
        order_nsu: orderNsu, redirect_url: origin + '/regularizacao',
        items: [{ quantity: 1, price: prepared.amountCents,
          description: 'EMPROVEX - Cota ' + number + '/' + (await get(token, cp))?.value?.sharedPayment?.count + ' - ' + month }],
        options: { single_payment: true, valid_until: validUntil,
          require_delivery_address: false, payment_methods_enabled: ['pix','credit_card'] },
        webhook: { url: origin + '/api/billing/portal?action=infinitepay-webhook&token='
          + encodeURIComponent(process.env.INFINITEPAY_WEBHOOK_TOKEN || ''),
          events: ['paid','settled','refunded','canceled'] },
      },
    });
    url = readCheckoutUrl(response);
  } catch {
    return { ...prepared, status: 'pending_review' as const };
  }
  try {
    return await transaction<SharedCheckoutResult>(token, [cp, ip], docs => {
      const cycle = docs.get(cp)?.value as BillingCycle | undefined;
      const intent = docs.get(ip)?.value as Record<string, unknown> | undefined;
      const part = cycle?.sharedPayment?.parts[number-1];
      if (!cycle || !part || !intent || part.orderNsu !== orderNsu)
        throw new BillingAdminError('BILLING_SHARED_LINK_CHANGED', 409);
      if (cycle.status === 'paid' || part.status === 'paid')
        return { result: { ...prepared, status: 'paid' as const, checkoutUrl: '' }, updates: [] };
      if (part.checkoutUrl)
        return { result: { ...prepared, status: part.checkoutUrl === url ? 'ready' as const : 'pending_review' as const,
          checkoutUrl: part.checkoutUrl === url ? url : '' }, updates: [] };
      if (part.checkoutState !== 'dispatching')
        return { result: { ...prepared, status: 'pending_review' as const }, updates: [] };
      return {
        result: { ...prepared, status: 'ready' as const, checkoutUrl: url },
        updates: [
          { path: cp, data: { ...cycle, sharedPayment: replacePart(cycle.sharedPayment!,
              { ...part, checkoutUrl: url, checkoutState: 'linked' as const }) } },
          { path: ip, data: { ...intent, checkoutUrl: url, status: 'linked' } },
        ],
      };
    });
  } catch {
    // There may already be a real link; never dispatch the provider POST again.
    return { ...prepared, status: 'pending_review' as const };
  }
}

/** Independently verified settlement of exactly one slot, atomic with ledger. */
export async function reconcileSectorSharedPayment(
  actor: Actor, workspaceId: string, email: string, input: PaymentReturn,
) {
  authorize(actor, workspaceId, email); requireCheckoutConfig();
  if (!codePattern.test(input.orderNsu)
      || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(input.transactionNsu)
      || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(input.slug))
    throw new BillingAdminError('BILLING_SHARED_RETURN_INVALID', 400);
  const token = await getGoogleAccessToken();
  const ip = 'billingPaymentIntents/' + input.orderNsu;
  const initial = (await get(token, ip))?.value as Record<string, unknown> | undefined;
  if (!initial || initial.workspaceId !== workspaceId
      || !Number.isSafeInteger(initial.sharedPartNumber)
      || !Number.isSafeInteger(initial.amountCents))
    throw new BillingAdminError('BILLING_SHARED_ORDER_UNKNOWN', 404);
  const month = initial.referenceMonth as string;
  const number = initial.sharedPartNumber as number;
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  const snapshot = (await get(token, cp))?.value as BillingCycle | undefined;
  const part = snapshot?.sharedPayment?.parts[number-1];
  if (!snapshot || !part || part.orderNsu !== input.orderNsu || part.amountCents !== initial.amountCents)
    throw new BillingAdminError('BILLING_SHARED_INTENT_MISMATCH', 409);
  const check = await callInfinitePay({
    operation: 'payment_check', apiKey: process.env.INFINITEPAY_API_KEY,
    payload: { handle: process.env.INFINITEPAY_HANDLE, order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu, slug: input.slug }, allowExternalCall: true,
  });
  const assessed = assessPaymentCheck({ amountCents: part.amountCents, paymentCheck: check });
  if (!assessed.verified) return { verified: false, code: assessed.reason };
  const lp = 'billingPaymentLedger/infinitepay_' + createHash('sha256').update(input.transactionNsu).digest('hex');
  const wp = 'workspaces/' + workspaceId, ap = 'billingAccounts/' + workspaceId;
  return transaction(token, [wp, ap, cp, lp, CONFIG_PATH], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const account = existingAccount(docs.get(ap) ?? null);
    verifyCustomer(workspace, account, email, true);
    const cycle = docs.get(cp)?.value as BillingCycle | undefined;
    if (!cycle || cycle.workspaceId !== workspaceId || cycle.sharedPayment?.version !== 'shared_v1'
        || cycle.sharedPayment.amountCents !== cycle.amountCents)
      throw new BillingAdminError('BILLING_SHARED_CYCLE_CHANGED', 409);
    const shared = cycle.sharedPayment;
    const currentPart = shared.parts[number-1];
    if (!currentPart || currentPart.orderNsu !== input.orderNsu || currentPart.amountCents !== check.amount)
      throw new BillingAdminError('BILLING_SHARED_AMOUNT_CHANGED', 409);
    const prior = docs.get(lp)?.value as Record<string, unknown> | undefined;
    if (prior) {
      if (prior.orderNsu === input.orderNsu && prior.workspaceId === workspaceId
          && prior.sharedPartNumber === number && currentPart.status === 'paid')
        return { result: { verified: true, code: 'BILLING_SHARED_ALREADY_VERIFIED',
          fullyPaid: cycle.status === 'paid' }, updates: [] };
      throw new BillingAdminError('BILLING_TRANSACTION_REUSE_CONFLICT', 409);
    }
    if (cycle.status === 'paid' || cycle.status === 'waived' || currentPart.status === 'paid')
      throw new BillingAdminError('BILLING_SHARED_ALREADY_SETTLED', 409);
    const now = new Date().toISOString();
    const nextShared = applySharedPayment(shared, number, lp.slice('billingPaymentLedger/'.length), now) as SharedBillingPayment;
    const fullyPaid = nextShared.fullyPaid === true;
    const nextCycle: BillingCycle = {
      ...cycle, sharedPayment: nextShared,
      status: fullyPaid ? 'paid' : 'pending',
      ...(fullyPaid ? { confirmedAt: now, confirmedBy: 'provider:infinitepay',
        checkoutState: 'settled' as const,
        note: 'Mensalidade compartilhada integralmente verificada pela InfinitePay' } : {}),
      updatedAt: now, updatedBy: 'provider:infinitepay',
    };
    const updates: Array<{ path: string; data: object }> = [
      { path: cp, data: nextCycle },
      { path: lp, data: { provider: 'infinitepay', workspaceId, cycleId: cycle.id,
        orderNsu: input.orderNsu, transactionNsu: input.transactionNsu, invoiceSlug: input.slug,
        amountCents: currentPart.amountCents, baseAmountCents: cycle.amountCents,
        divisionFeeCents: shared.feeCents, sharedPartNumber: number,
        method: check.capture_method, verifiedAt: now } },
      audit(actor, 'billing.shared_part_verified', 'billing_cycle', cycle.id,
        workspaceId, workspace.ug || null,
        { paidCount: shared.paidCount || 0 }, { paidCount: nextShared.paidCount, fullyPaid },
        { provider: 'infinitepay', sharedPartNumber: number, ledgerId: lp }),
    ];
    if (fullyPaid) {
      const nextAccount: BillingAccount = { ...account, status: 'active', monthlyPriceCents: cycle.amountCents,
        lastBilledReferenceMonth: !account.lastBilledReferenceMonth
          || cycle.referenceMonth > account.lastBilledReferenceMonth
          ? cycle.referenceMonth : account.lastBilledReferenceMonth,
        ...(cycle.referenceMonth === account.grace48ReferenceMonth
          ? { grace48ReviewStatus: 'confirmed' as const } : {}),
        updatedAt: now, updatedBy: 'provider:infinitepay' };
      updates.push({ path: ap, data: nextAccount });
      const period = paidServicePeriod(account);
      if (period?.referenceMonth === cycle.referenceMonth) {
        const config = docs.get(CONFIG_PATH)?.value as PlatformBillingConfig | undefined;
        updates.push({ path: wp, data: { ...workspace,
          billingEntitlementUntil: paidServiceAccessUntil(period, config?.gracePeriodDays || 0) } });
      }
    }
    return { result: { verified: true, code: fullyPaid ? 'BILLING_SHARED_CYCLE_PAID'
      : 'BILLING_SHARED_PART_CONFIRMED', fullyPaid }, updates };
  });
}

/** Retain the legacy full checkout and refund-review path unchanged. */
export async function reconcileSharedOrFullReturn(
  actor: Actor, workspaceId: string, email: string, input: PaymentReturn,
) {
  if (!codePattern.test(input.orderNsu)) throw new BillingAdminError('BILLING_INVALID_PROVIDER_RETURN', 400);
  const token = await getGoogleAccessToken();
  const intent = (await get(token, 'billingPaymentIntents/' + input.orderNsu))?.value;
  if (intent?.sharedPartNumber) {
    if (intent.workspaceId !== workspaceId) throw new BillingAdminError('BILLING_SHARED_TENANT_MISMATCH', 403);
    return reconcileSectorSharedPayment(actor, workspaceId, email, input);
  }
  return reconcileSectorSubscriptionPayment(actor, workspaceId, email, input);
}
export async function reconcileSharedOrFullWebhook(
  input: PaymentReturn & { event: string },
) {
  if (!codePattern.test(input.orderNsu)) throw new BillingAdminError('BILLING_UNKNOWN_ORDER', 400);
  const token = await getGoogleAccessToken();
  const intent = (await get(token, 'billingPaymentIntents/' + input.orderNsu))?.value;
  if (intent?.sharedPartNumber && ['paid','settled'].includes(input.event)) {
    const workspace = existingWorkspace(
      await get(token, 'workspaces/' + intent.workspaceId), intent.workspaceId);
    const actor = { uid: 'infinitepay', email: workspace.authorizedEmail };
    return reconcileSectorSharedPayment(actor, workspace.id, actor.email, input);
  }
  return reconcileInfinitePayWebhook(input);
}
