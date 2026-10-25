import { NextResponse } from 'next/server';
import { resolveBillingPortalSession, BillingPortalFailure } from '../../../../lib/server/billingPortalIdentity';
import { callInfinitePay } from '../../../../lib/server/payments/infinitepayCheckout.mjs';
import {
  pilotEnabledFor, pilotReturnBelongsToSession, verifyPilotResponse,
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
      verified: result.verified, code: result.code || result.reason,
      settlesSubscription: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure ? error.code : 'PILOT_VERIFICATION_FAILED';
    const status = error instanceof BillingPortalFailure ? error.status : 502;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
