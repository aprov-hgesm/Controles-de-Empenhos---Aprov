'use client';
import { useState,type FormEvent } from 'react';

type Flow={dueOn:string;payableCents:number;receivableCents:number;netForecastCents:number;basis:string};
type Preview={scope:string;complete:boolean;outstandingPayableCents:number;
 outstandingReceivableCents:number;cashflow:Flow[];warnings:string[]};
type Margin={knownComponentMarginCents:number;missing:string[];complete:boolean;basis:'estimate'};
const label:Record<string,string>={materialCostCents:'materiais',freightCents:'frete',
 taxesCents:'tributos',otherCents:'outras despesas'};
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const toCents=(s:string)=>{
 if(!/^\d{1,10}(?:[,.]\d{1,2})?$/.test(s))throw new Error('Valor inválido em reais.');
 const [a,b='']=s.replace(',','.').split('.');
 const n=Number(a)*100+Number(b.padEnd(2,'0'));
 if(!Number.isSafeInteger(n))throw new Error('Valor fora do limite.');
 return n;
};
/** Finance-only projections; may be mounted by W4/W10 without touching the operational shell. */
export function FinanceInsights({getIdToken}:{getIdToken:()=>Promise<string>}){
 const [preview,setPreview]=useState<Preview|null>(null);
 const [margin,setMargin]=useState<Margin|null>(null);
 const [form,setForm]=useState({revenueCents:'',materialCostCents:'',freightCents:'',taxesCents:'',otherCents:''});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=async(url:string,body?:unknown)=>{
  const token=await getIdToken(),resp=await fetch(url,{method:body?'POST':'GET',
    headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const result=await resp.json() as {ok:boolean;result?:unknown;code?:string};
  if(!resp.ok||!result.ok)throw new Error(result.code||'Consulta indisponível');
  return result.result;
 };
 const load=async()=>{setBusy(true);setError('');
  try{setPreview(await request('/api/company/finance/summary') as Preview);}
  catch(e){setError(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
 };
 const estimate=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');
  try{const payload:Record<string,number>={};
   for(const [k,v] of Object.entries(form))if(v.trim())payload[k]=toCents(v);
   if(payload.revenueCents===undefined)throw new Error('Informe a receita prevista.');
   setMargin(await request('/api/company/finance/margin',payload) as Margin);
  }catch(e){setError(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
 };
 return <div className="space-y-6">
  <section className="rounded-2xl border border-slate-200 p-4">
   <h2 className="text-xl font-semibold">Fluxo previsto por vencimento</h2>
   <p className="mt-1 text-sm text-slate-600">Prévia de obrigações abertas — não representa saldo bancário, inadimplência comprovada ou liquidação pública.</p>
   <button type="button" disabled={busy} onClick={()=>void load()} className="mt-3 rounded-lg border px-3 py-2">Consultar prévia</button>
   {preview&&<div className="mt-4 space-y-3">
    {!preview.complete&&<p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Prévia parcial: existem mais páginas. Não utilizar como total consolidado.</p>}
    <p className="text-sm">Nesta página: a pagar {money(preview.outstandingPayableCents)} · a receber {money(preview.outstandingReceivableCents)}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Vencimento</th><th className="p-2">A pagar</th><th className="p-2">A receber</th><th className="p-2">Diferença prevista</th></tr></thead>
     <tbody>{preview.cashflow.map(row=><tr key={row.dueOn} className="border-t"><td className="p-2">{row.dueOn}</td>
      <td className="p-2">{money(row.payableCents)}</td><td className="p-2">{money(row.receivableCents)}</td><td className="p-2">{money(row.netForecastCents)}</td></tr>)}</tbody></table></div>
   </div>}
  </section>
  <section className="rounded-2xl border border-slate-200 p-4">
   <h2 className="text-xl font-semibold">Margem estimada manual</h2>
   <p className="mt-1 text-sm text-slate-600">Não deduz custos do preço de venda da NE. Campos vazios são lacunas explícitas, não despesas iguais a zero.</p>
   <form onSubmit={estimate} className="mt-4 space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {Object.entries({revenueCents:'Receita prevista',materialCostCents:'Materiais',
      freightCents:'Frete',taxesCents:'Tributos',otherCents:'Outras despesas'}).map(([field,title])=>
      <label key={field} className="text-sm">{title} (R$)
       <input className="mt-1 w-full rounded-lg border p-2" inputMode="decimal" placeholder={field==='revenueCents'?'Obrigatória':'Não informado'}
        required={field==='revenueCents'} value={form[field as keyof typeof form]}
        onChange={e=>setForm(prev=>({...prev,[field]:e.target.value}))}/></label>)}
    </div>
    <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white">Calcular estimativa</button>
   </form>
   {margin&&<div className="mt-4 rounded-xl bg-slate-50 p-4" role="status">
    <p className="font-semibold">Diferença com custos conhecidos: {money(margin.knownComponentMarginCents)}</p>
    <p className="mt-1 text-sm">{margin.complete?'Todos os componentes manuais informados.':'Cálculo incompleto; não representa margem líquida.'}</p>
    {margin.missing.length>0&&<p className="mt-1 text-sm">Faltam: {margin.missing.map(k=>label[k]||k).join(', ')}.</p>}
    <p className="mt-2 text-xs text-slate-500">Estimativa apenas. Margem realizada exige custos e fatos conferidos.</p>
   </div>}
  </section>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}
 </div>;
}
