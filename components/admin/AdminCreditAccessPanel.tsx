'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, type User } from 'firebase/auth';
import { ShieldCheck, UserPlus, KeyRound, RefreshCw, ExternalLink } from 'lucide-react';
import { auth } from '../../lib/firebase';
type Row={uid:string;email:string;ug:string;role:'gestor'|'centro';centerId:string|null;active:boolean};
const profiles=[['gestor','Gestor'],['APROV','APROV — Aprovisionamento'],['ALMOX','ALMOX — Almoxarifado'],['FARM','FARM — Farmácia'],['LAC','LAC — Laboratório'],['ODONTO','ODONTO — Odontologia']];
const inputClass='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const button='inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50';
export default function AdminCreditAccessPanel({adminUser}:{adminUser:User}){
  const [members,setMembers]=useState<Row[]>([]);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [profile,setProfile]=useState('gestor');
  const [existing,setExisting]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [truncated,setTruncated]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const pending=useRef(false);
  const request=useCallback(async(body?:Record<string,unknown>)=>{
    const signal=controller.current?.signal;
    const token=await adminUser.getIdToken();
    if(signal?.aborted||auth.currentUser?.uid!==adminUser.uid)throw new Error('Sessão alterada.');
    const res=await fetch('/api/admin/controle-credito',{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal});
    const data=await res.json();
    if(signal?.aborted||auth.currentUser?.uid!==adminUser.uid)throw new Error('Sessão alterada.');
    if(!res.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
    return data;
  },[adminUser]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{const data=await request();setMembers(data.members||[]);setTruncated(Boolean(data.truncated));}
    catch(e){if(!controller.current?.signal.aborted){setMembers([]);setError(e instanceof Error?e.message:'Falha ao consultar acessos.');}}
    finally{if(!controller.current?.signal.aborted)setLoading(false);}
  },[request]);
  useEffect(()=>{const c=new AbortController();controller.current=c;setMembers([]);setEmail('');setPassword('');void refresh();return()=>{c.abort();};},[refresh]);
  async function perform(action:()=>Promise<void>){
    if(pending.current)return;
    pending.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){if(!controller.current?.signal.aborted)setError(e instanceof Error?e.message:'Falha na operação.');}
    finally{pending.current=false;if(!controller.current?.signal.aborted)setBusy(false);}
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    await perform(async()=>{
      const body={action:'save',email,role:profile==='gestor'?'gestor':'centro',centerId:profile==='gestor'?null:profile,password:existing?'':password,confirmInstitutionalEmail:confirmed};
      setPassword('');setConfirmed(false);
      await request(body);setEmail('');setNotice('Acesso autorizado no Controle de Crédito.');await refresh();
    });
  }
  async function revoke(row:Row){
    if(!window.confirm('Revogar somente o acesso de '+row.email+' ao Controle de Crédito?'))return;
    await perform(async()=>{await request({action:'revoke',uid:row.uid});setNotice('Acesso revogado. Os demais módulos foram preservados.');await refresh();});
  }
  async function recover(row:Row){
    if(!window.confirm('Enviar recuperação de senha para '+row.email+'? A senha Firebase é compartilhada com os demais módulos.'))return;
    await perform(async()=>{if(auth.currentUser?.uid!==adminUser.uid)throw new Error('Sessão alterada.');await sendPasswordResetEmail(auth,row.email);setNotice('Solicitação de recuperação enviada ao e-mail cadastrado.');});
  }
  return <section data-testid="admin-credit-access-tab" className="space-y-5 text-slate-900">
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#081a34] to-[#163d68] p-5 text-white shadow-lg sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-blue-200"/><div><p className="text-xs font-bold uppercase tracking-widest text-blue-200">UG 160416 · HGeSM</p><h2 className="text-xl font-bold">Acessos do Controle de Crédito</h2></div></div><a href="/controle-credito" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-3 py-2 text-sm font-semibold">Abrir módulo <ExternalLink className="h-4 w-4"/></a></div>
      <p className="mt-3 text-sm text-blue-100">Gerencie os acessos gratuitos do gestor e dos cinco centros de custos. Nenhum vínculo com assinaturas ou cobrança.</p>
    </div>
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold"><UserPlus className="h-5 w-5 text-blue-700"/> Autorizar acesso</h3>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm font-semibold">Perfil<select value={profile} onChange={e=>setProfile(e.target.value)} className={inputClass} disabled={busy}>{profiles.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="space-y-1 text-sm font-semibold">E-mail institucional<input required type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} maxLength={254} disabled={busy}/></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={existing} onChange={e=>{setExisting(e.target.checked);setPassword('');setConfirmed(false);}} disabled={busy}/> Vincular conta Firebase existente (preservar senha atual)</label>
      {!existing&&<><label className="block space-y-1 text-sm font-semibold">Senha inicial<input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} disabled={busy}/><span className="block text-xs font-normal text-slate-500">Mínimo de 8 caracteres. Prefira uma senha exclusiva, não reutilizada. A senha não será armazenada no banco do módulo nem exibida posteriormente.</span></label><label className="flex items-start gap-2 text-sm"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy} className="mt-1"/> Confirmo que verifiquei a titularidade institucional deste e-mail e autorizo a criação da conta.</label></>}
      <button type="submit" disabled={busy||loading} className={button}><UserPlus className="h-4 w-4"/>{busy?'Processando...':'Salvar acesso'}</button>
    </form>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Acessos cadastrados</h3><button type="button" disabled={loading||busy} onClick={()=>{setError('');void refresh();}} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"><RefreshCw className="h-4 w-4"/>Atualizar</button></div>
      {truncated&&<p className="mt-2 text-xs text-amber-800">Listagem limitada a 100 vínculos.</p>}
      {loading?<p className="py-4 text-sm text-slate-500">Consultando acessos...</p>:members.length===0?<p className="py-4 text-sm text-slate-500">{error?'Listagem indisponível.':'Nenhum acesso cadastrado.'}</p>:<div className="mt-4 space-y-2">{members.map(row=><div key={row.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="break-all text-sm font-bold">{row.email}</p><p className="text-xs text-slate-600">{row.role==='gestor'?'Gestor':row.centerId} · {row.active?'Ativo':'Revogado'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void recover(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"><KeyRound className="h-4 w-4"/> Recuperar senha</button>{row.active&&<button type="button" disabled={busy} onClick={()=>void revoke(row)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Revogar acesso</button>}</div></div>)}</div>}
      <p className="mt-4 text-xs text-slate-500">Para reativar um vínculo, selecione o mesmo perfil e vincule a conta existente. A revogação não apaga históricos nem desabilita a conta Firebase global.</p>
    </div>
  </section>;
}
