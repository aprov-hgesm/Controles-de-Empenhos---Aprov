'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CatalogItem, SourceSupplier } from '../../../lib/company/suppliers/domain';
import type { CompanyUnit } from '../../../lib/company/contracts';
interface Props { getIdToken: () => Promise<string> }
type Api<T> = { ok: true; result: T } | { ok: false; code: string };
type Page<T> = { items:T[]; nextCursor:string|null };
const units: CompanyUnit[] = ['UN','KG','G','L','ML','CX','FD','M'];
export function CatalogWorkspace({getIdToken}:Props) {
  const [items,setItems]=useState<CatalogItem[]>([]);
  const [suppliers,setSuppliers]=useState<SourceSupplier[]>([]);
  const [sku,setSku]=useState('');const [title,setTitle]=useState('');const [description,setDescription]=useState('');
  const [canonicalUnit,setCanonicalUnit]=useState<CompanyUnit>('UN');const [purchaseUnit,setPurchaseUnit]=useState<CompanyUnit>('UN');
  const [supplierId,setSupplierId]=useState('');const [supplierSku,setSupplierSku]=useState('');
  const [numerator,setNumerator]=useState('1');const [denominator,setDenominator]=useState('1');
  const [price,setPrice]=useState('');const [quotedAt,setQuotedAt]=useState('');
  const [query,setQuery]=useState('');const [cursor,setCursor]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const request=useCallback(async <T,>(path:string,method='GET',payload?:unknown):Promise<T>=>{
    const token=await getIdToken();const result=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}: {})},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
    const data=await result.json() as Api<T>;
    if (!result.ok || !data.ok) throw new Error(data.ok?'REQUEST_FAILED':data.code);
    return data.result;
  },[getIdToken]);
  const refresh=useCallback(async(next='',q='')=>{
    setBusy(true);setMessage('');
    try {const page=await request<Page<CatalogItem>>(`/api/company/catalog?limit=20&cursor=${encodeURIComponent(next)}&q=${encodeURIComponent(q)}`);setItems(page.items);setCursor(page.nextCursor);}
    catch(error){setMessage(error instanceof Error?error.message:'Falha de consulta.');}finally{setBusy(false);}
  },[request]);
  useEffect(()=>{void refresh();void request<Page<SourceSupplier>>('/api/company/suppliers?limit=50').then(p=>setSuppliers(p.items)).catch(()=>setMessage('Não foi possível carregar a lista de fornecedores.'));},[request,refresh]);
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      if (price && (!/^\d+(\.\d{1,2})?$/.test(price) || !quotedAt)) throw new Error('Informe preço em reais com até 2 casas e data da cotação.');
      const amountCents=price?Number(price.split('.')[0])*100+Number((price.split('.')[1]||'').padEnd(2,'0')):null;
      if (amountCents!==null && !Number.isSafeInteger(amountCents)) throw new Error('Preço fora do limite.');
      const option=supplierId?[{sourceSupplierId:supplierId,supplierSku,packageLabel:'',purchaseUnit,conversion:{from:purchaseUnit,to:canonicalUnit,numerator:Number(numerator),denominator:Number(denominator)},estimatedLeadTimeDays:null,channel:suppliers.find(s=>s.id===supplierId)?.channels[0] || 'email',priceHistory:amountCents===null?[]:[{amountCents,currency:'BRL',quotedAt,validFrom:null,validUntil:null,basis:'quotation'}]}]:[];
      await request('/api/company/catalog','POST',{sku,title,description,canonicalUnit,sourcingOptions:option});
      setSku('');setTitle('');setDescription('');setPrice('');setSupplierSku('');await refresh('',query);setMessage('Produto incluído no catálogo.');
    } catch(error){setMessage(error instanceof Error?error.message:'Falha ao cadastrar.');}finally{setBusy(false);}
  }
  return <section aria-label="Catálogo empresarial" className="space-y-5"><header><h2 className="text-xl font-semibold">Catálogo empresarial</h2><p className="text-sm opacity-75">SKU canônico por empresa, múltiplas fontes e cotações históricas datadas. Valores não são preços atuais garantidos.</p></header>
    <form onSubmit={create} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">Cadastrar produto</h3>
      <label className="grid gap-1">SKU<input required className="rounded-lg border p-2" value={sku} onChange={e=>setSku(e.target.value)} /></label>
      <label className="grid gap-1">Nome do produto<input required className="rounded-lg border p-2" value={title} onChange={e=>setTitle(e.target.value)} /></label>
      <label className="grid gap-1">Descrição<input className="rounded-lg border p-2" value={description} onChange={e=>setDescription(e.target.value)} /></label>
      <label className="grid gap-1">Unidade canônica<select className="rounded-lg border p-2" value={canonicalUnit} onChange={e=>setCanonicalUnit(e.target.value as CompanyUnit)}>{units.map(u=><option key={u}>{u}</option>)}</select></label>
      <label className="grid gap-1">Fornecedor de origem (opcional)<select className="rounded-lg border p-2" value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.tradeName || s.legalName} {s.lifecycle!=='active'?'(não selecionável)':''}</option>)}</select></label>
      {supplierId && <><label className="grid gap-1">SKU do fornecedor<input className="rounded-lg border p-2" value={supplierSku} onChange={e=>setSupplierSku(e.target.value)} /></label><label className="grid gap-1">Unidade de compra<select className="rounded-lg border p-2" value={purchaseUnit} onChange={e=>setPurchaseUnit(e.target.value as CompanyUnit)}>{units.map(u=><option key={u}>{u}</option>)}</select></label><label className="grid gap-1">Numerador da conversão<input required type="number" min="1" className="rounded-lg border p-2" value={numerator} onChange={e=>setNumerator(e.target.value)} /></label><label className="grid gap-1">Denominador da conversão<input required type="number" min="1" className="rounded-lg border p-2" value={denominator} onChange={e=>setDenominator(e.target.value)} /></label><label className="grid gap-1">Preço cotado em R$ por unidade de compra<input inputMode="decimal" className="rounded-lg border p-2" value={price} onChange={e=>setPrice(e.target.value)} /></label><label className="grid gap-1">Data da cotação<input type="date" className="rounded-lg border p-2" value={quotedAt} onChange={e=>setQuotedAt(e.target.value)} /></label></>}
      <button disabled={busy} className="rounded-lg border px-4 py-2 sm:col-span-2">Cadastrar produto</button>
    </form>
    <div className="flex gap-2"><label className="flex-1">Buscar catálogo<input className="mt-1 w-full rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)} /></label><button disabled={busy} className="self-end rounded-lg border px-4 py-2" onClick={()=>void refresh('',query)}>Buscar</button></div>
    {message && <p role="status">{message}</p>}{busy && <p role="status">Carregando…</p>}{!busy && items.length===0 && <p>Nenhum item nesta página.</p>}
    <ul className="grid gap-3">{items.map(p=><li key={p.id} className="rounded-xl border p-4"><strong>{p.sku} — {p.title}</strong><p className="text-sm">{p.description || 'Sem descrição'} · {p.canonicalUnit} · {p.sourcingOptions.length} referências de origem</p>{p.sourcingOptions.map((o,i)=><p key={i} className="text-sm opacity-75">Fornecedor {o.sourceSupplierId} · {o.purchaseUnit} → {o.conversion.numerator}/{o.conversion.denominator} {p.canonicalUnit} · {o.priceHistory.length} cotação(ões) histórica(s)</p>)}</li>)}</ul>
    {cursor && <button disabled={busy} className="rounded-lg border px-4 py-2" onClick={()=>void refresh(cursor,query)}>Próxima página</button>}
  </section>;
}
