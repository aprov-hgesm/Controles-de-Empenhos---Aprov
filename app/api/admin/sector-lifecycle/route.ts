import { NextResponse } from 'next/server';

import {
  SectorLifecycleFailure,
  applySectorLifecycleStatus,
  parseSectorLifecycleInput,
} from '../../../../lib/server/sectorLifecycleAdmin';
import {
  SectorProvisioningFailure,
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
  const security = createRequestSecurityContext(request, 'sector-lifecycle');

  try {
    enforcePreAuthBurstLimit(security);
    const founder = await verifyFounderSession(bearerToken(request));
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'mutation');
    assertAdminMutationEnabled(security, 'sector-lifecycle');

    let input;
    try {
      input = parseSectorLifecycleInput(
        await readBoundedJsonRequest<unknown>(request, security)
      );
    } catch (error) {
      if (error instanceof ApiSecurityError || error instanceof SectorLifecycleFailure) {
        throw error;
      }
      throw new SectorLifecycleFailure(
        'A solicitação de suspensão/reativação é inválida.',
        'INVALID_INPUT',
        400
      );
    }

    const result = await applySectorLifecycleStatus(input, founder);

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

    if (error instanceof SectorLifecycleFailure) {
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

    console.error('Unexpected EMPROVEX sector lifecycle failure.', {
      requestId: security.requestId,
      error,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível concluir a suspensão/reativação segura do setor.',
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
