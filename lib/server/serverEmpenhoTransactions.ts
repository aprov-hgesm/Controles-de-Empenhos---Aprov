/** Create/update NE only: reuse the exact domain revision functions. */
import { assertEmpenhoRevision, buildNextEmpenho, EmpenhoConcurrencyError } from '../empenhoConcurrency';
import { normalizeSupplierCnpj } from '../invoiceIdentity';
import type { Empenho } from '../types';
import type { VerifiedPlatformPrincipal } from './platformAuthorization';
import { coreDocumentTransaction, CoreTransactionError, type CoreTxValue } from './coreFirestoreTransaction';

const statuses=new Set(['Ativo','Encerrado','Sem Movimentação','Urgente']);
const ids=/^[A-Za-z0-9_-]{1,160}$/;
export function validateEmpenhoServerInput(input:unknown):Empenho {
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new CoreTransactionError('EMPENHO_INVALID',400);
  const doc=input as Record<string,unknown>;
  if(typeof doc.id!=='string'||!ids.test(doc.id)
    ||typeof doc.supplier!=='string'||!doc.supplier.trim()||doc.supplier.length>300
    ||typeof doc.description!=='string'||doc.description.length>4000
    ||typeof doc.date!=='string'||doc.date.length>40
    ||!statuses.has(String(doc.status))||!Array.isArray(doc.items)
    ||doc.items.length>450)
    throw new CoreTransactionError('EMPENHO_INVALID',400);
  for(const item of doc.items){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new CoreTransactionError('EMPENHO_ITEM_INVALID',400);
    const i=item as Record<string,unknown>;
    if(typeof i.id!=='string'||!ids.test(i.id)||typeof i.name!=='string'||!i.name.trim()
      ||typeof i.unit!=='string'||!i.unit.trim()
      ||typeof i.quantity!=='number'||!Number.isFinite(i.quantity)||i.quantity<0
      ||typeof i.unitPrice!=='number'||!Number.isFinite(i.unitPrice)||i.unitPrice<0
      ||typeof i.received!=='number'||!Number.isFinite(i.received)||i.received<0)
      throw new CoreTransactionError('EMPENHO_ITEM_INVALID',400);
  }
  const allowed=new Set(['id','supplier','supplierCnpj','description','date',
    'status','items','lastNFDaysAgo','pregao','modalidadeContratacao',
    'numeroContratacao','notaCredito','contrato','classification','revision',
    'updatedAt','updatedBy','notaEmpenhoPdf','notaEmpenhoPdfVersions','userId']);
  if(Object.keys(doc).some(k=>!allowed.has(k)))throw new CoreTransactionError('EMPENHO_INVALID_FIELDS',400);
  const raw=JSON.stringify(input);
  if(raw.length>800000)throw new CoreTransactionError('EMPENHO_TOO_LARGE',413);
  return doc as unknown as Empenho;
}
export async function commitServerEmpenho(
  actor:VerifiedPlatformPrincipal, mode:'create'|'update', input:unknown
):Promise<Empenho>{
  const candidate=validateEmpenhoServerInput(input);
  const prefix='workspaces/'+actor.workspaceId+'/';
  const path=prefix+'empenhos/'+candidate.id;
  const lock=prefix+'settings/empenhoDelete_'+candidate.id;
  return coreDocumentTransaction([path,lock],docs=>{
    if(docs.get(lock))throw new CoreTransactionError('EMPENHO_DELETION_LOCKED',409);
    const stored=docs.get(path)?.data as Empenho|undefined;
    if(mode==='create'&&stored)throw new EmpenhoConcurrencyError('create_conflict',
      'O empenho já foi criado por outra sessão. Atualize os dados.');
    if(mode==='update'&&!stored)throw new EmpenhoConcurrencyError('missing_empenho',
      'O empenho não existe mais. Atualize os dados.');
    if(mode==='update'&&stored)assertEmpenhoRevision(stored,candidate.revision);
    if(candidate.supplierCnpj!==undefined &&
       normalizeSupplierCnpj(candidate.supplierCnpj)!==candidate.supplierCnpj &&
       !(mode==='update'&&stored?.supplierCnpj===candidate.supplierCnpj))
      throw new CoreTransactionError('EMPENHO_CNPJ_INVALID',400);
    const next=buildNextEmpenho(candidate,stored||null,actor.uid);
    // Rules on the old client required revision increment and trusted updatedBy.
    return {result:next,writes:[{path,data:{...next,userId:actor.uid} as unknown as Record<string,CoreTxValue>}]};
  });
}
