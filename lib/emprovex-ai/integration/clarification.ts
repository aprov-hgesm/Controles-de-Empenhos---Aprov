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
  'Qual é o nome ou a descrição do produto'+(p.commitmentId?' na NE '+p.commitmentId:'')+
  '? Vou localizar o item pela Consulta de Itens; não é necessário informar itemId.';
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
 const match=message.match(/\b(?:item|material|produto)\s+(?:de\s+)?([\p{L}][\p{L}\s/-]{1,70}?)(?=\s+(?:nos?|nas?|das?|dos?|em)\s+(?:empenhos?|ne|notas? de empenho)\b|[?!.]|$)/iu);
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
  // An item-level request must never become a total-NE balance. Resolve the
  // material with the existing Consulta de Itens rather than demanding itemId.
  // This fallback is only for missing slots, never for unrepresented filters.
  const omitted=interpreted.filterAudit?.unhandled||[];
  if(omitted.some(name=>name!=='materialQuery'))return null;
  const item=/\b(?:do item|de item|por item|itens|material|materiais|produto)\b/i.test(message)||
    interpreted.reason==='ITEM_NAME_REQUIRES_ITEM_ID';
  const ne=message.match(NE)?.[1]?.toUpperCase();
  const name=itemLabel(message);
  if(item&&name)return readyItemSearch(name,ne);
  if(item){
    const pending:PendingClarification={kind:'commitment_item_search',step:'material',
      ...(ne?{commitmentId:ne}:{})};
    return {kind:'question',question:questionItemSearch,pending};
  }
  const pending:PendingClarification={kind:'commitment_balance',step:'ne',
    ...(ne?{commitmentId:ne}:{})};
  return {kind:'question',question:questionNe(pending),pending};
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
/** Offers an optional contextual refinement after W3 returned multiple
 * real description/unit groups. Carries no balance or item data in the token.
 * The next reply must execute W3 again with the new name, never use a cached
 * result or infer a numeric itemId.
 */
export function itemSearchRefinement(
 query:{intent:string;params:Record<string,unknown>},data:unknown,status:string
):PendingClarification|null {
 if(query.intent!=='commitment_item_search'||!['ok','partial'].includes(status)||
   !data||typeof data!=='object'||Array.isArray(data))return null;
 const groups=(data as Record<string,unknown>).items;
 if(!Array.isArray(groups)||groups.length<2)return null;
 const ne=query.params.commitmentId;
 return {kind:'commitment_item_search',step:'material',
   ...(typeof ne==='string'&&NE.test(ne)?{commitmentId:ne.toUpperCase()}:{})};
}
function isSwitch(message:string):boolean {
 return /^(?:agora |mudando de assunto|outra pergunta|na verdade )?\s*(?:quais?|como|onde|quando|quantos?|quanto|mostre|liste|consulte|detalhe|localize|verifique|preciso saber|explique)\b/i.test(message)
  && /\b(?:estoque|empenho|notas?|nfs?|forneced|deposito|materiais?|item|saldo)\b/i.test(message);
}
function readyItemSearch(materialQuery:string,commitmentId?:string):ClarificationAction {
 const query=makeW3Query('commitment_item_search',{
   materialQuery,...(commitmentId?{commitmentId}:{})
 });
 if(!query)throw new Error('AI_ITEM_SEARCH_SCHEMA_INVALID');
 return {kind:'ready',query};
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
  // Legacy signed item-balance clarification: a known material name is
  // enough. The W3 item lookup resolves the technical ID server-side.
  if(p.materialLabel)return readyItemSearch(p.materialLabel,id);
  const next:PendingClarification={kind:'commitment_item_search',step:'material',
    commitmentId:id};
  return {kind:'question',question:questionItemSearch,pending:next};
 }
 if(p.step==='item'){
  // Backward compatibility for pending states created by earlier R3.1:
  // accept explicit itemId, but prefer the lookup by material description.
  const explicitId=message.match(/^(?:itemId|codigo do item)\s*[:#=-]?\s*([A-Za-z0-9_-]{1,130})$/i)?.[1];
  if(explicitId&&ITEM.test(explicitId))
    return ready(p.kind,{commitmentId:p.commitmentId,itemId:explicitId});
  const name=p.materialLabel||message.replace(/^(?:item|material|produto)\s+(?:de\s+)?/iu,'');
  if(!SAFE.test(name)||name.length>90)return {kind:'question',question:questionItem(p),pending:p};
  return readyItemSearch(name,p.commitmentId);
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
