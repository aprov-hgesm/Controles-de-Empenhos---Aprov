'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {FileDown,Printer,RefreshCw,Truck} from 'lucide-react';
import {DistributionView} from '@/features/hospital/distribution/DistributionView';
import {mealName} from './meal-period.mjs';
import type {KitchenMeal,KitchenSnapshot} from '@/features/hospital/production/contracts';
import {eligibleForOrganizationLabel,printPhase,plannedPrintability} from '@/features/hospital/printing/meal-print-selection';
import {
 printDistributionReport,printPatientLabels,type DistributionPrintRow
} from '@/features/hospital/printing/hospital-diet-print';

type Cycle='06'|'10'|'16';
const today=()=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=(k:string)=>p.find(x=>x.type===k)?.value??'';
 return v('year')+'-'+v('month')+'-'+v('day');
};
const suitable=(m:KitchenMeal)=>eligibleForOrganizationLabel(m);
const observation=(m:KitchenMeal)=>[
 (m.observation??'').trim(),m.dietRestrictionCodes?.length?'Restrições: '+m.dietRestrictionCodes.join(', '):''
].filter(Boolean).join(' · ')||'Sem observações';
const needsIdentity=(m:KitchenMeal)=>!m.patientName?.trim()||!m.bedNumber?.trim();
const record=(m:KitchenMeal):DistributionPrintRow=>({
 unit:m.unitId,bed:m.bedNumber?.trim()||'LEITO A CONFERIR',
 patient:m.patientName?.trim()||(m.recipientType==='COMPANION'?'ACOMPANHANTE - CONFERIR REFERÊNCIA':'PACIENTE - CONFERIR IDENTIFICAÇÃO'),
 diet:m.dietLabel??'Dieta',observation:observation(m),
 recipientType:m.recipientType==='COMPANION'?'COMPANION':'PATIENT',
 allergyAlert:!!m.allergyAlert,allergyNote:m.allergyNote??'',
 corrected:!!m.correctionAcknowledgedAt,
 phase:printPhase(m.status),identityIncomplete:needsIdentity(m)
});

