'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChefHat,Check,ClipboardCheck,FileDown,Printer,RefreshCw,ShieldAlert} from 'lucide-react';
import type {CycleId} from '../core/contracts';
import type {KitchenBatch,KitchenMeal,KitchenSnapshot} from './contracts';
import {printProductionLabels,printProductionReport,type ProductionPrintRow} from '../printing/hospital-diet-print';
import {mealName} from '../integration/meal-period.mjs';
import {eligibleForOrganizationLabel,plannedPrintability,printRecipientType} from '../printing/meal-print-selection';

type Props={organizationId:string;unitIds:string[];getAuthorization:()=>Promise<string>;
 initialDate?:string;initialCycle?:CycleId;initialUnitId?:string;initialMealType?:'ALL'|'PRIMARY'|'SECONDARY';mode?:'overview'|'operations';
 onOpenDistribution?:(focus:{unitId:string;cycleId:CycleId;localDate:string;mealType:'PRIMARY'|'SECONDARY'})=>void;};
type Api<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
type DietGroup={key:string;unitId:string;dietCode:string;dietLabel:string;observation:string;
 mealType:string;consistency:string;recipientType:'PATIENT'|'COMPANION';
 meals:KitchenMeal[];pending:KitchenMeal[];preparing:KitchenMeal[];ready:KitchenMeal[];batches:KitchenBatch[]};
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
 meal.allergyAlert?'ALERGIA: '+(meal.allergyNote??'conferir ficha'):'',
 meal.dietRestrictionCodes?.length?'Restrições: '+meal.dietRestrictionCodes.join(', '):''
].filter(Boolean).join(' · ')||'Sem observações';
const groupKey=(m:KitchenMeal)=>JSON.stringify([m.unitId,m.dietCode,m.mealType,m.consistency??null,printRecipientType(m),
 m.observation??'',m.allergyNote??'', [...(m.dietRestrictionCodes??[])].sort()]);
function groupsOf(snapshot:KitchenSnapshot|null):DietGroup[]{
 if(!snapshot)return [];
 const grouped=new Map<string,DietGroup>();
 const reserved=new Set(snapshot.batches.filter(b=>b.status!=='CANCELLED').flatMap(b=>b.mealIds));
 const eligible=['REQUESTED','PREPARING','READY'];
 for(const m of snapshot.meals){
  if(!eligible.includes(m.status)||m.safetyIssue)continue;
  const key=groupKey(m);
  if(!grouped.has(key))grouped.set(key,{key,unitId:m.unitId,dietCode:m.dietCode,
    dietLabel:m.dietLabel??'Dieta',observation:noteOf(m),mealType:m.mealType,
    consistency:m.consistency??'NÃO INFORMADA',recipientType:printRecipientType(m),
    meals:[],pending:[],preparing:[],ready:[],batches:[]});
  const g=grouped.get(key)!;
  g.meals.push(m);
  if(m.status==='REQUESTED'&&!reserved.has(m.id))g.pending.push(m);
  if(m.status==='PREPARING')g.preparing.push(m);
  if(m.status==='READY')g.ready.push(m);
 }
 for(const g of grouped.values()){
  const mealIds=new Set(g.meals.map(x=>x.id));
  g.batches=snapshot.batches.filter(b=>b.status!=='CANCELLED'&&b.mealIds.some(id=>mealIds.has(id)));
 }
 return [...grouped.values()].sort((a,b)=>a.dietLabel.localeCompare(b.dietLabel,'pt-BR')||a.unitId.localeCompare(b.unitId));
}
type DietFamily={key:string;dietCode:string;dietLabel:string;observation:string;mealType:string;consistency:string;
 recipientType:'PATIENT'|'COMPANION';units:DietGroup[];
 pending:number;preparing:number;ready:number;total:number;batches:KitchenBatch[]};
function familiesOf(groups:DietGroup[]):DietFamily[]{
 const families=new Map<string,DietFamily>();
 for(const g of groups){
  const key=JSON.stringify([g.dietCode,g.mealType,g.consistency,g.recipientType,g.observation]);
  if(!families.has(key))families.set(key,{key,dietCode:g.dietCode,dietLabel:g.dietLabel,
   consistency:g.consistency,recipientType:g.recipientType,
   observation:g.observation,mealType:g.mealType,units:[],pending:0,preparing:0,ready:0,total:0,batches:[]});
  const f=families.get(key)!;
  f.units.push(g);f.pending+=g.pending.length;f.preparing+=g.preparing.length;
  f.ready+=g.ready.length;f.total+=g.meals.length;f.batches.push(...g.batches);
 }
 return [...families.values()].sort((a,b)=>a.dietLabel.localeCompare(b.dietLabel,'pt-BR'));
}
const printRows=(groups:DietGroup[]):ProductionPrintRow[]=>groups
 .map(g=>({
  unit:g.unitId,diet:g.dietLabel,consistency:g.consistency,
  recipientType:g.recipientType,
  observation:g.observation,mealType:g.mealType,
  quantity:g.meals.filter(eligibleForOrganizationLabel).length
 }))
 .filter(row=>row.quantity>0);

