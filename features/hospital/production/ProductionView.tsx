'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChefHat,Check,ClipboardCheck,FileDown,Printer,RefreshCw,ShieldAlert} from 'lucide-react';
import type {CycleId} from '../core/contracts';
import type {KitchenBatch,KitchenMeal,KitchenSnapshot} from './contracts';
import {printProductionLabels,printProductionReport,type ProductionPrintRow} from '../printing/hospital-diet-print';

type Props={organizationId:string;unitIds:string[];getAuthorization:()=>Promise<string>;
 initialDate?:string;initialCycle?:CycleId;initialUnitId?:string;mode?:'overview'|'operations'};
type Api<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
type DietGroup={key:string;unitId:string;dietCode:string;dietLabel:string;observation:string;
 mealType:string;meals:KitchenMeal[];pending:KitchenMeal[];preparing:KitchenMeal[];ready:KitchenMeal[];batches:KitchenBatch[]};
const today=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=(s:string)=>parts.find(p=>p.type===s)?.value??'';
 return get('year')+'-'+get('month')+'-'+get('day');
};
const CYCLES:{value:CycleId;label:string}[]=[
 {value:'06',label:'06h · Café / lanche'},{value:'10',label:'10h · Almoço / lanche'},{value:'16',label:'16h · Jantar / ceia'}
];
const noteOf=(meal:KitchenMeal)=>[
 (meal.observation??'').trim(),
 meal.dietRestrictionCodes?.length?'Restrições: '+meal.dietRestrictionCodes.join(', '):''
].filter(Boolean).join(' · ')||'Sem observações';
const groupKey=(m:KitchenMeal)=>JSON.stringify([m.unitId,m.dietCode,m.mealType,m.observation??'',
 [...(m.dietRestrictionCodes??[])].sort()]);
function groupsOf(snapshot:KitchenSnapshot|null):DietGroup[]{
 if(!snapshot)return [];
 const grouped=new Map<string,DietGroup>();
 const eligible=['REQUESTED','PREPARING','READY'];
 for(const m of snapshot.meals){
  if(!eligible.includes(m.status)||m.safetyIssue)continue;
  const key=groupKey(m);
  if(!grouped.has(key))grouped.set(key,{key,unitId:m.unitId,dietCode:m.dietCode,
    dietLabel:m.dietLabel??'Dieta',observation:noteOf(m),mealType:m.mealType,meals:[],pending:[],preparing:[],ready:[],batches:[]});
  const g=grouped.get(key)!;
  g.meals.push(m);
  if(m.status==='REQUESTED')g.pending.push(m);
  if(m.status==='PREPARING')g.preparing.push(m);
  if(m.status==='READY')g.ready.push(m);
 }
 for(const g of grouped.values()){
  const mealIds=new Set(g.meals.map(x=>x.id));
  g.batches=snapshot.batches.filter(b=>b.status!=='CANCELLED'&&b.mealIds.some(id=>mealIds.has(id)));
 }
 return [...grouped.values()].sort((a,b)=>a.dietLabel.localeCompare(b.dietLabel,'pt-BR')||a.unitId.localeCompare(b.unitId));
}
const printRows=(groups:DietGroup[],onlyReady=false):ProductionPrintRow[]=>groups
 .map(g=>({unit:g.unitId,diet:g.dietLabel,observation:g.observation,
   quantity:onlyReady?g.ready.length:g.meals.length}))
 .filter(row=>row.quantity>0);

