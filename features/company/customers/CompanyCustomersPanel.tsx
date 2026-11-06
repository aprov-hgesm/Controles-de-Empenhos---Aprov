'use client';
import { useCallback, useEffect, useState } from 'react';
import { companyApi, companyList } from './apiClient';
import type { PublicCustomer } from '../../../lib/company/customers/model';

export function CompanyCustomersPanel() {
  const [items,setItems]=useState<PublicCustomer[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [name,setName]=useState(''),[kind,setKind]=useState<PublicCustomer['kind']>('military_organization');
  const [ug,setUg]=useState(''),[uasg,setUasg]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=useCallback(async(next?:string)=>{
    setBusy(true);setError('');
    try {
      const result=await companyList<PublicCustomer>('customers?limit=20'+(next?'&cursor='+encodeURIComponent(next):''));
      setItems(old=>next?[...old,...result.items]:result.items);
      setCursor(result.nextCursor);
    } catch(e){setError(e instanceof Error?e.message:'Erro ao consultar clientes.');}
    finally {setBusy(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      await companyApi('customers','POST',{kind,name,ug:ug||undefined,uasg:uasg||undefined,
        addresses:[],contacts:[]});
      setName('');setUg('');setUasg('');setNotice('Cliente registrado.');await load();
    } catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar.');}
    finally {setBusy(false);}
  }
  return <section className="space-y-5" aria-label="Clientes públicos">
    <header><h2 className="text-xl font-semibold">Clientes públicos</h2>
      <p className="text-sm text-slate-500">OMs e órgãos compradores — UG/UASG são somente atributos, nunca contas de acesso.</p></header>
    <form onSubmit={create} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
      <label className="text-sm">Nome da OM ou órgão
        <input className="mt-1 w-full rounded-md border p-2" required maxLength={180} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label className="text-sm">Tipo
        <select className="mt-1 w-full rounded-md border p-2" value={kind} onChange={e=>setKind(e.target.value as PublicCustomer['kind'])}>
          <option value="military_organization">Organização Militar</option><option value="public_agency">Órgão público</option></select></label>
      <label className="text-sm">UG (opcional)
        <input className="mt-1 w-full rounded-md border p-2" inputMode="numeric" value={ug} onChange={e=>setUg(e.target.value)}/></label>
      <label className="text-sm">UASG (opcional)
        <input className="mt-1 w-full rounded-md border p-2" inputMode="numeric" value={uasg} onChange={e=>setUasg(e.target.value)}/></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">Cadastrar cliente</button>
    </form>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    <ul className="divide-y rounded-xl border bg-white">
      {items.map(i=><li key={i.id} className="flex flex-wrap justify-between gap-3 p-3 text-sm">
        <span><strong>{i.name}</strong><span className="ml-2 text-slate-500">{i.ug?'UG '+i.ug:''}</span></span>
        <code className="select-all text-xs text-slate-500">{i.id}</code></li>)}
      {!items.length&&<li className="p-4 text-sm text-slate-500">Nenhum cliente cadastrado.</li>}
    </ul>
    {cursor&&<button disabled={busy} onClick={()=>void load(cursor)} className="rounded-lg border px-4 py-2 text-sm">Carregar mais</button>}
  </section>;
}
