'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {CycleId} from '../core/contracts';
import type {KitchenBatch,KitchenMeal,KitchenSnapshot} from './contracts';

type Props={organizationId:string;unitIds:string[];getAuthorization:()=>Promise<string>;initialDate?:string;initialCycle?:CycleId;mode?:'overview'|'operations'};
type Result<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
const dateInHospital=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const cycleLabels:Record<CycleId,string>={'06':'06h · Café / lanche','10':'10h · Almoço / lanche','16':'16h · Jantar / ceia'};
const stageNames:Record<string,string>={REQUESTED:'Aguardando',PREPARING:'Em preparo',READY:'Pronto',SUSPENDED:'Suspenso',SAFETY_BLOCKED:'Bloqueado',CANCELLED:'Cancelado',NEEDS_REVIEW:'Revisão necessária',PENDING:'Lote pendente',IN_PROGRESS:'Lote em preparo',COMPLETE:'Lote concluído',DISPATCHED:'Expedido',DELIVERED:'Entregue',RECEIVED_BY_UNIT:'Recebido na unidade'};
const time=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit'}).format(new Date(value)):'—';
const button='hospital-secondary-action disabled:cursor-not-allowed disabled:opacity-40';
const heading='text-xs font-extrabold uppercase tracking-[0.14em] text-[#516f97]';

