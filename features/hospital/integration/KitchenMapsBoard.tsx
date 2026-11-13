'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertCircle,Check,ChevronDown,ChefHat,Clock3,RefreshCw,Truck,UtensilsCrossed} from 'lucide-react';
import type {KitchenMapReceipt,KitchenMeal,KitchenSnapshot} from '../production/contracts';
import {getOrderProgress} from './order-progress.mjs';
import {OrderProgress} from './OrderProgress';

type Focus={unitId:string;cycleId:'06'|'10'|'16';localDate:string};
type Issue={id:string;mapId:string;unitId:string;note:string;status:string;revision:number;createdAt:string;resolutionNote?:string};
type Response<T>={ok:true;data:T}|{ok:false;error:{message:string}};
const cycles=['06','10','16'] as const;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})
 .formatToParts(new Date()).reduce((r,x)=>({...r,[x.type]:x.value}),{} as Record<string,string>);
function localDay(){const base=process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR==='1'?new Date(Date.now()+2*86400000):new Date();const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(base);const x=(name:string)=>p.find(v=>v.type===name)?.value??'';return x('year')+'-'+x('month')+'-'+x('day');}
const iconFor=(stage:number)=>stage===4?Check:stage>=3?Truck:stage>=1?UtensilsCrossed:Clock3;

