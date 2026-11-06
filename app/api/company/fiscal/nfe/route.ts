import { NextResponse } from 'next/server';
import { companyErrorStatus, requireCompanyContext } from '@/lib/server/companyAuthz';

/**
 * W14 fiscal endpoint intentionally fails closed until W10 installs:
 * - live multi-CNPJ fiscal RBAC and active-profile guards
 * - durable Firestore CAS and idempotency indexes
 * - issuer-verification, WLG vault, signed XML validation and W5 private storage.
 * No server credentials, provider calls or real invoice mutations here.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
async function handle(request: Request, action: 'accountsReceivable:read' | 'accountsReceivable:write') {
  try {
    await requireCompanyContext(request, { action });
    return NextResponse.json({
      ok: false, code: 'NFE_INTEGRATION_PENDING',
      error: 'Emissão fiscal indisponível até integração e homologação autorizada.',
    }, { status: 503, headers });
  } catch (error) {
    const status = companyErrorStatus(error);
    return NextResponse.json({ ok: false, code: 'COMPANY_ACCESS_DENIED' },
      { status, headers });
  }
}
export async function GET(request: Request) {
  return handle(request, 'accountsReceivable:read');
}
export async function POST(request: Request) {
  return handle(request, 'accountsReceivable:write');
}
