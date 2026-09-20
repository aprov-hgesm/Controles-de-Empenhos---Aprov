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
import {
  isGoogleCloudMonitoringConfigured,
  loadFirebaseGlobalUsageObservation,
} from '../../../../lib/server/googleCloudMonitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = createRequestSecurityContext(request, 'firebase-global-usage');

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

  if (!isGoogleCloudMonitoringConfigured()) {
    return NextResponse.json(
      {
        code: 'CLOUD_MONITORING_NOT_CONFIGURED',
        message: 'A integração server-side com o Google Cloud Monitoring ainda não foi configurada neste ambiente.',
      },
      {
        status: 503,
        headers: securityResponseHeaders(security),
      }
    );
  }

  try {
    const observation = await loadFirebaseGlobalUsageObservation();
    return NextResponse.json(
      {
        configured: true,
        ...observation,
      },
      {
        status: 200,
        headers: securityResponseHeaders(security),
      }
    );
  } catch (error) {
    console.error('Falha ao consultar métricas globais do Firestore no Cloud Monitoring.', {
      requestId: security.requestId,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        code: 'CLOUD_MONITORING_UNAVAILABLE',
        message: 'Não foi possível consultar as métricas globais do Firebase neste momento.',
      },
      {
        status: 502,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
