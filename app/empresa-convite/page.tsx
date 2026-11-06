'use client';
import { useState, type FormEvent } from 'react';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function CompanyInvitationPage() {
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [companyId,setCompanyId]=useState(''),[invitationToken,setInvitationToken]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function accept(e:FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try{
      const credentials=await signInWithEmailAndPassword(auth,email,password);
      await credentials.user.reload();
      if(!credentials.user.emailVerified){
        await sendEmailVerification(credentials.user);
        throw new Error('Confirme o e-mail enviado à sua caixa postal e tente novamente.');
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
      <p className="text-sm text-slate-600">Use sua própria conta Firebase com senha e e-mail verificado. O convite não concede acesso a outros workspaces.</p>
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
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy?'Validando...':'Validar e aceitar convite'}
      </button>
      <a href="/login" className="block text-center text-sm text-blue-700 underline">Voltar ao login</a>
    </form>
  </main>;
}
