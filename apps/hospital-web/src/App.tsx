import {lazy,Suspense,useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,type User} from 'firebase/auth';
import {LogOut,Menu,ShieldCheck,Activity,Users,ClipboardList,PackageCheck,LockKeyhole,Mail,Eye,EyeOff,ArrowRight,ArrowUpRight,LayoutDashboard,UserRound,Utensils,FileText,Settings2,Stethoscope,Truck,CalendarClock,X} from 'lucide-react';
import {auth} from './firebase';
import {menuForRoles} from './features/hospital/integration/navigation.mjs';
const PatientsView=lazy(()=>import('./features/hospital/patients/PatientsView').then(m=>({default:m.PatientsView})));
const DietasView=lazy(()=>import('./features/hospital/diets/DietasView').then(m=>({default:m.DietasView})));
const MeusMapasView=lazy(()=>import('./features/hospital/maps/MeusMapasView').then(m=>({default:m.MeusMapasView})));
const TrackingView=lazy(()=>import('./features/hospital/integration/TrackingView').then(m=>({default:m.TrackingView})));
const ProductionView=lazy(()=>import('./features/hospital/production/ProductionView').then(m=>({default:m.ProductionView})));
const DistributionQueue=lazy(()=>import('./features/hospital/integration/DistributionQueue').then(m=>({default:m.DistributionQueue})));
const KitchenMapsBoard=lazy(()=>import('./features/hospital/integration/KitchenMapsBoard').then(m=>({default:m.KitchenMapsBoard})));
const ReportingView=lazy(()=>import('./features/hospital/reporting/ReportingView').then(m=>({default:m.ReportingView})));
const NutritionAuditView=lazy(()=>import('./features/hospital/nutrition-audit/NutritionAuditView').then(m=>({default:m.NutritionAuditView})));
const AdministrationView=lazy(()=>import('./features/hospital/administration/AdministrationView').then(m=>({default:m.AdministrationView})));

type Role='UNIT'|'KITCHEN'|'NUTRITION'|'HOSPITAL_ADMIN';
const roleLabels:Record<Role,string>={UNIT:'Unidade Assistencial',KITCHEN:'Cozinha Dietética',NUTRITION:'Nutrição',HOSPITAL_ADMIN:'Administrador'};
type Access={status:200;organizationId:string;roles:Role[];unitIds:string[]};
type ErrorAccess={status:401|403|503;message:string};
type ResponseAccess=Access|ErrorAccess;
type Focus={unitId:string;cycleId:'06'|'10'|'16';localDate:string;mealType?:'PRIMARY'|'SECONDARY'};
type Profile={id:string;role:Role;label:string;detail:string;unitId?:string};
const clinicalUnits:Record<string,string>={upi:'UPI',uti:'UTI',pam:'PAM',onco:'Oncologia',bloco:'Bloco Cirúrgico'};
const emblem='/emblema-nutricao.webp';
function ProfileIcon({role}:{role:Role}){
  if(role==='HOSPITAL_ADMIN')return <ShieldCheck size={20}/>;
  if(role==='KITCHEN')return <Utensils size={20}/>;
  if(role==='NUTRITION')return <Stethoscope size={20}/>;
  return <UserRound size={20}/>;
}
function MenuIcon({id}:{id:string}){
  if(id==='inicio'||id==='painel')return <LayoutDashboard className="hospital-nav-icon"/>;
  if(id==='pacientes')return <Users className="hospital-nav-icon"/>;
  if(id==='dietas'||id==='nutricao')return <Stethoscope className="hospital-nav-icon"/>;
  if(id==='mapas')return <ClipboardList className="hospital-nav-icon"/>;
  if(id==='acompanhamento')return <CalendarClock className="hospital-nav-icon"/>;
  if(id==='producao')return <Utensils className="hospital-nav-icon"/>;
  if(id==='distribuicao')return <Truck className="hospital-nav-icon"/>;
  if(id==='administracao')return <Settings2 className="hospital-nav-icon"/>;
  if(id==='catalogo')return <Utensils className="hospital-nav-icon"/>;
  return <FileText className="hospital-nav-icon"/>;
}

