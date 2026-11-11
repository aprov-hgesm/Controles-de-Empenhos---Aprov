'use client';

import {useCallback,useEffect,useState} from 'react';

type Status={
  mealId:string;mealStatus:string;distributionState:string;jobRevision:number|null;
  destinationUnitId:string|null;routeReconciliationRequired:boolean;mainMealAlert:string|null;
};
type Props={
  organizationId:string;
  unitId:string;
  mealIds:readonly string[];
  getAuthorization:()=>Promise<string>;
};
type Operation='assembly.start'|'assembly.complete'|'assembly.check'|'batch.dispatch'|'batch.receive'|'meal.deliver'|'meal.return'|'meal.cancel'|'route.flag';
type Failure={ok:false;error:{code:string;message:string}};
type Success<T>={ok:true;data:T};

export function DistributionView({organizationId,unitId,mealIds,getAuthorization}:Props){
  const [statuses,setStatuses]=useState<Record<string,Status>>({});
  const [selected,setSelected]=useState<string[]>([]);
  const [activeMeal,setActiveMeal]=useState(mealIds[0]||'');
  const [preparedDietCode,setPreparedDietCode]=useState('');
  const [ingredientCodes,setIngredientCodes]=useState('');
  const [patientReferenceCode,setPatientReferenceCode]=useState('');
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
      setMessage('Operação registrada no servidor. A entrega só é confirmada individualmente.');
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

  return <section aria-label="Distribuição de refeições hospitalares" className="space-y-5 rounded-2xl border border-slate-200 p-4 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Distribuição de refeições</h2><p className="text-sm text-slate-600">Montagem, conferência, expedição, recebimento e entrega são eventos distintos.</p></div>
      <button type="button" onClick={()=>void refresh()} disabled={loading} className="rounded border px-3 py-2">Atualizar</button>
    </header>

    {mealIds.length===0?<p role="status" className="rounded bg-slate-50 p-3">Nenhum pedido disponível para esta unidade.</p>:
      <div className="grid gap-2" role="group" aria-label="Pedidos">
        {mealIds.map(id=><div key={id} className="flex flex-wrap items-center gap-3 rounded border p-2">
          <input type="checkbox" aria-label={'Selecionar '+id} checked={selected.includes(id)} onChange={e=>toggle(id,e.target.checked)}/>
          <button type="button" onClick={()=>setActiveMeal(id)} aria-pressed={activeMeal===id} className="min-w-0 flex-1 break-all text-left text-sm font-medium">{id}</button>
          <span className="text-xs">{statuses[id]?.distributionState||'Carregando'}</span>
          {statuses[id]?.routeReconciliationRequired&&<strong className="text-sm text-red-700">Reconciliação de rota obrigatória</strong>}
        </div>)}
      </div>}

    {selected.length>0&&<div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{selected.length} pedidos selecionados</span>
      <button type="button" disabled={loading} onClick={()=>void execute('batch.dispatch',{mealIds:selected})} className="rounded border px-3 py-2">Expedir lote conferido</button>
      <button type="button" disabled={loading} onClick={()=>void execute('batch.receive',{mealIds:selected})} className="rounded border px-3 py-2">Registrar recebimento do lote</button>
    </div>}

    {activeMeal&&<div className="space-y-4">
      <div className="rounded bg-slate-50 p-3 text-sm">
        <p><strong>Pedido:</strong> {activeMeal}</p>
        <p><strong>Preparo:</strong> {current?.mealStatus||'Aguardando consulta'} | <strong>Distribuição:</strong> {current?.distributionState||'Aguardando consulta'}</p>
        {current?.mainMealAlert&&<p role="alert" className="font-medium text-amber-900">{current.mainMealAlert}</p>}
        {current?.routeReconciliationRequired&&<p role="alert" className="font-medium text-red-700">Localização alterada: não entregar no leito anterior.</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Código da dieta preparada
          <input value={preparedDietCode} onChange={e=>setPreparedDietCode(e.target.value)} maxLength={100} className="mt-1 w-full rounded border p-2"/>
        </label>
        <label className="text-sm">Ingredientes/restrições (códigos separados por vírgula)
          <input value={ingredientCodes} onChange={e=>setIngredientCodes(e.target.value)} className="mt-1 w-full rounded border p-2"/>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={loading} onClick={()=>void execute('assembly.start')} className="rounded border px-3 py-2">Iniciar montagem</button>
        <button type="button" disabled={loading} onClick={()=>void execute('assembly.complete',{preparedDietCode,ingredientCodes:ingredientCodes.split(',').map(s=>s.trim()).filter(Boolean)})} className="rounded border px-3 py-2">Concluir montagem</button>
        <button type="button" disabled={loading} onClick={()=>void execute('assembly.check')} className="rounded border px-3 py-2">Conferir segurança</button>
        <label className="text-sm">Formato da etiqueta
          <select value={format} onChange={e=>setFormat(e.target.value as '80mm'|'A6'|'A4')} className="ml-2 rounded border p-2"><option value="80mm">80 mm</option><option value="A6">A6</option><option value="A4">A4</option></select>
        </label>
        <button type="button" disabled={loading} onClick={()=>void printLabel()} className="rounded border px-3 py-2">Abrir etiqueta protegida</button>
      </div>

      <fieldset className="space-y-2 rounded border p-3">
        <legend className="font-semibold">Identificação positiva antes da entrega</legend>
        <p className="text-sm text-slate-600">Dois identificadores do paciente: código institucional e nome completo, nunca apenas o leito. O leitor tipo teclado pode preencher os campos; se indisponível, conferência manual.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Identificador institucional
            <input value={patientReferenceCode} onChange={e=>setPatientReferenceCode(e.target.value)} autoComplete="off" className="mt-1 w-full rounded border p-2"/>
          </label>
          <label className="text-sm">Nome completo do paciente
            <input value={patientDisplayName} onChange={e=>setPatientDisplayName(e.target.value)} autoComplete="off" className="mt-1 w-full rounded border p-2"/>
          </label>
        </div>
        <label className="text-sm">Método
          <select value={identityMethod} onChange={e=>setIdentityMethod(e.target.value as 'MANUAL'|'SCANNER')} className="ml-2 rounded border p-2"><option value="MANUAL">Conferência manual</option><option value="SCANNER">Leitor tipo teclado</option></select>
        </label>
        <button type="button" disabled={loading} onClick={()=>void execute('meal.deliver',{patientReferenceCode,patientDisplayName,identityMethod})} className="rounded bg-slate-900 px-3 py-2 text-white">Confirmar entrega individual</button>
      </fieldset>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="text-sm">Motivo obrigatório da ocorrência
          <input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded border p-2"/>
        </label>
        <button type="button" disabled={loading||!reason.trim()} onClick={()=>void execute('meal.cancel',{reason})} className="rounded border px-3 py-2">Cancelar</button>
        <button type="button" disabled={loading||!reason.trim()} onClick={()=>void execute('meal.return',{reason})} className="rounded border px-3 py-2">Devolver</button>
        <button type="button" disabled={loading||!reason.trim()} onClick={()=>void execute('route.flag',{reason})} className="rounded border px-3 py-2">Sinalizar nova rota</button>
      </div>
    </div>}

    {loading&&<p role="status">Processando operação autorizada…</p>}
    {message&&<p role="status" className="rounded border p-2 text-sm">{message}</p>}
    {error&&<p role="alert" className="rounded border border-red-500 p-2 text-sm">{error}</p>}
  </section>;
}