export function ProductionView({organizationId,unitIds,getAuthorization,initialDate,initialCycle='10',
 initialUnitId='',initialMealType='ALL',mode='operations',onOpenDistribution}:Props){
 const [date,setDate]=useState(initialDate??today);
 const [cycle,setCycle]=useState<CycleId>(initialCycle);
 const [unit,setUnit]=useState(initialUnitId);
 const [data,setData]=useState<KitchenSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState<'all'|'pending'|'preparing'|'ready'>('all');
 const [mealFilter,setMealFilter]=useState<'ALL'|'PRIMARY'|'SECONDARY'>(initialMealType);
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
 const start=async(family:DietFamily)=>{
  if(!family.pending)return;
  await work(async()=>{
   for(const g of family.units.filter(x=>x.pending.length)){
    const meals=g.pending.slice(0,50);
    const label=(g.dietLabel+(g.observation==='Sem observações'?'':' · '+g.observation)).slice(0,120);
    const b=await command<KitchenBatch>('create',{unitId:g.unitId,localDate:date,cycleId:cycle,mealIds:meals.map(x=>x.id),preparationLabel:label});
    await command('start',{unitId:g.unitId,batchId:b.id,expectedRevision:b.revision});
   }
  },'Preparo iniciado por tipo de dieta e separado por unidade no histórico.');
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
 const performBatches=async(batches:KitchenBatch[],action:'start'|'complete')=>{
  await work(async()=>{
   for(const b of batches){
    const args:Record<string,unknown>={unitId:b.unitId,batchId:b.id,expectedRevision:b.revision};
    if(action==='complete')args.confirmedQuantity=b.quantity;
    await command(action,args);
   }
  },action==='complete'?'Quantidades conferidas. Dietas prontas para identificar e distribuir.':'Produção iniciada para as unidades correspondentes.');
 };
 const groups=useMemo(()=>groupsOf(data),[data]);
 const families=useMemo(()=>familiesOf(groups),[groups]);
 const groupsInMeal=groups.filter(g=>mealFilter==='ALL'||g.mealType===mealFilter);
 const rows=printRows(groupsInMeal);
 const organizationRows=rows;
 const printableStats=plannedPrintability((data?.meals??[]).filter(m=>mealFilter==='ALL'||m.mealType===mealFilter));
 const filtered=families.filter(g=>(mealFilter==='ALL'||g.mealType===mealFilter)&&(filter==='all'||filter==='pending'&&g.pending>0
  ||filter==='preparing'&&g.preparing>0||filter==='ready'&&g.ready>0));
 const safety=(data?.counts.blocked??0)+(data?.counts.suspended??0);
 const doPrint=(kind:'report'|'labels')=>{
  try{
   if(kind==='report')printProductionReport(rows,date,cycle);
   else printProductionLabels(organizationRows,date,cycle);
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
   <div className="flex flex-wrap gap-2" role="group" aria-label="Separar produção por refeição">{(['ALL','PRIMARY','SECONDARY'] as const).map(type=><button key={type} type="button" aria-pressed={mealFilter===type} onClick={()=>setMealFilter(type)} className={mealFilter===type?'hospital-primary-action':'hospital-secondary-action'}>{type==='ALL'?'Todas as dietas':mealName(cycle,type)}</button>)}</div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo da produção">
    {[
      ['Dietas solicitadas',rows.reduce((n,r)=>n+r.quantity,0)],
      ['Aguardando',families.filter(g=>mealFilter==='ALL'||g.mealType===mealFilter).reduce((n,g)=>n+g.pending,0)],
      ['Produzindo',families.filter(g=>mealFilter==='ALL'||g.mealType===mealFilter).reduce((n,g)=>n+g.preparing,0)],
      ['Prontas',families.filter(g=>mealFilter==='ALL'||g.mealType===mealFilter).reduce((n,g)=>n+g.ready,0)]
    ].map(([label,value])=><div className="hospital-kpi" key={String(label)}><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#174680] tabular-nums">{value}</p></div>)}
   </div>
   {safety>0&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <ShieldAlert className="inline" size={16}/> {safety} pedido(s) suspensos ou bloqueados não estão liberados para produção. Conferir com a unidade.</p>}
   <div className="flex flex-wrap gap-2">
    <button type="button" className="hospital-primary-action" disabled={!rows.length} onClick={()=>doPrint('report')}>
     <FileDown size={16} className="inline" aria-hidden="true"/> Relatório de produção · PDF A4 horizontal
    </button>
    <button type="button" className="hospital-secondary-action" disabled={loading} onClick={()=>doPrint('labels')}>
     <Printer size={16} className="inline" aria-hidden="true"/> Etiquetas para preparo e porcionamento
    </button>
    {onOpenDistribution&&<button type="button" className="hospital-primary-action" onClick={()=>onOpenDistribution({
      unitId:unit||groupsInMeal[0]?.unitId||unitIds[0]||'',cycleId:cycle,localDate:date,
      mealType:mealFilter==='SECONDARY'?'SECONDARY':'PRIMARY'
    })}>
     Próxima etapa: Distribuição <ArrowRight size={16} className="ml-1 inline"/>
    </button>}
   </div>
   <p className="text-xs text-slate-600">
    As etiquetas definitivas de dieta já podem ser impressas desde o recebimento dos pedidos: {organizationRows.reduce((n,r)=>n+r.quantity,0)} porções
    no mapa e horário selecionados, para uso junto às etiquetas de identificação na Distribuição.
    {printableStats.skippedForSafety>0&&` ${printableStats.skippedForSafety} pedidos cancelados, suspensos ou com bloqueio de segurança permanecem fora das etiquetas de preparo.`}
   </p>
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
     <div><p className="hospital-hint-label">Consistência e tipo · {g.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE'}</p>
      <h3 className="mt-1 text-lg font-extrabold text-[#173b69]">{g.dietLabel}</h3>
      <p className="mt-1 text-xs font-semibold text-[#37639b]">{g.consistency.replaceAll('_',' ')} · {g.recipientType==='COMPANION'?'Refeição principal do acompanhante':'Refeição do paciente'}</p>
      <p className="mt-1 text-sm text-slate-600">{g.observation}</p></div>
     <div className="text-right"><p className="text-[11px] font-bold text-[#4d76a9]">{mealName(cycle,g.mealType)}</p>
      <p className="text-3xl font-extrabold text-[#174680] tabular-nums">{g.total}</p><p className="text-xs text-slate-500">porções</p></div>
    </div>
    {g.units.some(u=>u.meals.some(m=>m.allergyAlert))&&<p role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-xs font-extrabold text-amber-950">ALERGIA ALIMENTAR — conferir os alérgenos informados e os ingredientes antes da preparação.</p>}
    {g.units.some(u=>u.meals.some(m=>m.correctionAcknowledgedAt))&&<p role="alert" className="rounded-xl border border-blue-300 bg-blue-50 p-2 text-xs font-bold text-blue-900">DIETA CORRIGIDA — produzir de acordo com a versão atual e descartar etiquetas anteriores.</p>}
    {g.units.some(u=>u.meals.some(m=>m.timingStage&&m.timingStage!=='ON_TIME'))&&<p role="alert" className={'rounded-xl border p-2 text-xs font-bold '+(g.units.some(u=>u.meals.some(m=>m.timingStage==='AFTER_TOLERANCE'))?'border-rose-200 bg-rose-50 text-rose-900':'border-amber-200 bg-amber-50 text-amber-900')}>
      Solicitação extraordinária: {g.units.flatMap(u=>u.meals).filter(m=>m.timingStage&&m.timingStage!=='ON_TIME').length} dieta(s) após o prazo do mapa. Conferir observações e horário antes de preparar.
     </p>}
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
     {g.pending>0&&<span className="rounded-full bg-slate-100 px-3 py-1">{g.pending} aguardando</span>}
     {g.preparing>0&&<span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{g.preparing} preparando</span>}
     {g.ready>0&&<span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{g.ready} prontas</span>}
     {g.units.map(u=><span key={u.unitId} className="rounded-full border border-blue-100 px-3 py-1 text-[#37639b]">{u.unitId}: {u.meals.length}</span>)}
    </div>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
     {g.pending>0&&<button type="button" className="hospital-primary-action" disabled={busy||loading} onClick={()=>void start(g)}>
      <ChefHat className="inline" size={16}/> Iniciar preparo ({g.pending})
     </button>}
     {g.batches.some(b=>b.effectiveStatus==='PENDING')&&<button type="button" className="hospital-primary-action" disabled={busy||loading}
      onClick={()=>void performBatches(g.batches.filter(b=>b.effectiveStatus==='PENDING'),'start')}>Retomar início do preparo</button>}
     {g.batches.some(b=>b.effectiveStatus==='IN_PROGRESS')&&<button type="button" className="hospital-primary-action" disabled={busy||loading}
      onClick={()=>void performBatches(g.batches.filter(b=>b.effectiveStatus==='IN_PROGRESS'),'complete')}>
       <Check size={15} className="inline"/> Conferi {g.batches.filter(b=>b.effectiveStatus==='IN_PROGRESS').reduce((n,b)=>n+b.quantity,0)} dietas · prontas
      </button>}
     {g.total>0&&<span className="flex items-center gap-2 text-xs font-bold text-blue-800"><ClipboardCheck size={16}/> {g.total} etiquetas de dieta disponíveis para imprimir</span>}
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
  <p className="text-xs leading-5 text-slate-500">Etiquetas de produção identificam consistência, refeição, unidade e se a porção é para paciente ou acompanhante. Nome e leito ficam na etiqueta da Distribuição. As mesmas etiquetas são utilizadas no porcionamento, junto às etiquetas de identificação da Distribuição. A impressão não altera o estado do preparo ou da entrega.</p>
 </section>;
}
