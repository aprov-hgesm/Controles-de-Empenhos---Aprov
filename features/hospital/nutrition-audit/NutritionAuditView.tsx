'use client';
import {useCallback,useEffect,useState} from 'react';
type Case={id:string;unitId:string;category:string;risk:string;status:string;evidence:string;recommendation:string;revision:number;createdAt:string};
type Contact={id:string;findingId:string;physicianRef:string;channel:string;contactedAt:string;requestNote:string;status:string;revision:number;respondedAt:string|null;responseNote:string|null};
type Props={organizationId:string;unitIds:string[];getAccessToken:()=>Promise<string>};
type AnyObject=Record<string,unknown>;
const tabs=['Painel de Auditoria','Pacientes e Dietas','Inconformidades','Comunicação Médica','Relatórios'] as const;
const field='w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900';
const btn='rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-40';
export function NutritionAuditView({organizationId,unitIds,getAccessToken}:Props){
 const [unitId,setUnitId]=useState(unitIds[0]||'');
 const [tab,setTab]=useState<(typeof tabs)[number]>(tabs[0]);
 const [rows,setRows]=useState<Case[]>([]),[contacts,setContacts]=useState<Contact[]>([]);
 const [catalog,setCatalog]=useState<{categories:string[];risks:string[]}>({categories:[],risks:[]});
 const [summary,setSummary]=useState<AnyObject>({}),[alerts,setAlerts]=useState<AnyObject[]>([]);
 const [filters,setFilters]=useState({status:'',category:'',risk:'',from:'',to:''});
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [admissionId,setAdmissionId]=useState(''),[diet,setDiet]=useState<AnyObject|null>(null);
 const [finding,setFinding]=useState({admissionId:'',medicalReferenceId:'',category:'',risk:'',evidence:'',recommendation:'',escalation:''});
 const [selected,setSelected]=useState(''),[reason,setReason]=useState('');
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
 async function action(operation:string,payload:AnyObject){setError('');setOk('');setLoading(true);try{await api(operation,{unitId,...payload},'POST');setOk('Registro gravado com autoria e horário.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Falha no registro')}finally{setLoading(false)}}
 async function inspect(){setError('');setDiet(null);try{setDiet(await api('patient.diet',{unitId,admissionId}))}catch(e){setError(e instanceof Error?e.message:'Consulta negada')}}
 async function exportCsv(){try{const token=await getAccessToken();const search=new URLSearchParams({operation:'report.csv',organizationId,unitId,from:filters.from,to:filters.to});const res=await fetch('/api/hospital/nutrition-audit?'+search.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!res.ok)throw Error('Exportação não autorizada');const blob=await res.blob();const uri=URL.createObjectURL(blob);const a=document.createElement('a');a.href=uri;a.download='auditoria-nutricional.csv';a.click();URL.revokeObjectURL(uri)}catch(e){setError(e instanceof Error?e.message:'Falha na exportação')}}
 if(!unitIds.length)return <section role="alert">Sem unidade autorizada para Nutrição.</section>;
 const current=rows.find(r=>r.id===selected),currentContact=contacts.find(c=>c.id===response.contactId);
 const date=(s:unknown)=>typeof s==='string'&&s?new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 return <section className="space-y-4 rounded-xl bg-slate-50 p-3 text-slate-900 sm:p-6" aria-label="Nutrição auditora">
  <header><h1 className="text-xl font-bold">Nutrição • Auditoria</h1><p className="text-sm text-slate-600">Auditoria não aprova mapas rotineiros. A prescrição é médica e registrada pela unidade. Contatos médicos são feitos fora da plataforma.</p></header>
  <label className="block text-sm">Unidade autorizada<select className={field} value={unitId} onChange={e=>setUnitId(e.target.value)}>{unitIds.map(u=><option key={u}>{u}</option>)}</select></label>
  <nav className="flex flex-wrap gap-2" aria-label="Abas de Nutrição">{tabs.map(t=><button type="button" key={t} aria-current={t===tab?'page':undefined} className={t===tab?btn:field} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  {loading&&<p role="status">Carregando…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}{ok&&<p role="status">{ok}</p>}
  {['Painel de Auditoria','Inconformidades','Relatórios'].includes(tab)&&<div className="grid grid-cols-2 gap-2 md:grid-cols-5">
   <label className="text-xs">Situação<select className={field} value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}><option value="">Todas</option>{['IDENTIFIED','CONTACTED','FOLLOW_UP','CLOSED'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-xs">Categoria<select className={field} value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))}><option value="">Todas</option>{catalog.categories.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-xs">Risco<select className={field} value={filters.risk} onChange={e=>setFilters(p=>({...p,risk:e.target.value}))}><option value="">Todos</option>{catalog.risks.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-xs">Desde<input type="date" className={field} value={filters.from} onChange={e=>setFilters(p=>({...p,from:e.target.value}))}/></label>
   <label className="text-xs">Até<input type="date" className={field} value={filters.to} onChange={e=>setFilters(p=>({...p,to:e.target.value}))}/></label>
  </div>}
  {tab==='Painel de Auditoria'&&<div><div className="grid grid-cols-2 gap-2 md:grid-cols-5">{[['Achados',summary.total],['Pendentes',summary.pending],['Críticos',summary.critical],['Aguardando médico',summary.contactsPending],['Retorno médio (h)',summary.averageResponseHours]].map(([label,value])=><article className="rounded border bg-white p-3" key={String(label)}><p className="text-xs">{String(label)}</p><b className="text-xl">{value==null?'—':String(value)}</b></article>)}</div><h2 className="mt-3 font-semibold">Alertas informativos</h2>{alerts.length?alerts.map((a,i)=><p key={i} className="border-b p-2 text-sm">{String(a.type)} • {date(a.occurredAt)}</p>):<p className="text-sm">Nenhuma alteração pendente.</p>}</div>}
  {tab==='Pacientes e Dietas'&&<article className="space-y-3 rounded border bg-white p-3"><p className="text-sm">Consulta de referência médica vigente, somente leitura. Consistência/via aguardam DTO W3. SNE e jejum não são consistências.</p><form className="flex gap-2" onSubmit={e=>{e.preventDefault();void inspect()}}><input required aria-label="ID da internação" placeholder="Internação" className={field} value={admissionId} onChange={e=>setAdmissionId(e.target.value)}/><button className={btn}>Consultar</button></form>{diet&&<pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(diet,null,2)}</pre>}</article>}
  {tab==='Inconformidades'&&<div className="space-y-3"><form className="grid gap-2 rounded border bg-white p-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void action('finding.create',{...finding,medicalReferenceId:finding.medicalReferenceId||null,idempotencyKey:crypto.randomUUID()})}}>
   <h2 className="font-semibold md:col-span-2">Registrar achado</h2>
   <label className="text-sm">Internação<input required className={field} value={finding.admissionId} onChange={e=>setFinding(p=>({...p,admissionId:e.target.value}))}/></label>
   <label className="text-sm">ID referência médica<input className={field} value={finding.medicalReferenceId} onChange={e=>setFinding(p=>({...p,medicalReferenceId:e.target.value}))}/></label>
   <label className="text-sm">Categoria<select required className={field} value={finding.category} onChange={e=>setFinding(p=>({...p,category:e.target.value}))}><option value="">Selecione</option>{catalog.categories.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm">Gravidade<select required className={field} value={finding.risk} onChange={e=>setFinding(p=>({...p,risk:e.target.value}))}><option value="">Selecione</option>{catalog.risks.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm">Evidência<textarea required className={field} value={finding.evidence} onChange={e=>setFinding(p=>({...p,evidence:e.target.value}))}/></label>
   <label className="text-sm">Recomendação<textarea required className={field} value={finding.recommendation} onChange={e=>setFinding(p=>({...p,recommendation:e.target.value}))}/></label>
   <label className="text-sm md:col-span-2">Encaminhamento (obrigatório no crítico)<input className={field} required={finding.risk==='CRITICAL'} value={finding.escalation} onChange={e=>setFinding(p=>({...p,escalation:e.target.value}))}/></label><button className={btn} disabled={loading}>Salvar achado</button>
  </form><h2 className="font-semibold">Achados</h2>{rows.length===0&&<p>Nenhum achado para os filtros.</p>}{rows.map(r=><article key={r.id} className="rounded border bg-white p-3 text-sm"><b>{r.category} / {r.risk} • {r.status}</b><p>{r.evidence}</p><p>Recomendação: {r.recommendation}</p><button type="button" className={field} onClick={()=>{setSelected(r.id);setContact(c=>({...c,findingId:r.id}))}}>Acompanhar</button></article>)}
  {current&&current.status!=='CLOSED'&&<div className="rounded border bg-white p-3"><h3>{current.id}</h3><input aria-label="Justificativa da transição" className={field} value={reason} onChange={e=>setReason(e.target.value)}/><button type="button" className={btn} disabled={!reason||loading} onClick={()=>void action('finding.transition',{findingId:current.id,next:current.status==='FOLLOW_UP'?'CLOSED':'FOLLOW_UP',reason,expectedRevision:current.revision})}>{current.status==='FOLLOW_UP'?'Encerrar':'Acompanhar'}</button></div>}</div>}
  {tab==='Comunicação Médica'&&<div className="space-y-3"><form className="grid gap-2 rounded border bg-white p-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void action('medical.contact',{...contact,contactedAt:new Date(contact.contactedAt).toISOString(),idempotencyKey:crypto.randomUUID()})}}>
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
