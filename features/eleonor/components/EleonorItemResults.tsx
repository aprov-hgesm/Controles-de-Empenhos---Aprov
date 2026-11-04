'use client';

import {useState} from 'react';
import {BookOpenText, ChevronDown, ChevronUp, Layers3} from 'lucide-react';
import {parseItemResult} from '../domain/itemPresentation';

type Evidence={source:string;documentId:string};
const quantity=(n:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(n);
const currency=(n:number)=>new Intl.NumberFormat('pt-BR',{
  style:'currency',currency:'BRL'}).format(n);

/** Project the W3 payload into accessible, compact read-only cards.
 * The API answer remains untouched and available for historical transcripts.
 */
export function EleonorItemResults({result,evidence}:{
 result:unknown;evidence?:Evidence[];
}){
 const view=parseItemResult(result);
 const [all,setAll]=useState(false);
 if(!view)return null;
 const visible=all?view.items:view.items.slice(0,3);
 const remaining=view.items.length-visible.length;
 const titles=view.totalGroups===view.items.length
   ?String(view.items.length)
   :view.items.length+' de '+view.totalGroups;
 return <section aria-label="Resultado estruturado da Consulta de Itens"
   className="w-full min-w-0 space-y-3 text-slate-800">
   <div className="space-y-1">
     <p className="text-[10px] font-semibold uppercase tracking-wide text-[#38619b]">
       Consulta de Itens • Empenhos
     </p>
     <h3 className="text-base font-bold leading-snug text-[#0b2859]">
       {titles} {view.totalGroups===1?'tipo de item':'tipos de itens'} {view.query?'para “'+view.query+'”':'encontrados'}
     </h3>
     <p className="text-xs leading-5 text-slate-500">
       {view.distinctCommitments} {view.distinctCommitments===1?'NE identificada':'NEs identificadas'} nos resultados exibidos
       {view.partial?' · Cobertura parcial':''}
     </p>
   </div>
   <div className="space-y-2">
     {visible.map((item,index)=><article key={index}
       className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-[#f7f9fd] px-3 py-3">
       <div className="flex items-start justify-between gap-2">
         <h4 className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-slate-800">
           {item.title}
         </h4>
         <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#164898]">
           {item.unit}
         </span>
       </div>
       <div className="mt-2 grid grid-cols-2 gap-2">
         <div className="rounded-lg bg-white px-2.5 py-2">
           <p className="text-[10px] text-slate-500">Saldo operacional</p>
           <p className="break-words text-base font-bold tabular-nums text-[#073b9b]">
             {quantity(item.pendingQuantity)} <span className="text-xs font-semibold">{item.unit}</span>
           </p>
         </div>
         <div className="rounded-lg bg-white px-2.5 py-2">
           <p className="text-[10px] text-slate-500">Valor restante</p>
           <p className="break-words text-sm font-bold tabular-nums text-slate-800">
             {currency(item.operationalBalance)}
           </p>
         </div>
       </div>
       <details className="group mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
         <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold text-[#164898] [&::-webkit-details-marker]:hidden">
           <Layers3 className="h-3.5 w-3.5 shrink-0" />
           <span className="flex-1">
             {item.associations.length} {item.associations.length===1?'vínculo de empenho':'vínculos de empenho'}
           </span>
           <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" />
         </summary>
         {item.associations.length>0?<ul className="mt-2 space-y-1.5">
           {item.associations.map((a,i)=><li key={a.commitmentId+'-'+a.itemId+'-'+i}
             className="break-words text-xs text-slate-700">
             <span className="font-semibold">{a.commitmentId}</span>
             <span className="text-slate-500"> · item {a.itemId}</span>
           </li>)}
         </ul>:<p className="mt-2 text-xs text-slate-500">Vínculos não disponíveis nesta resposta.</p>}
       </details>
       {item.name!==item.title&&<details className="group mt-2 px-1">
         <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
           Ver descrição completa
         </summary>
         <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.name}</p>
       </details>}
     </article>)}
   </div>
   {remaining>0&&<button type="button" onClick={()=>setAll(true)}
     className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-[#164898] hover:bg-blue-100">
     Mostrar mais {remaining} {remaining===1?'item':'itens'} <ChevronDown className="ml-1 inline h-3.5 w-3.5"/>
   </button>}
   {all&&view.items.length>3&&<button type="button" onClick={()=>setAll(false)}
     className="w-full rounded-lg py-1 text-xs font-semibold text-slate-500">
     Recolher lista <ChevronUp className="ml-1 inline h-3.5 w-3.5"/>
   </button>}
   {view.items.length>1&&<p className="text-xs leading-5 text-[#164898]">
     Para refinar a consulta, envie apenas a descrição ou o nome do produto.
   </p>}
   <div className="rounded-lg bg-slate-100/90 px-3 py-2 text-[11px] leading-5 text-slate-600">
     Saldos de empenhos são operacionais. Não representam estoque físico nem saldo contábil do SIAFI.
   </div>
   {view.limitations.filter(l=>!/saldo de itens de empenhos é operacional/i.test(l)).length>0&&
     <details className="px-1 text-xs text-amber-800">
       <summary className="cursor-pointer font-semibold">Observações da consulta</summary>
       <ul className="mt-1 space-y-1">
         {view.limitations.filter(l=>!/saldo de itens de empenhos é operacional/i.test(l))
           .map((s,i)=><li key={i} className="break-words">{s}</li>)}
       </ul>
     </details>}
   {evidence&&evidence.length>0&&<details className="px-1 text-xs text-slate-500">
     <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
       <BookOpenText className="h-3.5 w-3.5"/> Fontes da consulta ({evidence.length})
     </summary>
     <ul className="mt-2 space-y-1">
       {evidence.map((e,i)=><li key={i} className="break-words">{e.source}: {e.documentId}</li>)}
     </ul>
   </details>}
 </section>;
}
