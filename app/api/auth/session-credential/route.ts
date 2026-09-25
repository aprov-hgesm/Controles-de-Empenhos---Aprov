import { NextRequest, NextResponse } from 'next/server';

import {
  SessionCredentialError,
  issueWorkspaceSessionCredential,
  type WorkspaceSessionCredentialRequest,
} from '../../../../lib/server/firebaseSessionCredential';
import {
  ApiSecurityError,
  apiSecurityErrorHeaders,
  createRequestSecurityContext,
  enforceBestEffortBurstLimit,
  enforcePreAuthBurstLimit,
  logSecurityEvent,
  readBoundedJsonRequest,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const security = createRequestSecurityContext(request, 'session-credential');

  try {
    enforcePreAuthBurstLimit(security);
    const body = await readBoundedJsonRequest<WorkspaceSessionCredentialRequest>(
      request,
      security,
      8 * 1024
    );

    const result = await issueWorkspaceSessionCredential(
      request.headers.get('authorization'),
      body
    );

    enforceBestEffortBurstLimit(
      security,
      `session:${result.sessionId}`,
      30
    );

    return NextResponse.json(
      result,
      {
        status: 200,
        headers: securityResponseHeaders(security),
      }
    );
  } catch (error) {
    if (error instanceof SessionCredentialError) {
      logSecurityEvent('authentication_rejected', security, {
        status: error.status,
        code: error.code,
      });
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        {
          status: error.status,
          headers: securityResponseHeaders(security),
        }
      );
    }

    if (error instanceof ApiSecurityError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        {
          status: error.httpStatus,
          headers: apiSecurityErrorHeaders(security, error),
        }
      );
    }

    console.error('Falha ao emitir credencial operacional de sessão.', {
      requestId: security.requestId,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        code: 'SESSION_CREDENTIAL_UNAVAILABLE',
        message: 'Não foi possível preparar a sessão operacional neste momento.',
      },
      {
        status: 503,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
