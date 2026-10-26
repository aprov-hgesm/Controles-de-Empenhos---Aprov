import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileInfinitePayWebhook } from '../../../../lib/server/platformBillingAdminStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.INFINITEPAY_WEBHOOK_TOKEN || '';
  const received = new URL(request.url).searchParams.get('token') || '';
  // The provider callback has no trustworthy payment evidence of its own.
  // This token protects the endpoint from arbitrary traffic, and every paid
  // event MUST also pass server-to-server payment_check before any settlement.
  const a = Buffer.from(secret);
  const b = Buffer.from(received);
  if (a.length < 32 || a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ code: 'BILLING_WEBHOOK_UNAUTHORIZED' }, { status: 401 });
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return NextResponse.json({ code: 'BILLING_WEBHOOK_JSON_REQUIRED' }, { status: 415 });
  const length = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(length) || length > 16384)
    return NextResponse.json({ code: 'BILLING_WEBHOOK_TOO_LARGE' }, { status: 413 });
  try {
    const bodyText = await request.text();
    if (bodyText.length > 16384) throw new Error('WEBHOOK_TOO_LARGE');
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('INVALID_BODY');
    const event = typeof data.event === 'string' ? data.event
      : typeof data.type === 'string' ? data.type : 'paid';
    const result = await reconcileInfinitePayWebhook({
      orderNsu: typeof data.order_nsu === 'string' ? data.order_nsu : '',
      transactionNsu: typeof data.transaction_nsu === 'string' ? data.transaction_nsu : '',
      slug: typeof data.slug === 'string' ? data.slug
        : typeof data.invoice_slug === 'string' ? data.invoice_slug : '',
      event,
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    // Safe to retry on provider side; no confirmation is granted on failure.
    return NextResponse.json({ code: 'BILLING_WEBHOOK_RETRY' }, { status: 503 });
  }
}
