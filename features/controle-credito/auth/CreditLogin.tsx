'use client';

import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { creditAuth as auth, creditGoogleProvider as googleProvider } from './creditFirebase';
import type { CreditSession } from './useCreditSession';

const input='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const action='w-full rounded-lg bg-blue-700 hover:bg-blue-800 px-4 py-2 font-semibold text-white disabled:opacity-50';
function loginError(e:unknown){
  const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
  if(code==='auth/too-many-requests')return 'Muitas tentativas. Tente novamente mais tarde.';
  if(code==='auth/network-request-failed')return 'Falha de conexão. Confira sua internet.';
  if(code==='auth/popup-closed-by-user')return 'Entrada com Google cancelada.';
  if(code==='auth/popup-blocked')return 'Permita a janela de login do Google e tente novamente.';
  return 'Não foi possível entrar. Confira as credenciais e tente novamente.';
}
/** Render when the single useCreditSession instance owned by the page is not authorized. */
export function CreditLogin({session}:{session:CreditSession}){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function execute(task:()=>Promise<unknown>){
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{await task();}catch(e){setError(loginError(e));}
    finally{setBusy(false);setPassword('');}
  }
  function login(e:FormEvent){
    e.preventDefault();
    void execute(()=>signInWithEmailAndPassword(auth,email.trim(),password));
  }
  function reset(){
    const address=email.trim();
    if(!/^\S+@\S+\.\S+$/.test(address)){setError('Informe seu e-mail para recuperar a senha.');return;}
    void execute(async()=>{
      try{await sendPasswordResetEmail(auth,address);}
      catch(e){
        const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
        if(code!=='auth/user-not-found')throw e;
      }
      setMessage('Se a conta permitir recuperação, você receberá as instruções no e-mail informado.');
    });
  }
  return <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
    <h2 className="font-montserrat text-xl font-extrabold">Acesso ao Controle de Crédito</h2>
    <p className="mt-2 text-sm text-slate-600">Exclusivo para gestores e centros de custos autorizados. Acesso gratuito.</p>
    {(error||session.error)&&<p className="mt-3 text-red-700" role="alert">{error||session.error}</p>}
    {message&&<p className="mt-3 text-sm text-emerald-800" role="status">{message}</p>}
    {session.loading?<p role="status" className="mt-4">Validando acesso…</p>:session.user?<>
      <p className="mt-4 break-words text-sm">Conta conectada: {session.user.email}</p>
      <button type="button" disabled={busy} className={action+' mt-4'} onClick={()=>session.retry()}>Verificar acesso novamente</button>
      <button type="button" disabled={busy} className="mt-3 w-full rounded-lg border p-2" onClick={()=>void execute(session.signOut)}>Sair da conta</button>
      <p className="mt-2 text-xs text-slate-600">Esta sessão é independente dos demais módulos e das outras abas.</p>
      <p className="mt-2 text-sm text-slate-600">Se necessário, solicite a autorização ao gestor da sua UG.</p>
    </>:<>
      <form className="mt-5 space-y-3" onSubmit={login}>
        <label className="block">E-mail<input className={input} type="email" autoComplete="username" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label className="block">Senha<input className={input} type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className={action} disabled={busy}>Entrar</button>
      </form>
      <button type="button" className="mt-3 w-full rounded-lg border border-slate-300 p-2 font-semibold" disabled={busy} onClick={()=>void execute(()=>signInWithPopup(auth,googleProvider))}>Entrar com Google</button>
      <button type="button" className="mt-3 text-sm font-semibold text-[#16334d] underline" disabled={busy} onClick={reset}>Esqueci minha senha</button>
    </>}
  </section>;
}
