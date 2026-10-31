import {ACCEPTED_INTENTS} from './catalog';
import {makeW3Query} from './adapter';
import {has,matchAny,normalize,repairSafeWords,parsePeriod,WORDS} from './language';
import type {Input,Result,Route,Domain,Intent,ContextRefs,Dimensions,ShortContext,W3Intent} from './types';

const MAX_CHARS=1000,MAX_WORDS=150,MAX_REFS=4,TTL=10*60*1000;
const EMPTY:Dimensions={intention:null,document:null,material:null,situation:null,period:null,
  identity:null,quantity:null,location:null,relationship:null,format:null};
function safeContext(input:Input,now:number):ContextRefs {
 const p=input.previous,s=input.scope;
 if(!p||!s||!s.sessionId||!s.workspaceId||p.sessionId!==s.sessionId||p.workspaceId!==s.workspaceId||
   !Number.isFinite(p.updatedAt)||p.updatedAt>now+30000||now-p.updatedAt>TTL)return {};
 return Object.fromEntries(Object.entries(p.refs||{}).filter(([k,v])=>
   ['commitmentId','materialQuery','supplierName','supplierCnpj'].includes(k)&&typeof v==='string'&&v.length<=120)
   .slice(0,MAX_REFS)) as ContextRefs;
}
function extract(text:string,canonical:string) {
 const fullIds=[...text.matchAll(/\b\d{4}NE\d{1,10}\b/gi)].map(m=>m[0].toUpperCase());
 const id=fullIds[0];const multiCommitments=new Set(fullIds).size>1;
 const partial=text.match(/\bNE\s*[-]?\s*(\d{1,10})\b/i)?.[0];
 const rawCnpj=text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/)?.[0];
 const cnpj=rawCnpj?.replace(/\D/g,'');
 const nf=canonical.match(/\b(?:nf|nota fiscal|nota)\s*(?:n[uo]mero|n|no)?\s*(\d{1,12})\b/)?.[1];
 let supplier=text.match(/\bfornecedor\s+[\p{L}][\p{L}\s.\-]{1,75}/iu)?.[0]?.trim();
 if(!supplier)supplier=text.match(/\bfornecedo\s+[\p{L}][\p{L}\s.\-]{1,75}/iu)?.[0]?.replace(/^fornecedo/i,'fornecedor').trim();
 if(supplier)supplier=supplier.replace(/\s+(?:da|de|do|no|na|em)\s+(?:semana|mes|ano|dia)\b.*$/i,'').replace(/[.,;!?]+$/,'').trim();
 let material='';
 const patterns=[
   /\bquanto\s+(?:de\s+)?(.{2,85}?)\s+(?:ainda\s+)?temos\b/,
   /\b(?:onde (?:esta|fica|estao)|localizacao de|localize|encontrar)\s+(?:o|a|os|as)?\s*(.{2,85}?)(?:\s+(?:no|na|em|dentro|agora)\b|$)/,
   /\b(?:quantidade|estoque|saldo fisico)\s+(?:de|do|da)\s+(.{2,85}?)(?:\s+(?:no|na|em|agora)\b|$)/,
   /\btemos\s+(.{2,85}?)\s+em estoque\b/,
   /\b(?:existe|ha)\s+(.{2,85}?)\s+(?:no deposito|na camara|em estoque)\b/
 ];
 for(const re of patterns){const m=canonical.match(re);if(m){material=m[1].trim();break;}}
 if(!material&&/\b(?:nota|notas|nf|nfs)\b/.test(canonical)){
   const m=canonical.match(/\b(?:notas?|nfs?)\s+(?:de|do|da)\s+([a-z][a-z -]{1,60}?)(?=\s+(?:foram|cadastrad|da semana|na semana|emitid|ontem)|$)/);
   if(m)material=m[1];
 }
 if(!material&&/\b(?:estoque|armazenado|material|deposito)\b/.test(canonical)){
   const m=canonical.match(/\b(?:do|da|de)\s+([a-z][a-z\s-]{1,65})$/);
   if(m)material=m[1];
 }
 material=material.replace(/^(?:o|a|os|as|um|uma|do|da|de)\s+/,'')
   .replace(/\s+(?:em estoque|disponiveis|disponivel|hoje|ontem|aqui)$/,'').trim();
 if(/^(?:material|materiais|produto|produtos|deposito|estoque|esse material|aquele material|isso)$/.test(material))material='';
 if(!/^[a-z][a-z0-9\s\/-]{1,119}$/.test(material))material='';
 const year=canonical.match(/\b(?:exercicio|ano|de)\s+(20\d{2})\b/)?.[1];
 return {id,partial,cnpj,supplier,material,multiCommitments,year:year?Number(year):undefined,nf};
}
export function interpret(input:Input):Result {
 const started=Date.now(),now=input.now instanceof Date&&Number.isFinite(input.now.getTime())?input.now.getTime():started;
 const text=typeof input.message==='string'?input.message:'';
 const dimensions:Dimensions={...EMPTY};
 const refs=safeContext(input,now);
 let work=0;
 const finish=(domain:Domain,route:Route,intent:Intent,reason:string,params?:Record<string,unknown>,question?:string):Result=>{
   let query:Result['query'];
   if(route==='DETERMINISTIC'&&ACCEPTED_INTENTS.includes(intent as W3Intent))
     query=makeW3Query(intent as W3Intent,params||{})||undefined;
   if(route==='DETERMINISTIC'&&!query){route='CLARIFY';question='Informe os dados necessários para identificar o registro.';reason='W3_SCHEMA_REJECTED';}
   let nextContext:ShortContext|undefined;
   if(query&&input.scope?.sessionId&&input.scope.workspaceId) {
     const r:ContextRefs={...refs};
     if(typeof params?.commitmentId==='string')r.commitmentId=params.commitmentId;
     if(typeof params?.materialQuery==='string')r.materialQuery=params.materialQuery;
     if(typeof params?.nameQuery==='string')r.supplierName=params.nameQuery;
     if(typeof params?.cnpj==='string')r.supplierCnpj=params.cnpj;
     nextContext={sessionId:input.scope.sessionId,workspaceId:input.scope.workspaceId,updatedAt:now,refs:r};
   }
   const model=route==='MODEL_ELIGIBLE'?{
     schema:'emprovex.ai.modelProposal.v1' as const,userText:text.slice(0,MAX_CHARS).replace(/[\u0000-\u001f\u007f]/g,' '),
     allowedIntents:ACCEPTED_INTENTS,maxOutputTokens:128 as const,temperature:0 as const,
     context:refs,jsonOnly:true as const}:undefined;
   return {domain,route,intent,confidence:route==='DETERMINISTIC'?0.98:route==='MODEL_ELIGIBLE'?0.45:0.9,
     dimensions,entities:{...entities},...(query?{query}:{}),...(question?{question}:{}),
     reason,...(nextContext?{nextContext}:{}),...(model?{model}:{}),
     metrics:{durationMs:Date.now()-started,estimatedWork:work,qwenCalls:0}};
 };
 const entities:Record<string,string|number>={};
 if(!text.trim()||text.length>MAX_CHARS)return finish('UNCERTAIN','CLARIFY','unknown','INPUT_SIZE_LIMIT',undefined,'Resuma sua solicitação em até 1.000 caracteres.');
 if(text.split(/\s+/).length>MAX_WORDS)return finish('UNCERTAIN','CLARIFY','unknown','WORD_LIMIT',undefined,'Envie uma pergunta mais curta.');
 let norm=normalize(text),t=repairSafeWords(norm);work=t.length;
 if(/(?:ignore (?:as |todas as )?instrucoes|system prompt|firebase|firestore|workspaceid|id.?token|token de acesso|credenciais|colecao privada|rode (?:sql|query)|execute (?:sql|query))/i.test(t))
   return finish('OUT_OF_SCOPE','OUT_OF_SCOPE','unknown','UNTRUSTED_INSTRUCTION');
 const procedure=/^(como|onde posso|qual (?:o )?procedimento|me ensine|explique como)\b/.test(t);
 if(!procedure&&has(t,WORDS.writing))return finish('IN_SCOPE','REJECT_MUTATION','future_operation','READ_ONLY_NO_MUTATIONS');
 if(/(?:construir um foguete|motor de foguete|capital do brasil|previsao do tempo|receita de bolo|resultado do futebol|cotacao da bolsa)/.test(t))
   return finish('OUT_OF_SCOPE','OUT_OF_SCOPE','unknown','OUTSIDE_OPERATIONAL_DOMAIN');
 const x=extract(text,t);
 if(x.id)entities.commitmentId=x.id;
 if(x.partial&&!x.id)entities.incompleteCommitment=x.partial;
 if(x.cnpj)entities.cnpj=x.cnpj;
 if(x.supplier)entities.supplier=x.supplier;
 if(x.material)entities.material=x.material;
 if(x.year)entities.year=x.year;
 if(x.nf)entities.invoiceNumber=x.nf;
 const rel=parsePeriod(t);dimensions.period=rel;
 const isInvoice=(has(t,WORDS.invoice)||/\bnotas?\s+(?:de|do|da)\s+\S+/.test(t)||/\bnota\s+\d{1,12}\b/.test(t))&&!/\bnota de empenho\b/.test(t),isCommitment=has(t,WORDS.commitment)||!!x.id||!!x.partial;
 const isSchedule=has(t,WORDS.schedule),isSupplier=has(t,WORDS.supplier);
 const isContact=has(t,WORDS.contact),isStock=has(t,WORDS.stock);
 const isLocation=has(t,WORDS.location);
 const isBalance=has(t,WORDS.balance),isRegistered=has(t,WORDS.register);
 const isIssued=has(t,WORDS.issued);
 const isOverdue=has(t,WORDS.late);
 const directContext=/\b(?:esse|essa|aquele|aquela|mesmo|anterior|mencionado|dele|dela|e quanto|e onde|e quem)\b/.test(t);
 const commitmentId=x.id||((directContext||isCommitment)&&!x.partial?refs.commitmentId:undefined);
 const material=x.material||((directContext||(!x.material&&isStock))?refs.materialQuery:undefined);
 const supplier=x.supplier||((directContext&&isContact)?refs.supplierName:undefined);
 dimensions.document=isInvoice?'NF':isSchedule?'cronograma':isCommitment?'NE':null;
 dimensions.identity=x.id?{type:'NE',original:text.match(/\b\d{4}NE\d{1,10}\b/i)?.[0]||x.id,value:x.id}:
   x.cnpj?{type:'CNPJ',original:x.cnpj,value:x.cnpj}:x.supplier?{type:'supplier',original:x.supplier,value:x.supplier}:null;
 dimensions.material=material||null;
 dimensions.situation=isOverdue?'pendente/atrasado':isRegistered?'cadastrado':isIssued?'emitido':null;
 dimensions.quantity=isBalance?'saldo':/\bquanto|quantidade|total\b/.test(t)?'quantity':null;
 dimensions.location=isLocation?(/\b(?:camara fria|deposito|estante|prateleira|freezer|geladeira)\b/.exec(t)?.[0]||'localização'):null;
 dimensions.format=/\btabela\b/.test(t)?'table':/\bcompare|comparacao\b/.test(t)?'comparison':
   /\blista|quais|mostra\b/.test(t)?'list':'short';
 const success=(intent:W3Intent,params:Record<string,unknown>,relation?:string)=>{dimensions.intention=intent;
   if(relation)dimensions.relationship=relation;return finish('IN_SCOPE','DETERMINISTIC',intent,'W3_P0',params)};
 const unavailable=(intent:Intent,reason:string)=>{dimensions.intention=intent;
   return finish('IN_SCOPE','UNSUPPORTED',intent,reason)};
 const clarify=(intent:Intent,msg:string)=>{dimensions.intention=intent;
   return finish('IN_SCOPE','CLARIFY',intent,'MISSING_OR_AMBIGUOUS_PARAMETER',undefined,msg)};
 if(x.multiCommitments)return clarify('unknown','Você citou mais de uma NE. Qual delas deseja consultar?');
 if(x.partial&&!x.id&&isCommitment)return clarify(isBalance?'commitment_total_balance':'commitment_get',
   'Informe a NE completa, incluindo o exercício (por exemplo, 2026NE66).');
 if(isInvoice) {
   if(isIssued)return unavailable('invoice_issued_period','ISSUED_DATE_NOT_REGISTERED_DATE');
   if((x.material||(/\b(?:de|do|da)\s+\w+\s+(?:cadastrad|da semana)/.test(t)))&&!x.id)
     return unavailable('invoice_by_material_period','P1_MATERIAL_DATE_FILTER_UNAVAILABLE');
   if(x.nf)return clarify('invoice_by_number','Informe também o fornecedor ou CNPJ da nota fiscal.');
   if(rel&&isRegistered)return success('invoice_registration_period_list',{interval:rel,dateMeaning:'registered'},'NF → cadastro');
   if(isRegistered&&!rel)return clarify('invoice_registration_period_list','Qual período de cadastro das notas fiscais?');
   return unavailable('general_document_search','INVOICE_CONTRACT_NOT_AVAILABLE');
 }
 if(isSchedule){
   if(!has(t,WORDS.sent)&&!/\bquando\b/.test(t))return unavailable('general_document_search','SCHEDULE_QUERY_UNSUPPORTED');
   if(commitmentId||rel||x.cnpj)return success('schedule_sent_history_list',{
     ...(commitmentId?{commitmentId}:{}),...(rel?{sentPeriod:rel}:{}),...(x.cnpj?{supplierCnpj:x.cnpj}:{})
   },'NE → cronograma');
   return clarify('schedule_sent_history_list','Informe a NE, o fornecedor (CNPJ) ou o período de envio.');
 }
 if(directContext&&commitmentId&&isSupplier&&!isContact&&!isInvoice)
   return unavailable('supplier_by_commitment','P1_NE_TO_SUPPLIER_UNAVAILABLE');
 if((isSupplier||isContact)&&isOverdue)return unavailable('delivery_late_list','P1_DELIVERIES_UNAVAILABLE');
 if(isContact||((isSupplier||!!supplier||!!x.cnpj)&&/\b(?:telefone|email|whatsapp)\b/.test(t))){
   if(commitmentId&&!supplier&&!x.cnpj)return unavailable('supplier_by_commitment','P1_SUPPLIER_FROM_NE_UNAVAILABLE');
   if(!supplier&&!x.cnpj)return clarify('supplier_contact_find','Qual é o nome ou CNPJ do fornecedor?');
   const channel=/\bwhatsapp\b/.test(t)?'whatsapp':/\b(?:email|e-mail)\b/.test(t)?'email':
     /\btelefone\b/.test(t)?'phone':'all';
   return success('supplier_contact_find',{...(x.cnpj?{cnpj:x.cnpj}:{nameQuery:supplier}),channel},'fornecedor → contato');
 }
 if(isCommitment){
   if(/\b(?:fornecedor|empresa)\b/.test(t)&&commitmentId)return unavailable('supplier_by_commitment','P1_NE_TO_SUPPLIER_UNAVAILABLE');
   if(/\b(?:quais|liste|lista|mostre|empenhos)\b/.test(t)&&(/\b(?:anteriores|exercicios|de 20\d{2}|ainda tem saldo|com saldo)\b/.test(t)))
     return success('commitment_previous_open_list',x.year?{exerciseYear:x.year}:{});
   if(isBalance){
     if(!commitmentId)return clarify('commitment_total_balance','Qual NE completa deseja consultar?');
     return success('commitment_total_balance',{commitmentId});
   }
   if(!commitmentId)return clarify('commitment_get','Qual NE completa deseja consultar?');
   return success('commitment_get',{commitmentId,includeItems:/\bitens\b/.test(t)});
 }
 if(/\b(?:validade|vencimento|vencendo|vencidos|vencidas)\b/.test(t))
   return unavailable('validity_alerts','P1_EXPIRY_UNAVAILABLE');
 if(/\b(?:movimentacao|movimentacoes|retirada|saidas|entradas|transferencias)\b/.test(t))
   return unavailable('warehouse_movement','P1_MOVEMENTS_UNAVAILABLE');
 if(/\b(?:inventario|contagem)\b/.test(t))return unavailable('inventory_status','P1_INVENTORY_UNAVAILABLE');
 if(/\b(?:entregas|atraso|atrasadas)\b/.test(t))return unavailable('delivery_late_list','P1_DELIVERIES_UNAVAILABLE');
 if((isLocation||isStock)&&/\b(?:materiais|produtos|itens)\b/.test(t)&&
    /\b(?:deposito|camara fria|estante|prateleira|freezer)\b/.test(t)&&!x.material)
   return unavailable('warehouse_by_location','P1_LOCATION_TO_MATERIALS_UNAVAILABLE');
 if(isStock||isLocation||!!material){
   const asksLocation=/\b(?:onde|localiza|armazenado|fica|encontrar)\b/.test(t);
   const intent=asksLocation?'warehouse_material_locations_list':'warehouse_stock_get';
   if(!material)return clarify(intent,'Qual material você deseja consultar?');
   return success(intent,{materialQuery:material},'material → estoque → localização');
 }
 if(procedure)return unavailable('operational_procedure','P1_PROCEDURES_UNAVAILABLE');
 if(/\b(?:painel|abra|navegar|acesse|menu|aba)\b/.test(t))return unavailable('navigation','NAVIGATION_NOT_AVAILABLE_IN_W3');
 if(/\b(?:siscofis|siafi|sag|rpnp|ug|termo|auditoria|assinatura)\b/.test(t))
   return unavailable('general_document_search','P1_OR_P2_CONTRACT_UNAVAILABLE');
 if(/\b(?:motor|funcionando|aquilo|isso)\b/.test(t))return finish('UNCERTAIN','CLARIFY','unknown',
   'DOMAIN_UNCERTAIN',undefined,'Você está perguntando sobre um material ou uma operação do EMPROVEX?');
 if(/\b(?:fornecedor|nota|empenho|estoque|deposito|cronograma|material)\b/.test(t))
   return finish('IN_SCOPE','MODEL_ELIGIBLE','unknown','SEMANTIC_COMPLEXITY_W5_FALLBACK');
 return finish('OUT_OF_SCOPE','OUT_OF_SCOPE','unknown','OUTSIDE_OPERATIONAL_DOMAIN');
}
