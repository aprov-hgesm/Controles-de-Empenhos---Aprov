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
type Access={status:200;organizationId:string;roles:Role[];unitIds:string[]};
type ErrorAccess={status:401|403|503;message:string};
type ResponseAccess=Access|ErrorAccess;
type Focus={unitId:string;cycleId:'06'|'10'|'16';localDate:string;mealType?:'PRIMARY'|'SECONDARY'};
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
    if(!roles.length||!unitIds.length)throw Error('Nenhuma unidade e perfil foram vinculados à sua conta.');
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
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState('');
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
    setUser(next);setAccess(null);setPage('');setUnit('');setNotice('');
  }),[]);
  useEffect(()=>{
    if(!user||!hospital.trim())return;
    let active=true;
    setChecking(true);
    void requestAccess(user,hospital.trim()).then(data=>{
      if(!active)return;
      setAccess(data);
      if(data.status===200){setUnit(data.unitIds[0]||'');setPage(menuForRoles(data.roles)[0]?.id??'inicio');}
    }).catch(error=>{
      if(active)setAccess({status:503,message:error instanceof Error?error.message:'API hospitalar indisponível'});
    }).finally(()=>{if(active)setChecking(false)});
    return ()=>{active=false};
  },[user,hospital]);

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
  const logout=async()=>{await signOut(auth);setUser(null);setAccess(null);setPage('');};

  const isAllowed=access?.status===200;
  const roleNames=useMemo(()=>isAllowed?access.roles:[],[isAllowed,access]);
  const menu=useMemo(()=>menuForRoles(roleNames),[roleNames]);
  const allowed=access&&access.status===200?access:null;
  const organizationId=allowed?.organizationId??'';
  const unitId=allowed?.unitIds.includes(unit)?unit:allowed?.unitIds[0]??'';
  const unitIds=allowed?.unitIds??[];
  const roles=allowed?.roles??[];
  const canUnit=roles.includes('UNIT')&&!!unitId;
  const kitchen=roles.includes('KITCHEN')&&unitIds.length>0;
  const nutrition=roles.includes('NUTRITION')&&unitIds.length>0;
  const admin=roles.includes('HOSPITAL_ADMIN');
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
      <p role="alert" className="my-4 rounded-lg bg-amber-50 p-4 text-sm">{access.message}</p>
      <button type="button" className="rounded-lg bg-blue-900 px-4 py-3 text-white" onClick={()=>setAccess(null)}>Tentar novamente</button>
      <button type="button" className="ml-3 rounded-lg border px-4 py-3" onClick={()=>void logout()}>Sair</button>
    </div>
  </main>;

  return <div className="hospital-operational min-h-screen">
    <header className="hospital-topbar sticky top-0 z-40 flex items-center justify-between px-4 text-white md:px-7">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Alternar menu" className="rounded-lg p-2 lg:hidden" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button>
        <ChefHat size={26} className="text-sky-300"/>
        <div><p className="text-sm font-black tracking-wide">COZINHA DIETÉTICA</p>
          <p className="text-xs text-slate-300">Gestão hospitalar</p></div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden max-w-48 truncate text-slate-300 sm:inline">{organizationId}</span>
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
          {canUnit&&<select className="mt-2 w-full rounded bg-white p-2 text-slate-900" aria-label="Unidade assistencial" value={unitId}
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
          <Users size={14} className="ml-3"/> {roles.join(', ')} <PackageCheck size={14} className="ml-3"/>
        </footer>
      </main>
    </div>
  </div>;
}
