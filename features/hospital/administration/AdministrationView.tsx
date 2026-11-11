'use client';

import React, { useCallback, useEffect, useState } from 'react';

type Tab = 'overview' | 'units' | 'members' | 'diets' | 'audit' | 'settings';
type Result<T> = {ok:true;data:T}|{ok:false;error:{code:string;message:string}};
type Unit = {id:string;code:string;name:string;type:'CARE'|'KITCHEN'|'NUTRITION';active:boolean;revision:number;beds:Bed[]};
type Bed = {id:string;unitId:string;label:string;active:boolean;revision:number};
type Member = {id:string;uid:string;roles:string[];unitIds:string[];active:boolean;revision:number};
type Cycle = {id:string;mapDue:string;primaryTolerance:string;primaryName:string;secondaryName:string;notifyAt:string};
type Policy = {timezone:string;cycles:Cycle[];toleranceMinutes:number;extraordinary:string;clinicalApprovalRequired:boolean;contingency:string;labelCopies:number;requireTwoPatientIdentifiers:boolean;alertsEnabled:boolean;effectiveFrom:string;revision:number;activation?:string};
type Audit = {id:number;aggregateId:string;type:string;actorUid:string;occurredAt:string;before:unknown;after:unknown};
type Overview = {organizationId:string;ug:string;counts:{unit:number;bed:number;map:number;meal:number;members:number};scope:string};

const tabs: Array<[Tab,string]> = [['overview','Visão geral'],['units','Unidades e leitos'],['members','Usuários e permissões'],['diets','Dietas e parâmetros'],['audit','Relatórios / auditoria'],['settings','Configurações']];
const surface = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60';
const button = 'rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50';

