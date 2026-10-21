import { NextRequest, NextResponse } from 'next/server';

import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { registerWarehouseManualEntryServer } from '../../../../lib/server/warehouseManualEntry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(code: string, status: number) {
  return NextResponse.json({ ok: false, error: code }, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (!Number.isFinite(length) || length > 8192) {
      return errorResponse('WAREHOUSE_MANUAL_ENTRY_REQUEST_TOO_LARGE', 413);
    }
    const session = await verifyWarehouseRequest(request.headers.get('authorization'));
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || body.workspaceId !== session.workspaceId) {
      return errorResponse('WAREHOUSE_MANUAL_ENTRY_SCOPE_MISMATCH', 403);
    }
    const result = await registerWarehouseManualEntryServer(session, body.input);
    return NextResponse.json({ ok: true, result }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof WarehouseAccessError || error instanceof FounderAuthError) {
      return errorResponse('WAREHOUSE_MANUAL_ENTRY_UNAUTHORIZED', error.status);
    }
    if (error instanceof WarehouseStoreError) {
      return errorResponse(error.code, error.status);
    }
    if (error instanceof SectorProvisioningFailure) {
      return errorResponse('WAREHOUSE_MANUAL_ENTRY_SERVER_CONFIGURATION', 503);
    }
    // Don't expose credentials, user claims, Firestore paths, or raw upstream exceptions.
    console.error('[warehouse/manual-entry] rejected:', error instanceof Error ? error.name : 'error');
    return errorResponse('WAREHOUSE_MANUAL_ENTRY_SERVER_UNAVAILABLE', 503);
  }
}
