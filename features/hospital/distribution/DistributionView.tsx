'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,ClipboardCheck,Clock3,PackageCheck,RefreshCw,ShieldCheck,Truck} from 'lucide-react';
import {timingLabel} from '../integration/meal-period.mjs';

type Status={
 mealId:string;mealStatus:string;distributionState:string;jobRevision:number|null;
 destinationUnitId:string|null;destinationBedNumber?:string|null;patientName?:string|null;
 needsBirthDate?:boolean;dietCode?:string;dietLabel?:string;observation?:string;mealType?:string;timingStage?:string;deliveredAt?:string|null;
 routeReconciliationRequired:boolean;mainMealAlert:string|null
};
type Props={organizationId:string;unitId:string;mealIds:readonly string[];getAuthorization:()=>Promise<string>;mealTitle?:string};
type Api<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
type Operation='assembly.start'|'assembly.complete'|'assembly.check'|'batch.dispatch'|'meal.deliver.paper';

const decode=(input:string)=>input.split(',').map(s=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')).filter(Boolean);
const clock=(when:string|null|undefined)=>when?new Date(when).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):'—';
const stage=(item:Status)=>{
 if(item.mealStatus==='DELIVERED')return 'Distribuído no leito · '+clock(item.deliveredAt);
 if(item.distributionState==='RECEIVED')return 'Aguardando registro da entrega';
 if(item.distributionState==='DISPATCHED')return 'Saiu para distribuição';
 if(item.distributionState==='CHECKED')return 'Bandeja conferida';
 if(['ASSEMBLED','ASSEMBLING'].includes(item.distributionState))return 'Montagem em andamento';
 return 'Dieta pronta para montagem';
};
export function DistributionView({organizationId,unitId,mealIds,getAuthorization,mealTitle}:Props){
 const [status,setStatus]=useState<Record<string,Status>>({});
 const [selected,setSelected]=useState<string[]>([]);
 const [ingredients,setIngredients]=useState('');
 const [physicalChecked,setPhysicalChecked]=useState(false);
 const [paperChecked,setPaperChecked]=useState(false);
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
 const selection=selected.map(id=>status[id]).filter((x):x is Status=>!!x);
 const compatible=selection.length>0&&selection.every(s=>s.dietCode===selection[0].dietCode&&s.observation===selection[0].observation);
 const canPack=compatible&&selection.every(s=>preparing.some(m=>m.mealId===s.mealId))&&physicalChecked&&decode(ingredients).length>0;
 const canDispatch=selection.length>0&&selection.every(s=>checked.some(m=>m.mealId===s.mealId));
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
 const dispatch=()=>void act(async()=>{
  await send('batch.dispatch',{mealIds:selection.map(x=>x.mealId),idempotencyKey:crypto.randomUUID()});
 },'Saída para distribuição registrada. A entrega nos leitos ainda não foi confirmada.');
 const deliver=(meal:Status)=>void act(async()=>{
  if(!paperChecked)throw Error('Confirme que o copeiro conferiu nome e nascimento no leito usando a ficha.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours[meal.mealId]??''))throw Error('Copie a hora real de entrega que está anotada na folha.');
  await send('meal.deliver.paper',{mealId:meal.mealId,deliveryTime:hours[meal.mealId],
   paperConfirmed:true,identityChecked:true,idempotencyKey:crypto.randomUUID()});
 },'Distribuído no leito · hora efetiva registrada conforme a folha em papel.');

 return <section className="hospital-panel space-y-5 p-4 sm:p-6" aria-label="Separação e distribuição de dietas">
  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
   <div><p className="hospital-hint-label">Identificação, saída e retorno</p><h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Distribuição · {unitId}{mealTitle?' · '+mealTitle:''}</h2>
    <p className="mt-1 text-sm text-slate-500">Cole a etiqueta do paciente ao lado da etiqueta da dieta. Confira antes de sair. Ao voltar, registre a hora escrita no relatório.</p></div>
   <button className="hospital-secondary-action" type="button" disabled={loading||busy} onClick={()=>void load()}>
    <RefreshCw size={15} className="inline"/> Atualizar</button>
  </header>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Situação da distribuição">
   {[
     ['Para identificar',preparing.length],['Conferidas',checked.length],
     ['Em distribuição',enRoute.length],['Entregues',delivered.length]
    ].map(([name,count])=><div className="hospital-kpi" key={String(name)}>
     <p className="text-xs text-slate-500">{name}</p><p className="mt-1 text-2xl font-extrabold text-[#174680]">{count}</p>
    </div>)}
  </div>
  {loading&&<p role="status" className="text-sm text-slate-600">Conferindo etapas registradas…</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-emerald-900">{notice}</p>}
  <section className="space-y-3" aria-label="Refeições identificadas">
   <p className="text-sm font-bold text-[#1b477f]">Dietas e identificação dos leitos</p>
   {records.length===0&&!loading&&<p className="text-sm text-slate-500">Nenhuma dieta nesta unidade e horário.</p>}
   {records.map(m=><article key={m.mealId} className={'rounded-xl border p-3 '+(m.routeReconciliationRequired?'border-amber-300 bg-amber-50':'border-slate-200 bg-white')}>
    <div className="flex flex-wrap items-center gap-3">
     {['READY'].includes(m.mealStatus)&&<input type="checkbox" aria-label={'Selecionar '+(m.patientName??'paciente')} checked={selected.includes(m.mealId)} disabled={busy||m.routeReconciliationRequired}
      onChange={e=>setSelected(xs=>e.target.checked?[...xs,m.mealId]:xs.filter(id=>id!==m.mealId))}/>}
     <div className="min-w-0 flex-1">
      <p className="text-sm font-extrabold text-[#1c4579]">{unitId} · Leito {m.destinationBedNumber??'a conferir'} · {m.patientName??'Paciente sem nome'}</p>
      <p className="mt-1 text-xs text-slate-700">{m.dietLabel??'Dieta'}{m.observation?' · '+m.observation:''}</p>
      {m.timingStage&&m.timingStage!=='ON_TIME'&&<p role="alert" className={'mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-bold '+(m.timingStage==='AFTER_TOLERANCE'?'bg-rose-100 text-rose-900':'bg-amber-100 text-amber-900')}>{timingLabel(m.timingStage,m.mealType)}</p>}
      <p className="mt-1 text-xs font-semibold text-[#2768af]">{stage(m)}</p>
     </div>
     {m.mealStatus==='DELIVERED'&&<Check size={19} className="text-emerald-700" aria-hidden="true"/>}
    </div>
    {m.routeReconciliationRequired&&<p role="alert" className="mt-2 text-xs font-semibold text-amber-900">Transferência ou mudança de leito: corrigir a rota antes de entregar.</p>}
    {m.mainMealAlert&&<p role="alert" className="mt-2 text-xs font-semibold text-amber-900">{m.mainMealAlert}</p>}
    {enRoute.some(x=>x.mealId===m.mealId)&&<div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-blue-100 bg-[#f7faff] p-3">
     <label className="grid gap-1 text-xs font-semibold text-slate-700">Hora anotada no relatório
      <input type="time" aria-label={'Hora exata da entrega '+(m.patientName??'paciente')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={hours[m.mealId]??''}
       onChange={e=>setHours(old=>({...old,[m.mealId]:e.target.value}))}/>
     </label>
     <button type="button" className="hospital-primary-action" disabled={busy||!paperChecked||!hours[m.mealId]||m.routeReconciliationRequired}
      onClick={()=>deliver(m)}>Distribuído no leito</button>
    </div>}
   </article>)}
  </section>
  {selected.length>0&&<section className="space-y-3 rounded-2xl border border-blue-200 bg-[#f4f8ff] p-4" aria-label="Próxima ação do lote">
   <div className="flex items-center gap-2"><PackageCheck size={18} className="text-blue-700"/>
    <p className="font-extrabold text-[#173b69]">{selected.length} dieta(s) selecionada(s)</p></div>
   {canDispatch?<button type="button" className="hospital-primary-action" disabled={busy} onClick={dispatch}>
    <Truck size={17} className="inline"/> Enviar para distribuição</button>:
   <>
    <p className="text-xs text-slate-600">Selecione dietas do mesmo tipo e observação. Basta conferir uma vez a composição dessa preparação.</p>
    <label className="grid gap-1 text-sm font-semibold text-slate-700">Ingredientes utilizados (separados por vírgula)
     <input className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal" value={ingredients} maxLength={500}
      onChange={e=>setIngredients(e.target.value)} placeholder="Ex.: arroz, carne, legumes" />
    </label>
    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={physicalChecked} onChange={e=>setPhysicalChecked(e.target.checked)}/>
     Conferi a composição, as restrições e as duas etiquetas das dietas selecionadas.
    </label>
    <button type="button" className="hospital-primary-action" disabled={!canPack||busy} onClick={pack}>
     <ClipboardCheck size={17} className="inline"/> Conferir montagem e etiquetas ({selected.length})
    </button>
    {!compatible&&<p role="alert" className="text-xs font-semibold text-amber-800">Escolha dietas do mesmo tipo e observação para conferir em conjunto.</p>}
   </>}
  </section>}
  {enRoute.length>0&&<section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
   <h3 className="flex items-center gap-2 font-extrabold text-[#1a467e]"><Clock3 size={17}/> Retorno do copeiro · registro pelo papel</h3>
   <p className="mt-1 text-xs leading-5 text-slate-700">Copie a hora exata escrita à caneta para cada paciente. O registro será feito pelo usuário atual com data e hora de lançamento próprias.</p>
   <label className="mt-3 flex items-start gap-2 text-sm text-slate-800"><input type="checkbox" checked={paperChecked} onChange={e=>setPaperChecked(e.target.checked)}/>
    Confirmo que a entrega foi efetuada, e o nome completo e a data de nascimento foram conferidos na pulseira/ficha do paciente no momento da entrega, conforme o relatório físico.</label>
  </section>}
  <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/> A emissão de etiqueta ou PDF não constitui confirmação de entrega. Refeições suspensas, com jejum, alergias conflitantes ou leito alterado continuam bloqueadas.</p>
 </section>;
}