/** UI só recebe dados de endpoint autorizado. Nenhuma fixture clínica e nenhuma aceitação individual. */
export function ProductionView({organizationId,unitIds,getAuthorization,initialDate,initialCycle='10',mode='operations'}:Props){
  const [localDate,setLocalDate]=useState(initialDate??dateInHospital);
  const [cycleId,setCycleId]=useState<CycleId>(initialCycle);
  const [unitId,setUnitId]=useState('');
  const [dietCode,setDietCode]=useState('');
  const [lateOnly,setLateOnly]=useState(false);
  const [includeSuspended,setIncludeSuspended]=useState(true);
  const [data,setData]=useState<KitchenSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [offline,setOffline]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [preparationLabel,setPreparationLabel]=useState('');
  const [confirmQuantities,setConfirmQuantities]=useState<Record<string,string>>({});
  const [cancelReasons,setCancelReasons]=useState<Record<string,string>>({});
  const mounted=useRef(true);
  const requestSeq=useRef(0);
  const visibleUnits=useMemo(()=>unitId?[unitId]:unitIds,[unitId,unitIds]);
  const keyUnits=visibleUnits.join('|');

  const headers=useCallback(async()=>({'Authorization':await getAuthorization(),'x-hospital-organization-id':organizationId}),[getAuthorization,organizationId]);
  const load=useCallback(async(silent=false)=>{
    const seq=++requestSeq.current;
    if(!silent)setLoading(true);
    try{
      const q=new URLSearchParams({localDate,cycleId,includeSuspended:String(includeSuspended)});
      visibleUnits.forEach(x=>q.append('unitId',x));
      if(dietCode)q.set('dietCode',dietCode);
      if(lateOnly)q.set('lateOnly','true');
      const response=await fetch(`/api/hospital/production?${q}`,{headers:await headers(),cache:'no-store'});
      const result=await response.json() as Result<KitchenSnapshot>;
      if(!response.ok||!result.ok)throw new Error(!result.ok?result.error.message:'Não foi possível consultar a fila');
      if(mounted.current&&seq===requestSeq.current){setData(result.data);setSelected(old=>old.filter(id=>result.data.meals.some(m=>m.id===id&&m.status==='REQUESTED'&&!m.safetyIssue)));setError('');setOffline(false);}
    }catch(e){if(mounted.current&&seq===requestSeq.current){setError(e instanceof Error?e.message:'Falha de leitura');setOffline(true);}}
    finally{if(mounted.current&&seq===requestSeq.current)setLoading(false);}
  },[localDate,cycleId,visibleUnits,keyUnits,dietCode,lateOnly,includeSuspended,headers]);

  useEffect(()=>{mounted.current=true;void load();const polling=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},20000);const onFocus=()=>void load(true);window.addEventListener('focus',onFocus);return()=>{mounted.current=false;clearInterval(polling);window.removeEventListener('focus',onFocus);};},[load]);
  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();
    const stream=async()=>{
      try{
        const q=new URLSearchParams();visibleUnits.forEach(u=>q.append('unitId',u));
        const response=await fetch(`/api/hospital/production/stream?${q}`,{headers:await headers(),signal:controller.signal,cache:'no-store'});
        if(!response.ok||!response.body)return;
        const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';let lastCursor='';
        while(!cancelled){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const frames=pending.split('\n\n');pending=frames.pop()??'';
          for(const frame of frames){const match=frame.match(/^data: (.+)$/m);if(!match)continue;const parsed=JSON.parse(match[1]) as {cursor?:string};if(parsed.cursor&&lastCursor&&parsed.cursor!==lastCursor)void load(true);lastCursor=parsed.cursor??'';}
        }
      }catch{/* Polling autorizado permanece ativo durante a reconexão. */}
    };
    void stream();return()=>{cancelled=true;controller.abort();};
  },[keyUnits,visibleUnits,headers,load]);

  const act=async(action:string,args:Record<string,unknown>)=>{
    setBusy(true);setMessage('');setError('');
    try{
      const response=await fetch('/api/hospital/production',{method:'POST',headers:{...(await headers()),'Content-Type':'application/json'},body:JSON.stringify({action,args:{...args,idempotencyKey:crypto.randomUUID()}})});
      const result=await response.json() as Result<unknown>;
      if(!response.ok||!result.ok)throw new Error(!result.ok?result.error.message:'Falha na operação');
      setMessage('Operação confirmada e registrada no histórico.');setSelected([]);await load(true);
    }catch(e){setError(e instanceof Error?e.message:'Operação não concluída');await load(true);}
    finally{setBusy(false);}
  };
  const eligible=(data?.meals??[]).filter(m=>m.status==='REQUESTED'&&!m.safetyIssue);
  const chosen=eligible.filter(m=>selected.includes(m.id));
  const sameGroup=chosen.length>0&&chosen.every(m=>m.unitId===chosen[0].unitId&&m.dietCode===chosen[0].dietCode&&m.mealType===chosen[0].mealType&&JSON.stringify([...m.dietRestrictionCodes].sort())===JSON.stringify([...chosen[0].dietRestrictionCodes].sort()));
  const activeBatches=data?.batches.filter(b=>!['CANCELLED'].includes(b.status))??[];
  const create=()=>{if(!chosen.length||!sameGroup)return;void act('create',{unitId:chosen[0].unitId,localDate,cycleId,mealIds:chosen.map(m=>m.id),preparationLabel});};
  const reconcile=(batch:KitchenBatch)=>void act('reconcile',{unitId:batch.unitId,batchId:batch.id,expectedRevision:batch.revision,excludedMealIds:batch.invalid.map(x=>x.mealId)});

  return <section className="space-y-5 text-slate-900" data-mode={mode} aria-label="Painel da Cozinha Dietética">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold text-[#193c6a]">Fila operacional e preparo</h2><p className="mt-1 text-sm text-slate-500">Mapas recebidos, lotes e conferência. A entrega é confirmada separadamente em Distribuição.</p></div>
      <button className={button} disabled={busy} onClick={()=>void load()}>Atualizar fila</button>
    </header>
    <div className="hospital-panel grid gap-3 p-4 sm:grid-cols-4">
      <label className="text-sm font-medium">Data<input aria-label="Data do mapa" type="date" className="mt-1 w-full rounded-lg border p-2" value={localDate} onChange={e=>setLocalDate(e.target.value)}/></label>
      <label className="text-sm font-medium">Ciclo<select aria-label="Ciclo" className="mt-1 w-full rounded-lg border p-2" value={cycleId} onChange={e=>setCycleId(e.target.value as CycleId)}>{(Object.keys(cycleLabels) as CycleId[]).map(c=><option key={c} value={c}>{cycleLabels[c]}</option>)}</select></label>
      <label className="text-sm font-medium">Unidade<select aria-label="Unidade" className="mt-1 w-full rounded-lg border p-2" value={unitId} onChange={e=>{setUnitId(e.target.value);setSelected([]);}}><option value="">Todas autorizadas</option>{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
      <label className="text-sm font-medium">Dieta<input aria-label="Código da dieta" className="mt-1 w-full rounded-lg border p-2" value={dietCode} onChange={e=>setDietCode(e.target.value)} placeholder="Filtrar código"/></label>
    </div>
    <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-3 text-sm"><label className="flex gap-2"><input type="checkbox" checked={lateOnly} onChange={e=>setLateOnly(e.target.checked)}/>Somente extraordinários/tardios</label><label className="flex gap-2"><input type="checkbox" checked={includeSuspended} onChange={e=>setIncludeSuspended(e.target.checked)}/>Mostrar suspensos e cancelados</label></div>
    {loading&&<p role="status">Consultando mapas autorizados…</p>}
    {offline&&<p role="status" className="rounded-lg border border-amber-300 p-3 text-amber-900">Sem conexão confirmada. Dados exibidos podem estar desatualizados; operações exigem reconexão.</p>}
    {error&&<p role="alert" className="rounded-lg border border-rose-300 p-3 text-rose-900">{error}</p>}
    {message&&<p role="status" className="rounded-lg border border-emerald-300 p-3 text-emerald-900">{message}</p>}
    {data&&<>
      <p className="text-xs text-slate-500">Última leitura: {time(data.at)} (horário local). Mapas não enviados não entram na fila.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{([['Mapas recebidos',data.maps.length],['Aguardando',data.counts.requested],['Preparando',data.counts.preparing],['Prontos',data.counts.ready],['Tardios',data.counts.late],['Bloqueados',data.counts.blocked],['Suspensos',data.counts.suspended]] as const).map(([label,count])=><div key={label} className="rounded-xl border bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold tabular-nums">{count}</p></div>)}</div>
      <div className="hospital-panel p-5"><h2 className={heading}>Mapas efetivamente enviados</h2>{data.maps.length===0?<p className="mt-3 text-sm text-slate-500">Nenhum mapa enviado neste ciclo. Rascunhos não são pedidos recebidos.</p>:<div className="mt-2 flex flex-wrap gap-2">{data.maps.map(m=><span className="rounded-lg border bg-slate-50 p-2 text-xs" key={m.id}>{m.unitId} · {stageNames[m.status]??m.status} · recebido {time(m.submittedAt)}</span>)}</div>}</div>
      <div className="hospital-production-operations grid gap-4 lg:grid-cols-2">
        <section className="hospital-panel min-w-0 p-5"><h2 className={heading}>Fila individual</h2><p className="my-2 text-xs text-slate-500">Marque pedidos compatíveis para formar um lote; não há aceite individual.</p>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">{data.meals.length===0?<p className="p-3 text-sm">Sem pedidos nesta consulta.</p>:data.meals.map(m=><MealRow key={m.id} meal={m} selected={selected.includes(m.id)} busy={busy||offline} onSelect={checked=>setSelected(prev=>checked?[...prev,m.id]:prev.filter(x=>x!==m.id))}/>)}</div>
          <div className="mt-3 space-y-2 border-t pt-3"><p className="text-sm font-semibold">Selecionados: {chosen.length} {chosen.length>0&&!sameGroup?'· dietas, unidades ou restrições incompatíveis':''}</p>
            <label className="block text-sm">Preparação / prato conferido<input className="mt-1 w-full rounded-lg border p-2" maxLength={120} placeholder="Ex.: arroz e acompanhamento sem lactose" value={preparationLabel} onChange={e=>setPreparationLabel(e.target.value)}/></label>
            <button className="hospital-primary-action" disabled={busy||offline||!sameGroup||!preparationLabel.trim()} onClick={create}>Formar lote de {chosen.length}</button></div>
        </section>
        <section className="min-w-0 rounded-xl border bg-white p-4"><h2 className={heading}>Mapa consolidado de produção</h2><p className="my-2 text-xs text-slate-500">Quantidades por dieta, principal/secundária e restrição; sem duplicação por adendo/transferência.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Dieta / tipo</th><th className="p-2">Preparações</th><th className="p-2">Restrições</th><th className="p-2">Total</th><th className="p-2">Preparo</th><th className="p-2">Pronto</th></tr></thead><tbody>{data.groups.map(g=><tr key={`${g.dietCode}:${g.mealType}:${g.restrictionCodes.join('|')}`} className="border-b"><td className="p-2">{g.dietCode} · {g.mealType==='PRIMARY'?'Principal':'Secundária'}</td><td className="p-2">{g.preparationLabels.join(', ')||'A definir no lote'}</td><td className="p-2">{g.restrictionCodes.join(', ')||'—'}</td><td className="p-2 tabular-nums">{g.total}</td><td className="p-2">{g.preparing}</td><td className="p-2">{g.ready}</td></tr>)}</tbody></table>{data.groups.length===0&&<p className="p-3 text-sm">Sem produção elegível.</p>}</div>
        </section>
      </div>
      <section className="hospital-production-operations hospital-panel p-5"><h2 className={heading}>Lotes de preparo e reconferência</h2>{activeBatches.length===0?<p className="mt-3 text-sm">Nenhum lote formado neste ciclo.</p>:<div className="mt-3 grid gap-3 lg:grid-cols-2">{activeBatches.map(b=><article key={b.id} className="space-y-2 rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{b.preparationLabel}</strong><span className={`rounded-md px-2 py-1 text-xs ${b.effectiveStatus==='NEEDS_REVIEW'?'bg-rose-100 text-rose-900':'bg-slate-100'}`}>{stageNames[b.effectiveStatus]??b.effectiveStatus}</span></div><p className="text-sm">{b.unitId} · {b.dietCode} · {b.quantity} pedidos · {b.mealType==='PRIMARY'?'principal':'secundária'}</p><p className="text-xs text-slate-500">Início {time(b.startedAt)} · fim {time(b.completedAt)} · quantidade conferida {b.preparedQuantity}</p>
            {b.invalid.length>0&&<p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900">Reconferência obrigatória: {b.invalid.map(x=>x.reason).join(', ')}. Não liberar a preparação incompatível.</p>}
            <div className="flex flex-wrap items-center gap-2">
              {b.effectiveStatus==='PENDING'&&<button className={button} disabled={busy||offline} onClick={()=>void act('start',{unitId:b.unitId,batchId:b.id,expectedRevision:b.revision})}>Iniciar lote</button>}
              {b.effectiveStatus==='IN_PROGRESS'&&<><label className="text-xs">Quantidade conferida<input type="number" min="0" step="1" inputMode="numeric" aria-label={`Quantidade conferida do lote ${b.id}`} className="ml-2 w-20 rounded border p-2" value={confirmQuantities[b.id]??''} onChange={e=>setConfirmQuantities(prev=>({...prev,[b.id]:e.target.value}))}/></label><button className={button} disabled={busy||offline||Number(confirmQuantities[b.id])!==b.quantity||!confirmQuantities[b.id]} onClick={()=>void act('complete',{unitId:b.unitId,batchId:b.id,expectedRevision:b.revision,confirmedQuantity:Number(confirmQuantities[b.id])})}>Concluir preparo</button></>}
              {b.effectiveStatus==='NEEDS_REVIEW'&&b.invalid.length===0&&<button className={button} disabled={busy||offline} onClick={()=>void act('acknowledge',{unitId:b.unitId,batchId:b.id,expectedRevision:b.revision})}>Confirmar reconferência</button>}
              {b.effectiveStatus==='NEEDS_REVIEW'&&b.invalid.length>0&&b.invalid.length<b.mealIds.length&&<button className={button} disabled={busy||offline} onClick={()=>reconcile(b)}>Excluir inelegíveis e reconferir</button>}
              {['PENDING','IN_PROGRESS','NEEDS_REVIEW'].includes(b.effectiveStatus)&&<><input aria-label={`Motivo do cancelamento do lote ${b.id}`} placeholder="Motivo para cancelar" className="min-w-0 flex-1 rounded border p-2 text-sm" value={cancelReasons[b.id]??''} onChange={e=>setCancelReasons(prev=>({...prev,[b.id]:e.target.value}))}/><button className={button} disabled={busy||offline||!(cancelReasons[b.id]??'').trim()} onClick={()=>void act('cancel',{unitId:b.unitId,batchId:b.id,expectedRevision:b.revision,reason:cancelReasons[b.id]})}>Cancelar lote</button></>}
            </div>
          </article>)}</div>}</section>
    </>}
  </section>;
}

function MealRow({meal,selected,busy,onSelect}:{meal:KitchenMeal;selected:boolean;busy:boolean;onSelect:(value:boolean)=>void}){
  const eligible=meal.status==='REQUESTED'&&!meal.safetyIssue;
  return <label className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${meal.safetyIssue?'border-rose-300 bg-rose-50':'bg-white'}`}>
    <input type="checkbox" className="mt-1" checked={selected} disabled={busy||!eligible} onChange={e=>onSelect(e.target.checked)}/>
    <span className="min-w-0 flex-1"><strong>{meal.dietCode}</strong> · {meal.mealType==='PRIMARY'?'principal':'secundária'} · {meal.unitId}<span className="block text-xs">Internação: {meal.admissionId} · pedido: {meal.id}</span><span className="block text-xs">{stageNames[meal.status]??meal.status} · registrado {time(meal.requestedAt)} · {meal.advisory==='ROUTINE'?'no prazo':'extraordinário/tardio'}</span>{meal.dietRestrictionCodes?.length>0&&<span className="block text-xs">Restrições: {meal.dietRestrictionCodes.join(', ')}</span>}{meal.safetyIssue&&<span className="block font-semibold text-rose-900">Revisão: {meal.safetyIssue}</span>}</span>
  </label>;
}
