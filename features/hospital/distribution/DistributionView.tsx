'use client';

import {useCallback,useEffect,useState} from 'react';

type Status={
  mealId:string;mealStatus:string;distributionState:string;jobRevision:number|null;
  destinationUnitId:string|null;destinationBedNumber?:string|null;patientName?:string|null;needsBirthDate?:boolean;dietCode?:string;dietLabel?:string;routeReconciliationRequired:boolean;mainMealAlert:string|null;
};
type Props={
  organizationId:string;
  unitId:string;
  mealIds:readonly string[];
  getAuthorization:()=>Promise<string>;
};
type Operation='assembly.start'|'assembly.complete'|'assembly.check'|'assembly.reopen'|'meal.suspend'|'batch.dispatch'|'batch.receive'|'meal.deliver'|'meal.return'|'meal.cancel'|'route.flag';
type Failure={ok:false;error:{code:string;message:string}};
type Success<T>={ok:true;data:T};

export function DistributionView({organizationId,unitId,mealIds,getAuthorization}:Props){
  const [statuses,setStatuses]=useState<Record<string,Status>>({});
  const [selected,setSelected]=useState<string[]>([]);
  const [activeMeal,setActiveMeal]=useState(mealIds[0]||'');
  const [dietReviewed,setDietReviewed]=useState(false);
  const [ingredientCodes,setIngredientCodes]=useState('');
  const [patientReferenceCode,setPatientReferenceCode]=useState('');
  const [patientBirthDate,setPatientBirthDate]=useState('');
  const [patientDisplayName,setPatientDisplayName]=useState('');
  const [identityMethod,setIdentityMethod]=useState<'MANUAL'|'SCANNER'>('MANUAL');
  const [reason,setReason]=useState('');
  const [format,setFormat]=useState<'80mm'|'A6'|'A4'>('80mm');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const send=useCallback(async(operation:string,payload:Record<string,unknown>):Promise<Response>=>{
    const authorization=await getAuthorization();
    if(!/^Bearer \S+$/.test(authorization))throw new Error('Autenticação hospitalar necessária');
    return fetch('/api/hospital/distribution',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      headers:{authorization,'x-hospital-organization-id':organizationId,'content-type':'application/json'},
      body:JSON.stringify({operation,payload:{...payload,unitId}})
    });
  },[getAuthorization,organizationId,unitId]);

  const refresh=useCallback(async()=>{
    if(mealIds.length===0){setStatuses({});return}
    setLoading(true);setError('');
    try{
      const results=await Promise.all(mealIds.map(async mealId=>{
        const response=await send('distribution.status',{mealId});
        const result=await response.json() as Success<Status>|Failure;
        if(!result.ok)throw new Error(result.error.message);
        return [mealId,result.data] as const;
      }));
      setStatuses(Object.fromEntries(results));
    }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar distribuição')}
    finally{setLoading(false)}
  },[mealIds,send]);

  useEffect(()=>{void refresh()},[refresh]);

  const execute=async(operation:Operation,extra:Record<string,unknown>={})=>{
    setLoading(true);setError('');setMessage('');
    try{
      const response=await send(operation,{mealId:activeMeal,idempotencyKey:crypto.randomUUID(),...extra});
      const result=await response.json() as Success<unknown>|Failure;
      if(!result.ok)throw new Error(result.error.message);
      setMessage('Operação registrada. Nenhuma outra refeição foi confirmada automaticamente.');
      setSelected([]);setDietReviewed(false);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Falha na operação')}
    finally{setLoading(false)}
  };

  const printLabel=async()=>{
    setLoading(true);setError('');
    // Open only as a direct user gesture. Never place clinical identifiers in the URL.
    const printWindow=window.open('about:blank','_blank');
    try{
      if(!printWindow)throw new Error('Permita a janela de impressão no navegador');
      printWindow.opener=null;
      const response=await send('label.print',{mealId:activeMeal,format});
      if(!response.ok){
        const errorResult=await response.json() as Failure;
        throw new Error(errorResult.error?.message||'Etiqueta indisponível');
      }
      const html=await response.text();
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setMessage('Etiqueta preparada para impressão; a impressão física não foi presumida.');
    }catch(e){printWindow?.close();setError(e instanceof Error?e.message:'Falha na etiqueta')}
    finally{setLoading(false)}
  };

  const toggle=(mealId:string,checked:boolean)=>setSelected(current=>checked?[...new Set([...current,mealId])]:current.filter(id=>id!==mealId));
  const current=statuses[activeMeal];

  const active=current;
  const allChecked=selected.length>0&&selected.every(id=>statuses[id]?.distributionState==='CHECKED'&&statuses[id]?.mealStatus==='READY');
  const allDispatched=selected.length>0&&selected.every(id=>statuses[id]?.distributionState==='DISPATCHED'&&statuses[id]?.mealStatus==='DISPATCHED');
  const ingredients=ingredientCodes.split(',').map(x=>x.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')).filter(Boolean);
  const identityValid=!!patientDisplayName.trim()&&(active?.needsBirthDate?!!patientBirthDate:!!patientReferenceCode.trim());
  return <section aria-label="Distribuição de refeições hospitalares" className="hospital-panel space-y-5 p-4 text-slate-900 sm:p-6">
   <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
    <div><p className="hospital-hint-label">Etapa final · Conferência de segurança</p><h2 className="mt-1 text-xl font-extrabold text-[#173b69]">Montagem e entrega das dietas</h2>
     <p className="mt-1 text-sm text-slate-500">Cada refeição passa por conferência antes de sair; a entrega é confirmada individualmente no leito.</p></div>
    <button type="button" onClick={()=>void refresh()} disabled={loading} className="hospital-secondary-action">Atualizar</button>
   </header>
   {loading&&<p role="status" className="text-sm text-slate-500">Conferindo registros da distribuição…</p>}
   {message&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-emerald-900">{message}</p>}
   {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
   {mealIds.length===0?<div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Nenhuma dieta pronta para distribuição nesta unidade e horário.</div>:
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
     <section className="space-y-3" aria-label="Refeições da unidade">
      <p className="text-sm font-bold text-[#24466f]">Dietas para os leitos ({mealIds.length})</p>
      <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1" role="group" aria-label="Pedidos para distribuição">
       {mealIds.map(id=>{
        const info=statuses[id];
        const state=info?.distributionState??'NOT_STARTED';
        const status=info?.mealStatus??'';
        const subtitle=status==='DELIVERED'?'Entregue':state==='RECEIVED'?'Aguardando confirmação no leito':state==='DISPATCHED'?'Em distribuição':state==='CHECKED'?'Conferido para expedição':state==='ASSEMBLED'?'Montado, aguardando conferência':state==='ASSEMBLING'?'Em montagem':status==='READY'?'Pronto para montar':'Aguardando';
        return <div key={id} className={'rounded-xl border p-3 '+(activeMeal===id?'border-blue-300 bg-[#f0f6ff]':'border-slate-200 bg-white')}>
          <div className="flex items-center gap-3">
           <input type="checkbox" aria-label={'Selecionar dieta de '+(info?.patientName??'paciente')} checked={selected.includes(id)} onChange={e=>toggle(id,e.target.checked)}/>
           <button type="button" onClick={()=>{setActiveMeal(id);setDietReviewed(false);setPatientDisplayName('');setPatientBirthDate('');setPatientReferenceCode('');}} aria-pressed={activeMeal===id}
            className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-extrabold text-[#234776]">{unitId} · Leito {info?.destinationBedNumber??'a conferir'}</span>
            <span className="mt-0.5 block truncate text-sm text-slate-700">{info?.patientName??'Paciente'}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{info?.dietLabel??'Dieta'} · {subtitle}</span>
           </button>
          </div>
          {info?.routeReconciliationRequired&&<p role="alert" className="mt-2 text-xs font-bold text-rose-700">Transferência de leito/unidade: conferir nova rota antes da entrega.</p>}
         </div>;
       })}
      </div>
      {selected.length>0&&<div className="rounded-xl border border-blue-100 bg-[#f5f9ff] p-4">
       <p className="mb-3 text-sm font-semibold text-[#24466f]">{selected.length} refeições selecionadas</p>
       {allChecked&&<button type="button" className="hospital-primary-action w-full" disabled={loading} onClick={()=>void execute('batch.dispatch',{mealIds:selected})}>Enviar selecionadas para distribuição</button>}
       {allDispatched&&<button type="button" className="hospital-primary-action w-full" disabled={loading} onClick={()=>void execute('batch.receive',{mealIds:selected})}>Confirmar chegada à unidade</button>}
       {!allChecked&&!allDispatched&&<p className="text-xs text-slate-600">Para movimentar em conjunto, selecione apenas dietas na mesma etapa e já conferidas.</p>}
      </div>}
     </section>
     {activeMeal&&<section className="space-y-4 rounded-2xl border border-slate-200 bg-[#fafcff] p-4" aria-label="Detalhes e próxima ação">
      <div>
       <p className="hospital-hint-label">Dieta selecionada</p>
       <h3 className="mt-1 text-lg font-extrabold text-[#1b4475]">{active?.patientName??'Paciente'} · Leito {active?.destinationBedNumber??'a conferir'}</h3>
       <p className="mt-1 text-sm text-slate-600">{active?.dietLabel??'Dieta'} · {unitId}</p>
      </div>
      {active?.mainMealAlert&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{active.mainMealAlert}</p>}
      {active?.routeReconciliationRequired&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Leito ou unidade alterados. Não entregue sem reconciliação.</p>}
      {active?.mealStatus==='DELIVERED'?
       <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">Entrega confirmada no leito e registrada no histórico.</div>:
       <>
        {active?.distributionState==='NOT_STARTED'&&active?.mealStatus==='READY'&&<button type="button" className="hospital-primary-action w-full" disabled={loading} onClick={()=>void execute('assembly.start')}>1. Iniciar montagem da dieta</button>}
        {active?.distributionState==='ASSEMBLING'&&<div className="space-y-3">
         <p className="font-bold text-[#24466f]">Montagem · confira o prato preparado</p>
         <label className="grid gap-1 text-sm">Ingredientes utilizados (separados por vírgula)<textarea className="min-h-20 rounded-xl border border-slate-200 bg-white p-3" value={ingredientCodes} onChange={e=>setIngredientCodes(e.target.value)} placeholder="Ex.: arroz, carne, cenoura"/></label>
         <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm"><input type="checkbox" checked={dietReviewed} onChange={e=>setDietReviewed(e.target.checked)}/> Conferi a dieta preparada e os ingredientes em relação às restrições do paciente.</label>
         <button type="button" className="hospital-primary-action w-full" disabled={loading||!dietReviewed||ingredients.length===0||!active.dietCode} onClick={()=>void execute('assembly.complete',{preparedDietCode:active.dietCode,ingredientCodes:ingredients})}>2. Confirmar montagem concluída</button>
        </div>}
        {active?.distributionState==='ASSEMBLED'&&<button type="button" className="hospital-primary-action w-full" disabled={loading} onClick={()=>void execute('assembly.check')}>3. Conferir segurança e liberar expedição</button>}
        {active?.distributionState==='CHECKED'&&<p className="rounded-xl bg-blue-50 p-3 text-sm text-[#285489]">Dieta conferida. Marque esta e as demais refeições prontas na lista à esquerda para enviar à distribuição.</p>}
        {active?.distributionState==='DISPATCHED'&&<p className="rounded-xl bg-blue-50 p-3 text-sm text-[#285489]">Dieta em rota. Marque as refeições expedidas para registrar o recebimento na unidade.</p>}
        {active?.distributionState==='RECEIVED'&&<fieldset className="space-y-3 rounded-xl border border-blue-100 bg-white p-4">
         <legend className="font-bold text-[#24466f]">4. Confirmar entrega no leito</legend>
         <p className="text-xs leading-5 text-slate-600">Antes de entregar, compare os dados com a pulseira ou ficha em papel. Nunca confirme apenas pelo número do leito.</p>
         <label className="grid gap-1 text-sm">Nome completo conferido no papel<input className="rounded-xl border border-slate-200 p-3" value={patientDisplayName} onChange={e=>setPatientDisplayName(e.target.value)} autoComplete="off" aria-label="Nome completo para entrega"/></label>
         {active.needsBirthDate?
          <label className="grid gap-1 text-sm">Data de nascimento conferida<input type="date" className="rounded-xl border border-slate-200 p-3" value={patientBirthDate} onChange={e=>setPatientBirthDate(e.target.value)} aria-label="Data de nascimento para entrega"/></label>:
          <label className="grid gap-1 text-sm">Identificador do cadastro antigo<input className="rounded-xl border border-slate-200 p-3" value={patientReferenceCode} onChange={e=>setPatientReferenceCode(e.target.value)} aria-label="Identificador do cadastro antigo"/><small className="text-amber-700">Registro antigo sem data de nascimento. Atualize o cadastro na unidade para usar nome e nascimento.</small></label>}
         <button type="button" className="hospital-primary-action w-full" disabled={loading||!identityValid||active.routeReconciliationRequired} onClick={()=>void execute('meal.deliver',{patientReferenceCode,patientBirthDate,patientDisplayName,identityMethod})}>Confirmar entrega individual no leito</button>
        </fieldset>}
       </>}
      <details className="rounded-xl border border-slate-200 bg-white p-3">
       <summary className="cursor-pointer text-sm font-bold text-slate-700">Outras ações de segurança e etiquetas</summary>
       <div className="mt-3 space-y-3">
        <label className="grid gap-1 text-xs">Formato da etiqueta<select value={format} onChange={e=>setFormat(e.target.value as '80mm'|'A6'|'A4')} className="rounded-xl border border-slate-200 p-2"><option value="80mm">80 mm</option><option value="A6">A6</option><option value="A4">A4</option></select></label>
        <button type="button" className="hospital-secondary-action" disabled={loading} onClick={()=>void printLabel()}>Abrir etiqueta para impressão</button>
        <label className="grid gap-1 text-xs">Motivo da ocorrência<input className="rounded-xl border border-slate-200 p-2" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
        <div className="flex flex-wrap gap-2">
         <button type="button" className="hospital-secondary-action" disabled={loading||!reason.trim()} onClick={()=>void execute('assembly.reopen',{reason})}>Reabrir conferência</button>
         <button type="button" className="hospital-secondary-action" disabled={loading||!reason.trim()} onClick={()=>void execute('meal.suspend',{reason})}>Suspender por segurança</button>
         <button type="button" className="hospital-secondary-action" disabled={loading||!reason.trim()} onClick={()=>void execute('meal.return',{reason})}>Registrar devolução</button>
         <button type="button" className="hospital-secondary-action" disabled={loading||!reason.trim()} onClick={()=>void execute('route.flag',{reason})}>Conferir nova rota</button>
         <button type="button" className="hospital-secondary-action" disabled={loading||!reason.trim()} onClick={()=>void execute('meal.cancel',{reason})}>Cancelar pedido</button>
        </div>
       </div>
      </details>
     </section>}
    </div>}
  </section>;
}