export function KitchenMapsBoard({organizationId,unitIds,getAuthorization,onOpenProduction,onOpenDistribution}:{
 organizationId:string;unitIds:string[];getAuthorization:()=>Promise<string>;
 onOpenProduction:(focus:Focus)=>void;onOpenDistribution:(focus:Focus)=>void;
}){
 const [date,setDate]=useState(localDay);
 const [maps,setMaps]=useState<KitchenMapReceipt[]>([]);
 const [meals,setMeals]=useState<KitchenMeal[]>([]);
 const [issues,setIssues]=useState<Issue[]>([]);
 const [filter,setFilter]=useState<'all'|'pending'|'active'|'finished'>('all');
 const [expanded,setExpanded]=useState('');
 const [resolution,setResolution]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const headers=useCallback(async()=>({
  Authorization:await getAuthorization(),'x-hospital-organization-id':organizationId
 }),[getAuthorization,organizationId]);
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const auth=await headers();
   const batches=await Promise.all(cycles.map(async cycleId=>{
    const q=new URLSearchParams({localDate:date,cycleId});
    unitIds.forEach(unitId=>q.append('unitId',unitId));
    const response=await fetch('/api/hospital/production?'+q.toString(),{cache:'no-store',headers:auth});
    const data=await response.json() as Response<KitchenSnapshot>;
    if(!response.ok||!data.ok)throw Error(!data.ok?data.error.message:'Falha ao consultar mapas');
    return data.data;
   }));
   const feedback=await Promise.all(unitIds.map(async unitId=>{
    const response=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',headers:{...auth,'Content-Type':'application/json'},
     body:JSON.stringify({operation:'map.feedback.list',payload:{unitId,limit:25}})});
    const result=await response.json() as Response<Issue[]>;
    if(!response.ok||!result.ok)throw Error(!result.ok?result.error.message:'Falha ao consultar ocorrências');
    return result.data;
   }));
   const unique=new Map<string,KitchenMapReceipt>();
   for(const batch of batches)for(const row of batch.maps)unique.set(row.id,row);
   setMaps([...unique.values()].sort((a,b)=>a.cycleId.localeCompare(b.cycleId)||a.unitId.localeCompare(b.unitId)));
   setMeals(batches.flatMap(x=>x.meals));
   setIssues(feedback.flat());
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Falha de conexão com a cozinha');}
  finally{if(!silent)setLoading(false);}
 },[date,unitIds,headers]);
 useEffect(()=>{
  void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},20000);
  return()=>clearInterval(timer);
 },[load]);
 const grouped=useMemo(()=>maps.map(map=>{
  const requests=meals.filter(m=>m.mapId===map.id);
  return {map,requests,progress:getOrderProgress(map,requests),feedback:issues.filter(i=>i.mapId===map.id)};
 }),[maps,meals,issues]);
 const visible=grouped.filter(({progress})=>filter==='all'
  ||filter==='pending'&&progress.stage<=0
  ||filter==='active'&&progress.stage>0&&progress.stage<4
  ||filter==='finished'&&progress.stage===4);
 const receive=async(map:KitchenMapReceipt)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',
    headers:{...(await headers()),'Content-Type':'application/json'},
    body:JSON.stringify({operation:'map.receive',payload:{mapId:map.id,expectedRevision:map.revision,idempotencyKey:crypto.randomUUID()}})});
   const result=await response.json() as Response<unknown>;
   if(!response.ok||!result.ok)throw Error(!result.ok?result.error.message:'Não foi possível receber o mapa');
   setNotice('Mapa da '+map.unitId+' recebido e registrado com data e responsável.');
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'Recebimento não registrado');}
  finally{setBusy(false);}
 };
 const resolve=async(issue:Issue)=>{
  const note=resolution[issue.id]?.trim()??'';
  if(note.length<5){setError('Descreva como a ocorrência foi tratada (mínimo 5 caracteres).');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',
    headers:{...(await headers()),'Content-Type':'application/json'},
    body:JSON.stringify({operation:'map.feedback.resolve',payload:{issueId:issue.id,unitId:issue.unitId,expectedRevision:issue.revision,resolutionNote:note}})});
   const result=await response.json() as Response<unknown>;
   if(!response.ok||!result.ok)throw Error(!result.ok?result.error.message:'Não foi possível registrar a solução');
   setNotice('Tratamento da ocorrência registrado. Nenhuma entrega foi confirmada automaticamente.');
   setResolution(old=>({...old,[issue.id]:''}));
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'Falha no registro');}
  finally{setBusy(false);}
 };
 return <section className="space-y-4" aria-label="Mapas recebidos de todas as unidades">
  <div className="hospital-panel p-5 sm:p-6">
   <header className="flex flex-wrap items-start justify-between gap-4">
    <div><p className="hospital-hint-label">Central de recebimento</p><h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Mapas das unidades</h2>
     <p className="mt-1 text-sm text-slate-500">Receba os mapas enviados pela UPI, UTI, Bloco, Oncologia e PAM. As etapas só avançam após registro real.</p></div>
    <div className="flex flex-wrap items-end gap-2">
     <label className="grid gap-1 text-xs font-semibold text-slate-600">Dia<input type="date" aria-label="Data dos mapas da cozinha" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={date} onChange={e=>setDate(e.target.value)}/></label>
     <button type="button" className="hospital-secondary-action" disabled={busy||loading} onClick={()=>void load()}><RefreshCw size={15} className="inline"/> Atualizar</button>
    </div>
   </header>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo dos mapas">
    {[
     ['Mapas enviados',grouped.length],
     ['Para receber',grouped.filter(x=>x.progress.stage===0).length],
     ['Em andamento',grouped.filter(x=>x.progress.stage>0&&x.progress.stage<4).length],
     ['Concluídos',grouped.filter(x=>x.progress.completed).length],
    ].map(([label,count])=><div key={String(label)} className="hospital-kpi"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#164589]">{count}</p></div>)}
   </div>
   <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar mapas">
    {([['all','Todos'],['pending','Aguardando'],['active','Em andamento'],['finished','Entregues']] as const).map(([id,label])=>
     <button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}
      className={filter===id?'hospital-primary-action':'hospital-secondary-action'}>{label}</button>)}
   </div>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
  {loading&&<p role="status" className="text-sm text-slate-600">Consultando os mapas recebidos…</p>}
  {!loading&&!error&&visible.length===0&&<p role="status" className="hospital-panel p-5 text-sm text-slate-500">Nenhum mapa enviado para este filtro. Rascunhos ainda não aparecem para a cozinha.</p>}
  <div className="grid gap-3 xl:grid-cols-2">
   {visible.map(({map,requests,progress,feedback})=>{
    const Icon=iconFor(progress.stage),open=expanded===map.id;
    const focus:Focus={unitId:map.unitId,cycleId:map.cycleId,localDate:map.localDate};
    const ready=requests.some(x=>x.status==='READY');
    return <article key={map.id} className="hospital-panel min-w-0 p-4 sm:p-5" data-testid={'kitchen-map-'+map.unitId+'-'+map.cycleId}>
     <div className="flex items-start gap-3">
      <span className="hospital-kpi-icon shrink-0"><Icon size={20}/></span>
      <div className="min-w-0 flex-1">
       <p className="font-extrabold text-[#1a3b6c]">{map.unitId} · Mapa {map.cycleId}h</p>
       <p className="mt-1 text-xs text-slate-500">{requests.filter(x=>x.status!=='CANCELLED').length} dietas · {map.late?'Enviado fora do horário':'Enviado pela unidade'}</p>
       <p className="mt-2 text-sm font-semibold text-[#285b9e]" role="status">{progress.headline}</p>
       {!!map.needsKitchenReview&&<p className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-700"><AlertCircle size={14}/> Atenção: mapa com alteração tardia. Reconferir antes de liberar.</p>}
       {feedback.some(x=>x.status==='OPEN')&&<p className="mt-2 text-xs font-bold text-rose-700">{feedback.filter(x=>x.status==='OPEN').length} ocorrência(s) aguardando análise</p>}
      </div>
      <button type="button" className="hospital-secondary-action shrink-0 px-2.5" aria-expanded={open} aria-label={'Detalhes do mapa '+map.unitId+' '+map.cycleId+'h'} onClick={()=>setExpanded(open?'':map.id)}><ChevronDown size={16}/></button>
     </div>
     <div className="mt-4 flex flex-wrap gap-2">
      {!map.receivedAt&&<button type="button" className="hospital-primary-action" disabled={busy} onClick={()=>void receive(map)}>Confirmar recebimento</button>}
      {!!map.receivedAt&&progress.stage<3&&<button type="button" className="hospital-primary-action" onClick={()=>onOpenProduction(focus)}>{ready?'Conferir preparo':'Abrir produção'}</button>}
      {progress.stage>=2&&<button type="button" className={ready||progress.stage>=3?'hospital-primary-action':'hospital-secondary-action'} onClick={()=>onOpenDistribution(focus)}>{progress.completed?'Ver distribuição':'Abrir distribuição'}</button>}
      <button type="button" className="hospital-secondary-action" onClick={()=>setExpanded(open?'':map.id)}>{open?'Ocultar detalhes':'Acompanhar mapa'}</button>
     </div>
     {open&&<div className="mt-4 space-y-3">
      <OrderProgress map={map} meals={requests} compact/>
      {feedback.map(issue=><div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
       <p className="text-xs font-bold text-slate-700">{issue.status==='OPEN'?'Ocorrência pendente':'Ocorrência tratada'} · {issue.unitId}</p>
       <p className="mt-1 text-sm text-slate-700">{issue.note}</p>
       {issue.status==='OPEN'&&<div className="mt-2 flex flex-wrap gap-2">
        <input className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm" aria-label="Como a ocorrência foi tratada" placeholder="O que foi verificado e corrigido?" maxLength={500} value={resolution[issue.id]??''} onChange={e=>setResolution(p=>({...p,[issue.id]:e.target.value}))}/>
        <button type="button" className="hospital-secondary-action" disabled={busy||(resolution[issue.id]?.trim().length??0)<5} onClick={()=>void resolve(issue)}>Registrar solução</button>
       </div>}
       {issue.status!=='OPEN'&&issue.resolutionNote&&<p className="mt-2 text-xs text-emerald-800">Tratamento: {issue.resolutionNote}</p>}
      </div>)}
     </div>}
    </article>;
   })}
  </div>
 </section>;
}
