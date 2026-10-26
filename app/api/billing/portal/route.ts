import { NextResponse } from 'next/server';
import { resolveBillingPortalSession, BillingPortalFailure } from '../../../../lib/server/billingPortalIdentity';
import { pilotEnabledFor } from '../../../../lib/server/payments/infinitepayPortalPilot.mjs';
import { readBillingCycleHistory } from '../../../../lib/server/billingRecentCycles';
import { acceptNewCustomerRamp, readSectorBillingAccess, requestSectorGrace48,
  createSectorSubscriptionCheckout, reconcileSectorSubscriptionPayment, BillingAdminError } from '../../../../lib/server/platformBillingAdminStore';

import { callInfinitePay } from '../../../../lib/server/payments/infinitepayCheckout.mjs';
import {
  pilotOrderForDate, pilotCheckoutRequest, readCheckoutUrl,
  pilotReturnBelongsToSession, verifyPilotResponse,
} from '../../../../lib/server/payments/infinitepayPortalPilot.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { workspace, account, email } = await resolveBillingPortalSession(request);
    const view = new URL(request.url).searchParams.get('view');
    if (view === 'access') {
      const decision = await readSectorBillingAccess(workspace.id, email);
      return NextResponse.json(decision, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    // The payment tab needs the pilot allowlist, not the financial ledger.
    // Preserve the historical default (no view param returns history) for callers.
    const needsHistory = view !== 'payments';
    const history = !needsHistory
      ? { available: false, cycles: [] }
      : account?.status === 'exempt'
        ? { available: true, cycles: [] }
        : await readBillingCycleHistory(workspace.id);
    return NextResponse.json({
      workspaceName: workspace.name,
      accountStatus: account?.status ?? 'unavailable',
      accountExempt: account?.status === 'exempt',
      accountMonthlyCents: account?.monthlyPriceCents ?? null,
      trialEndsAt: account?.trialEndsAt || null,
      pricingPolicyId: account?.pricingPolicyId || null,
      firstPaidReferenceMonth: account?.firstPaidReferenceMonth || null,
      pricingTermsAcceptedAt: account?.pricingTermsAcceptedAt || null,
      history,
      pilot: {
        enabled: Boolean(pilotEnabledFor({ email, workspaceId: workspace.id, env: process.env })),
        amountCents: 100,
        simulatedOnlyForExempt: true,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure ? error.code : 'BILLING_PORTAL_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}


async function createPilotCheckout(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    if (!pilotEnabledFor({ email, workspaceId: workspace.id, env: process.env })) {
      return NextResponse.json({ code: 'PILOT_NOT_ENABLED' }, { status: 403 });
    }
    const raw = await request.text();
    if (raw.length > 300) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); }
    catch { return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 }); }
    if (data.confirmRealPix !== true || data.amountCents !== 100) {
      return NextResponse.json({ code: 'EXPLICIT_PILOT_CONFIRMATION_REQUIRED' }, { status: 400 });
    }
    const orderNsu = pilotOrderForDate({ uid, workspaceId: workspace.id, env: process.env });
    const requestBody = pilotCheckoutRequest({ orderNsu });
    const response = await callInfinitePay({
      operation: 'links',
      apiKey: process.env.INFINITEPAY_API_KEY,
      payload: requestBody,
      allowExternalCall: true,
    });
    const checkoutUrl = readCheckoutUrl(response);
    return NextResponse.json({
      mode: 'real_pix_pilot_no_subscription', amountCents: 100,
      orderNsu, checkoutUrl, settlesSubscription: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure ? error.code : 'PILOT_CHECKOUT_FAILED';
    const status = error instanceof BillingPortalFailure ? error.status : 502;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}


async function verifyPilotCheckout(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    if (!pilotEnabledFor({ email, workspaceId: workspace.id, env: process.env })) {
      return NextResponse.json({ code: 'PILOT_NOT_ENABLED' }, { status: 403 });
    }
    const raw = await request.text();
    if (raw.length > 900) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); }
    catch { return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 }); }
    const orderNsu = data.orderNsu;
    const transactionNsu = data.transactionNsu;
    const slug = data.slug;
    if (typeof orderNsu !== 'string' || !pilotReturnBelongsToSession({
      orderNsu, uid, workspaceId: workspace.id, env: process.env,
    }) || typeof transactionNsu !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(transactionNsu)
      || typeof slug !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(slug)) {
      return NextResponse.json({ code: 'PILOT_RETURN_NOT_OWNED' }, { status: 400 });
    }

    const paymentCheck = await callInfinitePay({
      operation: 'payment_check',
      apiKey: process.env.INFINITEPAY_API_KEY,
      payload: {
        handle: process.env.INFINITEPAY_HANDLE,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug,
      },
      allowExternalCall: true,
    });
    const result = verifyPilotResponse({ paymentCheck });
    return NextResponse.json({
      verified: result.verified, code: 'code' in result ? result.code : result.reason,
      settlesSubscription: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure ? error.code : 'PILOT_VERIFICATION_FAILED';
    const status = error instanceof BillingPortalFailure ? error.status : 502;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}



/**
 * Authenticated explicit agreement of the sector to all 5 price tiers.
 * No checkout, charge, legacy migration, or cross-workspace selection.
 */
async function acceptRampTerms(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
      return NextResponse.json({ code: 'BILLING_ACCEPTANCE_JSON_REQUIRED' }, { status: 400 });
    const raw = await request.text();
    if (raw.length > 300) return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); }
    catch { return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 }); }
    if (data.acceptFullPricingSchedule !== true
      || data.policyId !== 'emprovex_individual_ramp_v1')
      return NextResponse.json({ code: 'BILLING_EXPLICIT_CONSENT_REQUIRED' }, { status: 400 });
    const result = await acceptNewCustomerRamp({ uid, email }, workspace.id, email);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.code : 'BILLING_ACCEPTANCE_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}


