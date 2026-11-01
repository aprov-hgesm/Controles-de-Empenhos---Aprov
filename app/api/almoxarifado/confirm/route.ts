import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest } from '../../../lib/server/warehouseAccess';
import { requireAlmoxAccess, confirmAlmoxPhysicalWithdrawal } from '../../../lib/almoxarifado/integration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * Explicit fail-closed boundary. NO ledger, no transaction, no reservations.
 * Never forward any command to the Warehouse operations endpoint.
 */
export async function POST(request:NextRequest) {
  try {
    const access = await verifyWarehouseRequest(request.headers.get('authorization'));
    requireAlmoxAccess(access);
    confirmAlmoxPhysicalWithdrawal(null);
  } catch {
    return NextResponse.json({ok:false,error:'ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL'},
      {status:423,headers:{'cache-control':'no-store'}});
  }
}