/** Composable W7 component: W9 supplies verified Firebase ID token from the existing session. */
export function AdministrationView({organizationId,getToken}: {organizationId:string;getToken:()=>Promise<string>}) {
  const [tab,setTab]=useState<Tab>('overview');
  const [overview,setOverview]=useState<Overview|null>(null);
  const [units,setUnits]=useState<Unit[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [policy,setPolicy]=useState<Policy|null>(null);
  const [audits,setAudits]=useState<Audit[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [unitForm,setUnitForm]=useState({id:'',code:'',name:'',type:'CARE' as Unit['type'],active:true,expectedRevision:0});
  const [bedForm,setBedForm]=useState({id:'',unitId:'',label:'',active:true,expectedRevision:0});
  const [memberForm,setMemberForm]=useState({uid:'',roles:['UNIT'],unitIds:[] as string[],active:true,expectedRevision:0});

  const call = useCallback(async <T,>(operation:string,payload?:unknown,write=false):Promise<T> => {
    const token=await getToken();
    if (!token) throw new Error('Sessão Firebase ausente; autentique-se novamente.');
    const endpoint = '/api/hospital/administration';
    const url = write ? endpoint : `${endpoint}?view=${encodeURIComponent(operation)}`;
    const response = await fetch(url,{
      method:write?'POST':'GET',cache:'no-store',credentials:'same-origin',
      headers:{authorization:`Bearer ${token}`,'x-hospital-organization':organizationId,...(write?{'Content-Type':'application/json'}:{})},
      ...(write?{body:JSON.stringify({operation,payload})}:{})
    });
    const parsed:Result<T>=await response.json();
    if(!response.ok || !parsed.ok)throw new Error(parsed.ok?'Erro ao salvar':parsed.error.message);
    return parsed.data;
  },[organizationId,getToken]);

  const refresh=useCallback(async () => {
    setBusy(true);setError('');
    try {
      const [o,u,m,p,a]=await Promise.all([
        call<Overview>('overview'),call<Unit[]>('units.list'),call<Member[]>('members.list'),call<Policy>('settings.read'),call<Audit[]>('audit.list')
      ]);
      setOverview(o);setUnits(u);setMembers(m);setPolicy(p);setAudits(a);
    } catch(e) {setError(e instanceof Error?e.message:'Falha ao carregar administração');}
    finally{setBusy(false);}
  },[call]);
  useEffect(()=>{void refresh()},[refresh]);
  const mutate=async (operation:string,payload:unknown,message:string,critical=false) => {
    if(critical && typeof window!=='undefined' && !window.confirm('Confirmar esta alteração administrativa? Ela será auditada.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const saved=await call<unknown>(operation,payload,true);
      await refresh();
      setNotice(message + (operation==='membership.save'?' Nenhum e-mail de convite foi enviado.':'') + (operation==='settings.save'?' Vigência depende da integração W9.':''));
      return saved;
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar');}
    finally{setBusy(false);}
  };
  const setRoles=(role:string,checked:boolean)=>setMemberForm(s=>({...s,roles:checked?[...new Set([...s.roles,role])]:s.roles.filter(r=>r!==role)}));
  const setUnitAccess=(id:string,checked:boolean)=>setMemberForm(s=>({...s,unitIds:checked?[...new Set([...s.unitIds,id])]:s.unitIds.filter(x=>x!==id)}));

  return <section className="mx-auto max-w-6xl space-y-4 px-3 py-5 text-slate-900 sm:px-6" aria-label="Administração hospitalar">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">Administração Hospitalar</h1><p className="mt-1 text-sm text-slate-500">Gestão institucional da OM {overview?.ug??'—'} · acesso administrativo sem prontuários</p></div>
      <button type="button" className={secondary} disabled={busy} onClick={()=>void refresh()}>Atualizar</button>
    </header>
    <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Abas de administração">
      {tabs.map(([id,title])=><button type="button" key={id} aria-current={id===tab?'page':undefined} onClick={()=>setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${id===tab?'bg-blue-800 font-semibold text-white':'bg-slate-100 text-slate-800'}`}>{title}</button>)}
    </nav>
    {error&&<div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {busy&&<p role="status" className="text-sm text-slate-500">Carregando / salvando informações reais…</p>}
    {tab==='overview' && <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{([['Unidades','unit'],['Leitos','bed'],['Usuários ativos','members'],['Mapas','map'],['Refeições','meal']] as const).map(([label,key])=><article className={surface} key={key}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{overview?.counts[key]??'—'}</p></article>)}</div>
      <p className="text-sm text-slate-600">Contagens agregadas do repositório hospitalar de QA. Não há consulta de nomes, diagnósticos ou prescrições neste painel.</p>
    </div>}
    {tab==='units' && <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${surface} space-y-3`}><h2 className="font-semibold">{unitForm.id?'Editar unidade':'Cadastrar unidade'}</h2>
        <label className="block text-sm">Sigla<input className={input} value={unitForm.code} maxLength={12} onChange={e=>setUnitForm(s=>({...s,code:e.target.value.toUpperCase()}))}/></label>
        <label className="block text-sm">Nome<input className={input} value={unitForm.name} onChange={e=>setUnitForm(s=>({...s,name:e.target.value}))}/></label>
        <label className="block text-sm">Tipo<select className={input} value={unitForm.type} onChange={e=>setUnitForm(s=>({...s,type:e.target.value as Unit['type']}))}><option value="CARE">Assistencial</option><option value="KITCHEN">Cozinha</option><option value="NUTRITION">Nutrição</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unitForm.active} onChange={e=>setUnitForm(s=>({...s,active:e.target.checked}))}/> Unidade ativa</label>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>void mutate('unit.save',{...unitForm,id:unitForm.id||undefined},'Unidade salva após confirmação do servidor.',!!unitForm.id)}>Salvar unidade</button><button className={secondary} onClick={()=>setUnitForm({id:'',code:'',name:'',type:'CARE',active:true,expectedRevision:0})}>Limpar</button></div>
      </div>
      <div className={`${surface} space-y-3`}><h2 className="font-semibold">{bedForm.id?'Editar leito':'Cadastrar leito'}</h2>
        <label className="block text-sm">Unidade<select className={input} value={bedForm.unitId} onChange={e=>setBedForm(s=>({...s,unitId:e.target.value,id:'',expectedRevision:0}))}><option value="">Selecione</option>{units.filter(u=>u.type==='CARE'&&u.active).map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select></label>
        <label className="block text-sm">Identificação do leito<input className={input} value={bedForm.label} onChange={e=>setBedForm(s=>({...s,label:e.target.value}))}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bedForm.active} onChange={e=>setBedForm(s=>({...s,active:e.target.checked}))}/> Leito ativo</label>
        <div className="flex gap-2"><button disabled={busy||!bedForm.unitId} className={button} onClick={()=>void mutate('bed.save',{...bedForm,id:bedForm.id||undefined},'Leito salvo.',!!bedForm.id)}>Salvar leito</button><button className={secondary} onClick={()=>setBedForm({id:'',unitId:'',label:'',active:true,expectedRevision:0})}>Limpar</button></div>
      </div>
      <div className={`${surface} space-y-3 lg:col-span-2`}><h2 className="font-semibold">Unidades e leitos existentes</h2>{units.length===0&&<p className="text-sm text-slate-500">Nenhuma unidade cadastrada nesta OM.</p>}
        {units.map(u=><article key={u.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold">{u.code} · {u.name} <span className="font-normal text-slate-500">({u.type}, {u.active?'ativa':'inativa'})</span></div><button className={secondary} onClick={()=>setUnitForm({id:u.id,code:u.code,name:u.name,type:u.type,active:u.active,expectedRevision:u.revision})}>Editar</button></div><div className="mt-2 flex flex-wrap gap-2">{u.beds.map(b=><button title="Editar leito" className="rounded border px-2 py-1 text-xs" key={b.id} onClick={()=>setBedForm({id:b.id,unitId:b.unitId,label:b.label,active:b.active,expectedRevision:b.revision})}>{b.label} {b.active?'':'(inativo)'}</button>)}{u.beds.length===0&&<span className="text-xs text-slate-500">Sem leitos.</span>}</div></article>)}
      </div>
    </div>}
    {tab==='members' && <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${surface} space-y-3`}><h2 className="font-semibold">Vincular conta Firebase existente</h2><p className="text-xs text-slate-600">Não cria senhas nem envia e-mails. O UID deve existir no provedor de identidade central.</p>
        <label className="block text-sm">UID Firebase<input className={input} value={memberForm.uid} onChange={e=>setMemberForm(s=>({...s,uid:e.target.value}))}/></label>
        <fieldset><legend className="text-sm font-medium">Papéis</legend><div className="grid grid-cols-2 gap-2">{([['UNIT','Unidade'],['KITCHEN','Cozinha'],['NUTRITION','Nutrição'],['HOSPITAL_ADMIN','Administrador']] as const).map(([role,label])=><label className="flex gap-2 text-sm" key={role}><input type="checkbox" checked={memberForm.roles.includes(role)} onChange={e=>setRoles(role,e.target.checked)}/>{label}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-medium">Unidades permitidas</legend><div className="grid grid-cols-2 gap-2">{units.filter(u=>u.active).map(u=><label key={u.id} className="flex gap-2 text-sm"><input type="checkbox" checked={memberForm.unitIds.includes(u.id)} onChange={e=>setUnitAccess(u.id,e.target.checked)}/>{u.code}</label>)}{units.length===0&&<p className="text-xs text-slate-500">Cadastre unidades antes.</p>}</div></fieldset>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={memberForm.active} onChange={e=>setMemberForm(s=>({...s,active:e.target.checked}))}/> Vínculo ativo</label>
        <div className="flex flex-wrap gap-2"><button disabled={busy||!memberForm.uid} className={button} onClick={()=>void mutate('membership.save',memberForm,'Vínculo persistido e auditado.',true)}>Salvar vínculo</button><button className={secondary} onClick={()=>setMemberForm({uid:'',roles:['UNIT'],unitIds:[],active:true,expectedRevision:0})}>Novo</button></div>
      </div>
      <div className={`${surface} space-y-3`}><h2 className="font-semibold">Vínculos da OM</h2>{members.length===0&&<p className="text-sm text-slate-500">Nenhum vínculo encontrado.</p>}{members.map(m=><article key={m.id} className="rounded-lg border p-3"><p className="break-all text-sm font-medium">{m.uid}</p><p className="text-xs text-slate-600">{m.roles.join(' / ')} · {m.unitIds.map(id=>units.find(u=>u.id===id)?.code??id).join(', ')||'Sem unidade'} · {m.active?'Ativo':'Revogado'}</p><div className="mt-2 flex flex-wrap gap-2"><button className={secondary} onClick={()=>setMemberForm({uid:m.uid,roles:m.roles,unitIds:m.unitIds,active:m.active,expectedRevision:m.revision})}>Editar</button>{m.active&&<button className={secondary} disabled={busy} onClick={()=>void mutate('membership.revoke',{uid:m.uid,expectedRevision:m.revision},'Vínculo revogado.',true)}>Revogar</button>}</div></article>)}</div>
    </div>}
    {tab==='diets' && <div className={`${surface} space-y-2`}><h2 className="font-semibold">Dietas e preparações</h2><p className="text-sm text-slate-700">A fonte canônica do catálogo é o serviço W3. O W07 não cria um segundo catálogo nem autoriza alteração clínica de prescrição.</p><p className="text-sm text-amber-800">Edição integrada dependerá de autorização do W3/W9; nenhum dado fictício é exibido como catálogo persistido.</p></div>}
    {tab==='audit' && <div className={`${surface} space-y-3`}><h2 className="font-semibold">Trilha administrativa</h2><p className="text-sm text-slate-600">Eventos de administração com autor, horário e alterações. Relatórios clínicos agregados completos serão integrados pelo W8/W9 em rota autorizada.</p>{audits.length===0&&<p className="text-sm text-slate-500">Nenhum evento administrativo registrado.</p>}{audits.map(a=><article key={a.id} className="border-b py-2 text-sm"><p className="font-medium">{a.type}</p><p className="text-xs text-slate-600">{a.occurredAt} · UID {a.actorUid} · {a.aggregateId}</p><details><summary className="cursor-pointer text-xs text-blue-700">Antes / depois</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({before:a.before,after:a.after},null,2)}</pre></details></article>)}</div>}
    {tab==='settings' && <div className={`${surface} space-y-3`}><h2 className="font-semibold">Política institucional de refeições</h2>{!policy?<p className="text-sm text-slate-500">Carregando política…</p>:<>
      <p className="text-xs text-amber-800">As alterações são versionadas, só podem começar em data futura e não modificam mapas fechados. A ativação no motor de ciclos depende de integração W9.</p>
      <label className="block text-sm">Fuso IANA<input className={input} value={policy.timezone} onChange={e=>setPolicy(s=>s&&({...s,timezone:e.target.value}))}/></label>
      <label className="block text-sm">Vigência a partir de (data futura)<input type="date" className={input} value={policy.effectiveFrom} onChange={e=>setPolicy(s=>s&&({...s,effectiveFrom:e.target.value}))}/></label>
      <div className="grid gap-3 md:grid-cols-3">{policy.cycles.map((c,index)=><fieldset key={c.id} className="rounded-lg border p-3"><legend className="font-semibold">Mapa {c.id}h</legend>{(['mapDue','notifyAt','primaryName','secondaryName'] as const).map(field=><label key={field} className="mb-2 block text-xs">{{mapDue:'Prazo do mapa',notifyAt:'Avisar às',primaryName:'Refeição principal',secondaryName:'Refeição secundária'}[field]}<input type={field==='mapDue'||field==='notifyAt'?'time':'text'} className={input} value={c[field]} onChange={e=>setPolicy(s=>s&&({...s,cycles:s.cycles.map((x,i)=>i===index?{...x,[field]:e.target.value,...(field==='mapDue'?{primaryTolerance:(()=>{const m=Number(e.target.value.slice(0,2))*60+Number(e.target.value.slice(3))+30;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`})()}:{} )}:x)}))}/></label>)}<span className="text-xs text-slate-500">Tolerância principal: {c.primaryTolerance}</span></fieldset>)}</div>
      <label className="block text-sm">Cópias de etiquetas<input type="number" min={1} max={3} className={input} value={policy.labelCopies} onChange={e=>setPolicy(s=>s&&({...s,labelCopies:Number(e.target.value)}))}/></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={policy.alertsEnabled} onChange={e=>setPolicy(s=>s&&({...s,alertsEnabled:e.target.checked}))}/> Alertas habilitados</label>
      <p className="text-xs text-slate-600">Solicitação extraordinária: secundária ou escalonamento clínico. Contingência: registro manual e reconciliação. Identificação positiva por dois identificadores. Regras de segurança não podem ser desabilitadas aqui.</p>
      <button disabled={busy} className={button} onClick={()=>void mutate('settings.save',{expectedRevision:policy.revision,policy},'Política persistida e auditada.',true)}>Salvar política</button>
    </>}</div>}
  </section>;
}

export default AdministrationView;
