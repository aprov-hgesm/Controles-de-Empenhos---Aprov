'use client';
import {useState} from 'react';
import {CreditLogin,useCreditSession} from '@/features/controle-credito/auth';
import Workspace from '@/features/controle-credito/ui/Workspace';
import {CreditDriveProvider} from '@/features/controle-credito/documents/CreditDriveProvider';
import {AppShellLogo} from '@/components/layout/chrome/AppShellLogo';
import {AppShellSignature} from '@/components/layout/chrome/AppShellSignature';
import {Loader2,ShieldCheck} from 'lucide-react';

export default function CreditControlPage(){
  const session=useCreditSession();
  const {user,member,loading}=session;
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function logout(){setBusy(true);setError('');try{await session.signOut();}catch{setError('Não foi possível encerrar a sessão. Tente novamente.');}finally{setBusy(false);}}
  if(user&&member)return <CreditDriveProvider key={member.uid+':'+member.ug+':'+member.role+':'+member.centerId} user={user} ug={member.ug}><Workspace user={user} member={member} onLogout={logout} logoutBusy={busy} logoutError={error}/></CreditDriveProvider>;
  return <main className="relative min-h-screen overflow-hidden bg-[#020817] text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_28%,rgba(37,99,235,.24),transparent_55%),linear-gradient(145deg,#020817,#071a34)]"/>
    <header className="emprovex-app-header relative flex h-16 items-center gap-3 px-5"><AppShellSignature variant="header"/><AppShellLogo customLogo="/branding/emprovex-dark-transparent.png?v=20261102-r4"/><div className="relative"><p className="font-montserrat text-lg font-extrabold tracking-widest">EMPROVEX</p><p className="text-xs text-blue-200">Controle de Crédito</p></div></header>
    <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 p-6 lg:grid-cols-2">
      <div className="space-y-5"><p className="font-mono text-xs font-bold uppercase tracking-[.25em] text-blue-300">Central de gestão orçamentária</p><h1 className="font-montserrat text-4xl font-extrabold leading-tight sm:text-5xl">Controle de Crédito<span className="block text-blue-300">EMPROVEX</span></h1><p className="max-w-md leading-relaxed text-slate-300">Acompanhe créditos, empenhos, distribuição setorial e prazos em um só lugar.</p><p className="flex items-center gap-2 text-sm text-emerald-300"><ShieldCheck className="h-5 w-5"/> Acesso autorizado · Gratuito · Sessão independente</p></div>
      {loading?<div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-10"><Loader2 className="h-5 w-5 animate-spin"/> Validando acesso…</div>:<CreditLogin session={session}/>}
    </div>
  </main>;
}
