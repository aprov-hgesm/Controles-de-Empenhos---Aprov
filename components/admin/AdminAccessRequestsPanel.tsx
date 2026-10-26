'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';

type LeadStatus = 'novo' | 'contatado' | 'em_teste' | 'concluido' | 'descartado';
type Lead = {
  id:string; nomeCompleto:string; patente:string; organizacaoMilitar:string;
  email:string; whatsapp:string; status:LeadStatus; createdAt:string; version:string;
};
const statuses: Array<{value:LeadStatus;label:string}> = [
  {value:'novo',label:'Novo'}, {value:'contatado',label:'Contatado'},
  {value:'em_teste',label:'Em teste'}, {value:'concluido',label:'Concluído'},
  {value:'descartado',label:'Descartado'},
];
export function AdminAccessRequestsPanel({adminUser}:{adminUser:User}) {
  const [records,setRecords]=useState<Lead[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState('');
  const reload=useCallback(async()=>{
    setError('');setLoading(true);
    try {
      const token=await adminUser.getIdToken();
      const response=await fetch('/api/admin/access-requests',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const body=await response.json();
      if(!response.ok || body.ok!==true)throw new Error(body.error||'Falha ao consultar solicitações.');
      setRecords(body.records);
    } catch(err) { setError(err instanceof Error?err.message:'Falha ao consultar solicitações.'); }
    finally { setLoading(false); }
  },[adminUser]);
  useEffect(()=>{void reload();},[reload]);
  const visible=useMemo(()=>records.filter(r=>
    [r.nomeCompleto,r.patente,r.organizacaoMilitar,r.email].join(' ').toLowerCase().includes(query.toLowerCase())
  ),[records,query]);
  const update=async (lead:Lead,status:LeadStatus)=>{
    setBusy(lead.id);setError('');
    try {
      const token=await adminUser.getIdToken();
      const res=await fetch('/api/admin/access-requests',{
        method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({id:lead.id,status,version:lead.version}),
      });
      const data=await res.json();
      if(!res.ok||!data.ok)throw new Error(data.error||'Não foi possível atualizar.');
      await reload();
    } catch(err){setError(err instanceof Error?err.message:'Não foi possível atualizar.');}
    finally {setBusy('');}
  };
  return (
    <section className="rounded-3xl border border-[#d4e3f4] bg-white p-5 text-[#17375e] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-xl font-bold">Solicitações de acesso</h3>
          <p className="text-xs text-[#597390]">Interessados recebidos pelo site institucional.</p></div>
        <button type="button" onClick={()=>void reload()} disabled={loading}
          className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Atualizar</button>
      </div>
      <label htmlFor="lead-query" className="mt-6 block text-xs font-semibold">Buscar interessado</label>
      <input id="lead-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, posto, OM ou e-mail"
        className="mt-1 w-full rounded-lg border border-[#b4c9dc] bg-white p-3 text-sm text-[#17375e]"/>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {loading?<p className="mt-5 text-sm">Carregando...</p>:(
        <div className="mt-5 space-y-3">
        {visible.length===0&&<p className="text-sm">Nenhuma solicitação encontrada.</p>}
        {visible.map(item=>(
          <article key={item.id} className="rounded-xl border border-[#d4e3f4] bg-[#f5f9fd] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h4 className="font-bold">{item.nomeCompleto}</h4>
                <p className="text-sm">{item.patente} · {item.organizacaoMilitar}</p>
                <p className="mt-1 text-xs text-[#597390]">{item.createdAt?new Date(item.createdAt).toLocaleString('pt-BR'):''}</p></div>
              <label className="text-xs font-semibold">Situação
                <select aria-label={'Situação de '+item.nomeCompleto} value={item.status}
                  onChange={e=>void update(item,e.target.value as LeadStatus)}
                  disabled={busy===item.id}
                  className="mt-1 block rounded-lg border border-[#b4c9dc] bg-white px-2 py-2 text-sm">
                  {statuses.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <a className="underline" href={'mailto:'+item.email}>{item.email}</a>
              <a className="underline" href={'https://wa.me/'+item.whatsapp.replace(/\D/g,'')}
                 target="_blank" rel="noopener noreferrer">WhatsApp: {item.whatsapp}</a>
            </div>
          </article>
        ))}
        </div>
      )}
    </section>
  );
}
