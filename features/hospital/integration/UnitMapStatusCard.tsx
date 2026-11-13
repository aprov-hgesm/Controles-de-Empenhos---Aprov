'use client';

import {useCallback,useEffect,useState} from 'react';
import {MealProgressPair} from './MealProgressPair';
import {mealName} from './meal-period.mjs';
type MapItem={id:string;cycleId:string;localDate:string;status:string;submittedAt?:string|null;receivedAt?:string|null};
type MapDetail={map:MapItem;meals:{status:string;mealType:string;timingStage?:string}[]};
type Api<T>={ok:true;data:T}|{ok:false;error:{message:string}};
const localDate=()=>{
 const delta=process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR==='1'?2:0;
 const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+delta*86400000));
 const x=(type:string)=>f.find(v=>v.type===type)?.value??'';
 return x('year')+'-'+x('month')+'-'+x('day');
};
export function UnitMapStatusCard({organizationId,unitId,getIdToken,onOpen,onRequest}:{
 organizationId:string;unitId:string;getIdToken:()=>Promise<string>;onOpen:()=>void;onRequest:()=>void
}){
 const [current,setCurrent]=useState<MapDetail|null>(null);
 const [error,setError]=useState('');
 const request=useCallback(async<T,>(operation:string,payload:Record<string,unknown>)=>{
  const response=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',
   headers:{Authorization:'Bearer '+await getIdToken(),'Content-Type':'application/json','x-hospital-organization-id':organizationId},
   body:JSON.stringify({operation,payload})});
  const data=await response.json() as Api<T>;
  if(!response.ok||!data.ok)throw Error(!data.ok?data.error.message:'Consulta indisponível');
  return data.data;
 },[getIdToken,organizationId]);
 const refresh=useCallback(async()=>{
  try{
   const lists=await Promise.all((['06','10','16'] as const).map(cycleId=>request<MapItem[]>('map.list',{unitId,cycleId,localDate:localDate()})));
   const latest=lists.flat().filter(m=>m.status!=='DRAFT').sort((a,b)=>(b.submittedAt??'').localeCompare(a.submittedAt??''))[0];
   setCurrent(latest?await request<MapDetail>('map.get',{mapId:latest.id}):null);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Acompanhamento indisponível');}
 },[request,unitId]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},20000);return()=>clearInterval(timer);},[refresh]);
 return <section className="hospital-panel space-y-4 p-5 sm:p-6" aria-label="Último mapa da unidade">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="hospital-hint-label">Acompanhamento da unidade</p><h2 className="mt-1 text-lg font-extrabold text-[#173b69]">Último mapa enviado</h2></div>
   <button className="hospital-secondary-action" type="button" onClick={()=>void refresh()}>Atualizar andamento</button>
  </div>
  {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  {current?<><p className="text-xs font-semibold text-slate-500">Unidade {unitId} · Mapa {current.map.cycleId}h · {mealName(current.map.cycleId,'PRIMARY')} e {mealName(current.map.cycleId,'SECONDARY')}</p>
   <MealProgressPair map={current.map} meals={current.meals} compact/>
   <button type="button" className="hospital-primary-action" onClick={onOpen}>Ver acompanhamento completo</button></>:
   <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
    <p className="text-sm font-semibold text-[#234e80]">Nenhum mapa enviado neste dia.</p>
    <p className="mt-1 text-xs text-slate-500">Cadastre dietas e envie o mapa do horário para começar o acompanhamento.</p>
    <button type="button" className="hospital-primary-action mt-3" onClick={onRequest}>Solicitar dietas</button>
   </div>}
 </section>;
}
