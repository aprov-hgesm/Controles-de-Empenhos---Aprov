import { NextRequest, NextResponse } from 'next/server';

import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { transferWarehouseStockServer } from '../../../../lib/server/warehouseTransfer';
import { saveWarehouseMaterialServer } from '../../../../lib/server/warehouseMaterialWrite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reject(code: string, status: number) {
  return NextResponse.json({ ok: false, error: code }, {
    status, headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const size=Number(request.headers.get('content-length')||'0');
    if (!Number.isFinite(size)||size>8192) return reject('WAREHOUSE_SERVER_REQUEST_TOO_LARGE',413);
    const access=await verifyWarehouseRequest(request.headers.get('authorization'));
    const body=await request.json() as Record<string,unknown>;
    if(!body||typeof body!=='object'||Array.isArray(body)
      ||body.workspaceId!==access.workspaceId) {
      return reject('WAREHOUSE_SERVER_SCOPE_MISMATCH',403);
    }
    const operation=body.operation;
    let result: unknown;
    switch(operation) {
      case 'TRANSFER':
        result=await transferWarehouseStockServer(access,body.input);
        break;
      case 'MATERIAL_SAVE':
        result=await saveWarehouseMaterialServer(access,body.input);
        break;
      default:
        return reject('WAREHOUSE_SERVER_OPERATION_UNSUPPORTED',400);
    }
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}});
  } catch(error) {
    if(error instanceof WarehouseAccessError||error instanceof FounderAuthError) {
      return reject('WAREHOUSE_SERVER_UNAUTHORIZED',error.status);
    }
    if(error instanceof WarehouseStoreError) return reject(error.code,error.status);
    if(error instanceof SectorProvisioningFailure) return reject('WAREHOUSE_SERVER_CONFIGURATION',503);
    console.error('[warehouse/operations] failed:',error instanceof Error?error.name:'error');
    return reject('WAREHOUSE_SERVER_UNAVAILABLE',503);
  }
}
