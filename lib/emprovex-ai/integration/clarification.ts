/** Eleonor R3.1.1 — typed, read-only multi-turn slot completion.
 * Only the server can seal/restore this state. Never infer missing NE/item IDs.
 * Execution remains exclusively inside authorized W3 contracts.
 */
import {makeW3Query} from '../context/adapter';
import type {Result,W3Query} from '../context/types';

export type PendingClarification={
 kind:'commitment_balance'|'commitment_item_balance'|'commitment_item_search'|'warehouse_stock'|'warehouse_location';
 step:'ne'|'item'|'material'|'materialId';
 commitmentId?:string;
 materialLabel?:string;
};
export type ClarificationAction=
 |{kind:'question';question:string;pending:PendingClarification}
 |{kind:'ready';query:W3Query}
 |{kind:'cancel'}
 |{kind:'new_request'};

const NE=/\b(20\d{2}NE\d{1,10})\b/i;
const MATERIAL_ID=/^mat_[a-f0-9]{32}$/i;
const BARCODE=/^\d{8,14}$/;
const ITEM=/^[a-z0-9_-]{1,130}$/i;
const SAFE=/^[\p{L}0-9][\p{L}0-9\s./_-]{1,119}$/u;
function cleaned(v:string):string{return v.trim().replace(/[.!?]+$/,'').trim();}
const questionNe=(p:PendingClarification)=>p.kind==='commitment_item_balance'
 ?'Qual é a NE completa do item que deseja consultar? Exemplo: 2026NE66.'
 :'Qual nota de empenho deseja consultar? Informe a NE completa, por exemplo, 2026NE66.';
const questionItem=(p:PendingClarification)=>
  'Qual é o identificador (itemId)'+(p.materialLabel?' correspondente a '+p.materialLabel:' do item')+
  ' na NE '+p.commitmentId+'? Não posso usar o nome do material como se fosse um itemId.';
const questionItemSearch='Qual é o nome ou descrição do produto que deseja procurar na Consulta de Itens?';
const questionMaterial=(p:PendingClarification)=>p.kind==='warehouse_location'
 ?'Qual material deseja localizar? Informe o nome completo, o código de barras ou o ID do material.'
 :'Qual material deseja consultar no estoque físico? Informe o nome completo, o código de barras ou o ID do material.';
const questionCanonical='Há mais de uma possibilidade ou a busca por nome ficou incompleta. Informe o ID canônico (mat_...) ou o código de barras do material.';

