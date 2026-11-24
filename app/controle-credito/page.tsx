'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { calculateCreditBalance, HGESM_COST_CENTERS } from '@/lib/controle-credito/creditBalance';
import type { SagHtmlCreditDraft } from '@/lib/controle-credito/sagCreditHtml.mjs';
import type { ParsedEmpenhoPdfResult } from '@/lib/server/empenhoPdfParser';

type Member = { uid:string; ug:string; role:'gestor'|'centro'; centerId:string|null; email:string };
const endpoint='/api/controle-credito/importacao';
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const inputClass='rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 w-full';
const action='rounded-lg bg-[#16334d] px-4 py-2 font-semibold text-white disabled:opacity-50';
const panel='rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

function Review({member,user}:{member:Member;user:User}) {
  const [nc,setNc]=useState<SagHtmlCreditDraft|null>(null);
  const [ne,setNe]=useState<ParsedEmpenhoPdfResult|null>(null);
  const [shares,setShares]=useState<Record<string,string>>({});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const centers=member.ug==='160416'?HGESM_COST_CENTERS:[];
  const allocations=centers.map(c=>({centerId:c.id,basisPoints:Math.round(Number(shares[c.id]||0)*100)}));
  let balance:ReturnType<typeof calculateCreditBalance>|null=null;
  try{if(nc)balance=calculateCreditBalance(nc.totalCents,allocations,[]);}catch{/* invalid share input */}
  async function importFile(file:File|undefined,kind:'nc'|'ne'){
    if(!file||busy)return;
    setBusy(true);setMessage('');
    if(kind==='nc'){setNc(null);setShares({});}else setNe(null);
    const abort=new AbortController();controller.current=abort;
    try{
      const token=await user.getIdToken();
      const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token,'x-credit-document-kind':kind},body:file,signal:abort.signal,cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Falha na importação.');
      if(abort.signal.aborted||auth.currentUser?.uid!==user.uid)return;
      if(kind==='nc')setNc(payload.result);else setNe(payload.result);
    }catch(e){if(!abort.signal.aborted)setMessage(e instanceof Error?e.message:'Falha na importação.');}
    finally{if(!abort.signal.aborted)setBusy(false);}
  }
  if(member.role==='centro')return <section className={panel}><h2 className="text-xl font-bold">Centro de Custos — {member.centerId}</h2><p className="mt-2 text-slate-600">Perfil de consulta autorizado. A listagem de créditos e empenhos será habilitada após a integração com o banco financeiro.</p></section>;
  return <div className="space-y-5">
    <section className={panel}>
      <h2 className="text-xl font-bold">Importação e conferência</h2>
      <p className="mt-1 text-sm text-slate-600">Ambiente de desenvolvimento: a prévia não grava créditos, empenhos ou arquivos no Drive.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 rounded-lg border border-slate-200 p-4 block"><span className="font-semibold">Nota de Crédito — HTML do SAG</span><input className={inputClass} type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0],'nc');e.target.value='';}}/></label>
        <label className="space-y-2 rounded-lg border border-slate-200 p-4 block"><span className="font-semibold">Nota de Empenho — PDF</span><input className={inputClass} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0],'ne');e.target.value='';}}/></label>
      </div>
      {busy&&<p className="mt-3" role="status">Interpretando documento…</p>}
      {message&&<p className="mt-3 text-red-700" role="alert">{message}</p>}
    </section>
    {nc&&<section className={panel}>
      <div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-slate-500">Nota de Crédito Orçamentário</p><h2 className="text-2xl font-bold">{nc.number}</h2></div><div><p className="text-sm text-slate-500">Crédito destinado à UG {nc.beneficiaryUg}</p><p className="text-2xl font-bold text-emerald-700">{money(nc.totalCents)}</p></div></div>
      <div className="grid gap-2 md:grid-cols-3 my-4 text-sm"><p>Emissão: {nc.issueDate}</p><p>Prazo: {nc.deadline||'Conferir'}</p><p>UG emitente: {nc.issuingUg}</p></div>
      <p className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap break-words">{nc.description}</p>
      {nc.warnings.map((w,i)=><p key={i} className="mt-2 text-amber-800">{w}</p>)}
      {nc.sequences.map(s=><div key={s.sequence} className="mt-5 overflow-x-auto"><h3 className="font-bold mb-2">Destino do crédito · Sequencial {s.sequence}</h3><table className="w-full text-left text-sm"><thead><tr>{['ND','PI','PTRES','Fonte','UGR','Valor'].map(x=><th key={x} className="border-b p-2">{x}</th>)}</tr></thead><tbody>{s.destination.map((c,i)=><tr key={i}>{[c.nd,c.pi||'—',c.ptres,c.fonte||'—',c.ugr,money(c.cents)].map((x,j)=><td key={j} className="p-2 border-b">{x}</td>)}</tr>)}</tbody></table></div>)}
      <h3 className="font-bold mt-6 mb-2">Prévia de rateio</h3>
      {centers.length===0?<p>Os centros de custos desta UG ainda precisam ser configurados.</p>:<div className="space-y-2">
        {centers.map(c=><div key={c.id} className="grid grid-cols-[1fr_100px_1fr] items-center gap-2"><label htmlFor={'share-'+c.id}>{c.id}</label><input id={'share-'+c.id} className={inputClass} type="number" min="0" max="100" step="0.01" value={shares[c.id]||''} placeholder="0%" onChange={e=>setShares(old=>({...old,[c.id]:e.target.value}))}/><span className="text-right">{balance?money(balance.centers.find(x=>x.centerId===c.id)?.allocatedCents??0):'—'}</span></div>)}
        <button type="button" className="text-sm font-semibold text-[#16334d] underline" onClick={()=>setShares(Object.fromEntries(centers.map(c=>[c.id,'20'])))}>Distribuir igualmente</button>
        {balance?<p className="mt-2">Não distribuído: <strong>{money(balance.unallocatedCents)}</strong></p>:<p className="text-red-700">Rateio inválido: máximo 100%.</p>}
      </div>}
    </section>}
    {ne&&<section className={panel}><h2 className="text-xl font-bold">{ne.id}</h2><p className="mt-2">Valor: {money(Math.round(ne.valorTotal*100))}</p><p>NC indicada: {ne.notaCredito||'Não identificada'}</p><p>ND: {ne.naturezaDespesa||'Conferir'} · PI: {ne.planoInterno||'Conferir'}</p><p className="text-sm mt-2 text-slate-600">Prévia somente: nenhum abatimento de saldo foi gravado.</p></section>}
  </div>;
}

