/**
 * Read-only Eleonor result projection for mobile UX.
 * Uses returned W3 facts only: never estimates balances or adds quantities
 * across incompatible units. Invalid payloads fall back to the original text.
 */
export type ItemAssociation = {commitmentId:string;itemId:string};
export type ItemResult = {
 name:string; title:string; unit:string;pendingQuantity:number;
 operationalBalance:number;associations:ItemAssociation[];
};
export type ItemResultView = {
 items:ItemResult[]; totalGroups:number; distinctCommitments:number;
 coverage:'complete'|'incomplete'|'unknown'; partial:boolean;
 limitations:string[]; query:string;
};
const isObject=(v:unknown):v is Record<string,unknown> =>
  !!v&&typeof v==='object'&&!Array.isArray(v);
const clean=(v:unknown,max=400):string=>
  typeof v==='string'?v.trim().slice(0,max):'';
const finite=(v:unknown):v is number=>
  typeof v==='number'&&Number.isFinite(v);
function friendly(v:string):string {
 const lower=v.toLocaleLowerCase('pt-BR');
 return lower?lower[0].toLocaleUpperCase('pt-BR')+lower.slice(1):'';
}
export function itemShortLabel(description:string):string {
 const parts=description.split(',').map(p=>p.trim()).filter(Boolean);
 const first=parts[0]||description;
 const variety=parts.find(p=>/^variedade\s+/i.test(p))?.replace(/^variedade\s+/i,'');
 const presentation=parts.find(p=>/^apresenta[cç][aã]o\s+/i.test(p))
   ?.replace(/^apresenta[cç][aã]o\s+/i,'');
 const labels=[first,variety,presentation].filter((x):x is string=>!!x);
 return labels.map(friendly).join(' · ').slice(0,125);
}
export function parseItemResult(raw:unknown):ItemResultView|null {
 if(!isObject(raw)||raw.intent!=='commitment_item_search'||
   !['ok','partial'].includes(String(raw.status))||!isObject(raw.data)||
   !Array.isArray(raw.data.items))return null;
 const data=raw.data;
 const rawItems=data.items;
 if(!Array.isArray(rawItems))return null;
 const items:ItemResult[]=[];
 for(const value of rawItems) {
   if(!isObject(value))return null;
   const name=clean(value.name,280);
   const unit=clean(value.unit,30);
   if(!name||!unit||!finite(value.pendingQuantity)||!finite(value.operationalBalance)
      ||value.pendingQuantity<0||value.operationalBalance<0||
      !Array.isArray(value.associations))return null;
   const associations:ItemAssociation[]=[];
   for(const candidate of value.associations) {
     if(!isObject(candidate))return null;
     const commitmentId=clean(candidate.commitmentId,32);
     const itemId=clean(candidate.itemId,130);
     if(!commitmentId||!itemId)return null;
     associations.push({commitmentId,itemId});
   }
   items.push({name,title:itemShortLabel(name),unit,
     pendingQuantity:value.pendingQuantity,
     operationalBalance:value.operationalBalance,associations});
 }
 const partial=raw.status==='partial'||raw.coverage!=='complete'||
   (isObject(raw.pagination)&&raw.pagination.truncated===true);
 const totalGroups=finite(data.matchedGroups)&&data.matchedGroups>=items.length
   ?data.matchedGroups:items.length;
 const distinctCommitments=new Set(items.flatMap(i=>i.associations.map(a=>a.commitmentId))).size;
 const limitations=Array.isArray(raw.limitations)
   ?raw.limitations.filter((s:unknown):s is string=>typeof s==='string')
     .map(s=>s.trim().slice(0,350)).filter(Boolean):[];
 return {items,totalGroups,distinctCommitments,
   coverage:raw.coverage==='complete'?'complete':raw.coverage==='incomplete'?'incomplete':'unknown',
   partial,limitations,query:clean(data.materialQuery,120)};
}
