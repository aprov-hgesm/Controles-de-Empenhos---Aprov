'use client';
import { useCallback,useEffect,useState,type FormEvent } from 'react';

type Direction='payables'|'receivables';
type Entry={id:string;kind:'settlement'|'settlement_reversal'|'adjustment';amountCents:number;reason:string;occurredOn:string};
type Obligation={
  id:string;revision:number;direction:'payable'|'receivable';
  invoice:{number:string;issuedOn:string;totalCents:number;verification:'unverified'};
  counterparty:{id:string;label:string};dueOn:string;financialStatus:string;entries:Entry[];
};
type Page={items:Obligation[];nextCursor:string|null;complete:boolean};
const today=()=>new Date().toISOString().slice(0,10);
const brl=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
const decimalToCents=(value:string,negative=false)=>{
  if(!/^-?\d{1,10}(?:[,.]\d{1,2})?$/.test(value) || (!negative&&value.startsWith('-')))throw new Error('Informe valor em reais (ex.: 125,50).');
  const sign=value.startsWith('-')?-1:1;
  const [whole,frac='']=value.replace('-','').replace(',','.').split('.');
  const cents=sign*(Number(whole)*100+Number(frac.padEnd(2,'0')));
  if(!Number.isSafeInteger(cents)||cents===0)throw new Error('Valor precisa ser diferente de zero.');
  return cents;
};
const headers=(token:string,write=false)=>({...{Authorization:'Bearer '+token},...(write?{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}: {})});
export function FinanceWorkspace({getIdToken}:{getIdToken:()=>Promise<string>}){
  const [book,setBook]=useState<Direction>('payables');
  const [items,setItems]=useState<Obligation[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<Obligation|null>(null);
  const [counterpartyId,setCounterpartyId]=useState('');
  const [counterpartyLabel,setCounterpartyLabel]=useState('');
  const [invoiceNumber,setInvoiceNumber]=useState('');
  const [invoiceValue,setInvoiceValue]=useState('');
  const [issuedOn,setIssuedOn]=useState(today);
  const [dueOn,setDueOn]=useState(today);
  const [entryAmount,setEntryAmount]=useState('');
  const [entryReason,setEntryReason]=useState('');
  const [entryOn,setEntryOn]=useState(today);
  const [entryKind,setEntryKind]=useState<'settlement'|'adjustment'>('settlement');

  const call=useCallback(async(url:string,init?:RequestInit)=>{
    const token=await getIdToken();
    const response=await fetch(url,{...init,headers:{...headers(token,!!init?.method),...init?.headers},cache:'no-store'});
    const body=await response.json() as {ok:boolean;result?:unknown;code?:string};
    if(!response.ok||!body.ok)throw new Error(body.code||'Falha de comunicação');
    return body.result;
  },[getIdToken]);
  const refresh=useCallback(async(nextCursor='')=>{
    setBusy(true);setError('');
    try{
      const result=await call('/api/company/finance/'+book+'?limit=20'+(nextCursor?'&cursor='+encodeURIComponent(nextCursor):'')) as Page;
      setItems(prev=>nextCursor?[...prev,...result.items]:result.items);
      setCursor(result.nextCursor);
    }catch(e){setError(e instanceof Error?e.message:'Erro de consulta');}
    finally{setBusy(false);}
  },[book,call]);
  useEffect(()=>{setItems([]);setCursor(null);setSelected(null);void refresh();},[refresh]);

  const create=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      const body={invoice:{number:invoiceNumber,issuedOn,totalCents:decimalToCents(invoiceValue)},
        counterparty:{id:counterpartyId,label:counterpartyLabel},dueOn};
      await call('/api/company/finance/'+book,{method:'POST',body:JSON.stringify(body)});
      setInvoiceNumber('');setInvoiceValue('');
      setMessage('NF e obrigação registradas manualmente. Não há confirmação fiscal ou bancária automática.');
      await refresh();
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar');}
    finally{setBusy(false);}
  };
  const entry=async(e:FormEvent)=>{
    e.preventDefault();if(!selected)return;
    setBusy(true);setError('');setMessage('');
    try{
      const payload={expectedRevision:selected.revision,kind:entryKind,
        amountCents:decimalToCents(entryAmount,entryKind==='adjustment'),
        occurredOn:entryOn,reason:entryReason};
      await call('/api/company/finance/'+book+'/'+encodeURIComponent(selected.id)+'/entries',{
        method:'POST',body:JSON.stringify(payload)});
      setMessage('Lançamento manual gravado, com revisão e auditoria.');
      setEntryAmount('');setEntryReason('');setSelected(null);await refresh();
    }catch(err){setError(err instanceof Error?err.message:'Falha no lançamento');}
    finally{setBusy(false);}
  };
  return <section className="space-y-6" aria-label="Financeiro empresarial">
    <header className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-blue-700">EMPROVEX Empresas · Financeiro W8</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Controle financeiro manual</h1>
      <p className="mt-2 text-sm text-slate-600">NFs informadas, vencimentos e baixas registradas por operador. Entrega não comprova atesto, liquidação ou crédito bancário.</p>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Livro financeiro">
      <button type="button" aria-pressed={book==='payables'} onClick={()=>setBook('payables')} className="rounded-xl border px-4 py-2 aria-pressed:bg-blue-700 aria-pressed:text-white">A pagar · NF de entrada</button>
      <button type="button" aria-pressed={book==='receivables'} onClick={()=>setBook('receivables')} className="rounded-xl border px-4 py-2 aria-pressed:bg-blue-700 aria-pressed:text-white">A receber · NF de saída</button>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
    {message&&<p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900">{message}</p>}
    <form onSubmit={create} className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Registrar {book==='payables'?'NF de fornecedor':'NF de venda'} (manual)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">ID da contraparte<input required value={counterpartyId} onChange={e=>setCounterpartyId(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Referência W1/W2" /></label>
        <label className="text-sm">Nome da contraparte<input required value={counterpartyLabel} onChange={e=>setCounterpartyLabel(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Número da nota<input required value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Valor da NF em R$<input required value={invoiceValue} onChange={e=>setInvoiceValue(e.target.value)} className="mt-1 w-full rounded-lg border p-2" inputMode="decimal" placeholder="1000,00" /></label>
        <label className="text-sm">Emissão<input type="date" required value={issuedOn} onChange={e=>setIssuedOn(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Vencimento<input type="date" required value={dueOn} onChange={e=>setDueOn(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      </div>
      <p className="text-xs text-slate-500">Referência documental não validada automaticamente contra compra ou OM até integração W1/W2/W6/W7.</p>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">Registrar obrigação</button>
    </form>
    <div className="rounded-2xl border border-slate-200 p-4">
      <h2 className="font-semibold">Lançamentos recentes</h2>
      {items.length===0&&!busy?<p className="mt-3 text-sm text-slate-500">Nenhuma obrigação nesta página.</p>:null}
      <ul className="mt-3 space-y-2">{items.map(r=>{
        const settled=r.entries.reduce((n,e)=>n+(e.kind==='settlement'?e.amountCents:e.kind==='settlement_reversal'?-e.amountCents:0),0);
        const total=r.invoice.totalCents+r.entries.reduce((n,e)=>n+(e.kind==='adjustment'?e.amountCents:0),0);
        return <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
          <div><p className="font-semibold">{r.counterparty.label} · NF {r.invoice.number}</p>
            <p className="text-sm text-slate-600">Vence {r.dueOn} · {r.financialStatus} · saldo {brl(total-settled)}</p></div>
          <button type="button" disabled={busy||r.financialStatus==='cancelled'} onClick={()=>setSelected(r)} className="rounded-lg border px-3 py-2 text-sm">Registrar baixa/ajuste</button>
        </li>;
      })}</ul>
      {cursor&&<button disabled={busy} type="button" className="mt-4 rounded-lg border px-3 py-2" onClick={()=>void refresh(cursor)}>Carregar mais</button>}
      <p className="mt-2 text-xs text-slate-500">Paginação por empresa. Não represente a página como saldo financeiro consolidado.</p>
    </div>
    {selected&&<form onSubmit={entry} className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="font-semibold">Novo lançamento · NF {selected.invoice.number}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Tipo<select value={entryKind} onChange={e=>setEntryKind(e.target.value as 'settlement'|'adjustment')} className="mt-1 w-full rounded-lg border p-2">
          <option value="settlement">Pagamento/recebimento informado</option><option value="adjustment">Ajuste auditável (+/-)</option></select></label>
        <label className="text-sm">Valor em R$<input required inputMode="decimal" value={entryAmount} onChange={e=>setEntryAmount(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Data informada<input required type="date" value={entryOn} onChange={e=>setEntryOn(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      </div>
      <label className="block text-sm">Justificativa / comprovante registrado manualmente<textarea required minLength={entryKind==='adjustment'?12:1} value={entryReason} onChange={e=>setEntryReason(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      <p className="text-xs text-slate-600">Esta ação não consulta banco, não gera liquidação e não confirma recebimento da OM.</p>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white">Confirmar lançamento</button>
      <button type="button" className="ml-2 rounded-lg border px-4 py-2" onClick={()=>setSelected(null)}>Cancelar</button>
    </form>}
  </section>;
}
