/**
 * Auditoria explícita, somente leitura, para retiradas históricas (v1).
 * Sem agendamento, sem alterações, sem tentativa de "corrigir" estoque.
 * Detecta cabeçalhos incompletos e FINALIZED que não possuem consumos
 * e movimentos correspondentes. Não substitui reexecutar o comando original.
 */
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminBatchRead, warehouseAdminReadScopedQuery,
  WarehouseStoreError,
} from './warehouseFirestoreTransaction';

export interface WarehouseLegacyWithdrawalFinding {
  id:string;
  status:string;
  reason:string;
  expectedLineCount:number;
  appliedLineCount:number;
}
export interface WarehouseLegacyWithdrawalAuditResult {
  scanned:number;
  atomicV2Skipped:number;
  legacyFinalizedChecked:number;
  findings:WarehouseLegacyWithdrawalFinding[];
}
const doc=(ws:string,kind:string,id:string)=>
  'warehouse/'+ws+'/'+kind+'/'+id;
const deny=(code:string):never=>{throw new WarehouseStoreError(code,409);};

/**
 * Auditor de diagnóstico em QA ou inspeção autorizada. As queries são
 * limitadas; jamais relatar PASS de amostragem saturada como auditoria total.
 */
export async function auditWarehouseLegacyWithdrawalsServer(
  access:VerifiedWarehouseRequest,maxHeaders=200,
):Promise<WarehouseLegacyWithdrawalAuditResult> {
  if(!Number.isSafeInteger(maxHeaders)||maxHeaders<1||maxHeaders>400)
    return deny('WAREHOUSE_LEGACY_AUDIT_INVALID_LIMIT');
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const headers=await warehouseAdminReadScopedQuery(
    token,access.workspaceId,'withdrawals',[],maxHeaders+1,
  );
  if(headers.length>maxHeaders)return deny('WAREHOUSE_LEGACY_AUDIT_SATURATED');
  const result:WarehouseLegacyWithdrawalAuditResult={
    scanned:headers.length,atomicV2Skipped:0,legacyFinalizedChecked:0,findings:[],
  };
  const flag=(id:string,status:string,reason:string,expectedLineCount:number,
    appliedLineCount:number)=>{
    result.findings.push({id,status,reason,expectedLineCount,appliedLineCount});
  };
  for(const item of headers) {
    const h=item.data;
    if(h.atomicVersion===2){result.atomicV2Skipped++;continue;}
    const id=item.path.split('/').at(-1)||'';
    const status=typeof h.status==='string'?h.status:'INVALID';
    const expected=typeof h.expectedLineCount==='number'?h.expectedLineCount:-1;
    const applied=typeof h.appliedLineCount==='number'?h.appliedLineCount:-1;
    if(!/^wd_[a-f0-9]{32}$/.test(id)
      ||h.id!==id||h.workspaceId!==access.workspaceId||h.ug!==access.ug
      ||!Number.isSafeInteger(expected)||expected<1||expected>40
      ||!Number.isSafeInteger(applied)||applied<0||applied>expected) {
      flag(id,status,'INVALID_HEADER',expected,applied);continue;
    }
    if(status!=='FINALIZED'||applied!==expected) {
      flag(id,status,'INCOMPLETE_LEGACY_WITHDRAWAL',expected,applied);
      continue;
    }
    result.legacyFinalizedChecked++;
    // Não confiar exclusivamente no status do cabeçalho: contar consumos
    // associados e conferir seus movimentos existentes.
    const consumptions=await warehouseAdminReadScopedQuery(
      token,access.workspaceId,'consumptions',
      [{field:'withdrawalId',value:id}],41,
    );
    if(consumptions.length!==expected) {
      flag(id,status,'CONSUMPTION_COUNT_MISMATCH',expected,applied);continue;
    }
    const movementIds=new Set<string>();
    const lineIds=new Set<string>();
    let bad=false;
    for(const row of consumptions) {
      const c=row.data;
      if(c.workspaceId!==access.workspaceId||c.ug!==access.ug
        ||c.withdrawalId!==id||c.origin!=='STOCK_OUTBOUND'
        ||c.destinationId!==h.destinationId||c.withdrawnBy!==h.withdrawnBy
        ||typeof c.lineId!=='string'||!/^wline_[a-f0-9]{32}$/.test(c.lineId)
        ||typeof c.movementId!=='string'||!/^mov_[a-f0-9]{64}$/.test(c.movementId)
        ||!['PENDING','PREPARED','POSTED'].includes(String(c.siscofisStatus))
        ||lineIds.has(c.lineId)||movementIds.has(c.movementId)) {
        bad=true;break;
      }
      lineIds.add(c.lineId);movementIds.add(c.movementId);
    }
    if(bad) {flag(id,status,'CONSUMPTION_CORRUPTED',expected,applied);continue;}
    const paths=[...movementIds].map(movementId=>doc(access.workspaceId,'movements',movementId));
    const found=new Map<string,Record<string,unknown>|null>();
    for(let index=0;index<paths.length;index+=30) {
      const rows=await warehouseAdminBatchRead(token,paths.slice(index,index+30));
      for(const [path,value] of rows)found.set(path,value?.data??null);
    }
    for(const c of consumptions) {
      const movement=found.get(doc(access.workspaceId,'movements',c.data.movementId as string));
      if(!movement||movement.workspaceId!==access.workspaceId||movement.ug!==access.ug
        ||movement.type!=='OUTBOUND'||movement.materialId!==c.data.materialId
        ||movement.quantityDelta!==-Number(c.data.quantity)
        ||(movement.source as {kind?:string}|undefined)?.kind!=='EXPRESS_OUTBOUND') {
        bad=true;break;
      }
    }
    if(bad)flag(id,status,'MOVEMENT_MISMATCH',expected,applied);
  }
  return result;
}
