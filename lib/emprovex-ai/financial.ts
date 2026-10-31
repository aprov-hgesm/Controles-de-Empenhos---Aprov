/** Contratos C01-C06. Dados e calculos baseados nas estruturas operacionais existentes. */
import type { AiAccess } from './authorize';
import type { AiQuery } from './contracts';
import { AiExecutionError, type QueryOutcome } from './response';
import { coreDocument, coreOperationalDocument, coreOperationalQuery, type AiRow } from './reader';
import { getEmpenhoExerciseYear } from '../../features/empenhos/domain/empenhoExercise';
import { parseAiCursor, makeAiCursor } from './cursor';
import { operationalMidnightUtc } from './period';

function s(v:unknown):string{return typeof v==='string'?v:'';}
function n(v:unknown):number {
  if(typeof v!=='number'||!Number.isFinite(v))throw new AiExecutionError('AI_INVALID_FINANCIAL_NUMBER',503);
  return v;
}
function source(domain:string,row:AiRow) {return {source:domain,documentId:row.id};}
function words(v:string):string{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function itemsOf(record:Record<string,unknown>):Array<Record<string,unknown>> {
  if(!Array.isArray(record.items))throw new AiExecutionError('AI_COMMITMENT_ITEMS_MISSING',503);
  return record.items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new AiExecutionError('AI_INVALID_COMMITMENT_ITEM',503);
    return item as Record<string,unknown>;
  });
}
function balanceOf(record:Record<string,unknown>, itemId?:string) {
  const items=itemsOf(record);
  const selected=itemId?items.filter(item=>item.id===itemId):items;
  if(itemId && selected.length!==1)throw new AiExecutionError('AI_ITEM_NOT_FOUND',404);
  let committed=0,received=0;
  const calculated=selected.map(item=>{
    const quantity=n(item.quantity),got=n(item.received),price=n(item.unitPrice);
    if(quantity<0||got<0||price<0||!s(item.unit) || !s(item.id))
      throw new AiExecutionError('AI_COMMITMENT_ITEM_INTEGRITY',503);
    const amount=quantity*price, receivedAmount=got*price;
    if(!Number.isFinite(amount)||!Number.isFinite(receivedAmount))throw new AiExecutionError('AI_FINANCIAL_OVERFLOW',503);
    committed+=amount; received+=receivedAmount;
    return {itemId:item.id,description:s(item.name),unit:item.unit,
      committedQuantity:quantity,receivedQuantity:got,pendingQuantity:Math.max(0,quantity-got),
      unitPrice:price,committedAmount:amount,receivedAmount,operationalBalance:Math.max(0,amount-receivedAmount)};
  });
  if(!Number.isFinite(committed)||!Number.isFinite(received))
    throw new AiExecutionError('AI_FINANCIAL_OVERFLOW',503);
  return {balanceKind:'operational' as const,currency:'BRL' as const,
    committedAmount:committed,receivedAmount:received,
    operationalBalance:Math.max(0,committed-received),itemsWithBalance:calculated.filter(x=>x.pendingQuantity>0).length,items:calculated};
}
async function supplierFind(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const cnpj=s(p.cnpj),nameQuery=words(s(p.nameQuery));
  let result;
  if(cnpj){
    result=await coreOperationalQuery(access,'suppliers',[{field:'cnpj',op:'EQUAL',value:cnpj}],21);
  }else{
    result=await coreOperationalQuery(access,'suppliers',[],21);
  }
  const matches=result.rows.filter(row=>!nameQuery ||
    words(s(row.data.legalName)).includes(nameQuery)).filter(row=>!cnpj||row.data.cnpj===cnpj);
  // O fallback global é deliberadamente restrito ao formato comprovado no documento defaults.
  if(!matches.length && cnpj && !p.nameQuery && !result.truncated) {
    const global=await coreDocument('supplierDirectory/defaults',access.googleToken);
    const raw=global?.entries;
    const entries=Array.isArray(raw)?raw:[];
    const candidate=entries.filter(x=>x&&typeof x==='object'&&(x as Record<string,unknown>).cnpj===cnpj);
    if(candidate.length===1){
      const x=candidate[0] as Record<string,unknown>;
      if(typeof x.email==='string'&&x.email.includes('@')){
        return {status:'ok',coverage:'complete',data:[{cnpj,email:x.email,source:'global'}],
          evidence:[{source:'supplierDirectory',documentId:'defaults'}],examinedDocuments:result.examined+1};
      }
    }
  }
  const channel=s(p.channel)||'all';
  const entries=matches.map(row=>({supplierId:row.id,legalName:s(row.data.legalName),
    cnpj:s(row.data.cnpj),source:'local',...(channel==='all'?{email:s(row.data.email),phone:s(row.data.phone),
      whatsapp:s(row.data.whatsapp)}:{[channel]:s(row.data[channel])})}));
  const status=result.truncated?'partial':matches.length>1?'ambiguous':entries.length?'ok':'empty';
  return {status,data:entries,evidence:matches.map(row=>source('suppliers',row)),
    coverage:result.truncated?'incomplete':'complete',
    limitations:result.truncated?['Busca por nome limitada a 20 candidatos: refine o nome ou informe CNPJ.']:[],
    truncated:result.truncated,examinedDocuments:result.examined};
}
async function commitmentGet(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const id=s(p.commitmentId),row=await coreOperationalDocument(access,'empenhos',id);
  if(!row)return {status:'empty',data:null,examinedDocuments:1};
  const d=row.data;
  return {data:{id:row.id,supplier:d.supplier,supplierCnpj:d.supplierCnpj||null,
    date:d.date,status:d.status,description:d.description,
    classification:d.classification||null,modalidadeContratacao:d.modalidadeContratacao||null,
    numeroContratacao:d.numeroContratacao||null,contrato:d.contrato||null,
    ...(p.includeItems===true?{items:itemsOf(d)}:{})},
    evidence:[source('empenhos',row)],examinedDocuments:1};
}
async function commitmentBalance(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const id=s(p.commitmentId),row=await coreOperationalDocument(access,'empenhos',id);
  if(!row)return {status:'empty',data:null,examinedDocuments:1};
  const balance=balanceOf(row.data,s(p.itemId)||undefined);
  return {data:{commitmentId:row.id,...balance},
    limitations:['Saldo operacional calculado a partir dos itens cadastrados; não equivale ao saldo contábil do SIAFI.'],
    evidence:[source('empenhos',row)],examinedDocuments:1};
}
async function previousOpen(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const requested=p.exerciseYear as number|undefined,older=p.includeHistorical===true,now=new Date().getUTCFullYear();
  const pageSize=p.pageSize as number;
  const cursor=p.cursor?parseAiCursor(String(p.cursor),access,'commitment_previous_open_list',p):undefined;
  const q=await coreOperationalQuery(access,'empenhos',[],201,'__name__',cursor);
  const found=q.rows.flatMap(row=>{
    const year=getEmpenhoExerciseYear({id:s(row.data.id)||row.id,date:s(row.data.date)});
    if(!year || (requested!==undefined&&requested!==year)
      || (requested===undefined && year>=now) || (!older && year<now-1))return [];
    const calc=balanceOf(row.data);
    if(calc.operationalBalance<=0)return [];
    return [{commitmentId:row.id,exerciseYear:year,supplier:s(row.data.supplier),
      operationalBalance:calc.operationalBalance,currency:'BRL',pendingItems:calc.itemsWithBalance,
      operationalClassification:year===now-1?'previous_exercise':'historical'}];
  });
  const over=found.length>pageSize;
  const lastMatched=found.length>pageSize?found[pageSize-1].commitmentId:null;
  const lastScanned=q.rows.at(-1)?.id||null;
  const nextCursor=(q.truncated||over) && (lastMatched||lastScanned)
    ? makeAiCursor(access,'commitment_previous_open_list',p,lastMatched||lastScanned||'') :null;
  return {status:q.truncated||over?'partial':found.length?'ok':'empty',
    data:found.slice(0,pageSize),evidence:q.rows.filter(row=>found.some(f=>f.commitmentId===row.id))
      .slice(0,pageSize).map(row=>source('empenhos',row)),
    coverage:q.truncated||over?'incomplete':'complete',
    truncated:q.truncated||over,nextCursor,
    limitations:['Classificação por exercício não comprova inscrição oficial em RPNP no SIAFI.',
      ...(q.truncated?['Pesquisa limitada a 200 empenhos; resultados podem estar incompletos.']:[]),
      ...(over?['Página limitada; refinamento por exercício recomendado.']:[]),
      ...((q.truncated||over)&&!nextCursor?['Paginação indisponível: configurar EMPROVEX_AI_CURSOR_SECRET com segredo seguro.']:[])],
    examinedDocuments:q.examined};
}
function historyOf(row:AiRow): Array<Record<string,unknown>> {
  const d=row.data,history=Array.isArray(d.historicoEnviosEmail)?d.historicoEnviosEmail:[];
  const records:Record<string,unknown>[]=[],seen=new Set<string>();
  for(const entry of [...history,d.ultimoEnvioEmail]){
    if(!entry || typeof entry!=='object'||Array.isArray(entry))continue;
    const e=entry as Record<string,unknown>;
    const messageId=s(e.messageId);
    if(!messageId || !s(e.enviadoEm)||seen.has(messageId))continue;
    seen.add(messageId);records.push(e);
  }
  return records;
}
async function sentHistory(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const id=s(p.commitmentId);
  const q=id?{rows:(()=>[] as AiRow[])(),truncated:false,examined:1}
    :await coreOperationalQuery(access,'cronogramas',[],11);
  if(id) {
    const row=await coreOperationalDocument(access,'cronogramas',id);
    if(row)q.rows.push(row);
  }
  const period=p.sentPeriod as {start:string;endExclusive:string}|undefined;
  const supplierByCronograma=new Map<string,string>();
  let unresolvedSupplier=false;
  if(p.supplierCnpj){
    for(const row of q.rows){
      const ne=s(row.data.empenhoId)||row.id;
      const empenho=await coreOperationalDocument(access,'empenhos',ne);
      if(empenho)supplierByCronograma.set(row.id,s(empenho.data.supplierCnpj));
      else unresolvedSupplier=true;
    }
  }
  const records=q.rows.flatMap(row=>historyOf(row).flatMap(ev=>{
    const at=s(ev.enviadoEm);
    if(period && (!Number.isFinite(Date.parse(at)) || Date.parse(at)<Date.parse(operationalMidnightUtc(period.start))
      ||Date.parse(at)>=Date.parse(operationalMidnightUtc(period.endExclusive))))return [];
    if(p.supplierCnpj && supplierByCronograma.get(row.id)!==p.supplierCnpj)return [];
    return [{commitmentId:s(row.data.empenhoId)||row.id,sentAt:at,
      messageId:ev.messageId,to:ev.destinatario,subject:ev.assunto,
      supplier:ev.fornecedor||null,remessas:ev.remessas||null,sourceRecordId:row.id}];
  })).sort((a,b)=>String(b.sentAt).localeCompare(String(a.sentAt)));
  const limited=records.length>(p.pageSize as number);
  const unverifiableSupplier=Boolean(p.supplierCnpj && unresolvedSupplier);
  const incomplete=q.truncated||limited||unverifiableSupplier
    ||records.some(item=>item.remessas===null);
  return {status:incomplete?'partial':records.length?'ok':'empty',
    data:records.slice(0,p.pageSize as number),
    evidence:records.slice(0,p.pageSize as number).map(e=>({source:'cronogramas',documentId:e.sourceRecordId})),
    coverage:incomplete?'incomplete':'complete',truncated:q.truncated||limited,
    limitations:['messageId registra envio, não confirma entrega nem leitura do e-mail.',
      'Ausência de registro não comprova ausência de envio pelo Gmail.',
      ...(incomplete?['Retratos de remessas ou cobertura histórica podem estar incompletos.']:[])],
    examinedDocuments:q.examined+(p.supplierCnpj?q.rows.length:0)};
}
async function invoicePeriod(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const period=p.interval as {start:string;endExclusive:string},size=p.pageSize as number;
  const cursor=p.cursor?parseAiCursor(String(p.cursor),access,'invoice_registration_period_list',p):undefined;
  const q=await coreOperationalQuery(access,'invoices',[
    {field:'registeredAt',op:'GREATER_THAN_OR_EQUAL',value:operationalMidnightUtc(period.start)},
    {field:'registeredAt',op:'LESS_THAN',value:operationalMidnightUtc(period.endExclusive)}],size+1,'registeredAt',cursor);
  const scanned=q.rows.slice(0,size);
  const visible=scanned.filter(row=>!p.supplierCnpj||row.data.supplierCnpj===p.supplierCnpj)
    .filter(row=>!p.commitmentId||row.data.empenhoId===p.commitmentId);
  const last=scanned.at(-1);
  const nextCursor=q.truncated&&last?makeAiCursor(access,'invoice_registration_period_list',p,last.id,s(last.data.registeredAt)):null;
  const incomplete=q.truncated || !!p.supplierCnpj || !!p.commitmentId;
  return {status:incomplete?'partial':visible.length?'ok':'empty',
    data:visible.map(row=>({recordKey:row.id,number:row.data.id,
      supplier:row.data.supplier,supplierCnpj:row.data.supplierCnpj||null,
      commitmentId:row.data.empenhoId,registeredAt:row.data.registeredAt,
      issueDate:row.data.issueDate,totalValue:row.data.totalValue,currency:'BRL'})),
    evidence:visible.map(row=>source('invoices',row)),coverage:incomplete?'incomplete':'complete',
    truncated:q.truncated,nextCursor,
    limitations:['Pesquisa por registeredAt; emissão, termo, comissão e tesouraria são datas distintas.',
      'Notas legadas sem registeredAt não entram nesta consulta; cobertura histórica não comprovada.',
      ...(incomplete?['Filtros adicionais ou paginação podem omitir registros; refine o intervalo.']:[]),
      ...(q.truncated&&!nextCursor?['Paginação indisponível: configurar EMPROVEX_AI_CURSOR_SECRET.']:[])],
    examinedDocuments:q.examined};
}
export async function executeFinancial(access:AiAccess,q:AiQuery):Promise<QueryOutcome>{
  switch(q.intent) {
    case 'supplier_contact_find':return supplierFind(access,q.params);
    case 'commitment_get':return commitmentGet(access,q.params);
    case 'commitment_total_balance':return commitmentBalance(access,q.params);
    case 'commitment_previous_open_list':return previousOpen(access,q.params);
    case 'schedule_sent_history_list':return sentHistory(access,q.params);
    case 'invoice_registration_period_list':return invoicePeriod(access,q.params);
    default:throw new AiExecutionError('AI_FINANCIAL_CONTRACT_UNSUPPORTED',422);
  }
}
