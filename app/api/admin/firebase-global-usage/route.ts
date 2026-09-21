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
import { persistGlobalUsageObservation } from '../../../../lib/server/globalUsageHistory';

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
    let historyPersisted = false;

    try {
      historyPersisted = await persistGlobalUsageObservation(observation);
    } catch (historyError) {
      console.warn('Métricas globais carregadas, mas o histórico diário não pôde ser consolidado.', {
        requestId: security.requestId,
        error: historyError instanceof Error ? historyError.message : historyError,
      });
    }

    return NextResponse.json(
      {
        configured: true,
        historyPersisted,
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

    const message = error instanceof Error ? error.message : '';
    const diagnosticCode = message.includes('HTTP 403')
      ? 'CLOUD_MONITORING_PERMISSION_DENIED'
      : message.includes('HTTP 401')
        ? 'CLOUD_MONITORING_AUTH_FAILED'
        : 'CLOUD_MONITORING_UNAVAILABLE';

    return NextResponse.json(
      {
        code: diagnosticCode,
        message: diagnosticCode === 'CLOUD_MONITORING_PERMISSION_DENIED'
          ? 'A credencial server-side não possui permissão para consultar o Cloud Monitoring. Verifique roles/monitoring.viewer.'
          : diagnosticCode === 'CLOUD_MONITORING_AUTH_FAILED'
            ? 'A credencial server-side do Cloud Monitoring não pôde ser autenticada.'
            : 'Não foi possível consultar as métricas globais do Firebase neste momento.',
      },
      {
        status: 502,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