export default function CreditControlPage(){
  const [user,setUser]=useState<User|null>(null);
  const [member,setMember]=useState<Member|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  useEffect(()=>{
    let live=true, generation=0;
    const unsubscribe=onIdTokenChanged(auth,async next=>{
      const id=++generation;setUser(next);setMember(null);setError('');setLoading(Boolean(next));
      if(!next){setLoading(false);return;}
      try{
        const response=await fetch(endpoint,{headers:{authorization:'Bearer '+await next.getIdToken()},cache:'no-store'});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'Acesso não autorizado.');
        if(live&&id===generation&&payload.member?.uid===next.uid)setMember(payload.member);
      }catch(e){if(live&&id===generation)setError(e instanceof Error?e.message:'Não foi possível validar o acesso.');}
      finally{if(live&&id===generation)setLoading(false);}
    });
    return()=>{live=false;unsubscribe();};
  },[]);
  async function login(e?:FormEvent,google=false){
    e?.preventDefault();setBusy(true);setError('');
    try{if(google)await signInWithPopup(auth,googleProvider);else await signInWithEmailAndPassword(auth,email.trim(),password);}
    catch{setError('Não foi possível autenticar. Confira as credenciais e tente novamente.');}
    finally{setBusy(false);setPassword('');}
  }
  const authorized=member&&user&&member.uid===user.uid&&auth.currentUser?.uid===user.uid;
  return <main className="min-h-screen bg-[#f4f6fa] text-[#0b1c30]">
    <header className="bg-[#16334d] text-white px-5 py-5"><div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold tracking-widest">EMPROVEX</p><h1 className="text-xl font-semibold">Controle de Crédito</h1></div>{user&&<button className="rounded-lg border border-white/50 px-3 py-2" onClick={()=>void signOut(auth)}>Sair</button>}</div></header>
    <div className="mx-auto max-w-6xl p-5">
      {loading?<p role="status">Validando acesso…</p>:authorized?<><p className="mb-5 text-sm text-slate-600">UG {member.ug} · {member.role==='gestor'?'Gestor':'Centro de Custos'}</p><Review key={member.uid+':'+member.ug+':'+member.role+':'+member.centerId} member={member} user={user}/></>:<section className={panel+' mx-auto max-w-md'}>
        <h2 className="text-xl font-bold">Acesso ao Controle de Crédito</h2>
        <p className="text-sm text-slate-600 mt-2">Apenas gestores e centros de custos autorizados.</p>
        {error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}
        {!user&&<><form className="mt-5 space-y-3" onSubmit={e=>void login(e)}><label className="block">E-mail<input className={inputClass} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Senha<input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={action+' w-full'} disabled={busy}>Entrar</button></form><button className="mt-3 w-full rounded-lg border border-slate-300 p-2 font-semibold" disabled={busy} onClick={()=>void login(undefined,true)}>Entrar com Google</button></>}
      </section>}
    </div>
  </main>;
}
