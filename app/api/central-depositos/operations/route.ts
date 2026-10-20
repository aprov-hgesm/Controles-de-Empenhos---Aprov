import { NextRequest, NextResponse } from 'next/server';

import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { transferWarehouseStockServer } from '../../../../lib/server/warehouseTransfer';
import { saveWarehouseMaterialServer } from '../../../../lib/server/warehouseMaterialWrite';
import { warehouseDestinationCreateServer, warehouseDestinationSetStatusServer } from '../../../../lib/server/warehouseDestinationWrite';
import { warehouseStructureServer } from '../../../../lib/server/warehouseStructureWrite';
import { saveWarehouseLandingVisualServer } from '../../../../lib/server/warehouseLandingVisualWrite';
import { saveWarehouseLogisticsSettingsServer } from '../../../../lib/server/warehouseLogisticsSettingsWrite';
import { excludeWarehouseQueueServer } from '../../../../lib/server/warehouseQueueExclusionWrite';
import { writeWarehouseLotServer } from '../../../../lib/server/warehouseLotWrite';
import { applyWarehouseExpressOutboundServer } from '../../../../lib/server/warehouseOutboundWrite';
import { returnWarehouseStockOutboundServer } from '../../../../lib/server/warehouseReturnWrite';
import { finalizeWarehouseWithdrawalServer } from '../../../../lib/server/warehouseWithdrawalWrite';
import { warehouseInventoryLifecycleServer } from '../../../../lib/server/warehouseInventoryLifecycle';
import { adjustWarehouseInventoryServer } from '../../../../lib/server/warehouseInventoryAdjustment';
import { startWarehouseInventoryServer } from '../../../../lib/server/warehouseInventoryStart';
import { markWarehouseLegacyIntakePostedServer } from '../../../../lib/server/warehouseIntakeLegacyStatus';

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
    // Até 40 linhas de retirada, com validação estrita no motor por linha.
    if (!Number.isFinite(size)||size>65536) return reject('WAREHOUSE_SERVER_REQUEST_TOO_LARGE',413);
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
      case 'DESTINATION_CREATE':
        result=await warehouseDestinationCreateServer(access,body.input);
        break;
      case 'DESTINATION_STATUS':
        result=await warehouseDestinationSetStatusServer(access,body.input);
        break;
      case 'STRUCTURE':
        result=await warehouseStructureServer(access,body.input);
        break;
      case 'LANDING_VISUAL_SAVE':
        result=await saveWarehouseLandingVisualServer(access,body.input);
        break;
      case 'LOGISTICS_SETTINGS_SAVE':
        result=await saveWarehouseLogisticsSettingsServer(access,body.input);
        break;
      case 'QUEUE_EXCLUDE':
        result=await excludeWarehouseQueueServer(access,body.input);
        break;
      case 'LOT_CREATE':
        result=await writeWarehouseLotServer(access,'CREATE',body.input);
        break;
      case 'LOT_UPDATE':
        result=await writeWarehouseLotServer(access,'UPDATE',body.input);
        break;
      case 'EXPRESS_OUTBOUND':
        result=await applyWarehouseExpressOutboundServer(access,body.input);
        break;
      case 'STOCK_RETURN':
        result=await returnWarehouseStockOutboundServer(access,body.input);
        break;
      case 'WITHDRAWAL_FINALIZE':
        result=await finalizeWarehouseWithdrawalServer(access,body.input);
        break;
      case 'INVENTORY_COUNT':
        result=await warehouseInventoryLifecycleServer(access,'COUNT',body.input);
        break;
      case 'INVENTORY_REVIEW':
        result=await warehouseInventoryLifecycleServer(access,'REVIEW',body.input);
        break;
      case 'INVENTORY_REOPEN':
        result=await warehouseInventoryLifecycleServer(access,'REOPEN',body.input);
        break;
      case 'INVENTORY_BEGIN_CONFIRM':
        result=await warehouseInventoryLifecycleServer(access,'BEGIN_CONFIRM',body.input);
        break;
      case 'INVENTORY_FINISH_CONFIRM':
        result=await warehouseInventoryLifecycleServer(access,'FINISH_CONFIRM',body.input);
        break;
      case 'INVENTORY_CANCEL':
        result=await warehouseInventoryLifecycleServer(access,'CANCEL',body.input);
        break;
      case 'INVENTORY_STALE':
        result=await warehouseInventoryLifecycleServer(access,'STALE',body.input);
        break;
      case 'INVENTORY_ADJUST':
        result=await adjustWarehouseInventoryServer(access,body.input);
        break;
      case 'INVENTORY_START':
        result=await startWarehouseInventoryServer(access,body.input);
        break;
      case 'LEGACY_INTAKE_POSTED':
        result=await markWarehouseLegacyIntakePostedServer(access,body.input);
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
