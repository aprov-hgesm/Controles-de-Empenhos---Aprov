'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {DistributionView} from '@/features/hospital/distribution/DistributionView';
import type {KitchenSnapshot} from '@/features/hospital/production/contracts';
type Cycle='06'|'10'|'16';
const localToday=()=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=(k:string)=>p.find(x=>x.type===k)?.value??'';
 return v('year')+'-'+v('month')+'-'+v('day');
};
export function DistributionQueue({organizationId,unitIds,getAuthorization}:{organizationId:string;unitIds:string[];getAuthorization:()=>Promise<string>}){
 const [unitId,setUnitId]=useState(unitIds[0]??'');
 const [cycle,setCycle]=useState<Cycle>('10');
 const [date,setDate]=useState(localToday);
 const [snapshot,setSnapshot]=useState<KitchenSnapshot|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!unitId)return;
  setLoading(true);setError('');
  try{
   const qs=new URLSearchParams({unitId,localDate:date,cycleId:cycle});
   const res=await fetch('/api/hospital/production?'+qs.toString(),{cache:'no-store',headers:{authorization:await getAuthorization(),'x-hospital-organization-id':organizationId}});
   const answer=await res.json();
   if(!res.ok||!answer.ok)throw Error(answer.error?.message||'Fila não disponível');
   setSnapshot(answer.data as KitchenSnapshot);
  }catch(e){setSnapshot(null);setError(e instanceof Error?e.message:'Falha ao consultar pedidos');}
  finally{setLoading(false)}
 },[unitId,cycle,date,organizationId,getAuthorization]);
 useEffect(()=>{void load()},[load]);
 const filtered=useMemo(()=>snapshot?.meals.filter(m=>m.unitId===unitId&&['READY','DISPATCHED','RECEIVED_BY_UNIT'].includes(m.status)&&!m.safetyIssue)??[],[snapshot,unitId]);
 const mealIds=useMemo(()=>filtered.slice(0,50).map(m=>m.id),[filtered]);
 return <section className="space-y-4 text-slate-900">
  <div className="rounded-xl border bg-white p-4">
   <h2 className="font-bold">Fila real de distribuição</h2>
   <p className="text-sm text-slate-600">Somente refeições com preparo concluído ou distribuição já iniciada. Não existe aceite por pedido.</p>
   <div className="mt-3 flex flex-wrap items-end gap-3">
    <label className="grid gap-1 text-sm">Unidade<select value={unitId} onChange={e=>setUnitId(e.target.value)} className="rounded border p-2">{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded border p-2"/></label>
    <label className="grid gap-1 text-sm">Ciclo<select value={cycle} onChange={e=>setCycle(e.target.value as Cycle)} className="rounded border p-2"><option value="06">06h</option><option value="10">10h</option><option value="16">16h</option></select></label>
    <button className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50" type="button" disabled={loading} onClick={()=>void load()}>Atualizar pedidos</button>
   </div>
   {loading&&<p role="status">Consultando pedidos autorizados…</p>}
   {error&&<p role="alert" className="text-red-700">{error}</p>}
   {!loading&&!error&&filtered.length>50&&<p role="status">Exibindo 50 refeições por vez para limitar consultas; filtre por unidade e ciclo.</p>}
  </div>
  {!loading&&!error&&snapshot&&unitId&&<DistributionView key={unitId+'-'+date+'-'+cycle} organizationId={organizationId} unitId={unitId} mealIds={mealIds} getAuthorization={getAuthorization}/>}
 </section>;
}
