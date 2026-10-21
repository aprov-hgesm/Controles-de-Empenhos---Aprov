import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseFounderRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';
import { warehouseAdminTransaction } from '../../../../lib/server/warehouseFirestoreTransaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status, headers: { 'cache-control': 'no-store' },
  });
}

/** Founder-only, no-write preflight for a staged deployment. Never return secrets. */
export async function GET(request: NextRequest) {
  try {
    await verifyWarehouseFounderRequest(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof FounderAuthError || error instanceof WarehouseAccessError) {
      return reply({ ok: false, error: 'WAREHOUSE_HOSTING_UNAUTHORIZED' }, error.status);
    }
    return reply({ ok: false, error: 'WAREHOUSE_HOSTING_UNAVAILABLE' }, 503);
  }

  try {
    const emulator = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1';
    const accessToken = emulator ? 'emulator' : await getGoogleAccessToken();
    const path = 'warehouse/hgesm-aprov/settings/logistics-alerts';
    await warehouseAdminTransaction(accessToken, [path], () => ({
      result: true, writes: [],
    }));
    return reply({
      ok: true,
      checks: {
        authenticatedFounder: true,
        adminAccessToken: !emulator,
        warehouseTransaction: true,
      },
    }, 200);
  } catch {
    return reply({ ok: false, error: 'WAREHOUSE_HOSTING_NOT_READY' }, 503);
  }
}
