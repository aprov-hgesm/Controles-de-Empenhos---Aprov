import { NextRequest, NextResponse } from 'next/server';

import {
  FounderAuthError,
  verifyFounderFirebaseRequest,
} from '../../../../lib/server/firebaseFounderAuth';
import {
  createRequestSecurityContext,
  enforceAuthenticatedAdminBurstLimit,
  enforcePreAuthBurstLimit,
  logSecurityEvent,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';
import { loadUsageAlertPolicy } from '../../../../lib/server/usageAlertPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = createRequestSecurityContext(request, 'usage-alert-policy');

  try {
    enforcePreAuthBurstLimit(security);
    const founder = await verifyFounderFirebaseRequest(
      request.headers.get('authorization')
    );
    enforceAuthenticatedAdminBurstLimit(security, founder.uid, 'read');
  } catch (error) {
    if (error instanceof FounderAuthError) {
      logSecurityEvent('authentication_rejected', security, {
        status: error.status,
      });
      return NextResponse.json(
        {
          code: error.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
          message: error.message,
        },
        {
          status: error.status,
          headers: securityResponseHeaders(security),
        }
      );
    }

    if (
      typeof error === 'object'
      && error
      && 'httpStatus' in error
      && 'code' in error
    ) {
      const securityError = error as {
        httpStatus: number;
        code: string;
        message?: string;
        retryAfterSeconds?: number;
      };
      return NextResponse.json(
        {
          code: securityError.code,
          message: securityError.message || 'Solicitação recusada por segurança.',
        },
        {
          status: securityError.httpStatus,
          headers: securityResponseHeaders(
            security,
            securityError.retryAfterSeconds
              ? { 'Retry-After': String(securityError.retryAfterSeconds) }
              : {}
          ),
        }
      );
    }

    logSecurityEvent('authentication_rejected', security, { status: 401 });
    return NextResponse.json(
      {
        code: 'UNAUTHENTICATED',
        message: 'Não foi possível validar a sessão administrativa.',
      },
      {
        status: 401,
        headers: securityResponseHeaders(security),
      }
    );
  }

  try {
    return NextResponse.json(
      {
        configured: true,
        policy: loadUsageAlertPolicy(),
      },
      {
        status: 200,
        headers: securityResponseHeaders(security),
      }
    );
  } catch (error) {
    console.error('Falha ao carregar referências explícitas de alerta de consumo.', {
      requestId: security.requestId,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        code: 'USAGE_ALERT_POLICY_INVALID',
        message: 'A configuração server-side dos alertas de consumo é inválida.',
      },
      {
        status: 500,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
