'use client';
import {useCallback,useEffect,useState} from 'react';

type Cycle='06'|'10'|'16';
type MapItem={id:string;localDate:string;cycleId:Cycle;status:string;revision:number;total:number;late?:boolean};
type MealItem={id:string;mealType:string;status:string;advisory:string};
type MapDetail={map:MapItem;meals:MealItem[];receipt:{submittedAt:string;submittedByUid:string;submissionVersion:number}|null};
type ApiResult<T>={ok:true;data:T}|{ok:false;error:{message:string}};
const today=()=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=(type:string)=>p.find(x=>x.type===type)?.value??'';
 return value('year')+'-'+value('month')+'-'+value('day');
};
export function TrackingView({organizationId,unitId,getIdToken}:{organizationId:string;unitId:string;getIdToken:()=>Promise<string>}){
 const [date,setDate]=useState(today);
 const [cycle,setCycle]=useState<Cycle>('10');
 const [maps,setMaps]=useState<MapItem[]>([]);
 const [details,setDetails]=useState<MapDetail|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const command=useCallback(async<T,>(operation:string,payload:Record<string,unknown>):Promise<T>=>{
  const token=await getIdToken();
  const res=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',headers:{'content-type':'application/json',authorization:'Bearer '+token,'x-hospital-organization-id':organizationId},body:JSON.stringify({operation,payload})});
  const answer=await res.json() as ApiResult<T>;
  if(!res.ok||!answer.ok)throw Error(!answer.ok?answer.error.message:'Consulta indisponível');
  return answer.data;
 },[getIdToken,organizationId]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');setDetails(null);
  try{setMaps(await command<MapItem[]>('map.list',{unitId,localDate:date,cycleId:cycle}));}
  catch(e){setMaps([]);setError(e instanceof Error?e.message:'Falha ao consultar mapas');}
  finally{setLoading(false)}
 },[command,unitId,date,cycle]);
 useEffect(()=>{void load()},[load]);
 const inspect=async(mapId:string)=>{
  setLoading(true);setError('');
  try{setDetails(await command<MapDetail>('map.get',{mapId}));}
  catch(e){setError(e instanceof Error?e.message:'Falha ao consultar andamento');}
  finally{setLoading(false)}
 };
 return <section className="hospital-panel space-y-5 p-5 text-slate-900 sm:p-6" aria-label="Acompanhamento da unidade">
   <h2 className="text-xl font-extrabold text-[#173b69]">Rastreabilidade de mapas e refeições</h2>
   <p className="text-sm text-slate-600">Enviado, em preparo, pronto, expedido, recebido e entregue são registros distintos.</p>
   <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-[#f9fbff] p-4">
    <label className="grid gap-1 text-sm">Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded border p-2"/></label>
    <label className="grid gap-1 text-sm">Mapa<select value={cycle} onChange={e=>setCycle(e.target.value as Cycle)} className="rounded border p-2"><option value="06">06h</option><option value="10">10h</option><option value="16">16h</option></select></label>
    <button type="button" onClick={()=>void load()} disabled={loading} className="hospital-primary-action">Atualizar</button>
   </div>
   {loading&&<p role="status">Consultando dados do servidor…</p>}
   {error&&<p role="alert" className="text-red-700">{error}</p>}
   {!loading&&!error&&maps.length===0&&<p>Nenhum mapa criado nesta unidade e período.</p>}
   <div className="grid gap-2">{maps.map(m=><button type="button" key={m.id} onClick={()=>void inspect(m.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-[#23456e] hover:bg-blue-50"><strong>{m.cycleId}h · {m.status}</strong> · {m.total} refeições · revisão {m.revision}{m.late?' · envio tardio':''}</button>)}</div>
   {details&&<div className="space-y-3 rounded-2xl border border-sky-100 bg-[#fbfdff] p-4"><h3 className="font-bold">Mapa selecionado</h3>
    <p className="text-sm">Recibo: {details.receipt?new Date(details.receipt.submittedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Não enviado'}</p>
    {details.meals.length===0?<p>Sem refeições.</p>:<ul className="space-y-2">{details.meals.map(m=><li key={m.id} className="rounded bg-slate-50 p-2 text-sm">{m.mealType==='PRIMARY'?'Principal':'Secundária'} · <strong>{m.status}</strong> {m.advisory==='KITCHEN_REVIEW'?'· avaliação da cozinha pendente':''}</li>)}</ul>}
   </div>}
 </section>;
}