function profileOptions(access:Access):Profile[]{
  const choices:Profile[]=[];
  const {roles,unitIds}=access;
  if(roles.includes('HOSPITAL_ADMIN'))choices.push({
    id:'admin',role:'HOSPITAL_ADMIN',label:'Administrador',detail:'Gestão hospitalar e permissões'
  });
  if(roles.includes('UNIT')){
    for(const id of unitIds.filter(id=>id!=='copa'&&id!=='nutricao')){
      choices.push({id:'unit:'+id,role:'UNIT',label:clinicalUnits[id]??id.toUpperCase(),
        detail:'Pacientes, dietas, mapas e acompanhamento',unitId:id});
    }
  }
  if(roles.includes('KITCHEN'))choices.push({
    id:'kitchen',role:'KITCHEN',label:'Cozinha Dietética',detail:'Painel, produção e distribuição'
  });
  if(roles.includes('NUTRITION'))choices.push({
    id:'nutrition',role:'NUTRITION',label:'Nutrição',detail:'Auditoria nutricional'
  });
  return choices;
}

const preset=import.meta.env.VITE_HOSPITAL_ORGANIZATION_ID?.trim()??'';

async function requestAccess(user:User,hospital:string):Promise<ResponseAccess>{
  const token=await user.getIdToken();
  const response=await fetch('/api/hospital/session',{
    method:'POST',cache:'no-store',credentials:'same-origin',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'x-hospital-organization-id':hospital},
    body:JSON.stringify({organizationId:hospital})
  });
  let data:unknown;
  try{data=await response.json()}catch{throw Error('A API hospitalar ainda não está conectada ao site.');}
  if(!data||typeof data!=='object')throw Error('Resposta de sessão inválida.');
  const row=data as Record<string,unknown>;
  // Endpoint /api/hospital/session returns a trusted, server-verified scope, not client roles.
  if(response.ok&&row.status===200&&typeof row.organizationId==='string'&&Array.isArray(row.roles)&&Array.isArray(row.unitIds)){
    const roles=row.roles.filter(x=>['UNIT','KITCHEN','NUTRITION','HOSPITAL_ADMIN'].includes(String(x))) as Role[];
    const unitIds=row.unitIds.filter((x):x is string=>typeof x==='string');
    if(!roles.length||(!unitIds.length&&!roles.includes('HOSPITAL_ADMIN')))throw Error('Nenhuma unidade e perfil foram vinculados à sua conta.');
    return {status:200,organizationId:row.organizationId,roles,unitIds};
  }
  const status=response.status===401?401:response.status===403?403:503;
  return {status,message:typeof row.message==='string'?row.message:'Não foi possível verificar seu acesso hospitalar.'};
}

