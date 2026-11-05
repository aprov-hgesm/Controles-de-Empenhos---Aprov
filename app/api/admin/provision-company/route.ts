import { NextResponse } from 'next/server';

import { parseCompanyProvisioningInput } from '../../../../lib/companyProvisioning';
import {
  CompanyProvisioningFailure,
  provisionCompanyWorkspaceWithAuth,
} from '../../../../lib/server/companyProvisioningAdmin';
import { SectorProvisioningFailure, verifyFounderSession } from '../../../../lib/server/sectorProvisioningAdmin';
import {
  ApiSecurityError,
  apiSecurityErrorHeaders,
  assertAdminMutationEnabled,
  createRequestSecurityContext,
  enforceAuthenticatedAdminBurstLimit,
  enforcePreAuthBurstLimit,
  readBoundedJsonRequest,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const security = createRequestSecurityContext(request, 'company-provision');
  try {
    enforcePreAuthBurstLimit(security);
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
    const founder = await verifyFounderSession(bearer);
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'mutation');
    assertAdminMutationEnabled(security, 'company-provision');

    let input;
    try {
      input = parseCompanyProvisioningInput(
        await readBoundedJsonRequest<unknown>(request, security)
      );
    } catch (error) {
      if (error instanceof ApiSecurityError) throw error;
      throw new CompanyProvisioningFailure('Cadastro empresarial inválido.', 'INVALID_INPUT', 400);
    }

    const result = await provisionCompanyWorkspaceWithAuth(input, founder);
    return NextResponse.json({ ok: true, result }, {
      status: 201,
      headers: securityResponseHeaders(security),
    });
  } catch (error) {
    if (error instanceof ApiSecurityError) return NextResponse.json({
      ok: false, code: error.code, error: error.message, recoveryRequired: false,
    }, { status: error.httpStatus, headers: apiSecurityErrorHeaders(security, error) });
    if (error instanceof CompanyProvisioningFailure || error instanceof SectorProvisioningFailure) {
      return NextResponse.json({
        ok: false, code: error.code, error: error.message,
        recoveryRequired: error instanceof CompanyProvisioningFailure && error.recoveryRequired,
      }, { status: error.httpStatus, headers: securityResponseHeaders(security) });
    }
    console.error('Unexpected EMPROVEX company provisioning error.', {
      requestId: security.requestId, error,
    });
    return NextResponse.json({
      ok: false, code: 'UPSTREAM_ERROR', error: 'Erro ao cadastrar a empresa.',
      recoveryRequired: false,
    }, { status: 500, headers: securityResponseHeaders(security) });
  }
}
