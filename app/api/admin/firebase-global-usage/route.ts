import { NextRequest, NextResponse } from 'next/server';

import {
  FounderAuthError,
  verifyFounderFirebaseRequest,
} from '../../../../lib/server/firebaseFounderAuth';
import {
  isGoogleCloudMonitoringConfigured,
  loadFirebaseGlobalUsageObservation,
} from '../../../../lib/server/googleCloudMonitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

export async function GET(request: NextRequest) {
  try {
    await verifyFounderFirebaseRequest(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof FounderAuthError) {
      return NextResponse.json(
        {
          code: error.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
          message: error.message,
        },
        {
          status: error.status,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        code: 'UNAUTHENTICATED',
        message: 'Não foi possível validar a sessão administrativa.',
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
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
        headers: NO_STORE_HEADERS,
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
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      'Falha ao consultar métricas globais do Firestore no Cloud Monitoring.',
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        code: 'CLOUD_MONITORING_UNAVAILABLE',
        message: 'Não foi possível consultar as métricas globais do Firebase neste momento.',
      },
      {
        status: 502,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
