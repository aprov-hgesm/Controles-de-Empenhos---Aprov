'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,ClipboardCheck,Clock3,PackageCheck,RefreshCw,ShieldCheck,Truck,AlertTriangle} from 'lucide-react';
import {timingLabel} from '../integration/meal-period.mjs';

type Status={
 mealId:string;mealStatus:string;distributionState:string;jobRevision:number|null;
 destinationUnitId:string|null;destinationBedNumber?:string|null;patientName?:string|null;
 needsBirthDate?:boolean;dietCode?:string;dietLabel?:string;observation?:string;mealType?:string;timingStage?:string;deliveredAt?:string|null;
 recipientType?:'PATIENT'|'COMPANION';allergyAlert?:boolean;allergyNote?:string;
 routeReconciliationRequired:boolean;mainMealAlert:string|null
};
type Props={organizationId:string;unitId:string;mealIds:readonly string[];getAuthorization:()=>Promise<string>;mealTitle?:string;onOpenProduction?:()=>void};
type Api<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
type Operation='assembly.start'|'assembly.complete'|'assembly.check'|'batch.dispatch'|'meal.deliver.paper';

const decode=(input:string)=>input.split(',').map(s=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')).filter(Boolean);
const clock=(when:string|null|undefined)=>when?new Date(when).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):'—';
const stage=(item:Status)=>{
 if(item.mealStatus==='REQUESTED')return 'Solicitado à Cozinha · aguardando início do preparo';
 if(item.mealStatus==='PREPARING')return 'Em preparo na Cozinha';
 if(['SUSPENDED','CANCELLED','SAFETY_BLOCKED'].includes(item.mealStatus))return 'Pedido sem liberação de distribuição';
 if(item.mealStatus==='DELIVERED')return 'Distribuído no destino · '+clock(item.deliveredAt);
 if(item.distributionState==='RECEIVED')return 'Aguardando registro da entrega';
 if(item.distributionState==='DISPATCHED')return 'Saiu para distribuição';
 if(item.distributionState==='CHECKED')return 'Bandeja conferida';
 if(['ASSEMBLED','ASSEMBLING'].includes(item.distributionState))return 'Montagem em andamento';
 return 'Dieta pronta para montagem';
};
export function DistributionView({organizationId,unitId,mealIds,getAuthorization,mealTitle,onOpenProduction}:Props){
 const [status,setStatus]=useState<Record<string,Status>>({});
 const [selected,setSelected]=useState<string[]>([]);
 const [ingredients,setIngredients]=useState('');
 const [physicalChecked,setPhysicalChecked]=useState(false);
 const [hours,setHours]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const send=useCallback(async<T,>(operation:Operation|'distribution.status',payload:Record<string,unknown>)=>{
  const response=await fetch('/api/hospital/distribution',{method:'POST',cache:'no-store',credentials:'same-origin',
   headers:{authorization:await getAuthorization(),'Content-Type':'application/json','x-hospital-organization-id':organizationId},
   body:JSON.stringify({operation,payload:{...payload,unitId}})});
  const result=await response.json() as Api<T>;
  if(!response.ok||!result.ok)throw Error(!result.ok?result.error.message:'Falha na conferência');
  return result.data;
 },[getAuthorization,organizationId,unitId]);
 const load=useCallback(async()=>{
  if(!mealIds.length){setStatus({});setLoading(false);return;}
  setLoading(true);
  try{
   const pairs=await Promise.all(mealIds.map(async mealId=>[mealId,
    await send<Status>('distribution.status',{mealId})] as const));
   setStatus(Object.fromEntries(pairs));setError('');
  }catch(e){setError(e instanceof Error?e.message:'Distribuição indisponível');}
  finally{setLoading(false);}
 },[mealIds,send]);
 useEffect(()=>{void load();},[load]);
 const records=useMemo(()=>mealIds.map(id=>status[id]).filter((x):x is Status=>!!x),[mealIds,status]);
 const preparing=records.filter(m=>m.mealStatus==='READY'&&['NOT_STARTED','ASSEMBLING','ASSEMBLED'].includes(m.distributionState)&&!m.routeReconciliationRequired);
 const checked=records.filter(m=>m.mealStatus==='READY'&&m.distributionState==='CHECKED'&&!m.routeReconciliationRequired);
 const enRoute=records.filter(m=>['DISPATCHED','RECEIVED_BY_UNIT'].includes(m.mealStatus)&&!m.routeReconciliationRequired);
 const delivered=records.filter(m=>m.mealStatus==='DELIVERED');
 const pendingProduction=records.filter(m=>['REQUESTED','PREPARING'].includes(m.mealStatus));
 const routeProblems=records.filter(m=>m.routeReconciliationRequired);
 const errorOrigin=error.toLowerCase().includes('origem não autorizada');
 const selection=selected.map(id=>status[id]).filter((x):x is Status=>!!x);
 const compatible=selection.length>0&&selection.every(s=>s.dietCode===selection[0].dietCode&&
   s.observation===selection[0].observation&&s.recipientType===selection[0].recipientType);
 const canPack=compatible&&selection.every(s=>preparing.some(m=>m.mealId===s.mealId))&&physicalChecked&&decode(ingredients).length>0;
 const act=async(task:()=>Promise<unknown>,message:string)=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{await task();setNotice(message);setSelected([]);setPhysicalChecked(false);setIngredients('');}
  catch(e){setError(e instanceof Error?e.message:'Operação não concluída. Confira a lista.');}
  finally{await load();setBusy(false)}
 };
 const pack=()=>void act(async()=>{
  const codes=decode(ingredients);
  for(const m of selection){
   // Existing W5 safety gates and immutable auditing remain in force. A failure leaves
   // the meal in its last real state, to be resumed after fresh server verification.
   if(m.distributionState==='NOT_STARTED')await send('assembly.start',{mealId:m.mealId,idempotencyKey:crypto.randomUUID()});
   if(['NOT_STARTED','ASSEMBLING'].includes(m.distributionState))await send('assembly.complete',{
    mealId:m.mealId,preparedDietCode:m.dietCode,ingredientCodes:codes,idempotencyKey:crypto.randomUUID()});
   if(['NOT_STARTED','ASSEMBLING','ASSEMBLED'].includes(m.distributionState))await send('assembly.check',{
    mealId:m.mealId,idempotencyKey:crypto.randomUUID()});
  }
 },'Etiquetas e composição conferidas. Refeições liberadas para expedição.');
 const dispatch=(mealIds:string[])=>void act(async()=>{
  if(!mealIds.length||mealIds.length>50)throw Error('Selecione até 50 refeições conferidas por envio.');
  await send('batch.dispatch',{mealIds,idempotencyKey:crypto.randomUUID()});
 },'Saída para distribuição registrada. O horário da entrega será informado no retorno do copeiro.');
 const deliver=(meal:Status)=>void act(async()=>{
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours[meal.mealId]??''))throw Error('Copie a hora real de entrega que está anotada na folha.');
  await send('meal.deliver.paper',{mealId:meal.mealId,deliveryTime:hours[meal.mealId],
   paperConfirmed:true,identityChecked:true,idempotencyKey:crypto.randomUUID()});
 },'Entrega confirmada e hora efetiva registrada conforme a folha do copeiro.');

 return <section className="hospital-panel space-y-5 p-4 sm:p-6" aria-label="Separação e distribuição de dietas" data-testid="distribution-workflow">
  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
   <div>
    <p className="hospital-hint-label">Fluxo da Cozinha · {unitId}</p>
    <h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Distribuição{mealTitle?' · '+mealTitle:''}</h2>
    <p className="mt-1 text-sm text-slate-600">Siga as etapas abaixo, da esquerda para a direita. Pacientes e acompanhantes são identificados separadamente.</p>
   </div>
   <button className="hospital-secondary-action" type="button" disabled={loading||busy} onClick={()=>void load()}>
    <RefreshCw size={15} className="inline"/> Atualizar
   </button>
  </header>

  <nav className="grid gap-2 sm:grid-cols-4" aria-label="Sequência da distribuição">
   {([
    ['1','Montar e conferir',preparing.length],
    ['2','Enviar para distribuição',checked.length],
    ['3','Registrar entrega',enRoute.length],
    ['4','Entregues',delivered.length]
   ] as const).map(([number,title,count])=><div key={number} className={'rounded-xl border p-3 '+(count>0?'border-blue-300 bg-[#f1f7ff]':'border-slate-200 bg-white')}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold uppercase tracking-wide text-[#24558b]">Etapa {number}</span>
     <span className="text-lg font-extrabold tabular-nums text-[#174680]">{loading||!!error?'—':count}</span>
    </div>
    <p className="mt-1 text-sm font-bold leading-5 text-[#173b69]">{title}</p>
   </div>)}
  </nav>

  {loading&&<p role="status" className="text-sm text-slate-600">Buscando refeições e etapas registradas…</p>}
  {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
   <p className="font-extrabold"><AlertTriangle size={17} className="mr-2 inline"/> Não foi possível consultar a distribuição</p>
   <p className="mt-1">{error}</p>
   {errorOrigin&&<p className="mt-2 text-xs">No preview local, abra pelo endereço 127.0.0.1:3100 e atualize a branch. As informações abaixo não devem ser interpretadas como zero refeições.</p>}
   <button type="button" className="hospital-secondary-action mt-3" onClick={()=>void load()} disabled={busy||loading}>Tentar novamente</button>
  </div>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

  {!error&&!loading&&records.length===0&&<div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
   Nenhuma refeição recebida nesta unidade, data e horário. Confira a seleção acima e o envio do mapa pela unidade assistencial.
  </div>}

  {!error&&!loading&&records.length>0&&<>
   <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Etapa 1 · Montar e conferir">
    <div className="flex items-start gap-3">
     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173b69] text-lg font-extrabold text-white">1</span>
     <div className="flex-1">
      <h3 className="text-base font-extrabold text-[#173b69]">Montar e conferir bandejas</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">Quando a Produção concluir a dieta, selecione as bandejas do mesmo tipo, informe a composição e confirme as etiquetas de dieta e identificação.</p>
     </div>
     <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-800">{preparing.length} para conferir</span>
    </div>
    {pendingProduction.length>0&&<div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
     <p className="min-w-[175px] flex-1 text-xs text-slate-700"><Clock3 size={15} className="mr-1 inline"/>
      {pendingProduction.length} refeição(ões) ainda na Produção. As etiquetas definitivas estão disponíveis; a montagem começa quando a dieta fica pronta.
     </p>
     {onOpenProduction&&<button type="button" className="hospital-secondary-action" onClick={onOpenProduction}>Abrir Produção deste mapa</button>}
    </div>}
    {preparing.length===0&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Nenhuma bandeja aguardando conferência.</p>}
    <div className="grid gap-2">
     {preparing.map(m=><div key={m.mealId} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-[#fbfdff] p-3">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-700" aria-label={'Selecionar '+(m.patientName??'refeição')}
       disabled={busy} checked={selected.includes(m.mealId)}
       onChange={e=>setSelected(xs=>e.target.checked?[...xs.filter(x=>x!==m.mealId),m.mealId]:xs.filter(x=>x!==m.mealId))}/>
      <div className="min-w-[185px] flex-1">
       <p className="text-sm font-extrabold text-[#173b69]">{m.patientName??'Identificação a conferir'} · Leito {m.destinationBedNumber??'a confirmar'}</p>
       <p className="mt-1 text-[11px] font-bold text-[#2a5f9c]">{m.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE'} · {m.dietLabel??'Dieta'}{m.observation?' · '+m.observation:''}</p>
       {m.allergyAlert&&<p role="alert" className="mt-2 text-xs font-extrabold text-rose-800">ALERGIA: {m.allergyNote||'Conferir prescrição e composição'}</p>}
       <p className="mt-1 text-xs text-slate-500">{stage(m)}</p>
      </div>
      <button type="button" className="hospital-secondary-action text-xs" disabled={busy}
       onClick={()=>setSelected(preparing.filter(s=>s.dietCode===m.dietCode&&s.observation===m.observation&&s.recipientType===m.recipientType).map(s=>s.mealId))}>
       Selecionar dieta semelhante
      </button>
     </div>)}
    </div>
    {selected.length>0&&<div className="space-y-3 rounded-xl border border-blue-200 bg-[#f2f7ff] p-4" aria-label="Conferência de bandejas selecionadas">
     <p className="font-extrabold text-[#173b69]"><PackageCheck size={17} className="mr-1 inline"/> {selected.length} bandeja(s) selecionada(s)</p>
     {!compatible&&<p role="alert" className="text-xs font-bold text-amber-900">Selecione refeições da mesma dieta, observação e destinatário para registrar a composição em conjunto.</p>}
     <label className="block text-sm font-semibold text-slate-700">Ingredientes da preparação (separados por vírgula)
      <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal" value={ingredients} maxLength={500}
       onChange={e=>setIngredients(e.target.value)} placeholder="Ex.: arroz, carne, legumes"/>
     </label>
     <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={physicalChecked} onChange={e=>setPhysicalChecked(e.target.checked)}/>
      Conferi ingredientes, restrições, alergias e as etiquetas da dieta e do destinatário.
     </label>
     <div className="flex flex-wrap gap-2">
      <button className="hospital-primary-action" type="button" disabled={!canPack||busy} onClick={pack}>
       <ClipboardCheck size={17} className="mr-1 inline"/> Confirmar montagem de {selected.length} bandeja(s)
      </button>
      <button className="hospital-secondary-action" type="button" onClick={()=>setSelected([])} disabled={busy}>Cancelar seleção</button>
     </div>
    </div>}
   </section>

   <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Etapa 2 · Enviar para distribuição">
    <div className="flex flex-wrap items-start gap-3">
     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173b69] text-lg font-extrabold text-white">2</span>
     <div className="min-w-0 flex-1">
      <h3 className="text-base font-extrabold text-[#173b69]">Enviar para distribuição</h3>
      <p className="mt-1 text-xs text-slate-600">As bandejas conferidas ficam aqui. Registre a saída sem precisar selecioná-las novamente.</p>
     </div>
     {checked.length>1&&<button type="button" className="hospital-primary-action" disabled={busy} onClick={()=>dispatch(checked.slice(0,50).map(m=>m.mealId))}>
      <Truck size={16} className="mr-1 inline"/> Enviar {Math.min(checked.length,50)} conferidas
     </button>}
    </div>
    {checked.length===0&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Nenhuma bandeja conferida aguardando expedição.</p>}
    {checked.map(m=><div key={m.mealId} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
     <div className="min-w-[185px] flex-1">
      <p className="text-sm font-extrabold text-[#173b69]">{m.patientName??'Identificação a conferir'} · Leito {m.destinationBedNumber??'a confirmar'}</p>
      <p className="mt-1 text-xs text-slate-600">{m.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE'} · {m.dietLabel??'Dieta'}</p>
      {m.allergyAlert&&<p className="mt-1 text-xs font-extrabold text-rose-800">ALERGIA: {m.allergyNote||'Conferir ficha'}</p>}
     </div>
     <button type="button" className="hospital-primary-action" disabled={busy} onClick={()=>dispatch([m.mealId])}>
      <Truck size={16} className="mr-1 inline"/> Registrar saída
     </button>
    </div>)}
   </section>

   <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Etapa 3 · Registrar entrega">
    <div className="flex items-start gap-3">
     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173b69] text-lg font-extrabold text-white">3</span>
     <div className="flex-1">
      <h3 className="text-base font-extrabold text-[#173b69]">Registrar horário e entrega</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">No retorno do copeiro, copie a hora real da entrega anotada na folha física. Cada refeição tem seu próprio horário e confirmação.</p>
     </div>
    </div>
    {enRoute.length===0&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Nenhuma refeição enviada aguardando registro de entrega.</p>}
    {enRoute.map(m=><article key={m.mealId} className="space-y-2 rounded-xl border border-blue-200 bg-[#f6faff] p-4">
     <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-[180px] flex-1">
       <p className="text-sm font-extrabold text-[#173b69]">{m.patientName??'Identificação a conferir'} · Leito {m.destinationBedNumber??'a confirmar'}</p>
       <p className="mt-1 text-xs text-slate-700">{m.recipientType==='COMPANION'?'ACOMPANHANTE':'PACIENTE'} · {m.dietLabel??'Dieta'}{m.observation?' · '+m.observation:''}</p>
       {m.allergyAlert&&<p className="mt-1 text-xs font-extrabold text-rose-800">ALERGIA: {m.allergyNote||'Conferir ficha'}</p>}
      </div>
      <span className="text-xs font-bold text-blue-900">Em distribuição</span>
     </div>
     {m.mainMealAlert&&<p role="alert" className="text-xs font-bold text-amber-900">{m.mainMealAlert}</p>}
     <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-extrabold text-[#204c85]">Hora efetiva da entrega
       <input type="time" aria-label={'Hora exata da entrega '+(m.patientName??'refeição')} className="rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-base text-slate-900"
        value={hours[m.mealId]??''} onChange={e=>setHours(v=>({...v,[m.mealId]:e.target.value}))}/>
      </label>
      <button type="button" className="hospital-primary-action" disabled={busy||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours[m.mealId]??'')} onClick={()=>deliver(m)}>
       <Check size={16} className="mr-1 inline"/> Confirmar entrega
      </button>
     </div>
     <p className="text-[11px] leading-5 text-slate-600">Ao confirmar, você atesta que a folha física registra a entrega efetiva e que destinatário e leito foram conferidos.</p>
    </article>)}
   </section>

   <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Etapa 4 · Entregues">
    <div className="flex items-start gap-3">
     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-lg font-extrabold text-white">4</span>
     <div className="flex-1">
      <h3 className="text-base font-extrabold text-[#173b69]">Entregas concluídas · {delivered.length}</h3>
      <p className="mt-1 text-xs text-slate-600">Somente entregas efetivamente confirmadas aparecem aqui.</p>
     </div>
    </div>
    {delivered.length>0?<details className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
     <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver {delivered.length} entrega(s) registrada(s)</summary>
     <div className="mt-3 grid gap-2">{delivered.map(m=><div key={m.mealId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white p-3 text-xs">
      <span className="font-semibold text-slate-700">{m.patientName??'Destinatário a conferir'} · Leito {m.destinationBedNumber??'—'} · {m.recipientType==='COMPANION'?'Acompanhante':'Paciente'}</span>
      <span className="font-bold text-emerald-800">Entregue às {clock(m.deliveredAt)}</span>
     </div>)}</div>
    </details>:<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Ainda não há entregas confirmadas.</p>}
   </section>
   {routeProblems.length>0&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
    {routeProblems.length} pedido(s) com alteração de leito ou unidade: reconcilie a localização antes de montar, expedir ou registrar a entrega.
   </p>}
  </>}
  <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/>
   A impressão das etiquetas definitivas não registra preparo, saída ou entrega. Alergias, correções clínicas e mudanças de leito continuam exigindo conferência.
  </p>
 </section>;
}
