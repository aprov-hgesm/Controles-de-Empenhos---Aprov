'use client';
import { useCallback, useEffect, useState } from 'react';
import { companyApi, companyList } from '../customers/apiClient';
import type { Commitment } from '../../../lib/company/customers/model';

export function CompanyCommitmentsPanel() {
  const [items,setItems]=useState<Commitment[]>([]);
  const [customerId,setCustomerId]=useState(''),[neNumber,setNeNumber]=useState('');
  const [fiscalYear,setFiscalYear]=useState(new Date().getFullYear()),[description,setDescription]=useState('');
  const [qty,setQty]=useState('1'),[unit,setUnit]=useState<'UN'|'KG'|'G'|'L'|'ML'|'CX'|'FD'|'M'>('UN');
  const [price,setPrice]=useState('0'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{
    try {setItems((await companyList<Commitment>('commitments?limit=50')).items);}
    catch(e){setError(e instanceof Error?e.message:'Falha ao consultar empenhos.');}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      await companyApi('commitments','POST',{publicCustomerId:customerId,neNumber,fiscalYear,
        extractionSource:'manual',lines:[{id:'item-1',description,
          quantity:{value:qty,unit},salePrice:{amountCents:Number(price),currency:'BRL'}}]});
      setNeNumber('');setDescription('');await load();
    } catch(e){setError(e instanceof Error?e.message:'Falha ao cadastrar NE.');}
    finally {setBusy(false);}
  }
  return <section className="space-y-4" aria-label="Notas de empenho">
    <h2 className="text-xl font-semibold">Notas de Empenho da OM</h2>
    <p className="text-sm text-slate-500">Registro revisado manualmente; pedido efetivo da OM é uma entidade distinta.</p>
    <form onSubmit={create} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
      {([['ID do cliente',customerId,setCustomerId],['Número da NE',neNumber,setNeNumber],
        ['Descrição do item',description,setDescription],['Quantidade',qty,setQty],
        ['Preço de venda (centavos)',price,setPrice]] as const).map(([label,value,set])=>
        <label key={label} className="text-sm">{label}
          <input required className="mt-1 w-full rounded-md border p-2" value={value}
            onChange={e=>set(e.target.value)}/></label>)}
      <label className="text-sm">Exercício
        <input type="number" min="2000" max="2100" className="mt-1 w-full rounded-md border p-2"
          value={fiscalYear} onChange={e=>setFiscalYear(Number(e.target.value))}/></label>
      <label className="text-sm">Unidade
        <select value={unit} className="mt-1 w-full rounded-md border p-2" onChange={e=>setUnit(e.target.value as typeof unit)}>
          {['UN','KG','G','L','ML','CX','FD','M'].map(u=><option key={u} value={u}>{u}</option>)}</select></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Registrar NE</button>
    </form>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <ul className="divide-y rounded-xl border bg-white">{items.map(i=><li key={i.id} className="p-3 text-sm">
      <strong>{i.neNumber}</strong> · {i.fiscalYear} · {i.lines.length} item(ns)
      <p className="select-all text-xs text-slate-500">NE ID: {i.id} · Cliente: {i.publicCustomerId}</p>
      {i.lines.map(line=><p key={line.id} className="text-xs text-slate-500">{line.id}: {line.description} — solicitado {line.orderedQuantity.value} / {line.quantity.value} {line.quantity.unit}</p>)}
    </li>)}</ul>
  </section>;
}
