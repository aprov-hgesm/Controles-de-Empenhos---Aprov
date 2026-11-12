'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import {
  Activity,ArrowRight,BadgeCheck,BookOpenCheck,ChefHat,ChevronRight,ClipboardCheck,
  ClipboardList,FileChartColumn,HeartPulse,Home,LogOut,Menu,PackageCheck,
  ShieldCheck,Stethoscope,UserRound,Users,UtensilsCrossed,X,
  type LucideIcon
} from 'lucide-react';
import {AppShellLogo} from '@/components/layout/chrome/AppShellLogo';
import {getHospitalAuth} from '@/lib/hospital/firebase-client';
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
import {canOpenPage,firstPage,menuForRoles} from './navigation.mjs';
import './hospital-premium.css';

type Allowed=Extract<HospitalWorkspaceAccess,{status:200}>;
type Session=
 | {phase:'checking'}
 | {phase:'signed-out'}
 | {phase:'blocked';status:number;message:string}
 | {phase:'allowed';access:Allowed};

const navIcons:Record<string,LucideIcon>={
 inicio:Home,pacientes:Users,dietas:Stethoscope,mapas:ClipboardList,
 acompanhamento:Activity,painel:ChefHat,producao:UtensilsCrossed,
 distribuicao:PackageCheck,ocorrencias:ClipboardCheck,
 relatorios:FileChartColumn,nutricao:HeartPulse,administracao:ShieldCheck,
};
const roles:ReadonlyArray<{key:string;label:string;description:string}>= [
 {key:'UNIT',label:'Unidade assistencial',description:'Assistência e mapas'},
 {key:'KITCHEN',label:'Cozinha Dietética',description:'Produção e distribuição'},
 {key:'NUTRITION',label:'Nutrição',description:'Auditoria e comunicação'},
 {key:'HOSPITAL_ADMIN',label:'Administração',description:'Gestão institucional'},
];
const pageDescriptions:Record<string,string>={
 inicio:'O essencial para acompanhar o ciclo de refeições da unidade.',
 pacientes:'Cadastro, internações, leitos e movimentações com histórico.',
 dietas:'Referências à prescrição, catálogo e restrições registradas.',
 mapas:'Organize e envie os mapas manualmente, com versões rastreáveis.',
 acompanhamento:'Consulte o andamento dos pedidos de sua unidade.',
 painel:'Visão de trabalho para os ciclos de produção da cozinha.',
 producao:'Formação de lotes, preparo e reconferência de quantidades.',
 distribuicao:'Montagem, expedição, recebimento e confirmação de entrega.',
 ocorrencias:'Acompanhe eventos e registros de operação.',
 relatorios:'Consultas, indicadores e exportações por período.',
 nutricao:'Auditoria independente e acompanhamento de inconformidades.',
 administracao:'Unidades, vínculos, leitos, políticas e auditoria.',
};

