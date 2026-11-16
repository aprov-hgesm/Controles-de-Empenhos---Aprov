'use client';
import {useCallback,useEffect,useState} from 'react';
type Case={id:string;unitId:string;category:string;risk:string;status:string;evidence:string;recommendation:string;revision:number;createdAt:string};
type Contact={id:string;findingId:string;physicianRef:string;channel:string;contactedAt:string;requestNote:string;status:string;revision:number;respondedAt:string|null;responseNote:string|null};
type AdmissionOption={admissionId:string;status:string;fasting:boolean;medicalReferenceId:string|null};
type DietInspection={admissionId:string;unitId:string;referenceCode:string;fasting:boolean;allergyCodes:string[];activeMedicalReferenceId:string|null;versions:{id:string;catalogItemId:string;sourceRef:string;prescribedAt:string}[];events:{eventType:string;occurredAt:string}[]};
type Props={organizationId:string;unitIds:string[];getAccessToken:()=>Promise<string>};
type AnyObject=Record<string,unknown>;
const tabs=['Visão geral','Consultar dieta','Pendências','Contato com médico','Relatórios'] as const;
const field='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900';
const btn='hospital-primary-action disabled:opacity-40';
export function NutritionAuditView({organizationId,unitIds,getAccessToken}:Props){
 const [unitId,setUnitId]=useState(unitIds[0]||'');
 const [tab,setTab]=useState<(typeof tabs)[number]>(tabs[0]);
 const [rows,setRows]=useState<Case[]>([]),[contacts,setContacts]=useState<Contact[]>([]);
 const [catalog,setCatalog]=useState<{categories:string[];risks:string[]}>({categories:[],risks:[]});
 const [summary,setSummary]=useState<AnyObject>({}),[alerts,setAlerts]=useState<AnyObject[]>([]);
 const [filters,setFilters]=useState({status:'',category:'',risk:'',from:'',to:''});
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [admissionId,setAdmissionId]=useState(''),[diet,setDiet]=useState<DietInspection|null>(null);
 const [admissions,setAdmissions]=useState<AdmissionOption[]>([]);
 const [finding,setFinding]=useState({admissionId:'',medicalReferenceId:'',category:'',risk:'',evidence:'',recommendation:'',escalation:''});
 const [selected,setSelected]=useState(''),[reason,setReason]=useState(''),[history,setHistory]=useState<AnyObject[]>([]);
 const [contact,setContact]=useState({findingId:'',physicianRef:'',channel:'PHONE',contactedAt:'',requestNote:'',contactConfirmed:false});
 const [response,setResponse]=useState({contactId:'',respondedAt:'',responseNote:'',responseConfirmed:false});
 const api=useCallback(async(operation:string,payload:AnyObject={},method:'GET'|'POST'='GET')=>{
  const token=await getAccessToken();if(!token)throw Error('Autenticação hospitalar necessária');
  const search=new URLSearchParams({operation,organizationId});
  for(const [key,value] of Object.entries(payload))if(value!==''&&value!=null)search.set(key,String(value));
  const res=await fetch('/api/hospital/nutrition-audit'+(method==='GET'?'?'+search.toString():''),{method,headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({operation,organizationId,payload})}:{}) ,cache:'no-store'});
  const body=await res.json();if(!res.ok||!body.ok)throw Error(body.error?.message||'Operação indisponível');return body.data;
 },[getAccessToken,organizationId]);
 const refresh=useCallback(async()=>{if(!unitId)return;setLoading(true);setError('');
  try{const [f,c,cat,s,a]=await Promise.all([
   api('finding.list',{unitId,...filters,limit:100}),api('medical.list',{unitId}),api('catalog.read',{unitId}),
   api('summary.read',{unitId,from:filters.from,to:filters.to}),api('alerts.list',{unitId})
  ]);setRows(f.items);setContacts(c);setCatalog(cat);setSummary(s);setAlerts(a);}
  catch(e){setError(e instanceof Error?e.message:'Erro na consulta');}finally{setLoading(false)}
 },[api,unitId,filters]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{
  let active=true;
  setAdmissions([]);setAdmissionId('');setDiet(null);
  if(tab!=='Consultar dieta'||!unitId)return()=>{active=false};
  void api('patients.list',{unitId,limit:50})
    .then((rows:AdmissionOption[])=>{if(active)setAdmissions(rows.filter(row=>row.status==='ACTIVE'));})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível listar internações')});
  return()=>{active=false};
 },[tab,unitId,api]);
 async function action(operation:string,payload:AnyObject){setError('');setOk('');setLoading(true);try{await api(operation,{unitId,...payload},'POST');setOk('Registro gravado com autoria e horário.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Falha no registro')}finally{setLoading(false)}}
 async function inspect(){setError('');setDiet(null);try{setDiet(await api('patient.diet',{unitId,admissionId}))}catch(e){setError(e instanceof Error?e.message:'Consulta negada')}}
 async function inspectHistory(kind:string,id:string){try{setHistory(await api('history.read',{unitId,kind,id}))}catch(e){setError(e instanceof Error?e.message:'Histórico indisponível')}}
 async function exportCsv(){try{const token=await getAccessToken();const search=new URLSearchParams({operation:'report.csv',organizationId,unitId,from:filters.from,to:filters.to});const res=await fetch('/api/hospital/nutrition-audit?'+search.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!res.ok)throw Error('Exportação não autorizada');const blob=await res.blob();const uri=URL.createObjectURL(blob);const a=document.createElement('a');a.href=uri;a.download='auditoria-nutricional.csv';a.click();URL.revokeObjectURL(uri)}catch(e){setError(e instanceof Error?e.message:'Falha na exportação')}}
 if(!unitIds.length)return <section role="alert">Sem unidade autorizada para Nutrição.</section>;
 const current=rows.find(r=>r.id===selected),currentContact=contacts.find(c=>c.id===response.contactId);
 const date=(s:unknown)=>typeof s==='string'&&s?new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 return <section className="hospital-panel space-y-5 p-4 text-slate-900 sm:p-6" aria-label="Nutrição auditora">
  <header className="border-b border-slate-100 pb-4"><h2 className="text-xl font-extrabold text-[#173b69]">Auditoria nutricional</h2><p className="mt-1 text-sm text-slate-500">Confira as informações e trate apenas as pendências reais. Os pedidos seguem normalmente sem aprovação rotineira da Nutrição.</p></header>
  <label className="block text-sm">Unidade autorizada<select className={field} value={unitId} onChange={e=>setUnitId(e.target.value)}>{unitIds.map(u=><option key={u}>{u}</option>)}</select></label>
  <nav className="flex flex-wrap gap-2 border-b border-slate-100 pb-3" aria-label="Abas de Nutrição">{tabs.map(t=><button type="button" key={t} aria-current={t===tab?'page':undefined} className={t===tab?btn:'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100'} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  {loading&&<p role="status">Carregando…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}{ok&&<p role="status">{ok}</p>}
  {['Visão geral','Pendências','Relatórios'].includes(tab)&&<details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Filtrar registros (opcional)</summary>
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
   <label className="text-xs">Situação<select className={field} value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}><option value="">Todas</option>{['IDENTIFIED','CONTACTED','FOLLOW_UP','CLOSED'].map(s=><option key={s} value={s}>{({IDENTIFIED:'Identificada',CONTACTED:'Contato registrado',FOLLOW_UP:'Em acompanhamento',CLOSED:'Concluída'} as Record<string,string>)[s]}</option>)}</select></label>
   <label className="text-xs">Categoria<select className={field} value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))}><option value="">Todas</option>{catalog.categories.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-xs">Risco<select className={field} value={filters.risk} onChange={e=>setFilters(p=>({...p,risk:e.target.value}))}><option value="">Todos</option>{catalog.risks.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-xs">Desde<input type="date" className={field} value={filters.from} onChange={e=>setFilters(p=>({...p,from:e.target.value}))}/></label>
   <label className="text-xs">Até<input type="date" className={field} value={filters.to} onChange={e=>setFilters(p=>({...p,to:e.target.value}))}/></label>
    </div>
  </details>}
  {tab==='Visão geral'&&<div><div className="grid grid-cols-2 gap-2 md:grid-cols-5">{[['Achados',summary.total],['Pendentes',summary.pending],['Críticos',summary.critical],['Aguardando médico',summary.contactsPending],['Retorno médio (h)',summary.averageResponseHours]].map(([label,value])=><article className="hospital-kpi" key={String(label)}><p className="text-xs">{String(label)}</p><b className="text-xl">{value==null?'—':String(value)}</b></article>)}</div><h2 className="mt-3 font-semibold">Alertas informativos</h2>{alerts.length?alerts.map((a,i)=><p key={i} className="border-b p-2 text-sm">{String(a.type)} • {date(a.occurredAt)}</p>):<p className="text-sm">Nenhuma alteração pendente.</p>}</div>}
  {tab==='Consultar dieta'&&<article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div><h3 className="font-bold text-emerald-950">Conferir prescrição registrada</h3>
      <p className="mt-1 text-sm text-slate-600">Consulta de referências registradas pela unidade; não altera a prescrição médica.</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void inspect()}}>
      <label className="min-w-[210px] flex-1 text-sm font-semibold text-slate-700">Internação ativa
        <select required className={field+' mt-1'} value={admissionId} onChange={e=>{setAdmissionId(e.target.value);setDiet(null)}}>
          <option value="">Escolha a internação</option>
          {admissions.map((item,index)=><option key={item.admissionId} value={item.admissionId}>
            {'Internação '+(index+1)+' · '+item.admissionId.slice(-8)}{item.fasting?' · Jejum':''}
          </option>)}
        </select>
      </label>
      <button className={btn} disabled={!admissionId||loading}>Conferir dieta</button>
    </form>
    {admissions.length===0&&!loading&&<p className="text-sm text-slate-500">Não há internações ativas disponíveis nesta unidade.</p>}
    {diet&&<div className="space-y-3" aria-label="Resumo da prescrição registrada">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={'rounded-xl border p-4 '+(diet.fasting?'border-amber-300 bg-amber-50':'border-emerald-100 bg-emerald-50')}>
          <p className="text-xs font-bold text-slate-600">Jejum registrado</p>
          <p className={'mt-1 font-extrabold '+(diet.fasting?'text-amber-900':'text-emerald-800')}>{diet.fasting?'SIM — conferência assistencial necessária':'Não registrado'}</p>
        </div>
        <div className={'rounded-xl border p-4 '+(diet.allergyCodes.length?'border-amber-300 bg-amber-50':'border-emerald-100 bg-emerald-50')}>
          <p className="text-xs font-bold text-slate-600">Alergias registradas</p>
          <p className="mt-1 font-semibold text-slate-900">{diet.allergyCodes.length?diet.allergyCodes.join(', '):'Nenhuma cadastrada'}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-800">Histórico de referências médicas ({diet.versions.length})</h4>
        {diet.versions.length===0?<p className="mt-2 text-sm text-slate-500">Nenhuma referência registrada nesta internação.</p>:
          <ul className="mt-3 space-y-2">{diet.versions.slice().reverse().map(v=><li key={v.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <strong className="text-slate-800">{v.id===diet.activeMedicalReferenceId?'Referência vigente':'Referência anterior'}</strong>
            <span className="mt-1 block break-words text-slate-600">{v.sourceRef||'Transcrição assistencial'} · {date(v.prescribedAt)}</span>
          </li>)}</ul>}
      </div>
    </div>}
   </article>}
  {tab==='Pendências'&&<div className="space-y-3"><form className="grid gap-2 rounded border bg-white p-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void action('finding.create',{...finding,medicalReferenceId:finding.medicalReferenceId||null,idempotencyKey:crypto.randomUUID()})}}>
   <h2 className="font-semibold md:col-span-2">Registrar achado</h2>
   <label className="text-sm">Internação<input required className={field} value={finding.admissionId} onChange={e=>setFinding(p=>({...p,admissionId:e.target.value}))}/></label>
   <label className="text-sm">ID referência médica<input className={field} value={finding.medicalReferenceId} onChange={e=>setFinding(p=>({...p,medicalReferenceId:e.target.value}))}/></label>
   <label className="text-sm">Categoria<select required className={field} value={finding.category} onChange={e=>setFinding(p=>({...p,category:e.target.value}))}><option value="">Selecione</option>{catalog.categories.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm">Gravidade<select required className={field} value={finding.risk} onChange={e=>setFinding(p=>({...p,risk:e.target.value}))}><option value="">Selecione</option>{catalog.risks.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm">Evidência<textarea required className={field} value={finding.evidence} onChange={e=>setFinding(p=>({...p,evidence:e.target.value}))}/></label>
   <label className="text-sm">Recomendação<textarea required className={field} value={finding.recommendation} onChange={e=>setFinding(p=>({...p,recommendation:e.target.value}))}/></label>
   <label className="text-sm md:col-span-2">Encaminhamento (obrigatório no crítico)<input className={field} required={finding.risk==='CRITICAL'} value={finding.escalation} onChange={e=>setFinding(p=>({...p,escalation:e.target.value}))}/></label><button className={btn} disabled={loading}>Salvar achado</button>
  </form><h2 className="font-semibold">Achados</h2>{rows.length===0&&<p>Nenhum achado para os filtros.</p>}{rows.map(r=><article key={r.id} className="rounded border bg-white p-3 text-sm"><b>{r.category} / {r.risk} • {r.status}</b><p>{r.evidence}</p><p>Recomendação: {r.recommendation}</p><button type="button" className={field} onClick={()=>{setSelected(r.id);setContact(c=>({...c,findingId:r.id}));void inspectHistory('nutrition_finding',r.id)}}>Acompanhar</button></article>)}
  {current&&<div className="rounded border bg-white p-3"><h3 className="font-semibold">Histórico imutável: {current.id}</h3>{history.length===0&&<p className="text-sm">Sem eventos.</p>}{history.map((h,i)=><p key={i} className="text-xs">{String(h.eventType)} • {date(h.occurredAt)} • {String(h.actorUid)}</p>)}</div>}
  {current&&current.status!=='CLOSED'&&<div className="rounded border bg-white p-3"><h3>{current.id}</h3><input aria-label="Justificativa da transição" className={field} value={reason} onChange={e=>setReason(e.target.value)}/><button type="button" className={btn} disabled={!reason||loading} onClick={()=>void action('finding.transition',{findingId:current.id,next:current.status==='FOLLOW_UP'?'CLOSED':'FOLLOW_UP',reason,expectedRevision:current.revision})}>{current.status==='FOLLOW_UP'?'Encerrar':'Acompanhar'}</button></div>}</div>}
  {tab==='Contato com médico'&&<div className="space-y-3"><form className="grid gap-2 rounded border bg-white p-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void action('medical.contact',{...contact,contactedAt:new Date(contact.contactedAt).toISOString(),idempotencyKey:crypto.randomUUID()})}}>
   <h2 className="font-semibold md:col-span-2">Contato já realizado fora do EMPROVEX</h2>
   <label className="text-sm">Achado<select required className={field} value={contact.findingId} onChange={e=>setContact(c=>({...c,findingId:e.target.value}))}><option value="">Escolha</option>{rows.map(r=><option key={r.id} value={r.id}>{r.id}</option>)}</select></label>
   <label className="text-sm">Identificação do médico<input required className={field} value={contact.physicianRef} onChange={e=>setContact(c=>({...c,physicianRef:e.target.value}))}/></label>
   <label className="text-sm">Canal<select className={field} value={contact.channel} onChange={e=>setContact(c=>({...c,channel:e.target.value}))}>{['PHONE','IN_PERSON','INSTITUTIONAL_EMAIL','OTHER'].map(c=><option key={c}>{c}</option>)}</select></label>
   <label className="text-sm">Data/hora reais<input type="datetime-local" required className={field} value={contact.contactedAt} onChange={e=>setContact(c=>({...c,contactedAt:e.target.value}))}/></label>
   <label className="text-sm md:col-span-2">Solicitação registrada<textarea required className={field} value={contact.requestNote} onChange={e=>setContact(c=>({...c,requestNote:e.target.value}))}/></label>
   <label className="text-sm md:col-span-2"><input type="checkbox" checked={contact.contactConfirmed} onChange={e=>setContact(c=>({...c,contactConfirmed:e.target.checked}))}/> Confirmo que realizei este contato. Nenhuma mensagem será enviada aqui.</label><button className={btn} disabled={loading||!contact.contactConfirmed}>Registrar contato real</button>
  </form>{contacts.length===0&&<p>Nenhum contato registrado.</p>}{contacts.map(c=><article key={c.id} className="rounded border bg-white p-3 text-sm"><b>{c.physicianRef} • {c.status}</b><p>{c.channel} • {date(c.contactedAt)}</p><p>{c.requestNote}</p>{c.respondedAt&&<p>Resposta em {date(c.respondedAt)}: {c.responseNote}</p>}{c.status==='REQUESTED'&&<button className={field} onClick={()=>setResponse(r=>({...r,contactId:c.id}))}>Registrar resposta recebida</button>}</article>)}
  {currentContact&&currentContact.status==='REQUESTED'&&<form className="space-y-2 rounded border bg-white p-3" onSubmit={e=>{e.preventDefault();void action('medical.response',{...response,respondedAt:new Date(response.respondedAt).toISOString(),expectedRevision:currentContact.revision})}}><h3>Resposta efetivamente recebida</h3><input type="datetime-local" required className={field} value={response.respondedAt} onChange={e=>setResponse(r=>({...r,respondedAt:e.target.value}))}/><textarea required className={field} value={response.responseNote} onChange={e=>setResponse(r=>({...r,responseNote:e.target.value}))}/><label><input type="checkbox" checked={response.responseConfirmed} onChange={e=>setResponse(r=>({...r,responseConfirmed:e.target.checked}))}/> Médico realmente respondeu fora do sistema</label><button className={btn} disabled={!response.responseConfirmed||loading}>Registrar resposta</button></form>}</div>}
  {tab==='Relatórios'&&<article className="space-y-2 rounded border bg-white p-4 text-sm"><h2 className="font-semibold">Exportação minimizada</h2><p>CSV por unidade e período, sem nome, internação, leito ou conteúdo clínico. Acesso autorizado apenas no servidor.</p><button className={btn} onClick={()=>void exportCsv()}>Exportar CSV</button></article>}
  <p className="text-xs text-slate-500">Sem IA clínica, aprovação nutricional compulsória ou mensagens automáticas. Montagem de módulo em W9.</p>
 </section>;
}
export default NutritionAuditView;
