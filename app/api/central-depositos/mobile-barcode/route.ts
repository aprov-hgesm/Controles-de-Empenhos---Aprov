import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { readWarehouseMobileBarcodeServer } from '../../../../lib/server/warehouseMobileBarcodeRead';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 1024) {
      return reply(413, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_TOO_LARGE' });
    }
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply(400, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_INVALID' });
    }
    const input = body as Record<string, unknown>;
    if (Object.keys(input).length !== 2
      || typeof input.workspaceId !== 'string'
      || typeof input.barcode !== 'string') {
      return reply(400, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_INVALID' });
    }
    const access = await verifyWarehouseRequest(request.headers.get('authorization'));
    if (input.workspaceId !== access.workspaceId) {
      return reply(403, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_SCOPE_MISMATCH' });
    }
    const result = await readWarehouseMobileBarcodeServer(access, input.barcode);
    return reply(200, { ok: true, result });
  } catch (error) {
    if (error instanceof WarehouseAccessError || error instanceof FounderAuthError) {
      return reply(error.status, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_UNAUTHORIZED' });
    }
    if (error instanceof WarehouseStoreError) {
      return reply(error.status, { ok: false, error: error.code });
    }
    if (error instanceof SectorProvisioningFailure) {
      return reply(503, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_CONFIGURATION' });
    }
    console.error('[warehouse/mobile-barcode] failed:', error instanceof Error ? error.name : 'unknown');
    return reply(503, { ok: false, error: 'WAREHOUSE_MOBILE_BARCODE_UNAVAILABLE' });
  }
}