export function ProductionView({organizationId,unitIds,getAuthorization,initialDate,initialCycle='10',
 initialUnitId='',mode='operations'}:Props){
 const [date,setDate]=useState(initialDate??today);
 const [cycle,setCycle]=useState<CycleId>(initialCycle);
 const [unit,setUnit]=useState(initialUnitId);
 const [data,setData]=useState<KitchenSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState<'all'|'pending'|'preparing'|'ready'>('all');
 const [reviewNote,setReviewNote]=useState<Record<string,string>>({});
 const seq=useRef(0);
 const visibleUnits=useMemo(()=>unit&&unitIds.includes(unit)?[unit]:unitIds,[unit,unitIds]);
 const headers=useCallback(async()=>({authorization:await getAuthorization(),'x-hospital-organization-id':organizationId}),[getAuthorization,organizationId]);
 const load=useCallback(async(silent=false)=>{
  const serial=++seq.current;if(!silent)setLoading(true);
  try{
   const q=new URLSearchParams({localDate:date,cycleId:cycle,includeSuspended:'true'});
   visibleUnits.forEach(u=>q.append('unitId',u));
   const res=await fetch('/api/hospital/production?'+q,{cache:'no-store',headers:await headers()});
   const json=await res.json() as Api<KitchenSnapshot>;
   if(!res.ok||!json.ok)throw Error(!json.ok?json.error.message:'Não foi possível consultar produção');
   if(serial===seq.current){setData(json.data);setError('');}
  }catch(e){if(serial===seq.current)setError(e instanceof Error?e.message:'Falha de conexão')}
  finally{if(serial===seq.current&&!silent)setLoading(false);}
 },[date,cycle,visibleUnits,headers]);
 useEffect(()=>{
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},20000);
  const focus=()=>void load(true);window.addEventListener('focus',focus);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);seq.current++};
 },[load]);
 const command=useCallback(async<T,>(action:string,args:Record<string,unknown>):Promise<T>=>{
  const res=await fetch('/api/hospital/production',{method:'POST',cache:'no-store',
   headers:{...(await headers()),'Content-Type':'application/json'},
   body:JSON.stringify({action,args:{...args,idempotencyKey:crypto.randomUUID()}})});
  const json=await res.json() as Api<T>;
  if(!res.ok||!json.ok)throw Error(!json.ok?json.error.message:'Ação não registrada');
  return json.data;
 },[headers]);
 const work=async(task:()=>Promise<void>,message:string)=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{await task();setNotice(message);}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a ação');}
  finally{await load(true);setBusy(false)}
 };
 const start=async(g:DietGroup)=>{
  if(!g.pending.length)return;
  await work(async()=>{
   const group=g.pending.slice(0,50);
   const label=(g.dietLabel+(g.observation==='Sem observações'?'':' · '+g.observation)).slice(0,120);
   const b=await command<KitchenBatch>('create',{unitId:g.unitId,localDate:date,cycleId:cycle,mealIds:group.map(x=>x.id),preparationLabel:label});
   await command('start',{unitId:g.unitId,batchId:b.id,expectedRevision:b.revision});
  },'Preparo iniciado para '+g.dietLabel+' · '+g.unitId+'.');
 };
 const actBatch=async(b:KitchenBatch,action:'start'|'complete'|'acknowledge'|'reconcile'|'cancel')=>{
  await work(async()=>{
   const args:Record<string,unknown>={unitId:b.unitId,batchId:b.id,expectedRevision:b.revision};
   if(action==='complete')args.confirmedQuantity=b.quantity;
   if(action==='reconcile')args.excludedMealIds=b.invalid.map(x=>x.mealId);
   if(action==='cancel')args.reason=reviewNote[b.id]??'';
   await command(action,args);
  },action==='complete'?'Dietas prontas. Agora podem seguir para montagem e distribuição.':'Operação registrada na produção.');
 };
 const groups=useMemo(()=>groupsOf(data),[data]);
 const rows=printRows(groups);
 const readyRows=printRows(groups,true);
 const filtered=groups.filter(g=>filter==='all'||filter==='pending'&&g.pending.length>0
  ||filter==='preparing'&&g.preparing.length>0||filter==='ready'&&g.ready.length>0);
 const safety=(data?.counts.blocked??0)+(data?.counts.suspended??0);
 const doPrint=(kind:'report'|'labels')=>{
  try{
   if(kind==='report')printProductionReport(rows,date,cycle);
   else printProductionLabels(readyRows,date,cycle);
   setNotice('PDF gerado no dispositivo. Imprimir não confirma preparo nem entrega.');
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao preparar PDF');}
 };
 return <section className="space-y-5 text-slate-900" data-mode={mode} aria-label="Painel da Cozinha Dietética">
  <div className="hospital-panel space-y-4 p-5 sm:p-6">
   <header className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="hospital-hint-label">Preparo das dietas</p>
     <h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Produção por tipo de dieta</h2>
     <p className="mt-1 text-sm text-slate-500">A cozinha prepara dietas e quantidades. Pacientes e leitos ficam somente na Distribuição.</p></div>
    <button type="button" className="hospital-secondary-action" onClick={()=>void load()} disabled={loading||busy}>
     <RefreshCw size={15} className="inline" aria-hidden="true"/> Atualizar
    </button>
   </header>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded-xl border border-slate-200 p-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Mapa<select value={cycle} onChange={e=>setCycle(e.target.value as CycleId)} className="rounded-xl border border-slate-200 p-2.5">{CYCLES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Unidades<select value={unit} onChange={e=>setUnit(e.target.value)} className="rounded-xl border border-slate-200 p-2.5"><option value="">Todas</option>{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
   </div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo da produção">
    {[
      ['Dietas solicitadas',rows.reduce((n,r)=>n+r.quantity,0)],
      ['Aguardando',groups.reduce((n,g)=>n+g.pending.length,0)],
      ['Produzindo',groups.reduce((n,g)=>n+g.preparing.length,0)],
      ['Prontas',groups.reduce((n,g)=>n+g.ready.length,0)]
    ].map(([label,value])=><div className="hospital-kpi" key={String(label)}><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#174680] tabular-nums">{value}</p></div>)}
   </div>
   {safety>0&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <ShieldAlert className="inline" size={16}/> {safety} pedido(s) suspensos ou bloqueados não estão liberados para produção. Conferir com a unidade.</p>}
   <div className="flex flex-wrap gap-2">
    <button type="button" className="hospital-primary-action" disabled={!rows.length} onClick={()=>doPrint('report')}>
     <FileDown size={16} className="inline" aria-hidden="true"/> Relatório de produção · PDF A4 horizontal
    </button>
    <button type="button" className="hospital-secondary-action" disabled={!readyRows.length} onClick={()=>doPrint('labels')}>
     <Printer size={16} className="inline" aria-hidden="true"/> Etiquetas das dietas prontas
    </button>
   </div>
  </div>
  {loading&&<p role="status" className="text-sm text-slate-600">Carregando quantidades autorizadas…</p>}
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar produção">
   {([['all','Todas'],['pending','Aguardando'],['preparing','Em preparo'],['ready','Prontas']] as const).map(([key,label])=>
    <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}
     className={filter===key?'hospital-primary-action':'hospital-secondary-action'}>{label}</button>)}
  </div>
  {!loading&&!error&&filtered.length===0&&<div className="hospital-panel p-5 text-sm text-slate-500">Nenhuma dieta para este filtro. Confira o horário ou os mapas recebidos.</div>}
  <div className="grid gap-3 lg:grid-cols-2">
   {filtered.map(g=><article key={g.key} className="hospital-panel space-y-3 p-5" data-testid="production-diet-group">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="hospital-hint-label">Dieta / observações</p><h3 className="mt-1 text-lg font-extrabold text-[#173b69]">{g.dietLabel}</h3>
      <p className="mt-1 text-sm text-slate-600">{g.observation}</p></div>
     <div className="text-right"><p className="text-[11px] font-bold text-[#4d76a9]">{g.unitId} · {g.mealType==='PRIMARY'?'Principal':'Secundária'}</p>
      <p className="text-3xl font-extrabold text-[#174680] tabular-nums">{g.meals.length}</p><p className="text-xs text-slate-500">porções</p></div>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
     {g.pending.length>0&&<span className="rounded-full bg-slate-100 px-3 py-1">{g.pending.length} aguardando</span>}
     {g.preparing.length>0&&<span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{g.preparing.length} preparando</span>}
     {g.ready.length>0&&<span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{g.ready.length} prontas</span>}
    </div>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
     {g.pending.length>0&&<button type="button" className="hospital-primary-action" disabled={busy||loading} onClick={()=>void start(g)}>
      <ChefHat className="inline" size={16}/> Iniciar preparo ({Math.min(50,g.pending.length)})
     </button>}
     {g.batches.filter(b=>b.effectiveStatus==='PENDING').map(b=>
      <button type="button" key={b.id} className="hospital-primary-action" disabled={busy||loading} onClick={()=>void actBatch(b,'start')}>Iniciar lote pendente</button>)}
     {g.batches.filter(b=>b.effectiveStatus==='IN_PROGRESS').map(b=>
      <button type="button" key={b.id} className="hospital-primary-action" disabled={busy||loading} onClick={()=>void actBatch(b,'complete')}>
       <Check size={15} className="inline"/> Conferi {b.quantity} dietas · prontas
      </button>)}
     {g.ready.length>0&&<span className="flex items-center gap-2 text-xs font-bold text-emerald-800"><ClipboardCheck size={16}/> {g.ready.length} etiquetas liberadas para imprimir</span>}
    </div>
    {g.batches.some(b=>b.effectiveStatus==='NEEDS_REVIEW')&&<details className="rounded-xl border border-amber-200 bg-amber-50 p-3">
     <summary className="cursor-pointer text-sm font-semibold text-amber-900">Conferência de segurança obrigatória</summary>
     {g.batches.filter(b=>b.effectiveStatus==='NEEDS_REVIEW').map(b=><div key={b.id} className="mt-3 space-y-2 text-xs">
      <p>{b.invalid.length} pedido(s) exigem reconferência. Não liberar automaticamente.</p>
      {b.invalid.length===0&&<button className="hospital-secondary-action" disabled={busy} onClick={()=>void actBatch(b,'acknowledge')}>Registrar reconferência</button>}
      {b.invalid.length>0&&b.invalid.length<b.mealIds.length&&<button className="hospital-secondary-action" disabled={busy} onClick={()=>void actBatch(b,'reconcile')}>Excluir apenas os pedidos incompatíveis</button>}
      <label className="grid gap-1">Motivo para cancelar este lote<input className="rounded-lg border border-slate-200 p-2" maxLength={500} value={reviewNote[b.id]??''} onChange={e=>setReviewNote(s=>({...s,[b.id]:e.target.value}))}/></label>
      <button type="button" className="hospital-secondary-action" disabled={busy||!(reviewNote[b.id]??'').trim()} onClick={()=>void actBatch(b,'cancel')}>Cancelar lote com motivo</button>
     </div>)}
    </details>}
   </article>)}
  </div>
  <p className="text-xs leading-5 text-slate-500">As etiquetas desta fase contêm somente dieta, observação e unidade. Identificação do paciente e leito é impressa na Distribuição. Dietas com jejum, alergia ou alteração clínica bloqueada não entram no preparo.</p>
 </section>;
}
