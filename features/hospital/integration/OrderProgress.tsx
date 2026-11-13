'use client';

import {Check,ChefHat,ClipboardCheck,PackageCheck,Send,Truck} from 'lucide-react';
import {getOrderProgress,ORDER_STEPS} from './order-progress.mjs';

type MapState={status?:string|null;submittedAt?:string|null;receivedAt?:string|null};
type MealState={status:string};
const icons=[Send,ClipboardCheck,ChefHat,Truck,PackageCheck] as const;
export function OrderProgress({map,meals=[],compact=false}:{
 map:MapState|null;meals?:MealState[];compact?:boolean
}){
 const state=getOrderProgress(map,meals);
 return <div className={'hospital-order-progress '+(compact?'hospital-order-progress--compact':'')} aria-label="Acompanhamento do mapa" data-order-stage={state.stage}>
  <div className="hospital-order-progress__hero">
   <div className="hospital-order-progress__pulse" data-complete={state.completed}>
    {state.completed?<Check size={23} aria-hidden="true"/>:<ChefHat size={23} aria-hidden="true"/>}
   </div>
   <div className="min-w-0 flex-1">
    <p className="hospital-order-progress__eyebrow">Acompanhamento em tempo real*</p>
    <h3 className="text-base font-extrabold text-[#173b69] sm:text-lg" role="status">{state.headline}</h3>
    <p className="mt-1 text-xs leading-5 text-[#607690]">{state.description}</p>
   </div>
   {state.count>0&&<span className="hospital-order-progress__counter">{state.delivered}/{state.count} entregues</span>}
  </div>
  <ol className="hospital-order-progress__steps" aria-label="Etapas do pedido">
   {ORDER_STEPS.map((step,index)=>{
    const Icon=icons[index];
    const done=state.stage>index||state.completed&&state.stage===index;
    const active=state.stage===index&&!state.completed;
    return <li key={step.id} className="hospital-order-progress__step" data-state={done?'done':active?'active':'pending'} aria-current={active?'step':undefined}>
     <span className="hospital-order-progress__node">{done?<Check size={16} aria-hidden="true"/>:<Icon size={17} aria-hidden="true"/>}</span>
     <span className="hospital-order-progress__label">{step.label}</span>
    </li>;
   })}
  </ol>
  <p className="hospital-order-progress__foot">*O acompanhamento consulta eventos registrados no servidor; a tela não confirma preparo ou entrega automaticamente.</p>
 </div>
}