export function DistributionQueue({organizationId,unitIds,getAuthorization,initialUnitId,
 initialCycle='10',initialDate}:{organizationId:string;unitIds:string[];
 getAuthorization:()=>Promise<string>;initialUnitId?:string;initialCycle?:Cycle;initialDate?:string}){
 const [unit,setUnit]=useState(initialUnitId??'');
 const [cycle,setCycle]=useState<Cycle>(initialCycle);
 const [mealType,setMealType]=useState<'PRIMARY'|'SECONDARY'>('PRIMARY');
 const [date,setDate]=useState(initialDate??today);
 const [snapshot,setSnapshot]=useState<KitchenSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const q=new URLSearchParams({localDate:date,cycleId:cycle,includeSuspended:'true'});
   unitIds.forEach(u=>q.append('unitId',u));
   const res=await fetch('/api/hospital/production?'+q,{cache:'no-store',
    headers:{authorization:await getAuthorization(),'x-hospital-organization-id':organizationId}});
   const data=await res.json() as {ok:boolean;data?:KitchenSnapshot;error?:{message:string}};
   if(!res.ok||!data.ok||!data.data)throw Error(data.error?.message||'Fila indisponível');
   setSnapshot(data.data);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar distribuição');}
  finally{if(!silent)setLoading(false)}
 },[date,cycle,unitIds,organizationId,getAuthorization]);
 useEffect(()=>{
  void load();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void load(true)},20000);
  return()=>clearInterval(interval);
 },[load]);
 const allMeals=useMemo(()=>snapshot?.meals.filter(suitable)??[],[snapshot]);
 const queue=useMemo(()=>allMeals.filter(m=>m.mealType===mealType),[allMeals,mealType]);
 const records=useMemo(()=>queue.map(record).sort((a,b)=>
  a.unit.localeCompare(b.unit,'pt-BR')||a.bed.localeCompare(b.bed,'pt-BR',{numeric:true})),[queue]);
 const missing=records.filter(r=>r.identityIncomplete).length;
 const excluded=useMemo(()=>plannedPrintability((snapshot?.meals??[]).filter(m=>m.mealType===mealType)),[snapshot,mealType]);
 const shown=unit?queue.filter(m=>m.unitId===unit):queue;
 const unitCounts=unitIds.map(id=>({unitId:id,count:queue.filter(m=>m.unitId===id).length,
  prepared:queue.filter(m=>m.unitId===id&&m.status==='READY').length,
  route:queue.filter(m=>m.unitId===id&&['DISPATCHED','RECEIVED_BY_UNIT'].includes(m.status)).length,
  delivered:queue.filter(m=>m.unitId===id&&m.status==='DELIVERED').length}));
 const download=(type:'labels'|'report')=>{
  setError('');setNotice('');
  try{
   const selected=unit?records.filter(r=>r.unit===unit):records;
   if(type==='report')printDistributionReport(selected,date,cycle,mealName(cycle,mealType),mealType);
   else printPatientLabels(selected,date,cycle,mealName(cycle,mealType),mealType);
   setNotice('PDF preparado no seu dispositivo. A impressão não marca dietas como entregues.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o PDF');}
 };
 return <section className="space-y-5 text-slate-900" aria-label="Distribuição hospitalar">
  <div className="hospital-panel space-y-4 p-5 sm:p-6">
   <header className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="hospital-hint-label">Etiqueta de identificação · paciente ou acompanhante</p>
     <h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Organizar e distribuir · {mealName(cycle,mealType)}</h2>
     <p className="mt-1 text-sm text-slate-500">As etiquetas podem ser impressas antes do preparo para organizar o porcionamento. As porções de acompanhantes são identificadas separadamente e somente na refeição principal.</p></div>
    <button type="button" className="hospital-secondary-action" disabled={loading} onClick={()=>void load()}>
     <RefreshCw size={16} className="inline"/> Atualizar</button>
   </header>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Dia<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded-xl border border-slate-200 p-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Mapa<select value={cycle} onChange={e=>setCycle(e.target.value as Cycle)} className="rounded-xl border border-slate-200 p-2.5"><option value="06">06h</option><option value="10">10h</option><option value="16">16h</option></select></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">Unidade<select value={unit} onChange={e=>setUnit(e.target.value)} className="rounded-xl border border-slate-200 p-2.5"><option value="">Todas as unidades</option>{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
   </div>
   <div className="rounded-2xl border border-blue-100 bg-[#f6f9fe] p-4" aria-label="Selecionar refeição para entrega separada">
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#4d6c91]">Duas entregas distintas do mesmo mapa</p>
    <div className="grid gap-2 sm:grid-cols-2">{(['PRIMARY','SECONDARY'] as const).map(type=><button type="button" key={type} aria-pressed={mealType===type} data-testid={'distribution-meal-'+type.toLowerCase()} onClick={()=>{setMealType(type);setNotice('');setError('')}} className={(mealType===type?'border-blue-400 bg-blue-50 text-[#164680] shadow-sm':'border-slate-200 bg-white text-slate-700')+' rounded-xl border-2 p-3 text-left font-semibold'}>
      <span className="block text-sm">{mealName(cycle,type)}</span><span className="mt-1 block text-xs font-normal">{allMeals.filter(m=>m.mealType===type).length} dietas · distribuição independente</span>
     </button>)}</div>
    <p className="mt-2 text-xs text-slate-600">Os relatórios, as etiquetas e as confirmações serão gerados apenas para <strong>{mealName(cycle,mealType)}</strong>.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" className="hospital-primary-action" disabled={loading} onClick={()=>download('labels')}>
     <Printer size={16} className="inline"/> Etiquetas de pacientes e acompanhantes
    </button>
    <button type="button" className="hospital-secondary-action" disabled={loading} onClick={()=>download('report')}>
     <FileDown size={16} className="inline"/> Relatório de distribuição · PDF A4 horizontal
    </button>
   </div>
   {missing>0&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
    {missing} identificação(ões) incompleta(s): as etiquetas de organização serão impressas com aviso de conferência obrigatória de nome/leito antes da distribuição.</p>}
   {excluded.skippedForSafety>0&&<p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-900">
    {excluded.skippedForSafety} pedido(s) cancelados, suspensos ou clinicamente bloqueados não são impressos como refeições válidas para entrega.</p>}
   <p className="text-xs text-slate-600">Disponíveis desde o recebimento do pedido: {queue.length} etiquetas, incluindo {queue.filter(m=>m.recipientType==='COMPANION').length} de acompanhantes.
    Pedidos ainda em planejamento/preparo recebem aviso visível de que não estão liberados para distribuição.</p>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo da distribuição">
    {[
     ['Etiquetas para organizar',queue.length],['Aguardando produção',queue.filter(x=>['REQUESTED','PREPARING'].includes(x.status)).length],
     ['Em rota',queue.filter(x=>['DISPATCHED','RECEIVED_BY_UNIT'].includes(x.status)).length],
     ['Entregues',queue.filter(x=>x.status==='DELIVERED').length]
    ].map(([label,value])=><div key={String(label)} className="hospital-kpi">
     <p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#174680]">{value}</p>
    </div>)}
   </div>
  </div>
  {loading&&<p role="status" className="text-sm text-slate-500">Consultando pedidos autorizados…</p>}
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {!unit&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Filas por unidade">
   {unitCounts.map(r=><button key={r.unitId} type="button" onClick={()=>setUnit(r.unitId)}
     className="hospital-panel flex items-center justify-between gap-3 p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50">
     <div><p className="font-extrabold text-[#173b69]">{r.unitId}</p><p className="mt-1 text-xs text-slate-600">{r.prepared} prontas · {r.route} em rota · {r.delivered} entregues</p></div>
     <span className="hospital-kpi-icon"><Truck size={17}/></span>
    </button>)}
  </div>}
  {unit&&snapshot&&<div className="space-y-3">
   <button type="button" className="hospital-secondary-action" onClick={()=>setUnit('')}>Ver todas as unidades</button>
   <DistributionView key={unit+'-'+date+'-'+cycle+'-'+mealType} organizationId={organizationId} unitId={unit} mealTitle={mealName(cycle,mealType)}
    mealIds={shown.slice(0,50).map(m=>m.id)} getAuthorization={getAuthorization}/>
   {shown.length>50&&<p className="text-xs text-amber-800">Exibindo 50 dietas por vez. Utilize outros horários ou divida o controle da unidade antes de confirmar todas.</p>}
  </div>}
  <p className="text-xs text-slate-500">Imprimir auxilia o preparo e porcionamento: não altera o estado das dietas. Antes de sair, confira autorização de distribuição, identidade, restrições e alergias. A folha física registra hora e rubrica da entrega real.</p>
 </section>;
}
