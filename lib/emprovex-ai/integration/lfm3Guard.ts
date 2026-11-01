/** Untrusted LFM3 candidates may only carry identifiers and qualifiers grounded
 * in the user's utterance or the authenticated, signed short context.
 * Never silently discard a filter when crossing from the model into W3.
 */
import {auditFilters,detectConstraints} from '../context/filterGuard';
import {normalize,repairSafeWords} from '../context/language';
import type {Result,W3Query,ContextRefs} from '../context/types';

export type ModelFilterAudit={requested:string[];represented:string[];unhandled:string[]};
const norm=(s:string)=>repairSafeWords(normalize(s));
function mentioned(source:string,value:unknown):boolean {
 return typeof value==='string'&&value.length>0&&norm(source).includes(norm(value));
}
function trustedReference(value:unknown,source:string,reference?:string):boolean {
 return mentioned(source,value)||(typeof value==='string'&&value===reference);
}
export function guardLfm3Candidate(args:{
 query:W3Query;interpretation:Result;message:string;previous?:{refs:ContextRefs};
}):{ok:boolean;audit:ModelFilterAudit} {
 const {query,interpretation,message,previous}=args;
 const refs=previous?.refs||{},p=query.params,t=norm(message);
 const invalid=(unhandled:string[]):{ok:false;audit:ModelFilterAudit}=>({
  ok:false,audit:{requested:unhandled,represented:[],unhandled}
 });
 const checks:Record<string,boolean>={
  commitmentId:trustedReference(p.commitmentId,message,refs.commitmentId),
  materialQuery:trustedReference(p.materialQuery,message,refs.materialQuery),
  nameQuery:trustedReference(p.nameQuery,message,refs.supplierName),
  cnpj:trustedReference(p.cnpj,String(message).replace(/\D/g,''),refs.supplierCnpj),
  supplierCnpj:trustedReference(p.supplierCnpj,String(message).replace(/\D/g,''),refs.supplierCnpj),
  depotId:mentioned(message,p.depotId),
  itemId:mentioned(message,p.itemId),
  materialId:mentioned(message,p.materialId),
  barcode:mentioned(message,p.barcode)
 };
 const ungrounded=Object.entries(checks).filter(([key,valid])=>p[key]!==undefined&&!valid).map(([key])=>key);
 if(ungrounded.length)return invalid(ungrounded);
 // Model must not add pagination/cursors or self-authorize broader history.
 if(p.cursor!==undefined||p.pageSize!==undefined||p.includeHistorical===true)
   return invalid(['model_expansion']);
 if(p.includeItems===true&&!/\bitens?\b/.test(t))return invalid(['includeItems']);
 if(p.dateMeaning!==undefined&&p.dateMeaning!=='registered')return invalid(['dateMeaning']);
 // Time windows require a user's time qualifier, not a model hallucination.
 if((p.interval!==undefined||p.sentPeriod!==undefined)&&
    !/(\bhoje\b|\bontem\b|\bsemana\b|\bmes\b|\bano\b|\bexercicio\b|\b20\d{2}\b|\bultimos?\b|\bperiodo\b|\bentre\b|\bdesde\b)/.test(t))
   return invalid(['period']);
 if(p.exerciseYear!==undefined&&!t.includes(String(p.exerciseYear)))
   return invalid(['exerciseYear']);
 const entities=interpretation.entities;
 const constraints=detectConstraints(t,{
  commitmentId:typeof entities.commitmentId==='string'?entities.commitmentId:undefined,
  materialQuery:typeof entities.material==='string'?entities.material:undefined,
  supplierName:typeof entities.supplier==='string'?entities.supplier:undefined,
  supplierCnpj:typeof entities.cnpj==='string'?entities.cnpj:undefined,
  period:interpretation.dimensions.period,
  depotId:typeof entities.depotId==='string'?entities.depotId:undefined,
  itemId:typeof entities.itemId==='string'?entities.itemId:undefined
 },query.intent);
 const audit=auditFilters(query.intent,query.params,constraints);
 if(audit)return {ok:false,audit:{
  requested:audit.requested,represented:audit.represented,unhandled:audit.unhandled}};
 return {ok:true,audit:{
  requested:[...new Set(constraints.map(c=>c.name))],
  represented:[...new Set(constraints.map(c=>c.name))],unhandled:[]}};
}
