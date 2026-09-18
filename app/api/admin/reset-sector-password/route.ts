import { NextResponse } from 'next/server';

import {
  SectorProvisioningFailure,
  resetSectorPasswordWithAuth,
  verifyFounderSession,
} from '../../../../lib/server/sectorProvisioningAdmin';

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
    const body = await request.json().catch(() => null) as {
      workspaceId?: unknown;
      email?: unknown;
      newPassword?: unknown;
    } | null;

    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    const email = typeof body?.email === 'string' ? body.email : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    const result = await resetSectorPasswordWithAuth(
      workspaceId,
      email,
      newPassword,
      founder
    );

    return NextResponse.json({ ok: true, result });
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

    console.error('Unexpected EMPROVEX sector password reset failure.', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível redefinir a senha do setor com segurança.',
        code: 'UPSTREAM_ERROR',
        recoveryRequired: false,
      },
      { status: 500 }
    );
  }
}
