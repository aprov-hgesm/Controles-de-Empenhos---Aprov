'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import type {Admission,Patient} from '../core/contracts';

type Episode=Admission & {plannedDischargeAt?:string|null,temporaryUnitId?:string|null,medicalReferenceId?:string|null};
type Row={patient:Patient & {unitId:string,revision:number},admission:Episode|null,bedLabel:string,medicalReferenceId:string|null};
type Bed={id:string,label:string,active:boolean,occupied:boolean};
type Event={id:string,revision:number,toUnitId:string,toBedId?:string|null,status:string};
type Result<T>={ok:true,data:T}|{ok:false,error:{code:string,message:string}};
export interface PatientsViewProps {
  organizationId:string;
  unitId:string;
  getIdToken:()=>Promise<string>;
  endpoint?:string;
}
const inputClass='rounded border border-slate-300 bg-white p-2 text-slate-900';
const actionClass='rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50';
export function PatientsView({organizationId,unitId,getIdToken,endpoint='/api/hospital/patients'}:PatientsViewProps) {
  const [rows,setRows]=useState<Row[]>([]);
  const [beds,setBeds]=useState<Bed[]>([]);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('ACTIVE');
  const [page,setPage]=useState(0);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [selected,setSelected]=useState<Row|null>(null);
  const [history,setHistory]=useState<Array<{id:number,eventType:string,occurredAt:string,actorUid:string}>>([]);
  const [referenceCode,setReferenceCode]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [editName,setEditName]=useState('');
  const [chosenBed,setChosenBed]=useState('');
  const [transferUnit,setTransferUnit]=useState('');
  const [transferBed,setTransferBed]=useState('');
  const [pendingTransfer,setPendingTransfer]=useState<Event|null>(null);
  const [plannedAt,setPlannedAt]=useState('');
  const [temporaryUnit,setTemporaryUnit]=useState('');

  const request=useCallback(async<T,>(operation:string,payload:Record<string,unknown>={})=>{
    const token=await getIdToken();
    const response=await fetch(endpoint,{
      method:'POST',cache:'no-store',
      headers:{'content-type':'application/json',authorization:'Bearer '+token,'x-hospital-organization-id':organizationId},
      body:JSON.stringify({operation,payload})
    });
    let data:Result<T>;
    try {data=await response.json() as Result<T>;}catch{throw Error('Resposta inválida do servidor');}
    if(!data.ok) throw Error(data.error.message);
    return data.data;
  },[endpoint,getIdToken,organizationId]);

  const reload=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [result,list]=await Promise.all([
        request<{items:Row[],total:number}>('patient.search',{unitId,q:search,status,limit:20,offset:page*20}),
        request<Bed[]>('bed.list',{unitId})
      ]);
      setRows(result.items);setTotal(result.total);setBeds(list);
    }catch(e){setError(e instanceof Error?e.message:'Erro ao carregar pacientes');}
    finally{setLoading(false);}
  },[request,unitId,search,status,page]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{setPage(0);},[search,status,unitId]);
  const act=async<T,>(op:string,payload:Record<string,unknown>,after?:(v:T)=>void)=>{
    setSaving(true);setError('');setNotice('');
    try{const value=await request<T>(op,{unitId,...payload});after?.(value);setNotice('Operação registrada com autoria e horário.');await reload();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a operação');}
    finally{setSaving(false);}
  };
  const select=async(row:Row)=>{
    setSelected(row);setPendingTransfer(null);setHistory([]);
    setEditName(row.patient.displayName??'');setChosenBed(row.admission?.bedId??'');
    if(row.admission) try{
      const events=await request<typeof history>('admission.history',{unitId,admissionId:row.admission.id});
      setHistory(events);
    }catch{setHistory([]);}
  };
  const submitNew=(e:FormEvent)=>{
    e.preventDefault();
    void act<Patient>('patient.register',{referenceCode,displayName},()=>{
      setReferenceCode('');setDisplayName('');
    });
  };
  const current=rows.find(r=>r.patient.id===selected?.patient.id && r.admission?.id===selected?.admission?.id)??selected;
  const active=current?.admission?.status==='ACTIVE';
  return <section className="space-y-4 p-4 text-sm" aria-label="Pacientes da unidade">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold">Pacientes e internações</h1>
      <p className="text-slate-600">Unidade {unitId}. Cadastro e movimentações não substituem prescrição médica. A previsão não suspende refeições.</p>
    </header>
    <form onSubmit={submitNew} className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_1fr_auto]" aria-label="Cadastro rápido de paciente">
      <input required maxLength={80} className={inputClass} value={referenceCode} onChange={e=>setReferenceCode(e.target.value)} placeholder="Identificador institucional" aria-label="Identificador institucional"/>
      <input required maxLength={160} className={inputClass} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Nome do paciente" aria-label="Nome do paciente"/>
      <button disabled={saving} className={actionClass} type="submit">Cadastrar</button>
    </form>
    <div className="flex flex-wrap items-center gap-2">
      <input className={inputClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, identificação ou leito" aria-label="Pesquisar pacientes"/>
      <select className={inputClass} aria-label="Situação da internação" value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="ACTIVE">Internados</option><option value="DISCHARGED">Altas</option><option value="ALL">Todos</option>
      </select>
      <button className={actionClass} onClick={()=>void reload()} disabled={loading} type="button">Atualizar</button>
      <span className="text-slate-500" role="status">{loading?'Carregando…':total+' registro(s)'}</span>
    </div>
    {error&&<div role="alert" className="rounded border border-red-500 p-2 text-red-700">{error}</div>}
    {notice&&<div role="status" className="rounded border border-emerald-500 p-2">{notice}</div>}
    {!loading&&rows.length===0&&<p role="status">Nenhum paciente encontrado para este filtro.</p>}
    <ul className="divide-y rounded border">
      {rows.map((r,i)=><li key={r.patient.id+'-'+(r.admission?.id??i)}>
        <button type="button" className="w-full p-3 text-left hover:bg-slate-100 focus-visible:outline" onClick={()=>void select(r)}>
          <strong>{r.patient.displayName||'Paciente sem nome'}</strong>
          <span className="ml-2 text-slate-600">{r.patient.referenceCode} · {r.bedLabel||'Sem leito'} · {r.admission?.status??'Sem internação'}</span>
        </button>
      </li>)}
    </ul>
    <nav className="flex items-center gap-3" aria-label="Paginação">
      <button className={actionClass} disabled={!page||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button>
      <span>Página {page+1}</span>
      <button className={actionClass} disabled={(page+1)*20>=total||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button>
    </nav>
    {current&&<article className="space-y-3 rounded border p-3" aria-label="Detalhes do paciente">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{current.patient.displayName||current.patient.referenceCode}</h2>
        <button type="button" onClick={()=>setSelected(null)}>Fechar</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={inputClass} value={editName} onChange={e=>setEditName(e.target.value)} aria-label="Editar nome"/>
        <button className={actionClass} disabled={saving} onClick={()=>void act('patient.update',{patientId:current.patient.id,displayName:editName,expectedRevision:current.patient.revision})}>Salvar identificação</button>
      </div>
      <p><strong>Referência de dieta:</strong> {current.medicalReferenceId??'Ainda não vinculada (integração W3)'}.</p>
      {!current.admission&&<div className="flex flex-wrap gap-2">
        <select className={inputClass} value={chosenBed} onChange={e=>setChosenBed(e.target.value)} aria-label="Leito de admissão">
          <option value="">Sem leito</option>{beds.filter(b=>b.active&&!b.occupied).map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <button className={actionClass} disabled={saving} onClick={()=>void act('admission.admit',{patientId:current.patient.id,bedId:chosenBed||null})}>Admitir</button>
      </div>}
      {current.admission&&<div className="space-y-2">
        <p>Internação {current.admission.id} · {current.admission.status} · revisão {current.admission.revision}</p>
        {active&&<>
          <div className="flex flex-wrap gap-2">
            <select className={inputClass} value={chosenBed} onChange={e=>setChosenBed(e.target.value)} aria-label="Trocar leito">
              <option value="">Sem leito</option>{beds.filter(b=>b.active&&(!b.occupied||b.id===current.admission?.bedId)).map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <button className={actionClass} disabled={saving} onClick={()=>void act('admission.changeBed',{admissionId:current.admission?.id,toBedId:chosenBed||null,expectedRevision:current.admission?.revision})}>Atualizar leito</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input className={inputClass} value={transferUnit} onChange={e=>setTransferUnit(e.target.value)} placeholder="ID unidade de destino" aria-label="Unidade de destino"/>
            <input className={inputClass} value={transferBed} onChange={e=>setTransferBed(e.target.value)} placeholder="ID leito de destino (opcional)" aria-label="Leito de destino"/>
            <button className={actionClass} disabled={saving||!transferUnit} onClick={()=>void act<Event>('admission.planTransfer',{admissionId:current.admission?.id,toUnitId:transferUnit,toBedId:transferBed||null},setPendingTransfer)}>Prever transferência</button>
            {pendingTransfer&&<><button className={actionClass} disabled={saving} onClick={()=>void act('admission.confirmTransfer',{eventId:pendingTransfer.id,expectedRevision:pendingTransfer.revision,admissionRevision:current.admission?.revision},()=>setPendingTransfer(null))}>Confirmar transferência</button>
              <button className={actionClass} disabled={saving} onClick={()=>void act('admission.cancelTransfer',{eventId:pendingTransfer.id,expectedRevision:pendingTransfer.revision},()=>setPendingTransfer(null))}>Cancelar previsão</button></>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input className={inputClass} value={temporaryUnit} onChange={e=>setTemporaryUnit(e.target.value)} placeholder="Destino temporário" aria-label="Destino temporário"/>
            {!current.admission.temporaryUnitId
              ?<button className={actionClass} disabled={saving||!temporaryUnit} onClick={()=>void act('admission.temporaryDeparture',{admissionId:current.admission?.id,toUnitId:temporaryUnit,expectedRevision:current.admission?.revision})}>Saída temporária</button>
              :<button className={actionClass} disabled={saving} onClick={()=>void act('admission.temporaryReturn',{admissionId:current.admission?.id,expectedRevision:current.admission?.revision})}>Registrar retorno</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="datetime-local" className={inputClass} value={plannedAt} onChange={e=>setPlannedAt(e.target.value)} aria-label="Previsão de alta"/>
            <button className={actionClass} disabled={saving||!plannedAt} onClick={()=>void act('admission.planDischarge',{admissionId:current.admission?.id,plannedAt:new Date(plannedAt).toISOString(),expectedRevision:current.admission?.revision})}>Prever alta</button>
            {current.admission.plannedDischargeAt&&<button className={actionClass} disabled={saving} onClick={()=>void act('admission.cancelDischarge',{admissionId:current.admission?.id,expectedRevision:current.admission?.revision})}>Cancelar previsão</button>}
            <button className="rounded border border-red-500 px-3 py-2 text-red-700" disabled={saving} onClick={()=>{if(window.confirm('Confirmar alta efetiva? Refeições pendentes serão suspensas.'))void act('admission.confirmDischarge',{admissionId:current.admission?.id,expectedRevision:current.admission?.revision});}}>Confirmar alta</button>
          </div>
        </>}
        <details><summary>Histórico de alterações</summary><ul>{history.map(e=><li key={e.id}>{e.occurredAt} · {e.eventType} · {e.actorUid}</li>)}</ul></details>
      </div>}
    </article>}
  </section>;
}
export default PatientsView;
