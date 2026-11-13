'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertCircle,MessageCircle,RefreshCw} from 'lucide-react';
import {OrderProgress} from './OrderProgress';

type Cycle='06'|'10'|'16';
type MapItem={id:string;unitId:string;localDate:string;cycleId:Cycle;status:string;revision:number;total?:number;late?:boolean;submittedAt?:string|null;receivedAt?:string|null};
type MealItem={id:string;mealType:string;status:string;advisory:string};
type MapDetail={map:MapItem;meals:MealItem[];receipt:{submittedAt:string;submissionVersion:number}|null};
type ApiResult<T>={ok:true;data:T}|{ok:false;error:{message:string}};
const today=()=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+(process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR==='1'?2:0)*86400000));
 const value=(type:string)=>p.find(x=>x.type===type)?.value??'';
 return value('year')+'-'+value('month')+'-'+value('day');
};
export function TrackingView({organizationId,unitId,getIdToken}:{organizationId:string;unitId:string;getIdToken:()=>Promise<string>}){
 const [date,setDate]=useState(today);
 const [cycle,setCycle]=useState<Cycle>('10');
 const [maps,setMaps]=useState<MapItem[]>([]);
 const [details,setDetails]=useState<MapDetail|null>(null);
 const [selectedId,setSelectedId]=useState('');
 const [note,setNote]=useState('');
 const [editingNote,setEditingNote]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const command=useCallback(async<T,>(operation:string,payload:Record<string,unknown>):Promise<T>=>{
  const token=await getIdToken();
  const res=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',headers:{'content-type':'application/json',authorization:'Bearer '+token,'x-hospital-organization-id':organizationId},body:JSON.stringify({operation,payload})});
  const answer=await res.json() as ApiResult<T>;
  if(!res.ok||!answer.ok)throw Error(!answer.ok?answer.error.message:'Consulta indisponível');
  return answer.data;
 },[getIdToken,organizationId]);
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const rows=await command<MapItem[]>('map.list',{unitId,localDate:date,cycleId:cycle});
   setMaps(rows);
   const pick=rows.find(m=>m.id===selectedId)??rows.find(m=>m.status==='SUBMITTED'||m.status==='CLOSED')??rows[0];
   setDetails(pick?await command<MapDetail>('map.get',{mapId:pick.id}):null);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar mapas');if(!silent){setMaps([]);setDetails(null);}}
  finally{if(!silent)setLoading(false);}
 },[command,unitId,date,cycle,selectedId]);
 useEffect(()=>{
  void load();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},18000);
  return()=>clearInterval(interval);
 },[load]);
 const inspect=async(mapId:string)=>{
  setSelectedId(mapId);setLoading(true);setError('');
  try{setDetails(await command<MapDetail>('map.get',{mapId}));}
  catch(e){setError(e instanceof Error?e.message:'Falha ao consultar o mapa');}
  finally{setLoading(false);}
 };
 const report=async()=>{
  if(!details||note.trim().length<5)return;
  setBusy(true);setError('');setNotice('');
  try{
   await command('map.feedback',{mapId:details.map.id,note:note.trim(),idempotencyKey:crypto.randomUUID()});
   setNote('');setEditingNote(false);
   setNotice('Alteração registrada e encaminhada para a cozinha. Isso não altera automaticamente a entrega.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar a ocorrência');}
  finally{setBusy(false);}
 };
 return <section className="space-y-4" aria-label="Acompanhamento da unidade">
  <div className="hospital-panel p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="hospital-hint-label">Acompanhamento de pedidos</p><h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Onde estão as dietas?</h2>
     <p className="mt-1 text-sm text-slate-500">Acompanhe o mapa da sua unidade como um pedido, sem precisar ligar para conferir cada etapa.</p></div>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Data do mapa<input type="date" aria-label="Data do mapa" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={date} onChange={e=>{setDate(e.target.value);setSelectedId('');setDetails(null);}}/></label>
   </div>
   <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Selecionar horário do mapa">
    {(['06','10','16'] as const).map(hour=><button type="button" key={hour} aria-pressed={cycle===hour} className={cycle===hour?'hospital-primary-action':'hospital-secondary-action'} onClick={()=>{setCycle(hour);setSelectedId('');setDetails(null);}}>{hour}h</button>)}
    <button type="button" className="hospital-secondary-action ml-auto" disabled={loading} onClick={()=>void load()}><RefreshCw size={15} className="inline" aria-hidden="true"/> Atualizar</button>
   </div>
  </div>
  {loading&&<p role="status" className="text-sm text-slate-500">Atualizando andamento do mapa…</p>}
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {!loading&&!error&&maps.length===0&&<div className="hospital-panel p-5"><p className="font-semibold text-[#275382]">Nenhum mapa para {cycle}h</p>
   <p className="mt-1 text-sm text-slate-500">Depois de registrar os pedidos em Meus Mapas e enviá-los, o acompanhamento aparecerá aqui.</p></div>}
  {maps.length>1&&<div className="flex flex-wrap gap-2">{maps.map(m=><button key={m.id} type="button" onClick={()=>void inspect(m.id)} aria-pressed={details?.map.id===m.id}
   className={details?.map.id===m.id?'hospital-primary-action':'hospital-secondary-action'}>Mapa {m.cycleId}h · {m.status==='DRAFT'?'Em edição':'Enviado'}</button>)}</div>}
  {details&&<div className="space-y-4">
   <OrderProgress map={details.map} meals={details.meals}/>
   {details.map.late&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle size={17}/> Mapa enviado fora do horário. A cozinha precisa reconferir os pedidos afetados.</p>}
   {details.map.status!=='DRAFT'&&<div className="hospital-panel p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h3 className="font-extrabold text-[#1c456f]">Houve alguma alteração?</h3><p className="mt-1 text-xs text-slate-600">Informe o leito e o que aconteceu. A cozinha receberá a ocorrência para verificar.</p></div>
     <button type="button" className="hospital-secondary-action" aria-expanded={editingNote} onClick={()=>setEditingNote(open=>!open)}><MessageCircle size={16} className="inline"/> {editingNote?'Fechar':'Registrar alteração'}</button>
    </div>
    {editingNote&&<div className="mt-4 space-y-3"><label className="grid gap-1 text-sm font-semibold text-slate-700">O que aconteceu?
     <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}
      placeholder="Ex.: leito 02 recebeu dieta diferente da solicitada; cozinha avisada." aria-label="Descrição da alteração"/>
    </label><button className="hospital-primary-action" disabled={busy||note.trim().length<5} onClick={()=>void report()}>Enviar ocorrência à cozinha</button></div>}
   </div>}
   <details className="hospital-panel p-4"><summary className="cursor-pointer text-sm font-bold text-[#1d4b83]">Ver os registros das refeições ({details.meals.length})</summary>
    <ul className="mt-3 space-y-2 text-sm">{details.meals.map(m=><li className="flex justify-between gap-2 rounded-lg bg-slate-50 p-3" key={m.id}>
     <span>{m.mealType==='PRIMARY'?'Refeição principal':'Refeição secundária'}</span>
     <span className="font-semibold">{m.status==='DELIVERED'?'Entregue':m.status==='DISPATCHED'?'Em rota':m.status==='READY'?'Pronta':m.status==='PREPARING'?'Em preparo':m.status==='REQUESTED'?'Aguardando':m.status==='RECEIVED_BY_UNIT'?'Recebida na unidade':m.status==='SUSPENDED'?'Suspensa':m.status==='SAFETY_BLOCKED'?'Bloqueada':m.status==='CANCELLED'?'Cancelada':'Em análise'}</span>
    </li>)}</ul>
   </details>
  </div>}
 </section>;
}
