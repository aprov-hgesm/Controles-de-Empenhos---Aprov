import { NextResponse } from 'next/server';

import { createFirebaseAuthMetadataBackup } from '../../../../lib/server/firebaseAuthBackup';
import {
  FounderAuthError,
  verifyFounderFirebaseRequest,
} from '../../../../lib/server/firebaseFounderAuth';
import {
  ApiSecurityError,
  apiSecurityErrorHeaders,
  assertFirebaseAuthBackupEnabled,
  createRequestSecurityContext,
  enforceAuthenticatedAdminBurstLimit,
  enforcePreAuthBurstLimit,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const security = createRequestSecurityContext(request, 'firebase-auth-backup');

  try {
    enforcePreAuthBurstLimit(security);
    const founder = await verifyFounderFirebaseRequest(
      request.headers.get('authorization')
    );
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'read');
    assertFirebaseAuthBackupEnabled(security);

    const backup = await createFirebaseAuthMetadataBackup();
    return NextResponse.json(
      { ok: true, backup },
      { headers: securityResponseHeaders(security) }
    );
  } catch (error) {
    if (error instanceof ApiSecurityError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        {
          status: error.httpStatus,
          headers: apiSecurityErrorHeaders(security, error),
        }
      );
    }

    if (error instanceof FounderAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: 'FOUNDER_AUTH_REJECTED' },
        {
          status: error.status,
          headers: securityResponseHeaders(security),
        }
      );
    }

    console.error('Unexpected EMPROVEX Firebase Auth backup failure.', {
      requestId: security.requestId,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível gerar o backup administrativo de identidades.',
        code: 'UPSTREAM_ERROR',
      },
      {
        status: 500,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
