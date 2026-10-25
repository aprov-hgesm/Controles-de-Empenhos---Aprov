import { NextResponse } from 'next/server';
import { resolveBillingPortalSession, BillingPortalFailure } from '../../../../lib/server/billingPortalIdentity';
import { callInfinitePay } from '../../../../lib/server/payments/infinitepayCheckout.mjs';
import {
  pilotEnabledFor, pilotOrderForDate, pilotCheckoutRequest, readCheckoutUrl,
} from '../../../../lib/server/payments/infinitepayPortalPilot.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
