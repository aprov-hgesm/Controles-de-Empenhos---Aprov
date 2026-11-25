import { createHash } from 'node:crypto';
import type { CreditMember } from './creditControlAuth';
import { creditTransaction, CreditStoreError, type CreditTransaction } from './creditControlFirestore';
import { calculateCreditBalance, creditAlerts, type CreditAllocation } from '../controle-credito/creditBalance';
import type {
  BudgetCell, CreditSequence, CreditRecord, CommitmentRecord, CostCenter, CreditDetail,
  CreditBalance, CreditCellBalance, FinanceView, FinanceCredit, FinanceFilters, FinanceAlert,
  MovementKind, MovementRecord, BudgetDifference,
} from '../controle-credito/contracts';

type Obj = Record<string, unknown>;
type StoredCredit = CreditRecord & {
  year: string; source: 'html'|'manual'; originalFingerprint: string;
  cellAdjustments: Record<string, number>;
  projection?: Pick<CreditDetail,'balance'|'cells'>;
};
type StoredCommitment = CommitmentRecord & {
  year: string; centerYear: string; originalFingerprint: string; lastReplacementHash?: string;
};
const invalid = (message: string): never => { throw new CreditStoreError(422,'CREDIT_INVALID_INPUT',message); };
const forbidden = (): never => { throw new CreditStoreError(403,'CREDIT_FORBIDDEN','Perfil não autorizado para esta operação.'); };
const absent = (): never => { throw new CreditStoreError(404,'CREDIT_NOT_FOUND','Registro não encontrado ou não autorizado.'); };
const conflict = (message: string): never => { throw new CreditStoreError(409,'CREDIT_REVISION_CONFLICT',message); };
const corrupt = (): never => { throw new CreditStoreError(503,'CREDIT_INCONSISTENT_DATA','Dados financeiros inconsistentes. Solicite conciliação técnica.'); };
function object(x: unknown): Obj {
  if (!x || typeof x!=='object'||Array.isArray(x)) return invalid('Dados da operação inválidos.');
  return x as Obj;
}
function string(x: unknown, label: string, max=180, allowEmpty=false): string {
  if (typeof x!=='string') return invalid(label+' inválido.');
  const v=x.trim();
  if ((!allowEmpty&&!v)||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return invalid(label+' inválido.');
  return v;
}
function pattern(x: unknown, re: RegExp, label: string, max=180): string {
  const v=string(x,label,max); if(!re.test(v)) return invalid(label+' inválido.'); return v;
}
const id = (x:unknown,label='Identificador') => pattern(x,/^[A-Za-z0-9_-]{1,180}$/,label);
const centerId = (x:unknown) => pattern(x,/^[A-Za-z0-9_-]{1,64}$/,'Centro de custos');
const ug = (x:unknown) => pattern(x,/^\d{6}$/,'UG');
function integer(x:unknown,label:string,min=0):number {
  if (typeof x!=='number'||!Number.isSafeInteger(x)||x<min) return invalid(label+' inválido.');
  return x;
}
function sum(a:number,b:number):number {
  const n=a+b;
  if (!Number.isSafeInteger(n)) return invalid('Total financeiro excede o limite seguro.');
  return n;
}
function date(x:unknown,label:string):string {
  const v=pattern(x,/^\d{4}-\d{2}-\d{2}$/,label);
  const ms=Date.parse(v+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==v) return invalid(label+' inválida.');
  return v;
}
function deadline(x:unknown,issued:string):string|null {
  if (x===null) return null;
  const v=date(x,'Prazo'); if(v<issued)return invalid('Prazo anterior à emissão.'); return v;
}
function array(x:unknown,label:string,max:number):unknown[] {
  if(!Array.isArray(x)||x.length>max)return invalid(label+' inválido ou acima do limite.');
  return x;
}
function own(member:CreditMember,manager=false) {
  if (!/^\d{6}$/.test(member.ug)||!/^[A-Za-z0-9_-]{1,128}$/.test(member.uid)||
      (member.role!=='gestor'&&member.role!=='centro')||
      (member.role==='centro'&&!/^[A-Za-z0-9_-]{1,64}$/.test(member.centerId??''))||
      (member.role==='gestor'&&member.centerId!==null)||(manager&&member.role!=='gestor')) return forbidden();
}
async function verifyWriter(tx:CreditTransaction,member:CreditMember) {
  const actor=(await tx.get<CreditMember & {active:boolean}>('creditControlMembers/'+member.uid))?.data;
  if(!actor||actor.active!==true||actor.uid!==member.uid||actor.email!==member.email||
     actor.ug!==member.ug||actor.role!=='gestor'||actor.centerId!==null) return forbidden();
}
const path=(member:CreditMember,collection:string,key:string)=>'creditUnits/'+member.ug+'/'+collection+'/'+key;
const now=()=>new Date().toISOString();
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fingerprint=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
function revision(expected:unknown,actual:number) {
  if(integer(expected,'Revisão',1)!==actual) return conflict('Registro atualizado por outro usuário. Reabra antes de confirmar.');
}
function allocations(input:unknown):CreditAllocation[] {
  const out=array(input,'Rateio',200).map(v=>{
    const a=object(v); return {centerId:centerId(a.centerId),basisPoints:integer(a.basisPoints,'Percentual')};
  }).sort((a,b)=>a.centerId<b.centerId?-1:a.centerId>b.centerId?1:0);
  try{calculateCreditBalance(0,out,[]);}catch{return invalid('Rateio inválido, duplicado ou superior a 100%.');}
  return out;
}
function pi(input:unknown):string|null {
  if(input===null||input==='-')return null;
  return pattern(input,/^[A-Z0-9]{1,20}$/,'Plano interno');
}
function budgetCell(input:unknown,expectedUg:string):BudgetCell {
  const c=object(input);
  if(ug(c.ug)!==expectedUg)return invalid('UG da célula incompatível com a UG autorizada.');
  return {ug:expectedUg,item:pattern(c.item,/^\d{1,12}$/,'Item'),num:pattern(c.num,/^\d{1,12}$/,'Número da célula'),
    esfera:pattern(c.esfera,/^\d{1,3}$/,'Esfera'),ptres:pattern(c.ptres,/^\d{6}$/,'PTRES'),
    fonte:pattern(c.fonte,/^\d{10}$/,'Fonte'),nd:pattern(c.nd,/^\d{6}$/,'Natureza de despesa'),
    ugr:pattern(c.ugr,/^\d{6}$/,'UGR'),pi:pi(c.pi),cents:integer(c.cents,'Valor da célula',1)};
}
function sequences(input:unknown,expectedUg:string,manual:boolean):CreditSequence[] {
  const used=new Set<string>();
  let lines=0;
  const seqs=array(input,'Sequenciais',100).map(raw=>{
    const s=object(raw);
    const sequence=pattern(s.sequence,/^\d{1,12}$/,'Sequencial');
    const key=String(Number(sequence));
    if(used.has(key))return invalid('Sequencial duplicado.');
    used.add(key);
    const totalCents=integer(s.totalCents,'Valor do sequencial',1);
    const origin=array(s.origin??[],'Origem',200).map(c=>budgetCell(c,expectedUg));
    const destination=array(s.destination,'Destino',200).map((c,index)=>({
      ...budgetCell(c,expectedUg),cellId:'s'+key+'_l'+String(index+1),
    }));
    lines+=origin.length+destination.length;
    if(lines>400||!destination.length||(!manual&&!origin.length)||
      (origin.length>0&&origin.reduce((n,c)=>sum(n,c.cents),0)!==totalCents)||
      destination.reduce((n,c)=>sum(n,c.cents),0)!==totalCents) return invalid('Valores das células não conciliam com o sequencial.');
    return {sequence,totalCents,origin,destination};
  });
  if(!seqs.length)return invalid('Informe pelo menos uma célula de destino.');
  return seqs;
}
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function readCredit(member:CreditMember,raw:StoredCredit|undefined|null,key:string):StoredCredit {
  if(!raw)return absent();
  if(raw.id!==key||raw.beneficiaryUg!==member.ug||!raw.originalFingerprint||!raw.cellAdjustments) return corrupt();
  return raw;
}
function readCommitment(member:CreditMember,raw:StoredCommitment|undefined|null,key:string):StoredCommitment {
  if(!raw)return absent();
  if(raw.id!==key||raw.ug!==member.ug||!raw.originalFingerprint)return corrupt();
  return raw;
}
function publicCredit(record:StoredCredit):CreditRecord {
  const {year,source,originalFingerprint,cellAdjustments,projection,...result}=record;
  return result;
}
function publicCommitment(record:StoredCommitment):CommitmentRecord {
  const {year,centerYear,originalFingerprint,lastReplacementHash,...result}=record;
  return result;
}
function balanceFor(record:StoredCredit,commitments:readonly CommitmentRecord[]):CreditBalance {
  try { return calculateCreditBalance(record.totalCents,record.allocations,commitments); }
  catch { return corrupt(); }
}
function cellsFor(record:StoredCredit,commitments:readonly CommitmentRecord[]):CreditCellBalance[] {
  const used=new Map<string,number>();
  for(const ne of commitments) {
    if(ne.creditId!==record.id||ne.ug!==record.beneficiaryUg)return corrupt();
    used.set(ne.cellId,sum(used.get(ne.cellId)??0,ne.netCents));
  }
  const seen=new Set<string>();
  const result=record.sequences.flatMap(seq=>seq.destination.map(cell=>{
    if(seen.has(cell.cellId))return corrupt();
    seen.add(cell.cellId);
    const cents=sum(cell.cents,record.cellAdjustments[cell.cellId]??0);
    if(cents<0)return corrupt();
    const committedCents=used.get(cell.cellId)??0;
    return {...cell,originalCents:cell.cents,cents,committedCents,availableCents:cents-committedCents};
  }));
  if([...used.keys(),...Object.keys(record.cellAdjustments)].some(key=>!seen.has(key))||
    result.reduce((n,c)=>sum(n,c.cents),0)!==record.totalCents)return corrupt();
  return result;
}
function restrictDetail(member:CreditMember,record:StoredCredit,balance:CreditBalance,cells:CreditCellBalance[]):CreditDetail {
  if(member.role==='gestor')return {credit:publicCredit(record),balance,cells};
  const center=balance.centers.find(c=>c.centerId===member.centerId);
  if(!center||(!center.basisPoints&&!center.commitmentCount))return absent();
  const credit:CreditRecord={...publicCredit(record),totalCents:center.allocatedCents,documentTotalCents:null,
    sequences:[],allocations:record.allocations.filter(a=>a.centerId===member.centerId)};
  const restricted:CreditBalance={
    creditCents:center.allocatedCents,committedCents:center.committedCents,availableCents:center.availableCents,
    commitmentCount:center.commitmentCount,unallocatedBasisPoints:0,unallocatedCents:0,centers:[center],
    overdrawn:center.availableCents<0,overdrawnCenterIds:center.availableCents<0?[center.centerId]:[],
  };
  return {credit,balance:restricted,cells:[]};
}
function detail(member:CreditMember,record:StoredCredit,commitments:readonly CommitmentRecord[]):CreditDetail {
  return restrictDetail(member,record,balanceFor(record,commitments),cellsFor(record,commitments));
}
/** Projeção atômica: toda mutação financeira recalcula pelo núcleo e grava junto da NC. */
function withProjection(record:StoredCredit,detail:CreditDetail):StoredCredit {
  return {...record,projection:{balance:detail.balance,cells:detail.cells}};
}
function projectedDetail(member:CreditMember,record:StoredCredit):CreditDetail {
  const p=record.projection;
  if(!p||p.balance.creditCents!==record.totalCents||
    p.balance.availableCents!==record.totalCents-p.balance.committedCents)return corrupt();
  return restrictDetail(member,record,p.balance,p.cells);
}
async function getStoredCredit(tx:CreditTransaction,member:CreditMember,key:string) {
  return readCredit(member,(await tx.get<StoredCredit>(path(member,'credits',key)))?.data,key);
}
async function getStoredCommitment(tx:CreditTransaction,member:CreditMember,key:string) {
  return readCommitment(member,(await tx.get<StoredCommitment>(path(member,'commitments',key)))?.data,key);
}
async function linked(tx:CreditTransaction,member:CreditMember,creditId:string):Promise<StoredCommitment[]> {
  return (await tx.list<StoredCommitment>(member.ug,'commitments',{field:'creditId',value:creditId})).map(d=>{
    const ne=readCommitment(member,d.data,d.path.split('/').pop()!);
    if(ne.creditId!==creditId)return corrupt();
    return ne;
  });
}
async function ensureCenters(tx:CreditTransaction,member:CreditMember,shares:CreditAllocation[],old:CreditAllocation[]=[]){
  const prior=new Map(old.map(a=>[a.centerId,a.basisPoints]));
  const changed=shares.filter(a=>a.basisPoints>(prior.get(a.centerId)??0)||!prior.has(a.centerId));
  const keys=changed.map(a=>path(member,'centers',a.centerId));
  const docs=await tx.getMany<CostCenter>(keys);
  for(const a of changed) {
    const center=docs.get(path(member,'centers',a.centerId))?.data;
    if(!center||center.id!==a.centerId||center.active!==true)return invalid('Centro de custos inexistente ou inativo: '+a.centerId+'.');
  }
}
function deficitIncreased(before:CreditDetail,after:CreditDetail):boolean {
  const worse=(a:number,b:number)=>b<0&&b<a;
  if(worse(before.balance.availableCents,after.balance.availableCents))return true;
  const centers=new Map(before.balance.centers.map(c=>[c.centerId,c.availableCents]));
  if(after.balance.centers.some(c=>worse(centers.get(c.centerId)??0,c.availableCents)))return true;
  const cells=new Map(before.cells.map(c=>[c.cellId,c.availableCents]));
  return after.cells.some(c=>worse(cells.get(c.cellId)??0,c.availableCents));
}
function reconcile(before:CreditDetail,after:CreditDetail,ack:unknown) {
  if(deficitIncreased(before,after)&&ack!==true)throw new CreditStoreError(409,'CREDIT_DEFICIT_REQUIRES_RECONCILIATION',
    'A operação gera ou amplia déficit. Confira o saldo, a célula e a cota; confirme somente obrigação já emitida ou ajuste conciliado.');
}
function auditSummary(d:CreditDetail) {
  return {revision:d.credit.revision,totalCents:d.balance.creditCents,committedCents:d.balance.committedCents,
    availableCents:d.balance.availableCents,overdrawnCenterIds:d.balance.overdrawnCenterIds};
}
async function audit(tx:CreditTransaction,member:CreditMember,entityType:'nc'|'ne',entityId:string,rev:number,action:string,before:unknown,after:unknown,at:string){
  const key=path(member,'audit',entityType+'_'+entityId+'_r'+rev);
  if(await tx.get(key))return corrupt();
  tx.set(key,{id:entityType+'_'+entityId+'_r'+rev,entityType,entityId,action,authorUid:member.uid,createdAt:at,before,after});
}
export async function createCredit(member:CreditMember,input:unknown):Promise<CreditDetail> {
  own(member,true);
  const data=object(input),draft=object(data.draft);
  if(data.source!=='html'&&data.source!=='manual')return invalid('Informe a origem da NC.');
  const source=data.source,manual=source==='manual';
  const issuingUg=ug(draft.issuingUg);
  if(ug(draft.beneficiaryUg)!==member.ug)return forbidden();
  const number=pattern(draft.number,/^20\d{2}NC\d{6}$/,'Número da NC');
  const fullNumber=pattern(draft.fullNumber??(manual?issuingUg+number:undefined),/^\d{6,20}20\d{2}NC\d{6}$/,'Identificador completo da NC');
  if(!fullNumber.startsWith(issuingUg)||!fullNumber.endsWith(number))return invalid('Identificadores da NC divergentes.');
  const issueDate=date(draft.issueDate,'Data de emissão'),year=number.slice(0,4);
  if(issueDate.slice(0,4)!==year)return invalid('Exercício da NC incompatível com a data de emissão.');
  const operation=string(draft.operation??(manual?'DESCENTRALIZAÇÃO':undefined),'Operação');
  const decentralization=string(draft.decentralization??(manual?'PROVISÃO':undefined),'Descentralização');
  if(normalized(operation)!=='DESCENTRALIZACAO'||normalized(decentralization)!=='PROVISAO')
    return invalid('Apenas provisão por descentralização pode criar NC. Registre ajustes em movimentos.');
  const totalCents=integer(draft.totalCents,'Valor favorecido',1);
  const documentTotalCents=integer(draft.documentTotalCents??(manual?totalCents:undefined),'Valor do documento',1);
  if(documentTotalCents<totalCents)return invalid('Valor favorecido superior ao valor do documento.');
  const seqs=sequences(draft.sequences,member.ug,manual);
  if(seqs.reduce((n,s)=>sum(n,s.totalCents),0)!==totalCents)return invalid('Sequenciais não conciliam com o valor favorecido.');
  const shares=allocations(data.allocations);
  const fields={id:issuingUg+'_'+number,number,fullNumber,issuingUg,beneficiaryUg:member.ug,
    issueDate,description:string(data.description??draft.description,'Descrição',12000,true),
    deadline:deadline(data.deadline!==undefined?data.deadline:draft.deadline??null,issueDate),
    operation,decentralization,sourceSystem:string(draft.sourceSystem??(manual?'MANUAL':undefined),'Sistema de origem'),
    documentTotalCents,totalCents,sequences:seqs,allocations:shares};
  const originalFingerprint=fingerprint({source,...fields});
  return creditTransaction(async tx=>{
    await verifyWriter(tx,member);
    const key=path(member,'credits',fields.id);
    const existing=await tx.get<StoredCredit>(key);
    if(existing){
      const record=readCredit(member,existing.data,fields.id);
      if(record.originalFingerprint!==originalFingerprint)return conflict('NC já cadastrada com dados diferentes. Utilize edição ou conciliação.');
      return detail(member,record,await linked(tx,member,record.id));
    }
    if(data.expectedRevision!==undefined)return conflict('NC inexistente para a revisão informada.');
    await ensureCenters(tx,member,shares);
    const at=now();
    const record:StoredCredit={...fields,year,source,originalFingerprint,cellAdjustments:{},revision:1,createdAt:at,updatedAt:at};
    const result=detail(member,record,[]);
    await audit(tx,member,'nc',record.id,1,'create',null,{...auditSummary(result),source,allocations:shares},at);
    tx.set(key,withProjection(record,result));
    return result;
  });
}
export async function updateCredit(member:CreditMember,input:unknown):Promise<CreditDetail> {
  own(member,true);
  const data=object(input),key=id(data.id);
  if(data.allocations===undefined&&data.description===undefined&&data.deadline===undefined)
    return invalid('Nenhuma alteração informada.');
  return creditTransaction(async tx=>{
    await verifyWriter(tx,member);
    const record=await getStoredCredit(tx,member,key);
    revision(data.expectedRevision,record.revision);
    const nes=await linked(tx,member,key),before=detail(member,record,nes);
    const shares=data.allocations===undefined?record.allocations:allocations(data.allocations);
    await ensureCenters(tx,member,shares,record.allocations);
    const at=now(),next:StoredCredit={...record,allocations:shares,
      description:data.description===undefined?record.description:string(data.description,'Descrição',12000,true),
      deadline:data.deadline===undefined?record.deadline:deadline(data.deadline,record.issueDate),
      revision:sum(record.revision,1),updatedAt:at};
    if(next.description===record.description&&next.deadline===record.deadline&&
      JSON.stringify(next.allocations)===JSON.stringify(record.allocations))return before;
    const after=detail(member,next,nes);
    reconcile(before,after,data.acknowledgeDeficit);
    await audit(tx,member,'nc',key,next.revision,'update',
      {...auditSummary(before),allocations:record.allocations,deadline:record.deadline,description:record.description},
      {...auditSummary(after),allocations:next.allocations,deadline:next.deadline,description:next.description,
        acknowledgedDeficit:data.acknowledgeDeficit===true},at);
    tx.set(path(member,'credits',key),withProjection(next,after));
    return after;
  });
}
function commitmentInput(member:CreditMember,input:unknown) {
  const data=object(input),draft=object(data.draft);
  if(ug(draft.ug)!==member.ug)return forbidden();
  const rawNumber=string(draft.number??draft.id,'Número da NE');
  const number=rawNumber.startsWith(member.ug)&&rawNumber.length>12?rawNumber.slice(-12):rawNumber;
  if(!/^20\d{2}NE\d{6}$/.test(number)||!(rawNumber===number||rawNumber===member.ug+number))return invalid('Número da NE inválido.');
  const rawDate=string(draft.issueDate??draft.date,'Data de emissão');
  const issueDate=date(/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)?rawDate.slice(6)+'-'+rawDate.slice(3,5)+'-'+rawDate.slice(0,2):rawDate,'Data de emissão');
  const year=number.slice(0,4);
  if(issueDate.slice(0,4)!==year)return invalid('Exercício da NE incompatível com a data de emissão.');
  const supplierCnpj=string(draft.supplierCnpj,'CNPJ/CPF do favorecido',24).replace(/[.\/-]/g,'');
  if(!/^(?:\d{14}|\d{11})$/.test(supplierCnpj))return invalid('CNPJ/CPF do favorecido inválido.');
  const fields={id:member.ug+'_'+number,number,creditId:id(data.creditId,'NC'),centerId:centerId(data.centerId),
    cellId:id(data.cellId,'Célula'),ug:member.ug,issueDate,description:string(draft.description,'Descrição',12000,true),
    supplier:string(draft.supplier,'Favorecido',300),supplierCnpj,netCents:integer(draft.netCents,'Valor líquido',1)};
  const codes={nd:pattern(draft.nd??draft.naturezaDespesa,/^\d{6}$/,'ND'),
    ptres:pattern(draft.ptres,/^\d{6}$/,'PTRES'),fonte:pattern(draft.fonte??draft.fonteRecurso,/^\d{10}$/,'Fonte'),
    ugr:pattern(draft.ugr,/^\d{6}$/,'UGR'),pi:pi(draft.pi!==undefined?draft.pi:draft.planoInterno)};
  return {data,fields,codes,year,originalFingerprint:fingerprint({fields,codes})};
}
export async function createCommitment(member:CreditMember,input:unknown):Promise<{commitment:CommitmentRecord;balance:CreditBalance;cells:CreditCellBalance[]}> {
  own(member,true);
  const {data,fields,codes,year,originalFingerprint}=commitmentInput(member,input);
  return creditTransaction(async tx=>{
    await verifyWriter(tx,member);
    const key=path(member,'commitments',fields.id),existing=await tx.get<StoredCommitment>(key);
    if(existing){
      const ne=readCommitment(member,existing.data,fields.id);
      if(ne.originalFingerprint!==originalFingerprint)return conflict('NE já cadastrada com dados ou vínculo diferentes. Registre conciliação.');
      const nc=await getStoredCredit(tx,member,ne.creditId);
      const result=detail(member,nc,await linked(tx,member,nc.id));
      return {commitment:publicCommitment(ne),balance:result.balance,cells:result.cells};
    }
    const record=await getStoredCredit(tx,member,fields.creditId);
    if(record.year!==year)return invalid('NC e NE de exercícios diferentes exigem conciliação antes do registro.');
    if(data.expectedCreditRevision!==undefined)revision(data.expectedCreditRevision,record.revision);
    const nes=await linked(tx,member,record.id);
    const before=detail(member,record,nes);
    const center=(await tx.get<CostCenter>(path(member,'centers',fields.centerId)))?.data;
    if(!center||center.id!==fields.centerId||center.active!==true)return invalid('Centro de custos inexistente ou inativo.');
    const cell=before.cells.find(c=>c.cellId===fields.cellId);
    if(!cell)return invalid('Célula de destino não pertence à NC.');
    const differences:BudgetDifference[]=(['nd','ptres','fonte','ugr','pi'] as const).filter(k=>cell[k]!==codes[k]).map(k=>({field:k.toUpperCase(),credit:cell[k],commitment:codes[k]}));
    if(differences.length&&data.acknowledgeBudgetDifference!==true)throw new CreditStoreError(409,'CREDIT_BUDGET_ACK_REQUIRED','Confira as diferenças: '+differences.map(d=>({ND:'Natureza da despesa (ND)',PTRES:'Programa de trabalho (PTRES)',FONTE:'Fonte de recursos',UGR:'UG responsável (UGR)',PI:'Plano interno (PI)'} as Record<string,string>)[d.field]+' — NC: '+(d.credit??'não informado')+'; NE: '+(d.commitment??'não informado')).join(' | ')+'. Confirme a ciência para registrar o empenho.');
    // A célula escolhida permanece o vínculo financeiro; os códigos da NE divergentes ficam registrados, sem alterar a NC.
    const at=now(),ne:StoredCommitment={...fields,year,centerYear:year+'_'+fields.centerId,originalFingerprint,budgetDifferences:differences,revision:1,createdAt:at,updatedAt:at};
    const next={...record,revision:sum(record.revision,1),updatedAt:at};
    const after=detail(member,next,[...nes,ne]);
    reconcile(before,after,data.acknowledgeDeficit);
    await audit(tx,member,'ne',ne.id,1,'create',auditSummary(before),
      {...auditSummary(after),creditId:ne.creditId,centerId:ne.centerId,cellId:ne.cellId,netCents:ne.netCents,
        acknowledgedDeficit:data.acknowledgeDeficit===true,budgetDifferences:differences,acknowledgedBudgetDifference:data.acknowledgeBudgetDifference===true},at);
    tx.set(key,ne);
    // A revisão da NC serializa NEs concorrentes e ajustes de suas células.
    tx.set(path(member,'credits',record.id),withProjection(next,after));
    return {commitment:publicCommitment(ne),balance:after.balance,cells:after.cells};
  });
}
/** Replace only the consolidated PDF of the same NE; record its reduction atomically. */
export async function replaceCommitmentPdf(member:CreditMember,input:unknown):Promise<{commitment:CommitmentRecord;balance:CreditBalance;cells:CreditCellBalance[]}> {
  own(member,true);
  const data=object(input),keyId=id(data.id),documentHash=pattern(data.documentHash,/^[a-f0-9]{64}$/,'Identificação do documento');
  const netCents=integer(data.netCents,'Novo valor líquido'),expectedRevision=integer(data.expectedRevision,'Revisão',1);
  const number=pattern(data.number,/^20\d{2}NE\d{6}$/,'Número da NE');
  const supplierCnpj=string(data.supplierCnpj,'CNPJ/CPF do favorecido',24).replace(/[.\/-]/g,'');
  const issueDate=date(data.issueDate,'Data de emissão');
  if(data.confirmed!==true)return invalid('Confirme o novo valor e a devolução ao crédito.');
  return creditTransaction(async tx=>{
    await verifyWriter(tx,member);
    const ne=await getStoredCommitment(tx,member,keyId);
    if(ne.number!==number||ne.supplierCnpj!==supplierCnpj||ne.issueDate!==issueDate)return invalid('O PDF deve corresponder à mesma NE, ao mesmo favorecido e à mesma data de emissão.');
    const nc=await getStoredCredit(tx,member,ne.creditId),nes=await linked(tx,member,nc.id);
    const before=detail(member,nc,nes);
    if(ne.lastReplacementHash===documentHash&&ne.netCents===netCents)return {commitment:publicCommitment(ne),balance:before.balance,cells:before.cells};
    revision(expectedRevision,ne.revision);
    if(netCents>ne.netCents)return invalid('O novo PDF tem valor maior que o saldo registrado da NE. Para reforço, utilize Registrar ajuste.');
    const at=now(),delta=ne.netCents-netCents;
    const nextNe:StoredCommitment={...ne,netCents,lastReplacementHash:documentHash,revision:sum(ne.revision,1),updatedAt:at};
    const nextNc={...nc,revision:sum(nc.revision,1),updatedAt:at};
    const after=detail(member,nextNc,nes.map(n=>n.id===ne.id?nextNe:n));
    if(delta>0){
      const movementId='mov_'+fingerprint(['ne',ne.id,'pdf',documentHash]);
      const movementKey=path(member,'movements',movementId);
      if(await tx.get(movementKey))return conflict('Este documento já foi utilizado para uma anulação. Confira o histórico.');
      const movement:MovementRecord={id:movementId,entityType:'ne',entityId:ne.id,kind:'anulacao',amountCents:delta,deltaCents:-delta,reference:'PDF '+documentHash,reason:'Substituição por NE atualizada — redução do valor líquido',expectedRevision,acknowledgeDeficit:false,creditId:nc.id,cellId:ne.cellId,authorUid:member.uid,createdAt:at};
      tx.set(movementKey,movement);
    }
    await audit(tx,member,'ne',ne.id,nextNe.revision,'replacePdf',{...auditSummary(before),entityCents:ne.netCents},{...auditSummary(after),entityCents:netCents,returnedCents:delta,documentHash},at);
    tx.set(path(member,'commitments',ne.id),nextNe);
    tx.set(path(member,'credits',nc.id),withProjection(nextNc,after));
    return {commitment:publicCommitment(nextNe),balance:after.balance,cells:after.cells};
  });
}
export async function registerMovement(member:CreditMember,input:unknown):Promise<{movement:MovementRecord;credit:CreditRecord;commitment?:CommitmentRecord;balance:CreditBalance;cells:CreditCellBalance[]}> {
  own(member,true);
  const data=object(input),entityId=id(data.entityId);
  if(data.entityType!=='nc'&&data.entityType!=='ne')return invalid('Entidade financeira inválida.');
  const entityType=data.entityType;
  const kind=normalized(string(data.kind,'Tipo de movimento')).toLowerCase() as MovementKind;
  if(!['reforco','anulacao','recolhimento','correcao'].includes(kind)||(entityType==='ne'&&kind==='recolhimento'))
    return invalid('Tipo de movimento incompatível com a entidade.');
  const amountCents=integer(data.amountCents,'Valor do movimento',kind==='correcao'?-Number.MAX_SAFE_INTEGER:1);
  if(!amountCents)return invalid('Valor do movimento deve ser diferente de zero.');
  const deltaCents=kind==='anulacao'||kind==='recolhimento'?-amountCents:amountCents;
  const reference=string(data.reference,'Referência',180),reason=string(data.reason,'Motivo',4000);
  const expectedRevision=integer(data.expectedRevision,'Revisão',1);
  const movementId='mov_'+fingerprint([entityType,entityId,normalized(reference).replace(/\s+/g,' ')]);
  return creditTransaction(async tx=>{
    await verifyWriter(tx,member);
    const key=path(member,'movements',movementId),previous=await tx.get<MovementRecord>(key);
    const ne=entityType==='ne'?await getStoredCommitment(tx,member,entityId):undefined;
    const record=await getStoredCredit(tx,member,ne?.creditId??entityId);
    const nes=await linked(tx,member,record.id),before=detail(member,record,nes);
    const cellId=ne?ne.cellId:data.cellId!==undefined?id(data.cellId,'Célula'):
      before.cells.length===1?before.cells[0].cellId:invalid('Selecione a célula do movimento da NC.');
    if(ne&&data.cellId!==undefined&&data.cellId!==ne.cellId)return invalid('Célula do movimento diverge da NE.');
    const cell=before.cells.find(c=>c.cellId===cellId);
    if(!cell)return invalid('Célula não pertence à NC.');
    if(previous) {
      const m=previous.data;
      if(m.entityType!==entityType||m.entityId!==entityId||m.creditId!==record.id||m.cellId!==cellId||
        m.kind!==kind||m.amountCents!==amountCents||m.reason!==reason)
        return conflict('Referência já registrada para esta entidade com dados diferentes.');
      return {movement:m,credit:before.credit,...(ne?{commitment:publicCommitment(ne)}:{}),balance:before.balance,cells:before.cells};
    }
    revision(expectedRevision,ne?.revision??record.revision);
    const at=now();
    let next:StoredCredit={...record,revision:sum(record.revision,1),updatedAt:at};
    let nextNe:StoredCommitment|undefined;
    if(ne){
      const netCents=sum(ne.netCents,deltaCents);
      if(netCents<0)return invalid('Valor líquido da NE não pode ficar negativo.');
      nextNe={...ne,netCents,revision:sum(ne.revision,1),updatedAt:at};
    }else{
      if(sum(cell.cents,deltaCents)<0)return invalid('Valor líquido da célula da NC não pode ficar negativo.');
      next={...next,totalCents:sum(record.totalCents,deltaCents),
        cellAdjustments:{...record.cellAdjustments,[cellId]:sum(record.cellAdjustments[cellId]??0,deltaCents)}};
    }
    const after=detail(member,next,nextNe?nes.map(n=>n.id===nextNe!.id?nextNe!:n):nes);
    reconcile(before,after,data.acknowledgeDeficit);
    const movement:MovementRecord={id:movementId,entityType,entityId,kind,amountCents,deltaCents,reference,reason,
      expectedRevision,acknowledgeDeficit:data.acknowledgeDeficit===true,creditId:record.id,cellId,authorUid:member.uid,createdAt:at};
    await audit(tx,member,entityType,entityId,nextNe?.revision??next.revision,'movement',
      {...auditSummary(before),entityRevision:ne?.revision??record.revision,entityCents:ne?.netCents??cell.cents},
      {...auditSummary(after),entityRevision:nextNe?.revision??next.revision,
        entityCents:nextNe?.netCents??sum(cell.cents,deltaCents),movementId,reference,reason,
        acknowledgedDeficit:data.acknowledgeDeficit===true},at);
    tx.set(key,movement);
    tx.set(path(member,'credits',record.id),withProjection(next,after));
    if(nextNe)tx.set(path(member,'commitments',nextNe.id),nextNe);
    return {movement,credit:after.credit,...(nextNe?{commitment:publicCommitment(nextNe)}:{}),balance:after.balance,cells:after.cells};
  });
}
export async function getCredit(member:CreditMember,key:string):Promise<CreditDetail> {
  own(member);
  const validated=id(key);
  return creditTransaction(async tx=>{
    const record=await getStoredCredit(tx,member,validated);
    return projectedDetail(member,record);
  },true);
}
export async function getCommitment(member:CreditMember,key:string):Promise<{commitment:CommitmentRecord}> {
  own(member);
  return creditTransaction(async tx=>{
    const ne=await getStoredCommitment(tx,member,id(key));
    if(member.role==='centro'&&ne.centerId!==member.centerId)return absent();
    return {commitment:publicCommitment(ne)};
  },true);
}
export async function listFinance(member:CreditMember,filters:FinanceFilters={},completeReport=false):Promise<FinanceView> {
  own(member);
  const year=filters.year===undefined||filters.year===''?today().slice(0,4):pattern(String(filters.year),/^20\d{2}$/,'Exercício');
  const limit=filters.limit===undefined||filters.limit===''?50:integer(Number(filters.limit),'Limite',1);
  if(limit>200)return invalid('Limite máximo de 200 registros.');
  // Dois cursores por chave estável, vinculados à identidade/exercício.
  // "~" indica que a respectiva lista terminou; não voltar à primeira página.
  const sort=filters.sort||'deadline';
  if(!['deadline','issue','id'].includes(sort))return invalid('Ordenação inválida.');
  const selectedCenter=filters.center?centerId(filters.center):'';
  if(selectedCenter&&member.role==='centro'&&selectedCenter!==member.centerId)return forbidden();
  let creditAfter='',neAfter='';
  const scope=fingerprint([member.uid,member.ug,member.role,member.centerId,year,limit,sort,selectedCenter]).slice(0,20);
  if(completeReport&&filters.cursor)return invalid('Relatório integral não aceita cursor externo.');
  if(filters.cursor){
    const match=/^([a-f0-9]{20})\.([A-Za-z0-9_-]{1,180}|~)\.([A-Za-z0-9_-]{1,180}|~)$/.exec(filters.cursor);
    if(!match||match[1]!==scope)return invalid('Cursor inválido para esta consulta.');
    creditAfter=match[2];neAfter=match[3];
  }
  return creditTransaction(async tx=>{
    // Uma passagem pelas NCs projetadas, sem consultas N+1 ou leitura integral de NEs.
    // Totais e alertas abrangem o exercício todo, inclusive em páginas posteriores.
    const creditDocs=await tx.list<StoredCredit>(member.ug,'credits',{field:'year',value:year});
    const nePage=neAfter==='~'?{docs:[] as import('./creditControlFirestore').CreditDocument<StoredCommitment>[],nextAfter:undefined}:
      await tx.listCommitmentPage<StoredCommitment>(member.ug,
        member.role==='centro'||selectedCenter?{field:'centerYear',value:year+'_'+(member.role==='centro'?member.centerId:selectedCenter)}:{field:'year',value:year},limit,neAfter);
    // Relatório: todas as páginas de NEs no MESMO snapshot das NCs e dos totais.
    // Não refazer a consulta anual de NCs a cada página, nem misturar revisões concorrentes.
    if(completeReport){
      let next=nePage.nextAfter;
      for(let page=1;next;page++){
        if(page>=100)throw new CreditStoreError(422,'CREDIT_REPORT_LIMIT','Relatório excede o limite seguro de registros.');
        const more=await tx.listCommitmentPage<StoredCommitment>(member.ug,
          member.role==='centro'||selectedCenter?{field:'centerYear',value:year+'_'+(member.role==='centro'?member.centerId:selectedCenter)}:{field:'year',value:year},limit,next);
        nePage.docs.push(...more.docs);
        next=more.nextAfter;
      }
      nePage.nextAfter=undefined;
    }
    const centers=member.role==='gestor'?(await tx.list<CostCenter>(member.ug,'centers')).map(d=>d.data):
      [(await tx.get<CostCenter>(path(member,'centers',member.centerId!)))?.data].filter((x):x is CostCenter=>!!x);
    const pageNe=nePage.docs.map(d=>readCommitment(member,d.data,d.path.split('/').pop()!));
    if(pageNe.some(ne=>ne.year!==year||(member.role==='centro'&&ne.centerId!==member.centerId)))return corrupt();
    const credits:FinanceCredit[]=[],alerts:FinanceAlert[]=[];
    const totals:FinanceView['totals']={creditCents:0,committedCents:0,availableCents:0,creditCount:0,
      commitmentCount:0,noCommitmentsCount:0,unallocatedCents:0};
    const currentDay=today();
    const allCreditIds=new Set<string>();
    for(const doc of creditDocs){
      const record=readCredit(member,doc.data,doc.path.split('/').pop()!);
      if(record.year!==year)return corrupt();
      if(member.role==='centro'&&!record.projection?.balance.centers.some(c=>c.centerId===member.centerId&&(c.basisPoints>0||c.commitmentCount>0)))continue;
      const d=projectedDetail(member,record),b=d.balance;
      allCreditIds.add(record.id);
      totals.creditCents=sum(totals.creditCents,b.creditCents);
      totals.committedCents=sum(totals.committedCents,b.committedCents);
      totals.availableCents=sum(totals.availableCents,b.availableCents);
      totals.unallocatedCents=sum(totals.unallocatedCents,b.unallocatedCents);
      totals.creditCount++;
      totals.commitmentCount=sum(totals.commitmentCount,b.commitmentCount);
      if(!b.commitmentCount)totals.noCommitmentsCount++;
      const alert={creditId:record.id,number:record.number,...creditAlerts(b.availableCents,b.commitmentCount,record.deadline,currentDay),
        overdrawn:b.overdrawn,overdrawnCenterIds:b.overdrawnCenterIds,
        overdrawnCellIds:d.cells.filter(c=>c.availableCents<0).map(c=>c.cellId)};
      if(alert.noCommitments||alert.deadlineMissing||alert.overdue||alert.dueToday||alert.dueWithinSevenDays||
        alert.overdrawn||alert.overdrawnCenterIds.length||alert.overdrawnCellIds.length)alerts.push(alert);
      credits.push({...d.credit,balance:b,cells:d.cells});
    }
    if(pageNe.some(ne=>!allCreditIds.has(ne.creditId)))return corrupt();
    // Ordenação canônica, estável mesmo quando novos registros entram no exercício.
    const ordered=credits.filter(c=>!selectedCenter||c.balance.centers.some(x=>x.centerId===selectedCenter&&(x.basisPoints>0||x.commitmentCount>0)));
    ordered.sort((a,b)=>(sort==='deadline'?(a.deadline??'9999-12-31').localeCompare(b.deadline??'9999-12-31'):sort==='issue'?b.issueDate.localeCompare(a.issueDate):0)||a.id.localeCompare(b.id));
    const afterIndex=creditAfter&&creditAfter!=='~'?ordered.findIndex(c=>c.id===creditAfter):-1;
    if(creditAfter&&creditAfter!=='~'&&afterIndex<0)return invalid('A lista foi atualizada. Retorne à primeira página.');
    const remaining=creditAfter==='~'?[]:ordered.slice(afterIndex+1);
    const creditPage=completeReport?remaining:remaining.slice(0,limit);
    const creditNext=!completeReport&&remaining.length>limit?creditPage[creditPage.length-1].id:'~';
    const neNext=nePage.nextAfter??'~';
    return {member:{uid:member.uid,email:member.email,ug:member.ug,role:member.role,centerId:member.centerId},
      totals,credits:creditPage,commitments:pageNe.map(publicCommitment),
      centers:centers.filter(c=>member.role==='gestor'||c.id===member.centerId).map(c=>({id:c.id,name:c.name,active:c.active})),
      alerts,...(creditNext!=='~'||neNext!=='~'?{nextCursor:scope+'.'+creditNext+'.'+neNext}:{})};

  },true);
}
