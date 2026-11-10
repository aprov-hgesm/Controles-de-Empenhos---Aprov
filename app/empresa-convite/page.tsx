'use client';
import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { companyAuth as auth } from '../../lib/company/firebaseProjectClient';

export default function CompanyInvitationPage() {
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [companyId,setCompanyId]=useState(''),[invitationToken,setInvitationToken]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [createAccount,setCreateAccount]=useState(false),[busy,setBusy]=useState(false);
  async function accept(e:FormEvent) {
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const credentials=createAccount
        ? await createUserWithEmailAndPassword(auth,email,password)
        : await signInWithEmailAndPassword(auth,email,password);
      await credentials.user.reload();
      if(!credentials.user.emailVerified){
        await sendEmailVerification(credentials.user);
        setCreateAccount(false);
        setNotice('A confirmação foi enviada ao seu e-mail. Verifique a caixa postal e, depois de confirmar, entre com a senha para aceitar o convite.');
        return;
      }
      const response=await fetch('/api/company/members/accept',{
        method:'POST',cache:'no-store',
        headers:{Authorization:'Bearer '+await credentials.user.getIdToken(true),'Content-Type':'application/json'},
        body:JSON.stringify({companyId,invitationToken}),
      });
      const body=await response.json() as {ok:boolean;code?:string};
      if(!response.ok||!body.ok)throw new Error(body.code||'Não foi possível aceitar o convite');
      window.location.assign('/empresa');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível validar o convite');}
    finally{setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5">
    <form onSubmit={accept} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-7">
      <h1 className="text-2xl font-bold text-slate-900">Aceitar convite empresarial</h1>
      <p className="text-sm text-slate-600">Use sua própria conta Firebase com senha e e-mail verificado. Você pode criar uma conta nova; o convite não concede acesso a outros workspaces.</p>
      <div className="flex gap-2" role="group" aria-label="Tipo de acesso">
        <button type="button" aria-pressed={!createAccount} onClick={()=>{setCreateAccount(false);setError('');}} className="rounded-lg border px-3 py-2 text-sm aria-pressed:bg-blue-50">Já tenho conta</button>
        <button type="button" aria-pressed={createAccount} onClick={()=>{setCreateAccount(true);setError('');}} className="rounded-lg border px-3 py-2 text-sm aria-pressed:bg-blue-50">Criar conta</button>
      </div>
      <label className="block text-sm">E-mail
        <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"/></label>
      <label className="block text-sm">Senha
        <input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"/></label>
      <label className="block text-sm">ID do workspace fornecido pelo titular
        <input required value={companyId} onChange={e=>setCompanyId(e.target.value.trim())}
          className="mt-1 w-full rounded-lg border p-2"/></label>
      <label className="block text-sm">Token privado do convite
        <input required autoComplete="off" value={invitationToken} onChange={e=>setInvitationToken(e.target.value.trim())}
          className="mt-1 w-full rounded-lg border p-2"/></label>
      {notice&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy?'Validando...':createAccount?'Criar conta e confirmar e-mail':'Validar e aceitar convite'}
      </button>
      <a href="/entrar-empresa" className="block text-center text-sm text-blue-700 underline">Voltar ao login</a>
    </form>
  </main>;
}
