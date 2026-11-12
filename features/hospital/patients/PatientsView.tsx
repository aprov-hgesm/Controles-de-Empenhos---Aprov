'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import type {Admission,Patient} from '../core/contracts';

type Episode=Admission & {plannedDischargeAt?:string|null,temporaryUnitId?:string|null,medicalReferenceId?:string|null};
type Row={patient:Patient & {unitId:string,revision:number,birthDate?:string|null},admission:Episode|null,bedLabel:string,medicalReferenceId:string|null};
type Bed={id:string,label:string,active:boolean,occupied:boolean};
type Event={id:string,revision:number,toUnitId:string,toBedId?:string|null,status:string};
type Result<T>={ok:true,data:T}|{ok:false,error:{code:string,message:string}};
export interface PatientsViewProps {
  organizationId:string;
  unitId:string;
  getIdToken:()=>Promise<string>;
  endpoint?:string;
}
const inputClass='min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#19365c] shadow-sm';
const actionClass='rounded-xl border border-blue-200 bg-[#1049ad] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#073a96] disabled:opacity-50';
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
  const [birthDate,setBirthDate]=useState('');
  const [newBed,setNewBed]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [showNew,setShowNew]=useState(false);
  const [editName,setEditName]=useState('');
  const [editBirthDate,setEditBirthDate]=useState('');
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
    setEditName(row.patient.displayName??'');setEditBirthDate(row.patient.birthDate??'');setChosenBed(row.admission?.bedId??'');
    if(row.admission) try{
      const events=await request<typeof history>('admission.history',{unitId,admissionId:row.admission.id});
      setHistory(events);
    }catch{setHistory([]);}
  };
  const submitNew=async(e:FormEvent)=>{
    e.preventDefault();
    setSaving(true);setError('');setNotice('');
    let created:Patient|null=null;
    try{
      created=await request<Patient>('patient.register',{unitId,displayName,birthDate});
      if(newBed)await request<Admission>('admission.admit',{unitId,patientId:created.id,bedId:newBed});
      setNotice(newBed?'Paciente cadastrado e admitido no leito.':'Paciente cadastrado. Selecione-o na lista para registrar o leito.');
      setBirthDate('');setDisplayName('');setNewBed('');setShowNew(false);
      await reload();
    }catch(e){
      setError(e instanceof Error?e.message:'Não foi possível cadastrar o paciente');
      if(created){setNotice('Cadastro realizado, mas o leito não foi confirmado. Selecione o paciente na lista para concluir.');await reload();}
    }finally{setSaving(false);}
  };
  const current=rows.find(r=>r.patient.id===selected?.patient.id && r.admission?.id===selected?.admission?.id)??selected;
  const active=current?.admission?.status==='ACTIVE';
  return <section className="hospital-panel space-y-5 p-4 text-sm sm:p-6" aria-label="Pacientes da unidade">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="space-y-1">
      <h2 className="text-xl font-extrabold tracking-tight text-[#17375f]">Pacientes e internações</h2>
      <p className="text-sm text-slate-500">Unidade {unitId} · Cadastro e movimentações auditáveis. Previsões não suspendem refeições.</p>
     </div><button type="button" className="hospital-primary-action" aria-expanded={showNew} onClick={()=>setShowNew(open=>!open)}>{showNew?'Fechar cadastro':'+ Novo paciente'}</button></header>
    {showNew&&<form onSubmit={e=>void submitNew(e)} className="grid gap-3 rounded-2xl border border-sky-100 bg-[#f6f9ff] p-4 sm:grid-cols-3" aria-label="Cadastro rápido de paciente">
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Nome completo
       <input required maxLength={160} className={inputClass} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Conforme identificação do paciente" aria-label="Nome do paciente"/>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Data de nascimento
       <input required type="date" className={inputClass} value={birthDate} onChange={e=>setBirthDate(e.target.value)} aria-label="Data de nascimento"/>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Número do leito · {unitId}
       <select className={inputClass} value={newBed} onChange={e=>setNewBed(e.target.value)} aria-label="Número do leito"><option value="">Informar depois</option>{beds.filter(b=>b.active&&!b.occupied).map(b=><option key={b.id} value={b.id}>Leito {b.label}</option>)}</select>
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">Sem números de cadastro para digitar. O sistema gera os identificadores internos. Nome e nascimento devem ser conferidos com o papel.</p>
      <button disabled={saving||!birthDate||!displayName.trim()} className={actionClass} type="submit">Cadastrar paciente</button>
    </form>}
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50/90 p-3">
      <input className={inputClass+" flex-1"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou leito" aria-label="Pesquisar pacientes"/>
      <select className={inputClass} aria-label="Situação da internação" value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="ACTIVE">Internados</option><option value="DISCHARGED">Altas</option><option value="ALL">Todos</option>
      </select>
      <button className={actionClass} onClick={()=>void reload()} disabled={loading} type="button">Atualizar</button>
      <span className="text-slate-500" role="status">{loading?'Carregando…':total+' registro(s)'}</span>
    </div>
    {error&&<div role="alert" className="rounded border border-red-500 p-2 text-red-700">{error}</div>}
    {notice&&<div role="status" className="rounded border border-emerald-500 p-2">{notice}</div>}
    {!loading&&rows.length===0&&<p role="status">Nenhum paciente encontrado para este filtro.</p>}
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {rows.map((r,i)=><li key={r.patient.id+'-'+(r.admission?.id??i)}>
        <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 p-3.5 text-left hover:bg-[#f1f6ff] focus-visible:outline" onClick={()=>void select(r)}>
          <strong className="font-semibold text-[#153b74]">{r.patient.displayName||'Paciente sem nome'}</strong>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{unitId} · {r.bedLabel?'Leito '+r.bedLabel:'Sem leito'} · {r.admission?.status==='ACTIVE'?'Internado':r.admission?.status==='DISCHARGED'?'Alta registrada':'Sem internação'}</span>
        </button>
      </li>)}
    </ul>
    <nav className="flex items-center gap-3" aria-label="Paginação">
      <button className={actionClass} disabled={!page||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button>
      <span>Página {page+1}</span>
      <button className={actionClass} disabled={(page+1)*20>=total||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button>
    </nav>
    {current&&<article className="space-y-4 rounded-2xl border border-blue-100 bg-[#fbfdff] p-4 sm:p-5" aria-label="Detalhes do paciente">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[#173b6a]">{current.patient.displayName||current.patient.referenceCode}</h2>
        <button type="button" onClick={()=>setSelected(null)}>Fechar</button>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer font-semibold text-[#234d87]">Corrigir nome ou data de nascimento</summary>
       <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="grid gap-1 text-xs">Nome completo<input className={inputClass} value={editName} onChange={e=>setEditName(e.target.value)} aria-label="Editar nome"/></label>
        <label className="grid gap-1 text-xs">Nascimento<input type="date" className={inputClass} value={editBirthDate} onChange={e=>setEditBirthDate(e.target.value)} aria-label="Editar nascimento"/></label>
        <button type="button" className={actionClass} disabled={saving||!editBirthDate} onClick={()=>void act('patient.update',{patientId:current.patient.id,displayName:editName,birthDate:editBirthDate,expectedRevision:current.patient.revision})}>Salvar correção</button>
       </div>
      </details>
      <p className="text-sm text-slate-600"><strong>Prescrição no mapa:</strong> {current.medicalReferenceId?'Referência registrada':'Ainda não informada'}.</p>
      {!current.admission&&<div className="flex flex-wrap gap-2">
        <select className={inputClass} value={chosenBed} onChange={e=>setChosenBed(e.target.value)} aria-label="Leito de admissão">
          <option value="">Sem leito</option>{beds.filter(b=>b.active&&!b.occupied).map(b=><option key={b.id} value={b.id}>Leito {b.label}</option>)}
        </select>
        <button className={actionClass} disabled={saving} onClick={()=>void act('admission.admit',{patientId:current.patient.id,bedId:chosenBed||null})}>Admitir</button>
      </div>}
      {current.admission&&<div className="space-y-2">
        <p>Internação {current.admission.id} · {current.admission.status} · revisão {current.admission.revision}</p>
        {active&&<details className="group rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer py-2 font-bold text-[#1b4b91]">Movimentação, transferência e alta — abrir ações</summary><div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className={inputClass} value={chosenBed} onChange={e=>setChosenBed(e.target.value)} aria-label="Trocar leito">
              <option value="">Sem leito</option>{beds.filter(b=>b.active&&(!b.occupied||b.id===current.admission?.bedId)).map(b=><option key={b.id} value={b.id}>Leito {b.label}</option>)}
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
        </div></details>}
        <details className="rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer font-semibold">Histórico de alterações</summary><ul>{history.map(e=><li key={e.id}>{e.occurredAt} · {e.eventType} · {e.actorUid}</li>)}</ul></details>
      </div>}
    </article>}
  </section>;
}
export default PatientsView;
