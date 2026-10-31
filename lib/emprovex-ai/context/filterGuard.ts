import type {W3Intent,Route,Intent} from './types';

/** Semantic constraints extracted from the actual utterance, not guessed from a W3 contract. */
export type FilterName='commitmentId'|'materialQuery'|'supplierName'|'supplierCnpj'|'period'|
  'depotName'|'depotId'|'itemId'|'historicalBalance'|'issuedDate'|'status'|'comparison'|'quantityThreshold';
export type Constraint = {name:FilterName;value:string};
export type FilterDecision={requested:FilterName[];represented:FilterName[];unhandled:FilterName[];
  route:'CLARIFY'|'UNSUPPORTED';intent:Intent;reason:string;question?:string};
export const W3_FILTERS:Readonly<Record<W3Intent,readonly FilterName[]>>={
 supplier_contact_find:['supplierName','supplierCnpj'],
 commitment_get:['commitmentId'],
 commitment_total_balance:['commitmentId','itemId'],
 commitment_previous_open_list:[], // exerciseYear/historical list is not a per-document filter
 schedule_sent_history_list:['commitmentId','supplierCnpj','period'],
 invoice_registration_period_list:['commitmentId','supplierCnpj','period'],
 warehouse_stock_get:['materialQuery'],
 warehouse_material_locations_list:['materialQuery','depotId']
};
const asParameter:Partial<Record<FilterName,string>>={
 commitmentId:'commitmentId',supplierCnpj:'supplierCnpj',period:'interval',
 materialQuery:'materialQuery',supplierName:'nameQuery',depotId:'depotId',itemId:'itemId'
};
/** No silent reduction: every hard restriction must be representable in destination's real schema. */
export function auditFilters(intent:W3Intent,params:Record<string,unknown>,constraints:readonly Constraint[]):FilterDecision|null {
 const accepted=W3_FILTERS[intent];
 const requested=[...new Set(constraints.map(x=>x.name))];
 const represented:FilterName[]=[];
 const unhandled:FilterName[]=[];
 for(const filter of requested){
   let parameter=asParameter[filter];
   if(filter==='period'&&intent==='schedule_sent_history_list')parameter='sentPeriod';
   if(filter==='supplierName'&&intent!=='supplier_contact_find')parameter=undefined;
   if(filter==='materialQuery'&&!['warehouse_stock_get','warehouse_material_locations_list'].includes(intent))parameter=undefined;
   if(filter==='supplierCnpj'&&intent==='supplier_contact_find')parameter='cnpj';
   if(!accepted.includes(filter)||!parameter||params[parameter]===undefined)unhandled.push(filter);
   else represented.push(filter);
 }
 if(!unhandled.length)return null;
 const has=(name:FilterName)=>unhandled.includes(name);
 let route:FilterDecision['route']='UNSUPPORTED',affected:Intent=intent,
     reason='ESSENTIAL_FILTER_NOT_SUPPORTED',question:string|undefined;
 if(has('supplierName')&&['invoice_registration_period_list','schedule_sent_history_list'].includes(intent)){
   route='CLARIFY';reason='SUPPLIER_NAME_REQUIRES_CNPJ';
   question='Informe o CNPJ válido do fornecedor para manter esse filtro na consulta.';
 }else if(has('materialQuery')&&intent==='commitment_total_balance'){
   route='CLARIFY';reason='ITEM_NAME_REQUIRES_ITEM_ID';
   question='Qual é o identificador do item nessa NE? Não posso substituir o saldo do item pelo saldo total.';
 }else if(has('depotName')&&intent==='warehouse_material_locations_list'){
   route='CLARIFY';reason='DEPOT_NAME_REQUIRES_DEPOT_ID';
   question='Informe a identificação do depósito (depotId). O nome não é um identificador seguro.';
 }else if(has('depotName')||has('depotId')){
   reason='STOCK_BY_DEPOT_NOT_AVAILABLE';affected='warehouse_by_location';
 }else if(has('historicalBalance')){reason='HISTORICAL_BALANCE_UNAVAILABLE';}
 else if(has('comparison')){reason='COMPARISON_NOT_AVAILABLE';}
 else if(has('quantityThreshold')){reason='QUANTITY_THRESHOLD_NOT_AVAILABLE';}
 return {requested,represented,unhandled,route,intent:affected,reason,...(question?{question}:{})};
}

/** Capture operational qualifiers before their target could drop them. Bounded, regex-only. */
export function detectConstraints(t:string, explicit:{
 commitmentId?:string;materialQuery?:string;supplierName?:string;supplierCnpj?:string;
 period?:unknown;depotId?:string;itemId?:string;
},intent:W3Intent):Constraint[]{
 const c:Constraint[]=[];
 const add=(name:FilterName,value:unknown)=>{if(typeof value==='string'&&value)c.push({name,value});};
 add('commitmentId',explicit.commitmentId);
 add('materialQuery',explicit.materialQuery);
 add('supplierName',explicit.supplierName);
 add('supplierCnpj',explicit.supplierCnpj);
 if(explicit.period)c.push({name:'period',value:'specified'});
 else if(/\b(?:em|desde|no ano de)\s*20\d{2}\b/.test(t)&&
   ['warehouse_stock_get','warehouse_material_locations_list','supplier_contact_find'].includes(intent))
   c.push({name:'period',value:'unresolved_absolute_year'});
 add('depotId',explicit.depotId);
 add('itemId',explicit.itemId);
 if(/\b(?:no|na|dentro da|dentro do|somente na|somente no)\s+(?:camara fria|deposito(?:\s+[a-z0-9-]+)?|estante\s*\d+|prateleira\s*\d+|freezer|geladeira)\b/.test(t))
   c.push({name:'depotName',value:'location'});
 if((intent==='commitment_total_balance'||intent==='commitment_get')&&
    (/\b(?:restava|tinha saldo|saldo (?:em|no|na|de) (?:ontem|semana passada|mes passado)|na data de)\b/.test(t)||
     (explicit.period!==undefined&&/\b(?:resta|restante|saldo|quanto falta)\b/.test(t))))
   c.push({name:'historicalBalance',value:'historical'});
 if(/\b(?:compare|comparar|comparacao|comparativo|versus| vs )\b/.test(t))
   c.push({name:'comparison',value:'comparison'});
 if(/\b(?:acima de|maior que|maior do que|abaixo de|menor que|pelo menos)\s*(?:r\s*\$?\s*|\d)/.test(t))
   c.push({name:'quantityThreshold',value:'threshold'});
 if(/\b(?:(?:somente|apenas|so) (?:os |as )?(?:vencidos|vencidas|pendentes|atrasados|atrasadas))\b/.test(t))
   c.push({name:'status',value:'filtered'});
 return c;
}
