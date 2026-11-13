'use client';

import {AlertTriangle,Coffee,Moon,UtensilsCrossed} from 'lucide-react';
import {OrderProgress} from './OrderProgress';
import {mealName,timingLabel} from './meal-period.mjs';

type State={status:string;mealType?:string;timingStage?:string;advisory?:string};
type MapState={cycleId?:string;status?:string|null;submittedAt?:string|null;receivedAt?:string|null};
type Props={map:MapState|null;meals?:State[];compact?:boolean};
const labels=[
 {type:'PRIMARY',short:'Refeição principal'},
 {type:'SECONDARY',short:'Refeição secundária'}
] as const;

/** Two physically independent deliveries under the same submitted map and kitchen receipt. */
export function MealProgressPair({map,meals=[],compact=false}:Props){
 const cycle=map?.cycleId??'10';
 return <div className={'grid gap-3 '+(compact?'':'lg:grid-cols-2')} aria-label="Acompanhamento separado das duas refeições">
  {labels.map(({type,short})=>{
   const subset=meals.filter(x=>x.mealType===type&&x.status!=='CANCELLED');
   const extras=subset.filter(x=>x.timingStage&&x.timingStage!=='ON_TIME');
   const after=extras.some(x=>x.timingStage==='AFTER_TOLERANCE');
   const suspended=subset.filter(x=>['SUSPENDED','SAFETY_BLOCKED'].includes(x.status)).length;
   return <section key={type} className="min-w-0 space-y-3 rounded-2xl border border-[#dbe7f4] bg-white p-3 sm:p-4"
    aria-label={short+' · '+mealName(cycle,type)} data-testid={'meal-journey-'+type.toLowerCase()}>
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div className="flex items-center gap-2 text-[#214d82]">
      {type==='PRIMARY'?<UtensilsCrossed size={18} aria-hidden="true"/>:cycle==='16'?<Moon size={18} aria-hidden="true"/>:<Coffee size={18} aria-hidden="true"/>}
      <h3 className="text-sm font-extrabold">{short} · {mealName(cycle,type)}</h3>
     </div>
     <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{subset.length} dieta(s)</span>
    </div>
    {extras.length>0&&<div role="alert" className={'flex gap-2 rounded-xl border p-3 text-xs font-semibold '+(after?'border-rose-300 bg-rose-50 text-rose-900':'border-amber-300 bg-amber-50 text-amber-900')}>
     <AlertTriangle size={15} className="shrink-0" aria-hidden="true"/>
     <span>{extras.length} solicitação(ões) extraordinária(s): {after?'após os 30 minutos':'até 30 minutos após o prazo'}. Justificativa registrada e alerta prioritário encaminhado à cozinha. O atraso não impede a produção, salvo restrição de segurança real.</span>
    </div>}
    {suspended>0&&!extras.length&&<p role="alert" className="text-xs font-semibold text-rose-800">Atenção: {suspended} dieta(s) suspensa(s) ou bloqueada(s).</p>}
    {subset.length?<OrderProgress map={map} meals={subset} compact/>:
     <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">
      Nenhuma solicitação de {mealName(cycle,type).toLowerCase()} neste mapa. A outra refeição pode seguir independentemente.
     </p>}
   </section>;
  })}
 </div>;
}
