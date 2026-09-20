import { NextResponse } from 'next/server';

import {
  SectorProvisioningFailure,
  resetSectorPasswordWithAuth,
  verifyFounderSession,
} from '../../../../lib/server/sectorProvisioningAdmin';
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

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function POST(request: Request) {
  const security = createRequestSecurityContext(request, 'sector-password-reset');

  try {
    enforcePreAuthBurstLimit(security);
    const founder = await verifyFounderSession(bearerToken(request));
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'mutation');
    assertAdminMutationEnabled(security, 'sector-password-reset');

    const body = await readBoundedJsonRequest<{
      workspaceId?: unknown;
      email?: unknown;
      newPassword?: unknown;
    }>(request, security);

    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    const email = typeof body?.email === 'string' ? body.email : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    const result = await resetSectorPasswordWithAuth(
      workspaceId,
      email,
      newPassword,
      founder
    );

    return NextResponse.json(
      { ok: true, result },
      { headers: securityResponseHeaders(security) }
    );
  } catch (error) {
    if (error instanceof ApiSecurityError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          recoveryRequired: false,
        },
        {
          status: error.httpStatus,
          headers: apiSecurityErrorHeaders(security, error),
        }
      );
    }

    if (error instanceof SectorProvisioningFailure) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          recoveryRequired: error.recoveryRequired,
        },
        {
          status: error.httpStatus,
          headers: securityResponseHeaders(security),
        }
      );
    }

    console.error('Unexpected EMPROVEX sector password reset failure.', {
      requestId: security.requestId,
      error,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível redefinir a senha do setor com segurança.',
        code: 'UPSTREAM_ERROR',
        recoveryRequired: false,
      },
      {
        status: 500,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
