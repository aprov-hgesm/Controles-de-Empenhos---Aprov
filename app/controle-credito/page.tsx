'use client';
import {useState} from 'react';
import {CreditLogin,useCreditSession} from '@/features/controle-credito/auth';
import Workspace from '@/features/controle-credito/ui/Workspace';

export default function CreditControlPage(){
  const session=useCreditSession();
  const {user,member,loading}=session;
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function logout(){
    setBusy(true);setError('');
    try{await session.signOut();}catch{setError('Não foi possível encerrar a sessão. Tente novamente.');}finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-[#f4f6fa] text-[#0b1c30]">
    <header className="bg-[#16334d] px-4 py-5 text-white sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="font-bold tracking-widest">EMPROVEX</p><h1 className="text-xl font-semibold">Controle de Crédito</h1><p className="mt-1 text-xs text-slate-200">Gestão orçamentária · Acesso gratuito autorizado</p></div>{user&&member&&<button disabled={busy} className="rounded-lg border border-white/50 px-3 py-2" onClick={()=>{if(window.confirm('Sair encerra também a sessão compartilhada dos demais módulos EMPROVEX. Continuar?'))void logout();}}>Sair</button>}</div></header>
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {loading?<p role="status">Validando acesso…</p>:user&&member?<Workspace key={member.uid+':'+member.ug+':'+member.role+':'+member.centerId} user={user} member={member}/>:<CreditLogin session={session}/>}
      {error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}
    </div>
  </main>;
}
