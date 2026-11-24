'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,signOut,type User} from 'firebase/auth';
import {auth,googleProvider} from '@/lib/firebase';
import {api,cancelled,errorText,type Member} from '@/features/controle-credito/client';
import Workspace from '@/features/controle-credito/ui/Workspace';
import {panel,input,button,secondary,Field} from '@/features/controle-credito/ui/Forms';

export default function CreditControlPage(){
  const [user,setUser]=useState<User|null>(null);
  const [member,setMember]=useState<Member|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let controller:AbortController|null=null;
    let live=true;
    const unsubscribe=onAuthStateChanged(auth,next=>{
      controller?.abort();setUser(next);setMember(null);setError('');setLoading(Boolean(next));
      if(!next)return;
      const c=new AbortController();controller=c;
      // GET importacao permanece suportado durante integração do endpoint /sessao pelo Worker 02.
      void api<{member:Member}>(next,'/importacao',c.signal).then(v=>{
        if(!live||c.signal.aborted)return;
        if(v.member.uid!==next.uid)throw new Error('Vínculo de acesso inválido.');
        setMember(v.member);
      }).catch(e=>{if(live&&!c.signal.aborted&&!cancelled(e))setError(errorText(e));}).finally(()=>{if(live&&!c.signal.aborted)setLoading(false);});
    });
    return()=>{live=false;controller?.abort();unsubscribe();};
  },[retry]);
  async function login(e?:FormEvent,google=false){
    e?.preventDefault();if(busy)return;setBusy(true);setError('');
    try{if(google)await signInWithPopup(auth,googleProvider);else await signInWithEmailAndPassword(auth,email.trim(),password);}
    catch{setError('Não foi possível autenticar. Confira as credenciais e tente novamente.');}
    finally{setBusy(false);setPassword('');}
  }
  async function logout(){
    setBusy(true);setError('');
    try{await signOut(auth);}catch{setError('Não foi possível encerrar a sessão. Tente novamente.');}finally{setBusy(false);}
  }
  const authorized=member&&user&&member.uid===user.uid&&auth.currentUser?.uid===user.uid;
  return <main className="min-h-screen bg-[#f4f6fa] text-[#0b1c30]">
    <header className="bg-[#16334d] px-4 py-5 text-white sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="font-bold tracking-widest">EMPROVEX</p><h1 className="text-xl font-semibold">Controle de Crédito</h1><p className="mt-1 text-xs text-slate-200">Gestão orçamentária · Acesso gratuito autorizado</p></div>{user&&<button disabled={busy} className="rounded-lg border border-white/50 px-3 py-2" onClick={()=>{if(window.confirm('Sair encerra também a sessão compartilhada dos demais módulos EMPROVEX. Continuar?'))void logout();}}>Sair</button>}</div></header>
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {loading?<p role="status">Validando acesso…</p>:authorized?<><Workspace key={member.uid+':'+member.ug+':'+member.role+':'+member.centerId} user={user} member={member}/>{error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}</>:<section className={panel+' mx-auto mt-8 max-w-md'}>
        <h2 className="text-xl font-bold">Acesso ao Controle de Crédito</h2><p className="mt-2 text-sm text-slate-600">Apenas gestores e centros de custos autorizados. Não é necessário contratar outros módulos.</p>
        {error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}
        {!user?<><form className="mt-5 space-y-3" onSubmit={e=>void login(e)}><Field label="E-mail"><input className={input} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Senha"><input className={input} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className={button+' w-full'} disabled={busy}>Entrar</button></form><button className={secondary+' mt-3 w-full'} disabled={busy} onClick={()=>void login(undefined,true)}>Entrar com Google</button></>:<button className={secondary+' mt-4'} onClick={()=>setRetry(v=>v+1)}>Validar acesso novamente</button>}
      </section>}
    </div>
  </main>;
}
