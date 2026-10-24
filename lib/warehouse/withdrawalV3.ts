/**
 * Contrato de intenção warehouse_withdrawal_command_v3.
 * Exclui saldos, rótulos, lotes e identidade do operador. Não substitui
 * ids historicamente persistidos de materiais, posições ou retiradas.
 */
import { isValidWarehouseMaterialId } from './material';
import { validateWarehouseStockPosition, type WarehouseStockPosition } from './location';
import { normalizeWarehouseQuantity } from './movement';
import { isWarehouseDestinationId, isWarehouseWithdrawalId, WAREHOUSE_WITHDRAWAL_MAX_LINES } from './withdrawal';

export const WAREHOUSE_WITHDRAWAL_COMMAND_V3 = 'warehouse_withdrawal_command_v3' as const;

export interface WarehouseWithdrawalV3Line {
  materialId: string;
  position: WarehouseStockPosition;
  requestedQuantity: number;
  /** Código da apresentação; sem aceitar rótulo ou fator declarado pelo navegador. */
  presentationCode?: string;
  /** Associação canônica, se a apresentação provém de leitura por código de barras. */
  barcodeId?: string;
}
export interface WarehouseWithdrawalV3Command {
  schemaVersion: typeof WAREHOUSE_WITHDRAWAL_COMMAND_V3;
  withdrawalId: string;
  destinationId: string;
  lines: WarehouseWithdrawalV3Line[];
}
const isObject = (x:unknown):x is Record<string,unknown> =>
  Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const hasOnly = (x:Record<string,unknown>, fields:readonly string[]) =>
  Object.keys(x).every(key=>fields.includes(key));

/** Normalização estrita e estável: labels e metadados de apresentação não entram no hash. */
export function parseWarehouseWithdrawalV3(raw:unknown):WarehouseWithdrawalV3Command {
  if(!isObject(raw) || !hasOnly(raw,['schemaVersion','withdrawalId','destinationId','lines'])
    ||raw.schemaVersion!==WAREHOUSE_WITHDRAWAL_COMMAND_V3
    ||!isWarehouseWithdrawalId(raw.withdrawalId)
    ||!isWarehouseDestinationId(raw.destinationId)
    ||!Array.isArray(raw.lines) ||raw.lines.length<1
    ||raw.lines.length>WAREHOUSE_WITHDRAWAL_MAX_LINES)
    throw new Error('WAREHOUSE_WITHDRAWAL_V3_INPUT_INVALID');
  const lines:WarehouseWithdrawalV3Line[]=raw.lines.map((entry:unknown)=>{
    if(!isObject(entry) || !hasOnly(entry,[
      'materialId','position','requestedQuantity','presentationCode','barcodeId',
    ]) ||!isValidWarehouseMaterialId(entry.materialId))
      throw new Error('WAREHOUSE_WITHDRAWAL_V3_LINE_INVALID');
    const position=validateWarehouseStockPosition(entry.position);
    const quantity=normalizeWarehouseQuantity(entry.requestedQuantity);
    if(!position||position.kind==='UNASSIGNED'||quantity===null||quantity<=0)
      throw new Error('WAREHOUSE_WITHDRAWAL_V3_LINE_INVALID');
    const code=typeof entry.presentationCode==='string'
      ?entry.presentationCode:undefined;
    if(entry.presentationCode!==undefined
      &&(!code||!/^[a-z]{1,16}$/.test(code)))
      throw new Error('WAREHOUSE_WITHDRAWAL_V3_PRESENTATION_INVALID');
    const barcodeId=typeof entry.barcodeId==='string'
      ?entry.barcodeId:undefined;
    if(entry.barcodeId!==undefined
      &&(!barcodeId||!/^bar_[a-f0-9]{64}$/.test(barcodeId)))
      throw new Error('WAREHOUSE_WITHDRAWAL_V3_BARCODE_INVALID');
    return {
      materialId:entry.materialId,
      position,
      requestedQuantity:quantity,
      ...(code===undefined?{}:{presentationCode:code}),
      ...(barcodeId===undefined?{}:{barcodeId}),
    };
  });
  return {
    schemaVersion:WAREHOUSE_WITHDRAWAL_COMMAND_V3,
    withdrawalId:raw.withdrawalId,
    destinationId:raw.destinationId,
    lines,
  };
}