export function HospitalShell(){
 const [session,setSession]=useState<Session>({phase:'checking'});
 const [page,setPage]=useState('');
 const [unit,setUnit]=useState('');
 const [notification,setNotification]=useState('');
 const [mobileMenu,setMobileMenu]=useState(false);
 const request=useRef(0);

 useEffect(()=>{
  let mounted=true;
  const unsub=onAuthStateChanged(getHospitalAuth(),async user=>{
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
 useEffect(()=>{
  if(!mobileMenu)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileMenu(false)};
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[mobileMenu]);

 const getIdToken=useCallback(async()=>{
  const user=getHospitalAuth().currentUser;
  if(!user)throw Error('Sessão expirada: entre novamente.');
  return user.getIdToken();
 },[]);
 const getAuthorization=useCallback(async()=> 'Bearer '+await getIdToken(),[getIdToken]);
 const logout=async()=>{
  setMobileMenu(false);
  try{await signOut(getHospitalAuth());}catch{setNotification('Não foi possível encerrar a sessão.')}
 };
 if(session.phase==='checking')return <main className="flex min-h-screen items-center justify-center bg-[#061429] p-6 text-white"><p role="status" className="flex items-center gap-3 text-sm"><Activity className="h-5 w-5 animate-pulse text-sky-300" aria-hidden="true"/>Validando sessão e vínculo hospitalar no servidor…</p></main>;
 if(session.phase==='signed-out')return <main className="flex min-h-screen items-center justify-center bg-[#061429] p-6"><div className="max-w-md rounded-2xl border border-sky-200/20 bg-white p-8 text-slate-900 shadow-2xl"><h1 className="text-2xl font-bold">Sessão hospitalar encerrada</h1><p className="mt-2 text-sm text-slate-600">Faça login no ambiente hospitalar para continuar.</p><a className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-3 font-bold text-white" href="/cozinha-dietetica">Ir ao login hospitalar <ArrowRight size={16}/></a></div></main>;
 if(session.phase==='blocked')return <main className="flex min-h-screen items-center justify-center bg-[#061429] p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-slate-900 shadow-2xl"><ShieldCheck size={34} className="mb-4 text-blue-900"/><h1 className="text-2xl font-bold">Acesso hospitalar não autorizado</h1><p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{session.status}: {session.message}</p><div className="mt-5 flex gap-3"><a className="rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white" href="/cozinha-dietetica">Voltar à entrada</a><button type="button" className="rounded-lg border px-4 py-3 text-sm" onClick={()=>void logout()}>Sair</button></div></div></main>;

 const {access}=session;
 const menu=menuForRoles(access.roles);
 const selected=canOpenPage(access.roles,page)?page:menu[0]?.id??'';
 const current=menu.find(x=>x.id===selected)??menu[0];
 const title=current?.label??'Cozinha Dietética';
 const authorizedUnit=access.unitIds.includes(unit)?unit:access.unitIds[0]??'';
 const clinical=access.roles.includes('UNIT')&&!!authorizedUnit;
 const kitchen=access.roles.includes('KITCHEN')&&access.unitIds.length>0;
 const nutrition=access.roles.includes('NUTRITION')&&access.unitIds.length>0;
 const admin=access.roles.includes('HOSPITAL_ADMIN');
 const org=access.organizationId;
 const activeProfile=roles.find(x=>x.key===current?.role)?.label??'Hospitalar';
 const navigate=(target:string)=>{
  if(!canOpenPage(access.roles,target))return;
  setPage(target);
  setMobileMenu(false);
 };

 return <div className="hospital-operational">
   <header className="hospital-topbar sticky top-0 z-40 flex items-center justify-between gap-4 px-4 sm:px-6" aria-label="Cabeçalho do EMPROVEX hospitalar">
    <div className="flex min-w-0 items-center gap-3">
     <button type="button" className="rounded-lg border border-white/20 p-2 text-white lg:hidden" aria-label={mobileMenu?'Fechar menu':'Abrir menu'} aria-controls="hospital-sidebar" aria-expanded={mobileMenu} onClick={()=>setMobileMenu(open=>!open)}>{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button>
     <AppShellLogo customLogo={null}/>
     <div className="min-w-0">
      <p className="hospital-brand-kicker hidden uppercase sm:block">Gestão hospitalar</p>
      <p className="hospital-brand-title text-base sm:text-lg">EMPROVEX</p>
      <p className="truncate text-[10px] font-semibold tracking-wide text-slate-300">Cozinha Dietética</p>
     </div>
    </div>
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
     <span className="hospital-chip hidden sm:inline-flex"><BadgeCheck size={14} className="text-sky-300"/> Ambiente QA</span>
     <span className="hospital-chip max-w-[145px] truncate sm:max-w-[220px]"><UserRound size={14} className="shrink-0 text-sky-300"/><span className="truncate">{activeProfile}</span></span>
     <button type="button" onClick={()=>void logout()} title="Encerrar sessão" aria-label="Encerrar sessão" className="rounded-xl border border-slate-500/40 p-2.5 text-slate-200 hover:bg-white/10"><LogOut size={18}/></button>
    </div>
   </header>

   {mobileMenu&&<button type="button" className="hospital-mobile-mask fixed inset-0 z-40 lg:hidden" aria-label="Fechar menu lateral" onClick={()=>setMobileMenu(false)}/>}
   <aside id="hospital-sidebar" aria-label="Menu hospitalar" data-open={mobileMenu?'true':'false'} className="hospital-sidebar fixed bottom-0 left-0 top-[72px] z-50 flex w-72 flex-col overflow-y-auto px-3 pb-6 pt-5 lg:z-30">
    <div className="mb-6 rounded-2xl border border-blue-200/10 bg-white/[0.045] px-4 py-4">
     <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/15 text-sky-300"><ChefHat size={22}/></span>
      <div><p className="text-sm font-bold text-white">Operação hospitalar</p><p className="mt-0.5 text-[11px] text-slate-400">Área de trabalho segura</p></div>
     </div>
     <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Perfil autorizado no servidor</div>
    </div>
    <nav aria-label="Navegação hospitalar por perfil" className="flex-1 space-y-5">
     {roles.map(role=>{
       const options=menu.filter(item=>item.role===role.key);
       if(!options.length)return null;
       return <div key={role.key}>
        <p className="hospital-sidebar-label">{role.label}</p>
        <div className="space-y-1">
         {options.map(item=>{
          const Icon=navIcons[item.id]??ChevronRight;
          return <button key={item.id} type="button" data-testid={'hospital-nav-'+item.id} aria-current={selected===item.id?'page':undefined} className="hospital-sidebar-item" onClick={()=>navigate(item.id)}>
            <Icon size={19} className="hospital-nav-icon shrink-0" aria-hidden="true"/>
            <span className="min-w-0 flex-1">{item.label}</span>
            {selected===item.id&&<span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true"/>}
           </button>;
         })}
        </div>
       </div>;
     })}
    </nav>
    <div className="mt-8 border-t border-white/10 px-3 pt-5">
     <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><ShieldCheck size={16} className="text-sky-300"/>Acesso clínico restrito</div>
     <p className="mt-2 text-xs leading-5 text-slate-500">Ambiente exclusivamente de testes. Nenhum paciente real.</p>
     <a href="/cozinha-dietetica" className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-300 hover:text-white">Entrada hospitalar <ArrowRight size={14}/></a>
    </div>
   </aside>

   <main className="min-w-0 pb-14 lg:pl-72" id="hospital-main">
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-7 sm:py-8">
     <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
       <p className="hospital-hint-label">EMPROVEX / {activeProfile}</p>
       <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#122c52] sm:text-3xl">{title}</h1>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-[#0d4da5]">QA sintético</span>
       </div>
       <p className="mt-2 max-w-2xl text-sm leading-6 text-[#627894]">{pageDescriptions[selected]??'Operação hospitalar auditável e restrita.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
       {clinical&&access.unitIds.length>1&&
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
         <span>Unidade</span>
         <select aria-label="Unidade assistencial" className="rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-semibold text-slate-900" value={authorizedUnit} onChange={event=>setUnit(event.target.value)}>
          {access.unitIds.map(id=><option key={id} value={id}>{id}</option>)}
         </select>
        </label>}
       {clinical&&access.unitIds.length===1&&<span className="hospital-secondary-action inline-flex items-center gap-2"><BadgeCheck size={16} className="text-[#1456bc]"/>{authorizedUnit}</span>}
       {!clinical&&access.unitIds.length>0&&<span className="hospital-secondary-action inline-flex items-center gap-2"><BadgeCheck size={16} className="text-[#1456bc]"/>{access.unitIds.length} unidades autorizadas</span>}
      </div>
     </div>

     {notification&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{notification}</div>}

     {selected==='inicio'&&clinical&&
      <section className="hospital-panel overflow-hidden p-5 sm:p-7" aria-label="Atalhos para operação da unidade">
       <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="hospital-hint-label">Sua unidade · {authorizedUnit}</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">Próximas ações</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cadastre pacientes e transcreva referências da prescrição vigente antes de montar e enviar o mapa manualmente.</p></div>
        <BookOpenCheck size={27} className="text-[#1d5fcb]" aria-hidden="true"/>
       </div>
       <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {([
         ['pacientes','Pacientes','Cadastrar, internar e movimentar pacientes',Users],
         ['dietas','Dietas prescritas','Conferir e registrar a referência médica',Stethoscope],
         ['mapas','Meus Mapas','Montar e enviar mapas 06h, 10h e 16h',ClipboardList],
        ] as const).map(([id,label,description,Icon])=>
         <button key={id} type="button" className="hospital-kpi group flex items-start gap-3 text-left transition-colors hover:bg-slate-50" onClick={()=>navigate(id)}>
          <span className="hospital-kpi-icon shrink-0"><Icon size={20}/></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-[#18375d]">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
          <ChevronRight size={16} className="mt-2 shrink-0 text-slate-400 group-hover:text-blue-700"/>
         </button>
        )}
       </div>
       <div className="hospital-panel-soft mt-6 flex flex-wrap items-start gap-3 p-4 text-xs leading-5 text-[#4d6689]">
        <Activity size={17} className="mt-0.5 shrink-0 text-[#1d5fcb]"/>
        <p>Os mapas são enviados até 06h, 10h e 16h. A tolerância de entrega da refeição principal termina às 06h30, 10h30 e 16h30 — não amplia o horário de envio. Urgências seguem o protocolo assistencial.</p>
       </div>
      </section>}
     <div className="hospital-content min-w-0" data-testid={'hospital-page-'+selected}>
      {selected==='pacientes'&&clinical&&<PatientsView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
      {selected==='dietas'&&clinical&&<DietasView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} roles={access.roles} getIdToken={getIdToken}/>}
      {selected==='mapas'&&clinical&&<MeusMapasView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
      {selected==='acompanhamento'&&clinical&&<TrackingView key={authorizedUnit} organizationId={org} unitId={authorizedUnit} getIdToken={getIdToken}/>}
      {selected==='painel'&&kitchen&&<div className="hospital-panel mb-4 flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="hospital-hint-label">Ações operacionais</p><p className="mt-1 text-sm text-slate-500">Consulte os indicadores do ciclo e avance para as etapas específicas.</p></div><div className="flex flex-wrap gap-2"><button className="hospital-primary-action" onClick={()=>navigate('producao')}>Abrir Produção</button><button className="hospital-secondary-action" onClick={()=>navigate('distribuicao')}>Distribuição</button><button className="hospital-secondary-action" onClick={()=>navigate('relatorios')}>Relatórios</button></div></div>}
      {(selected==='painel'||selected==='producao')&&kitchen&&<ProductionView key={selected} mode={selected==='painel'?'overview':'operations'} organizationId={org} unitIds={access.unitIds} getAuthorization={getAuthorization}/>}
      {selected==='distribuicao'&&kitchen&&<DistributionQueue organizationId={org} unitIds={access.unitIds} getAuthorization={getAuthorization}/>}
      {(selected==='ocorrencias'||selected==='relatorios')&&kitchen&&<ReportingView key={selected} organizationId={org} unitIds={access.unitIds} initialView={selected==='ocorrencias'?'occurrences':'maps'} getAccessToken={getIdToken}/>}
      {selected==='nutricao'&&nutrition&&<NutritionAuditView organizationId={org} unitIds={access.unitIds} getAccessToken={getIdToken}/>}
      {selected==='administracao'&&admin&&<AdministrationView organizationId={org} getToken={getIdToken}/>}
     </div>
     <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dce6f4] pt-5 text-[11px] text-[#8192ac]"><span>EMPROVEX · Cozinha Dietética</span><span>Ambiente hospitalar QA · Dados exclusivamente fictícios</span></footer>
    </div>
   </main>
 </div>;
}
