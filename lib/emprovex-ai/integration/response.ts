import type {AiResponse,AiIntent} from '../contracts';
function row(value:unknown):Record<string,unknown> {
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function text(value:unknown):string {
 return typeof value==='string'?value.replace(/[<>\u0000-\u001f\u007f]/g,'').slice(0,160):'';
}
function number(value:unknown):string {
 return typeof value==='number'&&Number.isFinite(value)
   ?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(value):'não informado';
}
function money(value:unknown):string {
 return typeof value==='number'&&Number.isFinite(value)
   ?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value):'não informado';
}
function list(v:unknown):Record<string,unknown>[] {return Array.isArray(v)?v.map(row):[];}
function unit(v:unknown):string {return text(typeof v==='string'?v:row(v).code||row(v).label||row(v).name);}
function formatDate(v:unknown):string {
 const s=text(v);if(!s)return 'não informada';
 const date=new Date(s);
 return Number.isFinite(date.getTime())
   ?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(date):s;
}
function render(intent:AiIntent,data:unknown):string {
 const d=row(data);
 switch(intent){
 case 'supplier_contact_find':return list(data).map(x=>
   [text(x.legalName)||text(x.cnpj),text(x.email),text(x.phone),text(x.whatsapp)]
     .filter(Boolean).join(' · ')).join('; ');
 case 'commitment_get':{
   const base='Empenho '+text(d.id)+': fornecedor '+(text(d.supplier)||'não informado')+
     ', situação '+(text(d.status)||'não informada')+'.';
   if(!Array.isArray(d.items))return base;
   const items=list(d.items);
   if(!items.length)return base+' Não há itens cadastrados nessa NE.';
   const details=items.slice(0,12).map(x=>
     '• '+(text(x.name)||'Item sem descrição')+' (item '+text(x.id)+') — '+
     number(x.quantity)+' '+unit(x.unit)+' empenhados; '+
     number(x.received)+' recebidos');
   return base+'\nItens da NE ('+items.length+' cadastrados):\n'+details.join('\n')+
     (items.length>12?'\nExibindo apenas os 12 primeiros itens; refine a consulta para os demais.':'');
 }
 case 'commitment_item_search':{
   const items=list(d.items);
   if(!items.length)return 'Não foi encontrado item correspondente na cobertura consultada da Consulta de Itens.';
   return items.map(item=>{
     const associations=list(item.associations);
     const neList=associations.map(a=>text(a.commitmentId)+' (item '+text(a.itemId)+')')
       .filter(Boolean).slice(0,8).join(', ');
     return text(item.name)+' — saldo operacional: '+number(item.pendingQuantity)+' '+text(item.unit)+
       '; valor restante: '+money(item.operationalBalance)+
       (neList?'; empenhos associados: '+neList:'');
   }).join('\n');
 }
 case 'commitment_total_balance':return 'Saldo operacional restante da NE '+text(d.commitmentId)+': '+
   money(d.operationalBalance)+'. Valor empenhado: '+money(d.committedAmount)+
   '; recebido: '+money(d.receivedAmount)+'.';
 case 'commitment_previous_open_list':return list(data).map(x=>text(x.commitmentId)+': '+money(x.operationalBalance)).join('; ');
 case 'schedule_sent_history_list':return list(data).map(x=>
   'NE '+text(x.commitmentId)+', envio registrado em '+formatDate(x.sentAt)).join('; ');
 case 'invoice_registration_period_list':return list(data).map(x=>
   'NF '+(text(x.number)||text(x.recordKey))+' cadastrada em '+formatDate(x.registeredAt)).join('; ');
 case 'invoice_operational_pending_list':return list(data).map(x=>
   'NF '+(text(x.number)||text(x.recordKey))+' — '+
   (x.stage==='COMISSAO'?'na Comissão, aguardando envio à Tesouraria':
     'no Aprovisionamento, aguardando encaminhamento')+
   (text(x.commitmentId)?'; empenho '+text(x.commitmentId):'')+
   (x.stageInferred===true?' (etapa inferida)':'')
 ).join('\n');
 case 'warehouse_stock_get':return text(d.description)+': '+number(d.quantity)+
   ' '+unit(d.unit)+' de saldo físico agregado.';
 case 'warehouse_material_locations_list':return list(d.locations).map(x=>{
   const depot=row(x.depot),shelf=row(x.shelf),p=row(x.position);
   return [text(depot.name),text(shelf.name),text(p.name)].filter(Boolean).join(' / ')+
     ' — '+number(x.quantity)+' '+unit(x.unit);
 }).join('; ');
 }
}
export function presentAiResponse(response:AiResponse):string {
 if(response.status==='empty')return 'Nenhum registro localizado nos dados autorizados e na cobertura consultada.';
 if(response.status==='ambiguous')return 'Existem registros ambíguos. Refine a identificação antes de prosseguir.';
 if(response.status==='error'||response.status==='forbidden')return 'A consulta não pôde ser concluída.';
 const intent=response.intent;
 const main=intent?render(intent,response.data):'';
 const partial=response.status==='partial'||response.coverage!=='complete'||response.pagination?.truncated===true
   ?' Atenção: a consulta tem cobertura parcial ou não comprovada.':'';
 const limitations=(response.limitations||[]).slice(0,3).map(text).filter(Boolean);
 const pagination=response.pagination?.truncated===true
   ?' Existem mais registros; a página apresentada não é um total consolidado.':'';
 const operational=intent==='commitment_total_balance'
   ?' O saldo operacional é apurado a partir dos registros EMPROVEX e não substitui o saldo contábil oficial do SIAFI.':'';
 return (main||'Resultado disponível nos dados estruturados.')+partial+pagination+operational+
   (limitations.length?' '+limitations.join(' '):'');
}
