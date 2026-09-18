import { NextResponse } from 'next/server';

import {
  SectorProvisioningFailure,
  provisionSectorWorkspaceWithAuth,
  verifyFounderSession,
} from '../../../../lib/server/sectorProvisioningAdmin';
import { parseSectorProvisioningInput } from '../../../../lib/sectorProvisioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function POST(request: Request) {
  try {
    const founder = await verifyFounderSession(bearerToken(request));

    let input;
    try {
      input = parseSectorProvisioningInput(await request.json());
    } catch {
      throw new SectorProvisioningFailure(
        'A solicitação de provisionamento é inválida.',
        'INVALID_INPUT',
        400
      );
    }

    const result = await provisionSectorWorkspaceWithAuth(input, founder);

    return NextResponse.json({
      ok: true,
      result: {
        workspace: result.workspace,
        account: result.account,
        authUserReused: result.authUserReused,
      },
    });
  } catch (error) {
    if (error instanceof SectorProvisioningFailure) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          recoveryRequired: error.recoveryRequired,
        },
        { status: error.httpStatus }
      );
    }

    console.error('Unexpected EMPROVEX sector provisioning failure.', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível concluir o provisionamento seguro do setor.',
        code: 'UPSTREAM_ERROR',
        recoveryRequired: false,
      },
      { status: 500 }
    );
  }
}
