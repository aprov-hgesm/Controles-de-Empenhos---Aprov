'use client';
import { useCallback, useEffect, useState } from 'react';
import { companyApi, companyList } from '../customers/apiClient';
import type { CustomerOrder } from '../../../lib/company/customers/model';

export function CompanyOrdersPanel() {
  const [items,setItems]=useState<CustomerOrder[]>([]);
  const [customer,setCustomer]=useState(''),[ne,setNe]=useState(''),[reference,setReference]=useState('');
  const [line,setLine]=useState('item-1'),[qty,setQty]=useState('1'),[unit,setUnit]=useState('UN');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{
    try {setItems((await companyList<CustomerOrder>('customer-orders?limit=50')).items);}
    catch(e){setError(e instanceof Error?e.message:'Falha ao consultar pedidos.');}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      await companyApi('customer-orders','POST',{publicCustomerId:customer,commitmentId:ne,
        reference,lines:[{id:'pedido-1',commitmentLineId:line,quantity:{value:qty,unit}}]});
      setReference('');await load();
    } catch(e){setError(e instanceof Error?e.message:'Falha ao cadastrar pedido.');}
    finally {setBusy(false);}
  }
  return <section className="space-y-4" aria-label="Pedidos de organizações militares">
    <h2 className="text-xl font-semibold">Pedidos das OMs</h2>
    <p className="text-sm text-slate-500">Uma NE pode atender vários pedidos. O sistema impede que a soma dos pedidos ultrapasse a quantidade empenhada.</p>
    <form onSubmit={create} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
      {([['ID do cliente',customer,setCustomer],['ID da NE',ne,setNe],['Referência do pedido',reference,setReference],
        ['Linha da NE',line,setLine],['Quantidade do pedido',qty,setQty]] as const).map(([label,value,set])=>
        <label key={label} className="text-sm">{label}
          <input required className="mt-1 w-full rounded-md border p-2" value={value} onChange={e=>set(e.target.value)}/></label>)}
      <label className="text-sm">Unidade
        <select className="mt-1 w-full rounded-md border p-2" value={unit} onChange={e=>setUnit(e.target.value)}>
          {['UN','KG','G','L','ML','CX','FD','M'].map(u=><option key={u}>{u}</option>)}</select></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Registrar pedido</button>
    </form>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <ul className="divide-y rounded-xl border bg-white">{items.map(i=><li key={i.id} className="p-3 text-sm">
      <strong>{i.reference}</strong> · {i.fulfillmentState}
      <p className="select-all text-xs text-slate-500">Pedido: {i.id} · NE: {i.commitmentId}</p>
      {i.lines.map(l=><p key={l.id} className="text-xs text-slate-500">{l.description}: {l.quantity.value} {l.quantity.unit} · {l.salePrice.amountCents} centavos/un.</p>)}
    </li>)}</ul>
  </section>;
}
