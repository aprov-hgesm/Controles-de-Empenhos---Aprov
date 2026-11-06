'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SourceSupplier, SupplierLifecycle } from '../../../lib/company/suppliers/domain';

type Api<T> = { ok: true; result: T } | { ok: false; code: string };
type Page<T> = { items: T[]; nextCursor: string | null };
interface Props { getIdToken: () => Promise<string> }
const empty = { legalName: '', tradeName: '', cnpj: '', email: '', phone: '', contactName: '', terms: '', leadTime: '', lifecycle: 'active' as SupplierLifecycle };
export function SourceSuppliersWorkspace({ getIdToken }: Props) {
  const [items, setItems] = useState<SourceSupplier[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useCallback(async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const token = await getIdToken();
    const result = await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(body ? {'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()} : {})},body:body ? JSON.stringify(body):undefined,cache:'no-store'});
    const response = await result.json() as Api<T>;
    if (!result.ok || !response.ok) throw new Error(!response.ok ? response.code : 'REQUEST_FAILED');
    return response.result;
  },[getIdToken]);
  const refresh = useCallback(async (nextCursor = '', q = '') => {
    setBusy(true); setMessage('');
    try {
      const page = await request<Page<SourceSupplier>>(`/api/company/suppliers?limit=20&cursor=${encodeURIComponent(nextCursor)}&q=${encodeURIComponent(q)}`);
      setItems(page.items); setCursor(page.nextCursor);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao consultar fornecedores.'); }
    finally { setBusy(false); }
  },[request]);
  useEffect(()=>{ void refresh(); },[refresh]);
  const payload = (values: typeof empty) => ({
    legalName:values.legalName,tradeName:values.tradeName,cnpj:values.cnpj || null,
    contacts:values.contactName && (values.email || values.phone) ? [{name:values.contactName,role:'',email:values.email,phone:values.phone,preferredChannel:values.email ? 'email':'phone'}] : [],
    channels:values.email ? ['email'] : values.phone ? ['phone'] : [],
    commercialTerms:values.terms,estimatedLeadTimeDays:values.leadTime ? Number(values.leadTime) : null,lifecycle:values.lifecycle,
  });
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await request('/api/company/suppliers','POST',payload(form)); setForm(empty); await refresh('',query); setMessage('Fornecedor cadastrado.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Erro no cadastro.'); }
    finally { setBusy(false); }
  }
  async function changeLifecycle(supplier: SourceSupplier, lifecycle: SupplierLifecycle) {
    setBusy(true);setMessage('');
    try {
      const { id, revision, createdAt, createdByUid, companyId, workspaceId, schemaVersion, updatedAt, status, normalizedName, ...data } = supplier;
      await request(`/api/company/suppliers/${encodeURIComponent(id)}`,'PATCH',{expectedRevision:revision,data:{...data,lifecycle}});
      await refresh('',query); setMessage('Situação do fornecedor atualizada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na alteração.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Fornecedores de origem" className="space-y-5">
    <header><h2 className="text-xl font-semibold">Fornecedores de origem</h2><p className="text-sm opacity-75">Parceiros de compra da empresa. Não são fornecedores cadastrados pelas OMs.</p></header>
    <form onSubmit={create} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
      <h3 className="font-semibold sm:col-span-2">Cadastrar fornecedor</h3>
      {([['legalName','Razão social'],['tradeName','Nome fantasia'],['cnpj','CNPJ (opcional)'],['contactName','Contato'],['email','E-mail do contato'],['phone','Telefone'],['leadTime','Prazo estimado em dias'],['terms','Condições comerciais']] as const).map(([key,label])=><label key={key} className="grid gap-1 text-sm">{label}<input className="rounded-lg border p-2" value={form[key]} required={key==='legalName'} type={key==='email'?'email':key==='leadTime'?'number':'text'} min={key==='leadTime'?0:undefined} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} /></label>)}
      <button disabled={busy} type="submit" className="rounded-lg border px-4 py-2 font-medium sm:col-span-2">Cadastrar</button>
    </form>
    <div className="flex gap-2"><label className="flex-1">Buscar fornecedores<input className="mt-1 w-full rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)} /></label><button className="self-end rounded-lg border px-4 py-2" onClick={()=>void refresh('',query)} disabled={busy}>Buscar</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {busy && <p role="status">Atualizando…</p>}
    {!busy && items.length===0 && <p>Nenhum fornecedor nesta página.</p>}
    <ul className="grid gap-3">{items.map(s=><li key={s.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{s.tradeName || s.legalName}</strong><p className="text-sm opacity-75">{s.legalName} · {s.cnpj || 'Sem CNPJ'} · Prazo estimado: {s.estimatedLeadTimeDays ?? 'não informado'} dias</p></div><label className="text-sm">Situação <select className="ml-2 rounded-lg border p-2" disabled={busy} value={s.lifecycle} onChange={e=>void changeLifecycle(s,e.target.value as SupplierLifecycle)}><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="inactive">Inativo</option></select></label></div></li>)}</ul>
    {cursor && <button className="rounded-lg border px-4 py-2" disabled={busy} onClick={()=>void refresh(cursor,query)}>Próxima página</button>}
  </section>;
}
