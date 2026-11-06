import { NextResponse } from 'next/server';
import { CompanyAccessError } from '../../../../lib/server/companySession';

import { verifySelectedCompanySession } from '../../../../lib/server/companyProfiles/integration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await verifySelectedCompanySession(request);
    return NextResponse.json(session, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    const status = error instanceof CompanyAccessError ? error.status : 503;
    const code = error instanceof CompanyAccessError ? error.code : 'COMPANY_SESSION_UNAVAILABLE';
    if (!(error instanceof CompanyAccessError)) console.error('Company session validation failed.', error);
    return NextResponse.json(
      { code },
      { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  }
}
