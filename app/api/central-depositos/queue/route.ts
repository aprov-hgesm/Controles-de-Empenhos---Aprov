import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { readWarehouseInvoiceQueueServer } from '../../../../lib/server/warehouseQueueReadServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reply(body:Record<string,unknown>,status:number) {
  return NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
}

/** The scope is derived solely from verified Firebase credentials. */
export async function GET(request:NextRequest) {
  try {
    const access = await verifyWarehouseRequest(request.headers.get('authorization'));
    const result = await readWarehouseInvoiceQueueServer(access);
    return reply({ok:true,result},200);
  } catch (error) {
    if(error instanceof WarehouseAccessError || error instanceof FounderAuthError)
      return reply({ok:false,error:'WAREHOUSE_READ_UNAUTHORIZED'},error.status);
    if(error instanceof WarehouseStoreError)
      return reply({ok:false,error:error.code},error.status);
    if(error instanceof SectorProvisioningFailure)
      return reply({ok:false,error:'WAREHOUSE_READ_CONFIGURATION'},503);
    console.error('[warehouse/queue] failed:',
      error instanceof Error ? error.name : 'Unknown');
    return reply({ok:false,error:'WAREHOUSE_READ_UNAVAILABLE'},503);
  }
}