export function isValidPending(value:unknown):value is PendingClarification {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['kind','step','commitmentId','materialLabel'].includes(k))||
   typeof p.kind!=='string'||typeof p.step!=='string')return false;
 const commitment=p.kind==='commitment_balance'||p.kind==='commitment_item_balance'||p.kind==='commitment_item_search';
 if(!['commitment_balance','commitment_item_balance','commitment_item_search','warehouse_stock','warehouse_location'].includes(p.kind)||
   !(p.kind==='commitment_item_search'?p.step==='material':
     commitment?['ne','item'].includes(p.step):['material','materialId'].includes(p.step)))return false;
 if(p.commitmentId!==undefined&&
   (typeof p.commitmentId!=='string'||!/^20\d{2}NE\d{1,10}$/.test(p.commitmentId)))return false;
 if(p.materialLabel!==undefined&&
   (typeof p.materialLabel!=='string'||p.materialLabel.length<2||p.materialLabel.length>90||
     !SAFE.test(p.materialLabel)))return false;
 if(p.step==='item'&&(!p.commitmentId||p.kind!=='commitment_item_balance'))return false;
 return true;
}
function itemLabel(message:string):string|undefined{
 const match=message.match(/\b(?:item|material|produto)\s+(?:de\s+)?([\p{L}][\p{L}\s/-]{1,70}?)(?=\s+(?:nos?|das?|em)\s+(?:empenhos?|ne|notas? de empenho)\b|[?!.]|$)/iu);
 const v=match?cleaned(match[1]):'';
 return v.length>=2&&SAFE.test(v)?v.slice(0,90):undefined;
}
export function startClarification(interpreted:Result,message:string):ClarificationAction|null {
 if(interpreted.route!=='CLARIFY'||
  !['MISSING_OR_AMBIGUOUS_PARAMETER','ITEM_NAME_REQUIRES_ITEM_ID'].includes(interpreted.reason))
  return null; // Never drop an unsupported location, time or supplier filter.
 if(interpreted.intent==='commitment_item_search'){
   const ne=message.match(NE)?.[1]?.toUpperCase();
   const pending:PendingClarification={kind:'commitment_item_search',step:'material',
     ...(ne?{commitmentId:ne}:{})};
   return {kind:'question',question:questionItemSearch,pending};
 }
 if(interpreted.intent==='commitment_total_balance'){
  // Do not silently replace an item-level request by a total-NE balance.
  const item=/\b(?:do item|de item|por item|itens|material|materiais|produto)\b/i.test(message)||
    interpreted.reason==='ITEM_NAME_REQUIRES_ITEM_ID';
  const ne=message.match(NE)?.[1]?.toUpperCase();
  const pending:PendingClarification={
   kind:item?'commitment_item_balance':'commitment_balance',
   step:ne&&item?'item':'ne',
   ...(ne?{commitmentId:ne}:{}),
   ...(itemLabel(message)?{materialLabel:itemLabel(message)}:{})
  };
  return {kind:'question',question:pending.step==='item'?questionItem(pending):questionNe(pending),pending};
 }
 if(interpreted.intent==='warehouse_stock_get'||interpreted.intent==='warehouse_material_locations_list'){
  const pending:PendingClarification={kind:interpreted.intent==='warehouse_stock_get'?'warehouse_stock':'warehouse_location',
    step:'material'};
  return {kind:'question',question:questionMaterial(pending),pending};
 }
 return null;
}
export function startMaterialResolution(intent:string,query:{params:Record<string,unknown>},status:string,coverage:string):ClarificationAction|null{
 if(!['warehouse_stock_get','warehouse_material_locations_list'].includes(intent)||
  !['ambiguous','partial'].includes(status)||coverage!=='incomplete'&&status!=='ambiguous'||
  typeof query.params.materialQuery!=='string'||query.params.materialId||query.params.barcode)return null;
 const pending:PendingClarification={kind:intent==='warehouse_stock_get'?'warehouse_stock':'warehouse_location',
  step:'materialId'};
 return {kind:'question',question:questionCanonical,pending};
}
function isSwitch(message:string):boolean {
 return /^(?:agora |mudando de assunto|outra pergunta|na verdade )?\s*(?:quais?|como|onde|quando|quantos?|quanto|mostre|liste|consulte|detalhe|localize|verifique|preciso saber|explique)\b/i.test(message)
  && /\b(?:estoque|empenho|notas?|nfs?|forneced|deposito|materiais?|item|saldo)\b/i.test(message);
}
function ready(kind:PendingClarification['kind'],params:Record<string,unknown>):ClarificationAction{
 const intent=kind==='commitment_item_search'?'commitment_item_search':
   kind==='commitment_balance'||kind==='commitment_item_balance'?'commitment_total_balance':
  kind==='warehouse_stock'?'warehouse_stock_get':'warehouse_material_locations_list';
 const query=makeW3Query(intent,params);
 if(!query)throw new Error('AI_CLARIFICATION_SCHEMA_INVALID');
 return {kind:'ready',query};
}
export function continueClarification(p:PendingClarification,raw:string):ClarificationAction {
 const message=cleaned(raw);
 if(/^(?:cancelar|cancela|deixa pra la|esquece|desistir|pare|nova conversa)$/iu.test(message))
  return {kind:'cancel'};
 if(isSwitch(message))return {kind:'new_request'};
 if(p.step==='ne'){
  const id=message.match(/^(?:a |o )?(?:ne|empenho|nota de empenho)?\s*[:#-]?\s*(20\d{2}NE\d{1,10})$/i)?.[1]?.toUpperCase();
  if(!id)return {kind:'question',question:questionNe(p),pending:p};
  if(p.kind==='commitment_balance')return ready(p.kind,{commitmentId:id});
  const next:PendingClarification={...p,commitmentId:id,step:'item'};
  return {kind:'question',question:questionItem(next),pending:next};
 }
 if(p.step==='item'){
  const itemId=message.match(/^(?:(?:itemId|item|codigo do item)\s*[:#=-]?\s*)?([A-Za-z0-9_-]{1,130})$/i)?.[1];
  if(!itemId||!ITEM.test(itemId))return {kind:'question',question:questionItem(p),pending:p};
  return ready(p.kind,{commitmentId:p.commitmentId,itemId});
 }
 if(p.step==='materialId'){
  const v=message.replace(/^(?:materialId|id|barcode|codigo de barras|c[oó]digo)\s*[:#=-]?\s*/iu,'').trim();
  if(MATERIAL_ID.test(v))return ready(p.kind,{materialId:v.toLowerCase()});
  if(BARCODE.test(v))return ready(p.kind,{barcode:v});
  return {kind:'question',question:questionCanonical,pending:p};
 }
 if(message.length>120||!SAFE.test(message)||/\b(?:exceto|excluindo|outro setor|outra ug|outro workspace|altere|registre|exclua|transfira)\b/iu.test(message))
  return {kind:'question',question:questionMaterial(p),pending:p};
 const v=message.replace(/^(?:(?:o|a|os|as)\s+)?(?:item|material|produto)\s+(?:de\s+)?/iu,'');
 if(p.kind==='commitment_item_search'){
   const name=v.trim();
   if(name.length<2||name.length>120)return {kind:'question',question:questionItemSearch,pending:p};
   return ready(p.kind,{materialQuery:name,...(p.commitmentId?{commitmentId:p.commitmentId}:{})});
 }
 if(MATERIAL_ID.test(v))return ready(p.kind,{materialId:v.toLowerCase()});
 if(BARCODE.test(v))return ready(p.kind,{barcode:v});
 return ready(p.kind,{materialQuery:v});
}
