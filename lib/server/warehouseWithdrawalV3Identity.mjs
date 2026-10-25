import { createHash } from 'node:crypto';
const sha=text=>createHash('sha256').update(text).digest('hex');

/** Versionar o domínio de hash sem reinterpretar v1/v2. */
export function warehouseWithdrawalV3IntentHash(command) {
  return sha('warehouse_withdrawal_intent_v3\n'+JSON.stringify({
    destinationId:command.destinationId,
    lines:command.lines.map(line=>({
      materialId:line.materialId,
      position:line.position,
      requestedQuantity:line.requestedQuantity,
      presentationCode:line.presentationCode??null,
      barcodeId:line.barcodeId??null,
    })),
  }));
}
/** Determinístico por identidade do comando, índice de intenção e índice da parte. */
export function warehouseWithdrawalV3DerivedLineId(withdrawalId,index,part) {
  if(!/^wd_[a-f0-9]{32}$/.test(withdrawalId)
    ||!Number.isSafeInteger(index)||index<0
    ||!Number.isSafeInteger(part)||part<0)
    throw new Error('WAREHOUSE_WITHDRAWAL_V3_LINE_ID_INVALID');
  return 'wline_'+sha('warehouse_withdrawal_line_v3\n'+withdrawalId+'\n'+index+'\n'+part).slice(0,32);
}
