import { NextResponse } from 'next/server';
import { FounderAuthError, verifyFounderFirebaseRequest } from '../../../../lib/server/firebaseFounderAuth';
import { BillingAdminError, mutateBillingAdmin, readBillingAdminDirectory } from '../../../../lib/server/platformBillingAdminStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Authorization' };

async function founder(request: Request) {
  return verifyFounderFirebaseRequest(request.headers.get('authorization'));
}
function failure(error: unknown) {
  if (error instanceof FounderAuthError) {
    return NextResponse.json({ code: 'BILLING_AUTH_REJECTED' }, { status: error.status, headers: HEADERS });
  }
  if (error instanceof BillingAdminError) {
    return NextResponse.json({ code: error.code }, { status: error.status, headers: HEADERS });
  }
  console.error('BILLING_SERVER_UNEXPECTED_ERROR', {
    error: error instanceof Error ? error.name : 'unknown',
  });
  return NextResponse.json({ code: 'BILLING_ADMIN_UNAVAILABLE' }, { status: 503, headers: HEADERS });
}
export async function GET(request: Request) {
  try {
    await founder(request);
    const directory = await readBillingAdminDirectory();
    return NextResponse.json(directory, { headers: HEADERS });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await founder(request);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json'))
      return NextResponse.json({ code: 'BILLING_JSON_REQUIRED' }, { status: 400, headers: HEADERS });
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > 8192) return NextResponse.json({ code: 'BILLING_REQUEST_TOO_LARGE' }, { status: 413, headers: HEADERS });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8192)
      return NextResponse.json({ code: 'BILLING_REQUEST_TOO_LARGE' }, { status: 413, headers: HEADERS });
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { return NextResponse.json({ code: 'BILLING_INVALID_JSON' }, { status: 400, headers: HEADERS }); }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return NextResponse.json({ code: 'BILLING_INVALID_INPUT' }, { status: 400, headers: HEADERS });
    const result = await mutateBillingAdmin(actor, body as Parameters<typeof mutateBillingAdmin>[1]);
    return NextResponse.json({ ok: true, result }, { headers: HEADERS });
  } catch (error) {
    return failure(error);
  }
}
