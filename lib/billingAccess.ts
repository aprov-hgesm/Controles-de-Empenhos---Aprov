import type { BillingAccount, BillingCycle } from './billing';
import { addUtcDays, getReferenceMonth, paidServicePeriod } from './billing';
import { EMPROVEX_NEW_CUSTOMER_RAMP_ID } from './billing';

export type BillingAccessReason = 'vip' | 'trial' | 'paid' | 'grace48' | 'payment_required' | 'trial_ended' | 'suspended' | 'canceled' | 'account_missing' | 'legacy_contract' | 'observe' | 'due_grace';
export interface BillingAccessDecision {
  allowed: boolean;
  reason: BillingAccessReason;
  referenceMonth: string;
  amountCents: number | null;
  graceUntil: string | null;
  canRequestGrace48: boolean;
  requestPending: boolean;
  requiresPayment: boolean;
}

/** Server-authoritative decision. Client never chooses workspace, month or amount. */
export function decideBillingAccess(
  account: BillingAccount | null,
  cycle: BillingCycle | null,
  now: Date = new Date(),
  previousCycle: BillingCycle | null = null,
  renewalGraceDays = 0,
): BillingAccessDecision {
  const period = account?.pricingPolicyId === EMPROVEX_NEW_CUSTOMER_RAMP_ID
    ? paidServicePeriod(account, now) : null;
  const month = period?.referenceMonth || getReferenceMonth(now);
  const base = {
    referenceMonth: month,
    amountCents: account?.monthlyPriceCents ?? null,
    graceUntil: account?.grace48ReferenceMonth === month ? account.grace48Until || null : null,
    canRequestGrace48: false,
    requestPending: account?.grace48ReferenceMonth === month && account.grace48ReviewStatus === 'pending',
    requiresPayment: false,
  };
  const allow = (reason: BillingAccessReason): BillingAccessDecision => ({ ...base, allowed: true, reason });
  const deny = (reason: BillingAccessReason, canRequestGrace48 = false): BillingAccessDecision =>
    ({ ...base, allowed: false, reason, requiresPayment: true, canRequestGrace48 });
  if (!account) return deny('account_missing');
  if (account.status === 'exempt' || account.exemptionSource) return allow('vip');
  if (account.status === 'canceled') return deny('canceled');
  if (account.status === 'suspended') return deny('suspended');
  // Existing contracts cannot be silently migrated or blocked by an unknown billing policy.
  if (!account.pricingPolicyId) return allow('legacy_contract');
  if (account.pricingPolicyId !== EMPROVEX_NEW_CUSTOMER_RAMP_ID) return deny('payment_required');
  if (account.trialGranted && account.trialEndsAt
    && now.getTime() < Date.parse(account.trialEndsAt)) return allow('trial');
  const first = account.firstPaidReferenceMonth;
  if (!first || !period) return allow('trial');
  if (cycle && cycle.workspaceId === account.workspaceId
    && cycle.referenceMonth === month && (cycle.status === 'paid' || cycle.status === 'waived')) return allow('paid');
  if (base.graceUntil && now.getTime() < Date.parse(base.graceUntil)) return allow('grace48');
  if (period && period.periodNumber > 1 && previousCycle
    && previousCycle.workspaceId === account.workspaceId
    && (previousCycle.status === 'paid' || previousCycle.status === 'waived')
    && now.getTime() < addUtcDays(period.startsAt, renewalGraceDays).getTime())
    return allow('due_grace');
  const canRequest = account.grace48ReferenceMonth !== month;
  return deny(account.trialGranted ? 'trial_ended' : 'payment_required', canRequest);
}
