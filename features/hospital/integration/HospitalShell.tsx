'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import {auth} from '@/lib/firebase';
import {PatientsView} from '@/features/hospital/patients/PatientsView';
import {DietasView} from '@/features/hospital/diets/DietasView';
import {MeusMapasView} from '@/features/hospital/maps/MeusMapasView';
import {ProductionView} from '@/features/hospital/production/ProductionView';
import {NutritionAuditView} from '@/features/hospital/nutrition-audit/NutritionAuditView';
import {AdministrationView} from '@/features/hospital/administration/AdministrationView';
import {ReportingView} from '@/features/hospital/reporting/ReportingView';
import {TrackingView} from './TrackingView';
import {DistributionQueue} from './DistributionQueue';
import {getHospitalWorkspaceAccess,type HospitalWorkspaceAccess} from './access';
import {canOpenPage,firstPage,menuForRoles} from './navigation';

type Allowed=Extract<HospitalWorkspaceAccess,{status:200}>;
type Session=
 | {phase:'checking'}
 | {phase:'signed-out'}
 | {phase:'blocked';status:number;message:string}
 | {phase:'allowed';access:Allowed};

export function HospitalShell(){
 const [session,setSession]=useState<Session>({phase:'checking'});
 const [page,setPage]=useState('');
 const [unit,setUnit]=useState('');
 const [notification,setNotification]=useState('');
 const request=useRef(0);
 useEffect(()=>{
  let mounted=true;
  const unsub=onAuthStateChanged(auth,async user=>{
   const version=++request.current;
   setSession({phase:'checking'});
   if(!user){if(mounted)setSession({phase:'signed-out'});return;}
   try{
    const result=await getHospitalWorkspaceAccess(await user.getIdToken(true));
    if(!mounted||version!==request.current)return;
    if(result.status!==200){setSession({phase:'blocked',status:result.status,message:result.message});return;}
    const first=firstPage(result.roles);
    if(!first){setSession({phase:'blocked',status:403,message:'Perfil sem página hospitalar autorizada.'});return;}
    setPage(first);
    setUnit(result.unitIds[0]??'');
    setSession({phase:'allowed',access:result});
   }catch{
    if(mounted&&version===request.current)
     setSession({phase:'blocked',status:503,message:'Serviço de autenticação hospitalar indisponível.'});
   }
  });
  return ()=>{mounted=false;request.current++;unsub();};
 },[]);
 const getIdToken=useCallback(async()=>{
  const user=auth.currentUser;
  if(!user)throw Error('Sessão expirada: entre novamente.');
  return user.getIdToken();
 },[]);
 const getAuthorization=useCallback(async()=> 'Bearer '+await getIdToken(),[getIdToken]);
 const logout=async()=>{
  try{await signOut(auth);}catch{setNotification('Não foi possível encerrar a sessão.')}
 };
 if(session.phase==='checking')return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role="status">Validando sessão e vínculo hospitalar no servidor…</p></main>;
 if(session.phase==='signed-out')return <main className="min-h-screen bg-slate-950 p-6 text-white"><h1 className="text-xl font-bold">Sessão hospitalar encerrada</h1><p className="mt-2">Faça login institucional para continuar.</p><a className="mt-4 inline-block underline" href="/cozinha-dietetica">Ir ao login hospitalar</a></main>;
 if(session.phase==='blocked')return <main className="min-h-screen bg-slate-950 p-6 text-white"><h1 className="text-xl font-bold">Acesso hospitalar não autorizado</h1><p role="alert" className="mt-2">{session.status}: {session.message}</p><a className="mt-4 inline-block underline" href="/cozinha-dietetica">Voltar à entrada</a><button type="button" className="ml-4 underline" onClick={()=>void logout()}>Sair</button></main>;
 const {access}=session;
 const menu=menuForRoles(access.roles);
 const selected=canOpenPage(access.roles,page)?page:menu[0]?.id??'';
 const authorizedUnit=access.unitIds.includes(unit)?unit:access.unitIds[0]??'';
 const clinical=access.roles.includes('UNIT')&&!!authorizedUnit;
 const kitchen=access.roles.includes('KITCHEN')&&access.unitIds.length>0;
 const nutrition=access.roles.includes('NUTRITION')&&access.unitIds.length>0;
 const admin=access.roles.includes('HOSPITAL_ADMIN');
 const org=access.organizationId;
 return <main className="min-h-screen bg-slate-100 p-3 text-slate-900 sm:p-6">
  <div className="mx-auto max-w-7xl space-y-4">
   <header className="rounded-xl bg-slate-950 p-4 text-white sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-300">EMPROVEX · Ambiente de QA</p><h1 className="text-2xl font-bold">Cozinha Dietética</h1><p className="text-sm text-slate-300">Uso sintético restrito; não habilitado para pacientes reais.</p></div>
     <div className="flex items-center gap-3"><a href="/" className="text-sm underline">Portal</a><button type="button" onClick={()=>void logout()} className="rounded border border-white/40 px-3 py-2 text-sm">Sair</button></div></div>
   </header>
   {notification&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{notification}</p>}
   {access.unitIds.length>1&&<label className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 text-sm">Unidade autorizada<select aria-label="Unidade assistencial" className="rounded border p-2" value={authorizedUnit} onChange={e=>setUnit(e.target.value)}>{access.unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>}
   <nav aria-label="Navegação hospitalar por perfil" className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
    {menu.map(item=><button key={item.id} type="button" aria-current={selected===item.id?'page':undefined} onClick={()=>setPage(item.id)} className={'rounded-lg px-3 py-2 text-sm font-semibold '+(selected===item.id?'bg-slate-900 text-white':'bg-slate-100 text-slate-800')}>{item.label}</button>)}
   </nav>
   <div className="min-w-0">
    {selected==='inicio'&&clinical&&<section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Início · {authorizedUnit}</h2><p>Registre o paciente e a dieta conforme prescrição médica; monte e envie o mapa manualmente, sem aprovação nutricional rotineira.</p><p className="text-sm text-slate-600">Mapas: 06h, 10h e 16h. A tolerância da refeição principal encerra às 06h30, 10h30 e 16h30, respectivamente, e não amplia o prazo de envio.</p><div className="flex flex-wrap gap-2"><button type="button" className="rounded bg-slate-800 px-3 py-2 text-white" onClick={()=>setPage('pacientes')}>Pacientes</button><button type="button" className="rounded bg-slate-800 px-3 py-2 text-white" onClick={()=>setPage('mapas')}>Meus Mapas</button></div></section>}
    {selected==='pacientes'&&clinical&&<PatientsView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
    {selected==='dietas'&&clinical&&<DietasView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} roles={access.roles} getIdToken={getIdToken}/>}
    {selected==='mapas'&&clinical&&<MeusMapasView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
    {selected==='acompanhamento'&&clinical&&<TrackingView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
    {(selected==='painel'||selected==='producao')&&kitchen&&<ProductionView key={selected} organizationId={org} unitIds={access.unitIds} getAuthorization={getAuthorization}/>}
    {selected==='distribuicao'&&kitchen&&<DistributionQueue organizationId={org} unitIds={access.unitIds} getAuthorization={getAuthorization}/>}
    {(selected==='ocorrencias'||selected==='relatorios')&&kitchen&&<ReportingView key={selected} organizationId={org} unitIds={access.unitIds} initialView={selected==='ocorrencias'?'occurrences':'maps'} getAccessToken={getIdToken}/>}
    {selected==='nutricao'&&nutrition&&<NutritionAuditView organizationId={org} unitIds={access.unitIds} getAccessToken={getIdToken}/>}
    {selected==='administracao'&&admin&&<AdministrationView organizationId={org} getToken={getIdToken}/>}
   </div>
  </div>
 </main>;
}