async function requestGrace48(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    const data = await request.text();
    if (data.length > 100) return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    let body: { confirm?: boolean } = {};
    try { body = JSON.parse(data) as { confirm?: boolean }; } catch {
      return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    }
    if (body.confirm !== true) return NextResponse.json({ code: 'BILLING_EXPLICIT_GRACE_REQUEST_REQUIRED' }, { status: 400 });
    const result = await requestSectorGrace48({ uid, email }, workspace.id, email);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.code : 'BILLING_GRACE_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}


async function subscriptionCheckout(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    const raw = await request.text();
    if (raw.length > 128) return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    let body: { confirmRealPayment?: boolean } = {};
    try { body = JSON.parse(raw) as { confirmRealPayment?: boolean }; } catch {
      return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    }
    if (body.confirmRealPayment !== true)
      return NextResponse.json({ code: 'BILLING_EXPLICIT_PAYMENT_INTENT_REQUIRED' }, { status: 400 });
    const result = await createSectorSubscriptionCheckout({ uid, email }, workspace.id, email);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.code : 'BILLING_CHECKOUT_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}

async function verifySubscription(request: Request) {
  try {
    const { uid, email, workspace } = await resolveBillingPortalSession(request);
    const raw = await request.text();
    if (raw.length > 800) return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    let body: { orderNsu?: string; transactionNsu?: string; slug?: string };
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ code: 'BILLING_INVALID_REQUEST' }, { status: 400 });
    }
    const result = await reconcileSectorSubscriptionPayment({ uid, email }, workspace.id, email, {
      orderNsu: body.orderNsu || '', transactionNsu: body.transactionNsu || '', slug: body.slug || '',
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.code : 'BILLING_RECONCILIATION_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure || error instanceof BillingAdminError
      ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get('action');
  if (action === 'subscription-checkout') return subscriptionCheckout(request);
  if (action === 'verify-subscription') return verifySubscription(request);
  if (action === 'request-grace48') return requestGrace48(request);
  if (action === 'accept-pricing') return acceptRampTerms(request);
  if (action === 'create-pilot') return createPilotCheckout(request);
  if (action === 'verify-pilot') return verifyPilotCheckout(request);
  return NextResponse.json({ code: 'BILLING_OPERATION_UNKNOWN' }, {
    status: 404, headers: { 'Cache-Control': 'no-store' },
  });
}
