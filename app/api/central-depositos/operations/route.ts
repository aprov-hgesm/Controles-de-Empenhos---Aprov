import { NextRequest, NextResponse } from 'next/server';

import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { bindWarehouseMobileTrust, isWarehouseMobilePilotAction, WarehouseMobileTrustError } from '../../../../lib/server/warehouseMobileTrust.mjs';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { transferWarehouseStockServer } from '../../../../lib/server/warehouseTransfer';
import { saveWarehouseMaterialServer } from '../../../../lib/server/warehouseMaterialWrite';
import { warehouseDestinationCreateServer, warehouseDestinationSetStatusServer } from '../../../../lib/server/warehouseDestinationWrite';
import { warehouseStructureServer } from '../../../../lib/server/warehouseStructureWrite';
import { warehouseStructureLayoutApplyServer } from '../../../../lib/server/warehouseStructureLayoutApply';
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
import { setWarehouseConsumptionSiscofisStatusServer } from '../../../../lib/server/warehouseConsumptionStatusWrite';

import { warehouseBarcodeServer, warehouseLayoutSaveServer, warehouseIntakeStateServer } from '../../../../lib/server/warehouseRemainingWrites';

import { warehouseStructureArchiveServer } from '../../../../lib/server/warehouseLedgerAndArchive';
import { warehouseCroquiReadServer } from '../../../../lib/server/warehouseCroquiRead';

import { warehouseQueueIndexServer } from '../../../../lib/server/warehouseQueueIndexWrite';

import { warehouseLogisticsAlertsServer } from '../../../../lib/server/warehouseLogisticsAlertWrite';

import { confirmWarehouseSiscofisServer } from '../../../../lib/server/warehouseSiscofisWrite';

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
    if (!Number.isFinite(size)||size>524288) return reject('WAREHOUSE_SERVER_REQUEST_TOO_LARGE',413);
    const verified=await verifyWarehouseRequest(request.headers.get('authorization'));
    const body=await request.json() as Record<string,unknown>;
    if(!body||typeof body!=='object'||Array.isArray(body)
      ||body.workspaceId!==verified.workspaceId) {
      return reject('WAREHOUSE_SERVER_SCOPE_MISMATCH',403);
    }
    const operation=body.operation;
    const access=isWarehouseMobilePilotAction(operation)
      ? bindWarehouseMobileTrust(verified,{workspaceId:body.workspaceId,action:operation})
      : verified;
    if(operation!=='SISCOFIS_CONFIRM' && size>65536)
      return reject('WAREHOUSE_SERVER_REQUEST_TOO_LARGE',413);
    if(operation==='SISCOFIS_CONFIRM' && JSON.stringify(body).length>524288)
      return reject('WAREHOUSE_SERVER_REQUEST_TOO_LARGE',413);
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
      case 'CONSUMPTION_SISCOFIS_STATUS':
        result=await setWarehouseConsumptionSiscofisStatusServer(access,body.input);
        break;
      case 'BARCODE_SAVE':
        result=await warehouseBarcodeServer(access,'SAVE',body.input);
        break;
      case 'BARCODE_STATUS':
        result=await warehouseBarcodeServer(access,'STATUS',body.input);
        break;
      case 'BARCODE_REPLACE':
        result=await warehouseBarcodeServer(access,'REPLACE',body.input);
        break;
      case 'LAYOUT_SAVE':
        result=await warehouseLayoutSaveServer(access,body.input);
        break;
      case 'STRUCTURE_LAYOUT_APPLY':
        result=await warehouseStructureLayoutApplyServer(access,body.input);
        break;
      case 'CROQUI_READ':
        result=await warehouseCroquiReadServer(access,body.input);
        break;
      case 'INTAKE_STATE_SAVE':
        result=await warehouseIntakeStateServer(access,body.input);
        break;
      case 'LEDGER_MOVEMENT':
        // Fluxo genérico obsoleto: nunca aceitar deltas de saldo arbitrários.
        return reject('WAREHOUSE_LEDGER_DIRECT_COMMAND_DISABLED',403);
      case 'STRUCTURE_ARCHIVE':
        result=await warehouseStructureArchiveServer(access,body.input);
        break;
      case 'QUEUE_INDEX_UPSERT':
        result=await warehouseQueueIndexServer(access,'UPSERT',body.input);
        break;
      case 'QUEUE_INDEX_STATE':
        result=await warehouseQueueIndexServer(access,'STATE',body.input);
        break;
      case 'QUEUE_INDEX_DEACTIVATE':
        result=await warehouseQueueIndexServer(access,'DEACTIVATE',body.input);
        break;
      case 'LOGISTICS_ALERT_UPSERT':
        result=await warehouseLogisticsAlertsServer(access,'UPSERT',body.input);
        break;
      case 'LOGISTICS_ALERT_RESOLVE':
        result=await warehouseLogisticsAlertsServer(access,'RESOLVE',body.input);
        break;
      case 'SISCOFIS_CONFIRM':
        result=await confirmWarehouseSiscofisServer(access,body.input);
        break;
      default:
        return reject('WAREHOUSE_SERVER_OPERATION_UNSUPPORTED',400);
    }
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}});
  } catch(error) {
    if(error instanceof WarehouseAccessError||error instanceof FounderAuthError) {
      return reject('WAREHOUSE_SERVER_UNAUTHORIZED',error.status);
    }
    if(error instanceof WarehouseMobileTrustError) return reject(error.message,error.status);
    if(error instanceof WarehouseStoreError) return reject(error.code,error.status);
    if(error instanceof SectorProvisioningFailure) return reject('WAREHOUSE_SERVER_CONFIGURATION',503);
    console.error('[warehouse/operations] failed:',error instanceof Error?error.name:'error');
    return reject('WAREHOUSE_SERVER_UNAVAILABLE',503);
  }
}
