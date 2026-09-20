import { NextRequest, NextResponse } from 'next/server';

import {
  FounderAuthError,
  verifyFounderFirebaseRequest,
} from '../../../../lib/server/firebaseFounderAuth';
import { loadUsageAlertPolicy } from '../../../../lib/server/usageAlertPolicy';

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

  try {
    return NextResponse.json(
      {
        configured: true,
        policy: loadUsageAlertPolicy(),
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      'Falha ao carregar referências explícitas de alerta de consumo.',
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        code: 'USAGE_ALERT_POLICY_INVALID',
        message: 'A configuração server-side dos alertas de consumo é inválida.',
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
