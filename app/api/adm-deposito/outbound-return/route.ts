import { NextResponse } from 'next/server';

import {
  FounderAuthError,
} from '../../../../lib/server/firebaseFounderAuth';
import {
  ApiSecurityError,
  apiSecurityErrorHeaders,
  createRequestSecurityContext,
  enforceAuthenticatedAdminBurstLimit,
  enforcePreAuthBurstLimit,
  readBoundedJsonRequest,
  securityResponseHeaders,
} from '../../../../lib/server/requestSecurity';
import {
  verifyWarehouseFounderRequest,
  WarehouseAccessError,
} from '../../../../lib/server/warehouseAccess';
import {
  returnWarehouseStockOutboundAdmin,
  WarehouseOutboundReturnFailure,
} from '../../../../lib/server/warehouseOutboundReturnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const security = createRequestSecurityContext(
    request,
    'warehouse-outbound-return'
  );

  try {
    enforcePreAuthBurstLimit(security);
    const founder = await verifyWarehouseFounderRequest(
      request.headers.get('authorization')
    );
    enforceAuthenticatedAdminBurstLimit(
      security,
      founder.uid,
      'mutation'
    );

    const body = await readBoundedJsonRequest<{
      consumptionId?: unknown;
      quantity?: unknown;
      reason?: unknown;
      operationId?: unknown;
    }>(request, security);

    const result = await returnWarehouseStockOutboundAdmin({
      actorUid: founder.uid,
      consumptionId:
        typeof body.consumptionId === 'string' ? body.consumptionId : '',
      quantity:
        typeof body.quantity === 'number'
          ? body.quantity
          : Number(body.quantity),
      reason:
        typeof body.reason === 'string' ? body.reason : '',
      operationId:
        typeof body.operationId === 'string' ? body.operationId : '',
    });

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
        },
        {
          status: error.httpStatus,
          headers: apiSecurityErrorHeaders(security, error),
        }
      );
    }

    if (
      error instanceof FounderAuthError
      || error instanceof WarehouseAccessError
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Acesso ao ADM Depósito negado.',
          code: 'WAREHOUSE_ACCESS_DENIED',
        },
        {
          status: error.status,
          headers: securityResponseHeaders(security),
        }
      );
    }

    if (error instanceof WarehouseOutboundReturnFailure) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        {
          status: error.httpStatus,
          headers: securityResponseHeaders(security),
        }
      );
    }

    console.error('Unexpected EMPROVEX warehouse outbound return failure.', {
      requestId: security.requestId,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível concluir a devolução com segurança.',
        code: 'UPSTREAM_ERROR',
      },
      {
        status: 500,
        headers: securityResponseHeaders(security),
      }
    );
  }
}
