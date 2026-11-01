import { NextResponse } from 'next/server';

import { listCompanyDirectory } from '../../../../lib/server/companyProvisioningAdmin';
import { SectorProvisioningFailure, verifyFounderSession } from '../../../../lib/server/sectorProvisioningAdmin';
import {
  ApiSecurityError,
  apiSecurityErrorHeaders,
  createRequestSecurityContext,
  enforceAuthenticatedAdminBurstLimit,
  enforcePreAuthBurstLimit,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const security = createRequestSecurityContext(request, 'company-list');
  try {
    enforcePreAuthBurstLimit(security);
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
    const founder = await verifyFounderSession(bearer);
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'read');
    const companies = await listCompanyDirectory();
    return NextResponse.json({ ok: true, result: { companies } }, {
      headers: securityResponseHeaders(security),
    });
  } catch (error) {
    if (error instanceof ApiSecurityError) return NextResponse.json({
      ok: false, error: error.message, code: error.code,
    }, { status: error.httpStatus, headers: apiSecurityErrorHeaders(security, error) });
    if (error instanceof SectorProvisioningFailure) return NextResponse.json({
      ok: false, error: error.message, code: error.code,
    }, { status: error.httpStatus, headers: securityResponseHeaders(security) });
    console.error('Unexpected EMPROVEX company directory error.', {
      requestId: security.requestId, error,
    });
    return NextResponse.json({
      ok: false, code: 'UPSTREAM_ERROR', error: 'Não foi possível consultar as empresas.',
    }, { status: 502, headers: securityResponseHeaders(security) });
  }
}