export function App(){
  const [user,setUser]=useState<User|null|undefined>(undefined);
  const [hospital,setHospital]=useState(preset);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [access,setAccess]=useState<ResponseAccess|null>(null);
  const [checking,setChecking]=useState(false);
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState('');
  const [profile,setProfile]=useState<Profile|null>(null);
  const [unit,setUnit]=useState('');
  const [focus,setFocus]=useState<Focus|null>(null);
  const [mobileMenu,setMobileMenu]=useState(false);
  const getIdToken=useCallback(async()=>{
    const current=auth.currentUser;
    if(!current)throw Error('Sua sessão expirou. Entre novamente.');
    return current.getIdToken();
  },[]);
  const getAuthorization=useCallback(async()=> 'Bearer '+await getIdToken(),[getIdToken]);

  useEffect(()=>onAuthStateChanged(auth,next=>{
    setUser(next);setAccess(null);setPage('');setUnit('');setProfile(null);setNotice('');
  }),[]);
  useEffect(()=>{
    if(!user||!hospital.trim())return;
    let active=true;
    setChecking(true);
    void requestAccess(user,hospital.trim()).then(data=>{
      if(!active)return;
      setAccess(data);
      if(data.status===200){setProfile(null);setUnit('');setPage('');}
    }).catch(error=>{
      if(active)setAccess({status:503,message:error instanceof Error?error.message:'API hospitalar indisponível'});
    }).finally(()=>{if(active)setChecking(false)});
    return ()=>{active=false};
  },[user,hospital,retry]);

  const login=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    setBusy(true);setNotice('');
    try{await signInWithEmailAndPassword(auth,email.trim(),password);setPassword('');}
    catch{setNotice('Não foi possível autenticar. Confira as credenciais.');}
    finally{setBusy(false)}
  };
  const resetPassword=async()=>{
    if(!email.trim()){setNotice('Informe seu e-mail para recuperar a senha.');return}
    setBusy(true);
    try{await sendPasswordResetEmail(auth,email.trim())}catch{}
    finally{setBusy(false);setNotice('Se o e-mail estiver cadastrado, receberá instruções de recuperação.');}
  };
  const logout=async()=>{await signOut(auth);setUser(null);setAccess(null);setProfile(null);setPage('');};

  const allowed=access&&access.status===200?access:null;
  const roleNames=useMemo(()=>profile?[profile.role]:[],[profile]);
  const menu=useMemo(()=>menuForRoles(roleNames),[roleNames]);
  const organizationId=allowed?.organizationId??'';
  const careIds=(allowed?.unitIds??[]).filter(id=>id!=='copa'&&id!=='nutricao');
  const unitIds=profile?.role==='UNIT'&&profile.unitId?[profile.unitId]:
    profile?.role==='KITCHEN'||profile?.role==='NUTRITION'?careIds:[];
  const unitId=unitIds.includes(unit)?unit:unitIds[0]??'';
  const roles=roleNames;
  const canUnit=roles.includes('UNIT')&&!!unitId;
  const kitchen=roles.includes('KITCHEN')&&unitIds.length>0;
  const nutrition=roles.includes('NUTRITION')&&unitIds.length>0;
  const admin=roles.includes('HOSPITAL_ADMIN');
  const chooseProfile=(choice:Profile)=>{
    setProfile(choice);setUnit(choice.unitId??'');
    setPage(menuForRoles([choice.role])[0]?.id??'');
    setFocus(null);setMobileMenu(false);
  };
  const open=(id:string)=>{if(menu.some(item=>item.id===id)){setPage(id);setMobileMenu(false);}};

  if(user===undefined)return <main className="hospital-selection">
    <div className="flex flex-col items-center gap-5 text-center text-white" role="status" aria-live="polite">
      <span className="hospital-logo-medallion"><img src={emblem} alt="Emblema da Cozinha Dietética"/></span>
      <p className="text-sm font-semibold tracking-wide">Verificando sua sessão hospitalar…</p>
    </div>
  </main>;

  if(!user)return <main className="hospital-login">
    <div className="hospital-login-shell">
      <section className="hospital-login-hero" aria-label="Identidade Cozinha Dietética">
        <div className="hospital-hero-top">
          <span className="hospital-logo-medallion">
            <img src={emblem} alt="Emblema de Nutrição Hospitalar" width={108} height={108}/>
          </span>
          <p className="hospital-hero-eyebrow">Hospital Geral de Santa Maria</p>
          <h1 className="hospital-hero-title">Cada dieta,<em> um cuidado.</em></h1>
          <p className="hospital-hero-lead">Inteligência e precisão na gestão nutricional hospitalar. Do mapa alimentar à distribuição, cada etapa importa.</p>
        </div>
        <div className="hospital-hero-bottom">
          <div className="hospital-hero-separator"/>
          <p>COZINHA DIETÉTICA · HGESM</p>
          <p>Organização, segurança e cuidado no mesmo ambiente.</p>
        </div>
      </section>
      <section className="hospital-login-form-side" aria-labelledby="hospital-login-title">
        <span className="hospital-login-caption">Portal institucional</span>
        <h2 className="hospital-form-title" id="hospital-login-title">Bem-vindo de volta.</h2>
        <p className="hospital-form-subtitle">Acesse sua área de trabalho com as credenciais autorizadas pelo hospital.</p>
        <form onSubmit={login} className="hospital-login-form">
          <label className="hospital-field-label" htmlFor="hospital-login-email">E-mail institucional ou cadastrado
            <span className="hospital-input-wrap">
              <Mail size={18} aria-hidden="true"/>
              <input id="hospital-login-email" className="hospital-input" autoComplete="username" type="email"
                placeholder="seu.email@hospital.br" required value={email} onChange={e=>setEmail(e.target.value)}/>
            </span>
          </label>
          <label className="hospital-field-label" htmlFor="hospital-login-password">Senha de acesso
            <span className="hospital-input-wrap">
              <LockKeyhole size={18} aria-hidden="true"/>
              <input id="hospital-login-password" className="hospital-input" autoComplete="current-password"
                type={showPassword?'text':'password'} placeholder="Digite sua senha"
                required value={password} onChange={e=>setPassword(e.target.value)}/>
              <button type="button" className="hospital-reveal-password"
                aria-label={showPassword?'Ocultar senha':'Mostrar senha'} aria-pressed={showPassword}
                onClick={()=>setShowPassword(v=>!v)}>
                {showPassword?<EyeOff size={19}/>:<Eye size={19}/>}
              </button>
            </span>
          </label>
          <button className="hospital-login-primary" type="submit" disabled={busy}>
            {busy?'Autenticando…':'Entrar no sistema'}{!busy&&<ArrowRight size={18} aria-hidden="true"/>}
          </button>
        </form>
        <div className="mt-5 text-right"><button type="button" onClick={()=>void resetPassword()} disabled={busy} className="hospital-login-link">Esqueceu a senha?</button></div>
        {notice&&<p role="status" className="hospital-auth-message">{notice}</p>}
        <div className="hospital-login-note"><ShieldCheck size={18} aria-hidden="true"/>
          <span>Autenticação protegida pelo Firebase. Seus perfis e unidades são validados pelo servidor.</span>
        </div>
      </section>
    </div>
  </main>;

  if(!hospital.trim())return <main className="hospital-selection">
    <form onSubmit={e=>{e.preventDefault();setHospital((e.currentTarget.elements.namedItem('hospital') as HTMLInputElement).value.trim())}}
      className="hospital-selection-panel" style={{maxWidth:520}}>
      <div className="mb-5 flex items-center gap-4">
        <span className="hospital-profile-mark"><img src={emblem} alt="Emblema de Nutrição Hospitalar"/></span>
        <div><span className="hospital-workspace-kicker">Identificação institucional</span>
          <h1 className="hospital-selection-title">Selecionar hospital</h1></div>
      </div>
      <p className="hospital-selection-subtitle">Informe o código fornecido pela administração. Esta etapa pode ser pré-configurada.</p>
      <input name="hospital" className="hospital-input mt-5 !pl-4" placeholder="Código do hospital" required/>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="hospital-login-primary !w-auto px-6">Continuar <ArrowRight size={17}/></button>
        <button type="button" className="hospital-selection-exit" onClick={()=>void logout()}>Sair</button>
      </div>
    </form>
  </main>;

  if(checking||!access)return <main className="hospital-selection">
    <div className="flex flex-col items-center gap-5 text-center text-white" role="status">
      <span className="hospital-logo-medallion"><img src={emblem} alt="Emblema de Nutrição Hospitalar"/></span>
      <p className="text-sm font-semibold">Verificando vínculo e permissões no servidor…</p>
    </div>
  </main>;

  if(!allowed)return <main className="hospital-selection">
    <section className="hospital-selection-panel" style={{maxWidth:520}}>
      <div className="mb-5 flex items-center gap-4">
        <span className="hospital-profile-mark"><img src={emblem} alt="Emblema de Nutrição Hospitalar"/></span>
        <div><span className="hospital-workspace-kicker">Acesso institucional</span>
          <h1 className="hospital-selection-title">Acesso não concluído</h1></div>
      </div>
      <p role="alert" className="hospital-auth-message">{'message' in access?access.message:'Não foi possível validar seu acesso.'}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="hospital-login-primary !w-auto px-6" onClick={()=>setRetry(v=>v+1)}>Tentar novamente <ArrowRight size={17}/></button>
        <button type="button" className="hospital-selection-exit" onClick={()=>void logout()}>Sair</button>
      </div>
    </section>
  </main>;

  if(!profile || !profileOptions(allowed).some(option=>option.id===profile.id)){
    return <main className="hospital-selection">
      <section className="hospital-selection-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hospital-profile-mark"><img src={emblem} alt="Emblema de Nutrição Hospitalar"/></span>
            <div className="min-w-0">
              <span className="hospital-workspace-kicker">Cozinha Dietética · HGeSM</span>
              <h1 className="hospital-selection-title mt-1">Escolha seu ambiente</h1>
              <p className="hospital-selection-subtitle break-words">Olá, {user.email}. Selecione o perfil que deseja acessar.</p>
            </div>
          </div>
          <button type="button" className="hospital-selection-exit" onClick={()=>void logout()}>Sair <LogOut className="ml-1 inline-block" size={15}/></button>
        </div>
        <div className="hospital-profile-grid">
          {profileOptions(allowed).map(choice=><button type="button" key={choice.id}
            onClick={()=>chooseProfile(choice)} className="hospital-profile-card">
            <span className="hospital-profile-icon"><ProfileIcon role={choice.role}/></span>
            <strong>{choice.label}</strong>
            <small>{choice.detail}</small>
            <span className="hospital-profile-enter">Acessar ambiente <ArrowUpRight size={15} aria-hidden="true"/></span>
          </button>)}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-slate-500"><ShieldCheck size={15} className="mr-2 inline-block text-emerald-700"/>Os ambientes disponíveis são determinados pelas suas permissões no servidor.</p>
      </section>
    </main>;
  }

  return <div className="hospital-operational min-h-screen">
    <header className="hospital-topbar sticky top-0 z-40 flex items-center justify-between gap-3 px-4 text-white md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label={mobileMenu?'Fechar navegação':'Abrir navegação'}
          aria-expanded={mobileMenu} className="hospital-top-action !p-2 lg:hidden"
          onClick={()=>setMobileMenu(!mobileMenu)}>{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button>
        <span className="hospital-header-mark"><img src={emblem} alt="Emblema da Cozinha Dietética"/></span>
        <div className="min-w-0">
          <p className="hospital-topbar-title truncate">COZINHA DIETÉTICA</p>
          <p className="hospital-topbar-subtitle">Hospital Geral de Santa Maria</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 text-sm">
        <span className="hospital-top-profile hidden md:inline">{profile.label}</span>
        <button type="button" onClick={()=>{setProfile(null);setPage('');setFocus(null);}}
          className="hospital-top-action" title="Selecionar outro perfil">
          <ArrowRight size={15} aria-hidden="true"/><span className="hidden sm:inline">Trocar perfil</span><span className="sm:hidden">Perfis</span>
        </button>
        <button type="button" onClick={()=>void logout()} className="hospital-top-action !p-[10px]"
          aria-label="Encerrar sessão" title="Sair"><LogOut size={18}/></button>
      </div>
    </header>
    <div className="flex">
      {mobileMenu&&<button type="button" className="hospital-mobile-mask lg:hidden"
        aria-label="Fechar o menu lateral" onClick={()=>setMobileMenu(false)}/>}
      <aside data-open={mobileMenu?'true':'false'}
        className={"hospital-sidebar fixed bottom-0 top-[76px] z-50 w-64 overflow-y-auto p-4 text-white lg:sticky lg:h-[calc(100vh-76px)] "+(mobileMenu?'left-0':'-left-80 lg:left-0')}>
        <div className="hospital-sidebar-head">
          <span>Ambiente selecionado</span>
          <strong>{profile.label}</strong>
        </div>
        <p className="hospital-hint-label mb-3 !text-[#bfa96c]">Navegação</p>
        <nav aria-label="Navegação hospitalar" className="space-y-1">
          {menu.map(item=><button key={item.id} type="button" onClick={()=>open(item.id)}
            aria-current={item.id===page?'page':undefined}
            className="hospital-sidebar-item">
            <MenuIcon id={item.id}/>
            <span>{item.label}</span>
          </button>)}
        </nav>
        <div className="mt-6 border-t border-white/10 pt-5 text-xs text-slate-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#bfa96c]">Organização</p>
          <p className="mt-2 font-semibold text-white">Hospital Geral de Santa Maria</p>
          <p className="mt-1 text-[#b8d1c1]">Código: {organizationId.toUpperCase()}</p>
          {canUnit&&unitIds.length>1&&<select className="mt-3 w-full rounded-lg bg-white p-2.5 font-semibold text-emerald-900"
            aria-label="Unidade assistencial" value={unitId}
            onChange={e=>setUnit(e.target.value)}>
            {unitIds.map(id=><option key={id} value={id}>{clinicalUnits[id]??id.toUpperCase()}</option>)}
          </select>}
        </div>
        <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-[#b8d1c1]">
          <ShieldCheck size={17} className="text-[#e4c26b]"/> Acesso restrito e autorizado
        </div>
      </aside>
      <main className="hospital-content min-w-0 flex-1 p-4 md:p-7">
        <div className="hospital-workspace-banner">
          <div>
            <span className="hospital-workspace-kicker">Operação hospitalar · HGeSM</span>
            <h2 className="hospital-workspace-title">{profile.label}</h2>
            <p className="hospital-workspace-desc">{menu.find(item=>item.id===page)?.label??'Gestão de dietas hospitalares'} · Ambiente autorizado</p>
          </div>
          <span className="hospital-workspace-seal"><img src={emblem} alt="" className="h-full w-full object-contain rounded-full"/></span>
        </div>
        <Suspense fallback={<div className="hospital-loading" role="status" aria-live="polite">Carregando seu ambiente de trabalho…</div>}>
        {page==='pacientes'&&canUnit&&<PatientsView organizationId={organizationId} unitId={unitId} getIdToken={getIdToken}/>}
        {page==='dietas'&&canUnit&&<DietasView organizationId={organizationId} unitId={unitId} roles={roles} getIdToken={getIdToken}/>}
        {canUnit&&<section hidden={page!=='mapas'} aria-label="Solicitação de dietas em andamento">
          <MeusMapasView organizationId={organizationId} unitId={unitId} unitLabel={clinicalUnits[unitId]??unitId} getIdToken={getIdToken} onTrack={()=>open('acompanhamento')}/>
        </section>}
        {page==='acompanhamento'&&canUnit&&<TrackingView organizationId={organizationId} unitId={unitId} getIdToken={getIdToken}/>}
        {page==='painel'&&kitchen&&<KitchenMapsBoard organizationId={organizationId} unitIds={unitIds}
          getAuthorization={getAuthorization}
          onOpenProduction={f=>{setFocus(f);open('producao')}}
          onOpenDistribution={f=>{setFocus(f);open('distribuicao')}}/>}
        {page==='producao'&&kitchen&&<ProductionView organizationId={organizationId} unitIds={unitIds}
          getAuthorization={getAuthorization} initialDate={focus?.localDate} initialCycle={focus?.cycleId}
          initialUnitId={focus?.unitId} initialMealType={focus?.mealType}
          onOpenDistribution={f=>{setFocus(f);open('distribuicao')}}/>}
        {page==='distribuicao'&&kitchen&&<DistributionQueue organizationId={organizationId} unitIds={unitIds}
          getAuthorization={getAuthorization} initialDate={focus?.localDate} initialCycle={focus?.cycleId}
          initialUnitId={focus?.unitId} initialMealType={focus?.mealType}
          onOpenProduction={f=>{setFocus(f);open('producao')}}/>}
        {(page==='relatorios'||page==='ocorrencias')&&kitchen&&<ReportingView organizationId={organizationId}
          unitIds={unitIds} getAccessToken={getIdToken} initialView={page==='ocorrencias'?'occurrences':'maps'}/>}
        {page==='nutricao'&&nutrition&&<NutritionAuditView organizationId={organizationId} unitIds={unitIds} getAccessToken={getIdToken}/>}
        {page==='administracao'&&admin&&<AdministrationView organizationId={organizationId} getToken={getIdToken}/>}
        {page==='catalogo'&&admin&&<DietasView organizationId={organizationId} roles={['HOSPITAL_ADMIN']} getIdToken={getIdToken}/>} 
        </Suspense>
        {notice&&<p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm">{notice}</p>}
        <footer className="hospital-content-footer mt-8 flex flex-wrap items-center gap-2 pt-4">
          <Activity size={14}/> Gestão hospitalar independente · sessão individual e eventos auditáveis
          <Users size={14} className="ml-3"/> {roles.map(role=>roleLabels[role]).join(', ')} <PackageCheck size={14} className="ml-3"/>
        </footer>
      </main>
    </div>
  </div>;
}
