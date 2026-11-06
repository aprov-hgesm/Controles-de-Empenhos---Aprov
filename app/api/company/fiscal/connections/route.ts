import { NextResponse } from 'next/server';
import { requireCompanyContext, companyErrorStatus } from '../../../../../lib/server/companyAuthz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};
function failure(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return NextResponse.json({ ok: false, code: String(error.code).slice(0, 80) },
      { status: companyErrorStatus(error), headers });
  }
  return NextResponse.json({ ok: false, code: 'WLG_SERVICE_UNAVAILABLE' },
    { status: 503, headers });
}
/**
 * Read requires the existing W10 live finance role (owner/admin/finance);
 * financial roles cannot configure connections. This is NOT a fake connection.
 * W10 must integrate a server-side credential vault + persistence before GET
 * can expose metadata. No fiscal resource is read or written meanwhile.
 */
export async function GET(request: Request) {
  try {
    await requireCompanyContext(request, { action: 'accountsReceivable:read' });
    return NextResponse.json({ ok: false, code: 'WLG_CONNECTION_INTEGRATION_PENDING' },
      { status: 503, headers });
  } catch (error) { return failure(error); }
}
/** W10 alone enables the mutation contract and new fiscal capability. */
export async function POST(request: Request) {
  try {
    await requireCompanyContext(request, { action: 'members:write' });
    return NextResponse.json({ ok: false, code: 'WLG_CONFIGURATION_DISABLED' },
      { status: 503, headers });
  } catch (error) { return failure(error); }
}
export const PUT = POST;
export const DELETE = POST;
