import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,type User} from 'firebase/auth';
import {ChefHat,LogOut,Menu,ShieldCheck,Activity,Users,ClipboardList,PackageCheck} from 'lucide-react';
import {auth} from './firebase';
import {menuForRoles} from './features/hospital/integration/navigation.mjs';
import {PatientsView} from './features/hospital/patients/PatientsView';
import {DietasView} from './features/hospital/diets/DietasView';
import {MeusMapasView} from './features/hospital/maps/MeusMapasView';
import {TrackingView} from './features/hospital/integration/TrackingView';
import {ProductionView} from './features/hospital/production/ProductionView';
import {DistributionQueue} from './features/hospital/integration/DistributionQueue';
import {KitchenMapsBoard} from './features/hospital/integration/KitchenMapsBoard';
import {ReportingView} from './features/hospital/reporting/ReportingView';
import {NutritionAuditView} from './features/hospital/nutrition-audit/NutritionAuditView';
import {AdministrationView} from './features/hospital/administration/AdministrationView';
import {UnitMapStatusCard} from './features/hospital/integration/UnitMapStatusCard';

type Role='UNIT'|'KITCHEN'|'NUTRITION'|'HOSPITAL_ADMIN';
const roleLabels:Record<Role,string>={UNIT:'Unidade Assistencial',KITCHEN:'Cozinha Dietética',NUTRITION:'Nutrição',HOSPITAL_ADMIN:'Administrador'};
type Access={status:200;organizationId:string;roles:Role[];unitIds:string[]};
type ErrorAccess={status:401|403|503;message:string};
type ResponseAccess=Access|ErrorAccess;
type Focus={unitId:string;cycleId:'06'|'10'|'16';localDate:string;mealType?:'PRIMARY'|'SECONDARY'};
type Profile={id:string;role:Role;label:string;detail:string;unitId?:string};
const clinicalUnits:Record<string,string>={upi:'UPI',uti:'UTI',pam:'PAM',onco:'Oncologia',bloco:'Bloco Cirúrgico'};
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
  const heading=(title:string)=> <header className="mb-5 flex items-center gap-3">
    <ChefHat size={24} className="text-blue-800"/><h1 className="text-xl font-extrabold text-slate-800">{title}</h1>
  </header>;

  if(user===undefined)return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Verificando autenticação…</main>;
  if(!user)return <main className="grid min-h-screen place-items-center bg-[#061429] p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
      <div className="flex items-center gap-3"><ChefHat size={34} className="text-blue-900"/>
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Gestão hospitalar independente</p>
        <h1 className="text-2xl font-black text-slate-900">Cozinha Dietética</h1></div>
      </div>
      <p className="mt-4 text-sm text-slate-600">Mapas, produção, distribuição e rastreabilidade em um único sistema.</p>
      <form onSubmit={login} className="mt-6 space-y-3">
        <label className="block text-sm font-semibold">E-mail
          <input className="mt-1 w-full rounded-lg border p-3" autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label className="block text-sm font-semibold">Senha
          <input className="mt-1 w-full rounded-lg border p-3" autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="w-full rounded-lg bg-blue-900 p-3 font-bold text-white disabled:opacity-50" type="submit" disabled={busy}>Entrar</button>
      </form>
      <button type="button" onClick={()=>void resetPassword()} className="mt-4 text-sm font-semibold text-blue-800">Recuperar senha</button>
      {notice&&<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> Acesso individual por hospital e unidade.</p>
    </div>
  </main>;

  if(!hospital.trim())return <main className="grid min-h-screen place-items-center bg-[#061429] p-4">
    <form onSubmit={e=>{e.preventDefault();setHospital((e.currentTarget.elements.namedItem('hospital') as HTMLInputElement).value.trim())}}
      className="w-full max-w-md rounded-2xl bg-white p-7">
      <h1 className="text-xl font-bold">Selecionar hospital</h1>
      <p className="mt-2 text-sm text-slate-600">Informe o código fornecido pela administração. Esta etapa pode ser pré-configurada na instalação.</p>
      <input name="hospital" className="mt-5 w-full rounded-lg border p-3" placeholder="Código do hospital" required/>
      <button className="mt-4 rounded-lg bg-blue-900 px-5 py-3 font-bold text-white">Continuar</button>
      <button type="button" className="ml-4 text-sm text-blue-900" onClick={()=>void logout()}>Sair</button>
    </form>
  </main>;

  if(checking||!access)return <main className="grid min-h-screen place-items-center bg-[#061429] text-white">
    <p role="status">Verificando vínculo e permissões no servidor…</p>
  </main>;
  if(!allowed)return <main className="grid min-h-screen place-items-center bg-[#061429] p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-7 text-slate-900">
      <h1 className="text-xl font-bold">Acesso não concluído</h1>
      <p role="alert" className="my-4 rounded-lg bg-amber-50 p-4 text-sm">{'message' in access?access.message:'Não foi possível validar seu acesso.'}</p>
      <button type="button" className="rounded-lg bg-blue-900 px-4 py-3 text-white" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button>
      <button type="button" className="ml-3 rounded-lg border px-4 py-3" onClick={()=>void logout()}>Sair</button>
    </div>
  </main>;

  if(!profile || !profileOptions(allowed).some(option=>option.id===profile.id)){
    return <main className="grid min-h-screen place-items-center bg-[#061429] p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Cozinha Dietética</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Escolha o perfil de acesso</h1>
            <p className="mt-2 text-sm text-slate-600">Hospital Geral de Santa Maria · {user.email}</p></div>
          <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void logout()}>Sair</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {profileOptions(allowed).map(choice=><button type="button" key={choice.id}
            onClick={()=>chooseProfile(choice)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
            <p className="font-bold text-slate-900">{choice.label}</p>
            <p className="mt-2 text-sm text-slate-600">{choice.detail}</p>
            <p className="mt-3 text-sm font-semibold text-blue-800">Entrar neste perfil</p>
          </button>)}
        </div>
        <p className="mt-5 text-xs text-slate-500">Os acessos disponíveis são definidos pelas permissões do seu usuário no servidor.</p>
      </div>
    </main>;
  }

  return <div className="hospital-operational min-h-screen">
    <header className="hospital-topbar sticky top-0 z-40 flex items-center justify-between px-4 text-white md:px-7">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Alternar menu" className="rounded-lg p-2 lg:hidden" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button>
        <ChefHat size={26} className="text-sky-300"/>
        <div><p className="text-sm font-black tracking-wide">COZINHA DIETÉTICA</p>
          <p className="text-xs text-slate-300">Gestão hospitalar</p></div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden max-w-48 truncate text-slate-300 sm:inline">{organizationId} · {profile.label}</span>
        <button type="button" onClick={()=>{setProfile(null);setPage('');setFocus(null);}} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">Trocar perfil</button>
        <button type="button" onClick={()=>void logout()} className="rounded-lg border border-white/20 p-2" title="Sair"><LogOut size={18}/></button>
      </div>
    </header>
    <div className="flex">
      <aside className={"hospital-sidebar fixed bottom-0 top-[72px] z-30 w-64 p-4 text-white lg:sticky lg:h-[calc(100vh-72px)] "+(mobileMenu?'left-0':'-left-72 lg:left-0')}>
        <nav aria-label="Navegação hospitalar" className="space-y-1">
          {menu.map(item=><button key={item.id} type="button" onClick={()=>open(item.id)}
            aria-current={item.id===page?'page':undefined}
            className={"hospital-sidebar-item block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold "+(page===item.id?'bg-blue-600/30 text-white':'text-slate-300 hover:bg-white/10')}>
            {item.label}
          </button>)}
        </nav>
        <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-300">
          <p>Hospital: {organizationId}</p>
          {canUnit&&unitIds.length>1&&<select className="mt-2 w-full rounded bg-white p-2 text-slate-900" aria-label="Unidade assistencial" value={unitId}
            onChange={e=>setUnit(e.target.value)}>{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select>}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-7">
        {page==='inicio'&&canUnit&&<section>{heading('Visão da unidade')}
          <div className="grid gap-3 md:grid-cols-3">
            {(['06','10','16'] as const).map(c=><button key={c} className="hospital-panel p-4 text-left" type="button" onClick={()=>open('mapas')}>
              <ClipboardList size={22} className="mb-2 text-blue-900"/>
              <p className="text-xl font-black">{c}h</p><p className="text-sm">Abrir mapa alimentar</p>
            </button>)}
          </div>
          <div className="mt-5"><UnitMapStatusCard organizationId={organizationId} unitId={unitId} getIdToken={getIdToken}
            onOpen={()=>open('acompanhamento')} onRequest={()=>open('mapas')}/></div>
        </section>}
        {page==='pacientes'&&canUnit&&<PatientsView organizationId={organizationId} unitId={unitId} getIdToken={getIdToken}/>}
        {page==='dietas'&&canUnit&&<DietasView organizationId={organizationId} unitId={unitId} roles={roles} getIdToken={getIdToken}/>}
        {page==='mapas'&&canUnit&&<MeusMapasView organizationId={organizationId} unitId={unitId} unitLabel={unitId} getIdToken={getIdToken}/>}
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
        {notice&&<p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm">{notice}</p>}
        <footer className="mt-8 flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-slate-500">
          <Activity size={14}/> Gestão hospitalar independente · sessão individual e eventos auditáveis
          <Users size={14} className="ml-3"/> {roles.map(role=>roleLabels[role]).join(', ')} <PackageCheck size={14} className="ml-3"/>
        </footer>
      </main>
    </div>
  </div>;
}
