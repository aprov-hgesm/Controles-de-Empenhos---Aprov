'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {MealProgressPair} from '../integration/MealProgressPair';
import {MapRapidRegistration} from './MapRapidRegistration';
import {mealName,mealTitle,timeSituation,timingLabel,mapLateLabel} from '../integration/meal-period.mjs';

type Cycle='06'|'10'|'16';
type MealType='PRIMARY'|'SECONDARY';
type AdmissionRow={admissionId:string;patientId:string;patientCode:string;patientName?:string;bedLabel?:string|null;bedId:string|null;medicalReferenceId:string|null;fasting:boolean;allergyCodes:string[]};
type DietRow={id:string;code:string;label:string;type?:string;active:boolean};
type Reference={id:string;catalogItemId:string;sourceRef:string;sourceVersion?:string};
type MapRow={id:string;unitId:string;localDate:string;cycleId:Cycle;status:'DRAFT'|'SUBMITTED'|'CLOSED';revision:number;late?:boolean;submissionTimingStage?:string;hasLateAmendment?:boolean;latestExtraTimingStage?:string;submittedAt?:string|null;receivedAt?:string|null};
type MealRow={id:string;admissionId:string;mealType:MealType;dietCode:string;observation?:string;status:string;revision:number;advisory:string;timingStage?:string;lateReason?:string|null;allergyAlert?:boolean;allergyNote?:string;recipientType?:string};
type Receipt={mapId:string;unitId:string;localDate:string;cycleId:Cycle;submittedAt:string;submittedByUid:string;submissionVersion:number;currentVersion:number;late:boolean;needsKitchenReview:boolean;status:string};
type MapDetail={map:MapRow;meals:MealRow[];summary:{dietCode:string;mealType:MealType;count:number;blocked:number}[];receipt:Receipt|null};
type CommandResult<T>={ok:true;data:T}|{ok:false;error:{code:string;message:string}};
export type MeusMapasProps={
 organizationId:string;
 unitId:string;
 unitLabel?:string;
 getIdToken:()=>Promise<string>;
};
const CYCLES:{value:Cycle;label:string}[]=[
 {value:'06',label:'06h — Café e lanche da manhã'},
 {value:'10',label:'10h — Almoço e lanche da tarde'},
 {value:'16',label:'16h — Jantar e ceia'},
];
function todayLocal(){
 const items=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+(process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR==='1'?2:0)*86400000));
 const part=(type:string)=>items.find(x=>x.type===type)?.value??'';
 return `${part('year')}-${part('month')}-${part('day')}`;
}
function dateTime(s:string|null|undefined){return s?new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—'}
const panel:React.CSSProperties={border:'1px solid #e1e9f4',borderRadius:18,padding:22,background:'#fff',boxShadow:'0 12px 36px rgba(17,44,87,.045)'};
const inputStyle:React.CSSProperties={width:'100%',padding:'11px 12px',border:'1px solid #cddbef',borderRadius:11,background:'#fff',color:'#19365c',minHeight:42};
const actionStyle:React.CSSProperties={padding:'11px 15px',borderRadius:11,border:'1px solid #d5e2f6',background:'#f4f8ff',color:'#164785',fontWeight:650,cursor:'pointer'};
export function MeusMapasView({organizationId,unitId,unitLabel,getIdToken}:MeusMapasProps){
 const [date,setDate]=useState(todayLocal);
 const [cycle,setCycle]=useState<Cycle>('06');
 const [map,setMap]=useState<MapDetail|null>(null);
 const [quickMode,setQuickMode]=useState(false);
 const [editingMeal,setEditingMeal]=useState<MealRow|null>(null);
 const [editDiet,setEditDiet]=useState('');
 const [editObservation,setEditObservation]=useState('');
 const [editReason,setEditReason]=useState('');
 const [available,setAvailable]=useState<MapRow[]>([]);
 const [admissions,setAdmissions]=useState<AdmissionRow[]>([]);
 const [catalog,setCatalog]=useState<DietRow[]>([]);
 const [selectedAdmission,setSelectedAdmission]=useState('');
 const [selectedType,setSelectedType]=useState<MealType>('PRIMARY');
 const [reference,setReference]=useState<Reference|null>(null);
 const [reason,setReason]=useState('');
 const [timeTick,setTimeTick]=useState(()=>Date.now());
 const [observation,setObservation]=useState('');
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('');
 const [mapStatus,setMapStatus]=useState('');
 const [lateFilter,setLateFilter]=useState('');
 const [mealFilter,setMealFilter]=useState('');
 const [dietFilter,setDietFilter]=useState('');
 const [bedFilter,setBedFilter]=useState('');
 const [patientFilter,setPatientFilter]=useState('');
 const [restrictionFilter,setRestrictionFilter]=useState('');
 const [versionFilter,setVersionFilter]=useState('');
 const request=useCallback(async<T,>(path:'maps'|'diets',operation:string,payload:Record<string,unknown>):Promise<T>=>{
  const token=await getIdToken();
  if(!token)throw new Error('Sessão expirada; autentique-se novamente');
  const response=await fetch(`/api/hospital/${path}`,{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'x-hospital-organization-id':organizationId},
   body:JSON.stringify({operation,payload})});
  const json=await response.json() as CommandResult<T>;
  if(!json.ok)throw new Error(`${json.error.code}: ${json.error.message}`);
  return json.data;
 },[getIdToken,organizationId]);
 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const [maps,people,diets]=await Promise.all([
    request<MapRow[]>('maps','map.list',{
     unitId,localDate:date,cycleId:cycle,
     ...(mapStatus?{status:mapStatus}:{}),
     ...(lateFilter?{late:lateFilter==='late'}:{}),
     ...(mealFilter?{mealType:mealFilter}:{}),
     ...(dietFilter?{dietCode:dietFilter}:{}),
     ...(bedFilter?{bedId:bedFilter}:{}),
     ...(patientFilter?{patientId:patientFilter}:{}),
     ...(restrictionFilter?{restrictionCode:restrictionFilter}:{}),
     ...(versionFilter?{version:Number(versionFilter)}:{}),
    }),
    request<AdmissionRow[]>('maps','admission.list',{unitId}),
    request<DietRow[]>('diets','diet.list',{unitId}),
   ]);
   setAvailable(maps);setAdmissions(people);setCatalog(diets);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar mapas')}
  finally{setLoading(false)}
 },[request,unitId,date,cycle,mapStatus,lateFilter,mealFilter,dietFilter,bedFilter,patientFilter,restrictionFilter,versionFilter]);
 useEffect(()=>{void reload();setMap(null);setReference(null);setSelectedAdmission('')},[reload]);
 useEffect(()=>{const timer=setInterval(()=>setTimeTick(Date.now()),30000);return()=>clearInterval(timer)},[]);
 const loadMap=useCallback(async(mapId:string)=>{
  const detail=await request<MapDetail>('maps','map.get',{mapId});setMap(detail);return detail;
 },[request]);
 async function perform<T>(work:()=>Promise<T>,message:string){
  setSaving(true);setError('');setNotice('');
  try{await work();setNotice(message);await reload()}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir')}
  finally{setSaving(false)}
 }
 const patient=admissions.find(a=>a.admissionId===selectedAdmission);
 useEffect(()=>{
  let cancelled=false;
  setReference(null);
  if(!selectedAdmission)return;
  request<Reference|null>('diets','reference.current',{unitId,admissionId:selectedAdmission})
   .then(ref=>{if(!cancelled)setReference(ref)})
   .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Falha na referência médica')});
  return ()=>{cancelled=true};
 },[selectedAdmission,unitId,request]);
 const menu=useMemo(()=>map?.meals.filter(m=>(!filter||[m.admissionId,m.dietCode,m.mealType,m.status].some(v=>v.toLowerCase().includes(filter.toLowerCase()))))??[],[map,filter]);
 const disabled=saving||loading;
 const timing=timeSituation(cycle,date,new Date(timeTick),selectedType);
 const urgent=timing.stage==='AFTER_TOLERANCE';
 const extraordinary=timing.stage!=='ON_TIME';
 const updateMap=async()=>{
  await perform(async()=>{
   const result=await request<MapRow>('maps','map.create',{unitId,localDate:date,cycleId:cycle});
   await loadMap(result.id);
   setQuickMode(true);
  },'Mapa disponível para conferência');
 };
 const addMeal=async()=>{
  if(!map||!selectedAdmission||!reference)return setError('Selecione uma internação com prescrição médica vigente');
  if(extraordinary&&reason.trim().length<5)return setError('Informe um motivo objetivo para a solicitação extraordinária.');
  await perform(async()=>{
   await request('maps','meal.set',{mapId:map.map.id,admissionId:selectedAdmission,mealType:selectedType,medicalReferenceId:reference.id,dietCode:reference.catalogItemId,expectedMapRevision:map.map.revision,idempotencyKey:crypto.randomUUID(),reason:reason.trim()||null,observation:observation.trim()});
   setObservation('');
   await loadMap(map.map.id);
  },'Refeição registrada; confira os avisos de segurança');
 };
 const removeMeal=async(meal:MealRow)=>{
  if(!map)return;
  await perform(async()=>{
   await request('maps','meal.remove',{mapId:map.map.id,mealId:meal.id,expectedMapRevision:map.map.revision,expectedMealRevision:meal.revision,idempotencyKey:crypto.randomUUID(),reason:reason.trim()||null});
   await loadMap(map.map.id);
  },'Pedido cancelado ou suspenso com histórico preservado');
 };
 const send=async()=>{
  if(!map)return;
  if(extraordinary&&reason.trim().length<5)return setError('Informe o motivo do envio fora do prazo (mínimo 5 caracteres).');
  await perform(async()=>{
   await request('maps','map.submit',{mapId:map.map.id,expectedRevision:map.map.revision,idempotencyKey:crypto.randomUUID(),lateReason:reason.trim()||null});
   await loadMap(map.map.id);
  },'Mapa enviado. Recibo disponível');
 };
 const openEdit=(meal:MealRow)=>{
  setEditingMeal(meal);setEditDiet(meal.dietCode);setEditObservation(meal.observation??'');
  setEditReason('');setQuickMode(false);
 };
 const saveEdit=async()=>{
  if(!map||!editingMeal)return;
  if(map.map.status!=='DRAFT'&&editReason.trim().length<5){setError('Informe o motivo da correção enviada à Cozinha.');return}
  await perform(async()=>{
   await request('maps',map.map.status==='DRAFT'?'map.meal.draftEdit':'map.correction.request',{
    mapId:map.map.id,mealId:editingMeal.id,newDietCode:editDiet,observation:editObservation,
    expectedMapRevision:map.map.revision,expectedMealRevision:editingMeal.revision,
    idempotencyKey:crypto.randomUUID(),...(map.map.status==='DRAFT'?{}:{reason:editReason.trim()})
   });
   await loadMap(map.map.id);setEditingMeal(null);
  },map.map.status==='DRAFT'?'Dieta atualizada no rascunho':'Correção enviada à Cozinha. A refeição original ficou suspensa até a ciência.');
 };
 const close=async()=>{
  if(!map)return;
  await perform(async()=>{
   await request('maps','map.close',{mapId:map.map.id,expectedRevision:map.map.revision,idempotencyKey:crypto.randomUUID()});
   await loadMap(map.map.id);
  },'Mapa fechado no horário oficial; adendos permanecem possíveis');
 };
 return <div aria-label="Meus Mapas — Cozinha Dietética" style={{display:'grid',gap:18,width:'100%',color:'#173151'}}>
  <style>{`@media print { .w3-no-print {display:none !important} .w3-print-only {display:block !important} .w3-receipt {border:0 !important;padding:0 !important} } @media screen {.w3-print-only{display:none !important}}`}</style>
  <header className="w3-no-print">
   <h2 style={{fontSize:23,fontWeight:800,letterSpacing:'-.03em',marginBottom:4,color:'#173b69'}}>Solicitar dietas à cozinha</h2>
   <p style={{margin:0,color:'#475569'}}>Unidade: {unitLabel??unitId}. Escolha o horário, inclua as dietas dos leitos e envie o mapa à cozinha.</p>
  </header>
  <section className="w3-no-print" style={panel}>
   <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Selecionar ciclo do mapa">{CYCLES.map(c=><button key={c.value} type="button" aria-pressed={cycle===c.value} onClick={()=>setCycle(c.value)} className={cycle===c.value?'hospital-primary-action':'hospital-secondary-action'}>{c.value}h</button>)}</div>
   <div role={extraordinary?'alert':'status'} data-testid="map-deadline-indicator"
     className={'mt-3 rounded-xl border p-3 text-sm '+(urgent?'border-rose-300 bg-rose-50 text-rose-900':extraordinary?'border-amber-300 bg-amber-50 text-amber-900':'border-blue-100 bg-[#f4f8ff] text-[#315b91]')}>
     <p className="font-extrabold">{timing.label} · {cycle}h</p>
     <p className="mt-1 text-xs">{timing.message}</p>
     <p className="mt-1 text-xs font-semibold">Prazo do mapa: {timing.due}. Tolerância de entrega principal: até {timing.tolerance}. {mealName(cycle,'SECONDARY')} possui controle de distribuição separado.</p>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,alignItems:'end'}}>
    <label>Data local<input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Horário do mapa<select style={inputStyle} value={cycle} onChange={e=>setCycle(e.target.value as Cycle)}>{CYCLES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <button style={actionStyle} type="button" disabled={disabled} onClick={()=>void reload()}>Atualizar</button>
    <button style={{...actionStyle,background:'#1452ba',color:'#fff',borderColor:'#1452ba'}} type="button" disabled={disabled} onClick={()=>void updateMap()}>Iniciar mapa de dietas</button>
   </div>
   <details style={{marginTop:12,marginBottom:10}}>
     <summary style={{cursor:'pointer',fontWeight:600}}>Mais filtros (opcional)</summary>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:12}}>
      <label>Status<select style={inputStyle} value={mapStatus} onChange={e=>setMapStatus(e.target.value)}><option value="">Todos</option><option value="DRAFT">Rascunho</option><option value="SUBMITTED">Enviado</option><option value="CLOSED">Fechado</option></select></label>
      <label>Pontualidade<select style={inputStyle} value={lateFilter} onChange={e=>setLateFilter(e.target.value)}><option value="">Todos</option><option value="late">Atrasados</option><option value="on-time">Sem atraso</option></select></label>
      <label>Refeição<select style={inputStyle} value={mealFilter} onChange={e=>setMealFilter(e.target.value)}><option value="">Todas</option><option value="PRIMARY">Principal</option><option value="SECONDARY">Secundária</option></select></label>
      <label>Dieta<select style={inputStyle} value={dietFilter} onChange={e=>setDietFilter(e.target.value)}><option value="">Todas</option>{catalog.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      <label>Paciente<select style={inputStyle} value={patientFilter} onChange={e=>setPatientFilter(e.target.value)}><option value="">Todos</option>{admissions.map(a=><option key={a.admissionId} value={a.patientId}>{a.patientCode}</option>)}</select></label>
      <label>Leito<input style={inputStyle} value={bedFilter} onChange={e=>setBedFilter(e.target.value)} placeholder="Identificador do leito"/></label>
      <label>Restrição<input style={inputStyle} value={restrictionFilter} onChange={e=>setRestrictionFilter(e.target.value)} placeholder="Código da restrição"/></label>
      <label>Versão do snapshot<input style={inputStyle} type="number" min={1} value={versionFilter} onChange={e=>setVersionFilter(e.target.value)} placeholder="Todas"/></label>
     </div>
    </details>
   <small>06h, 10h e 16h são prazos dos mapas. Os 30 minutos seguintes são tolerância da entrega principal, não extensão do prazo regular de envio.</small>
   <p style={{marginBottom:0}}>Mapas existentes: {available.length===0?'nenhum para o período':available.map(m=><button key={m.id} style={{...actionStyle,margin:4}} disabled={disabled} onClick={()=>{setQuickMode(false);void loadMap(m.id).catch(e=>setError(e instanceof Error?e.message:'Erro de leitura'))}}>{m.status==='DRAFT'?'Em preenchimento':'Enviado'} · {mapLateLabel(m)||'No prazo'}</button>)}</p>
  </section>
  {loading&&<p role="status">Carregando mapas autorizados…</p>}
  {error&&<div role="alert" className="w3-no-print" style={{...panel,borderColor:'#b91c1c',color:'#991b1b'}}>{error} {error.includes('CONFLICT')&&'Recarregue antes de tentar novamente.'}</div>}
  {notice&&<p className="w3-no-print" role="status" style={{color:'#166534'}}>{notice}</p>}
  {map&&<MealProgressPair map={map.map} meals={map.meals}/>}
  {map&&<section className="w3-no-print" style={panel}>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h3 className="text-lg font-bold text-[#17447a]">Mapa {map.map.cycleId}h · {map.map.localDate}</h3>
      <p className="text-sm text-slate-600">{map.meals.filter(x=>x.status!=='CANCELLED').length} refeições cadastradas · {map.map.status==='DRAFT'?'Em preenchimento':'Enviado à cozinha'}</p>
     </div>
     <div className="flex flex-wrap gap-2">
      <button className="hospital-secondary-action" type="button" disabled={disabled} onClick={()=>setQuickMode(true)}>{map.map.status==='DRAFT'?'Cadastrar paciente e dieta':'Incluir dieta extra'}</button>
      {map.map.status==='DRAFT'&&!quickMode&&<button className="hospital-primary-action" type="button" disabled={disabled||map.meals.length===0||(extraordinary&&reason.trim().length<5)} onClick={()=>void send()}>Enviar mapa de dietas à cozinha</button>}
     </div>
    </div>
    {!quickMode&&map.map.status==='DRAFT'&&<div className="mt-2 space-y-2 text-sm text-slate-500">
      <p>Confira as dietas na lista abaixo, faça as alterações necessárias e depois envie o mapa.</p>
      {extraordinary&&<label className="grid gap-1 font-semibold text-amber-900">Justificativa do envio fora do prazo<textarea style={inputStyle} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo do envio extraordinário (mínimo 5 caracteres)"/></label>}
    </div>}
  </section>}
  {map&&quickMode&&<MapRapidRegistration organizationId={organizationId} getIdToken={getIdToken}
    map={map.map} catalog={catalog} onCancel={()=>setQuickMode(false)}
    onSaved={async (finish,savedReason)=>{await loadMap(map.map.id);await reload();if(savedReason)setReason(savedReason);setQuickMode(!finish)}}/>}
  {map&&<section style={panel}>
    <div className="w3-no-print" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
     <h3 style={{margin:0}}>Mapa {map.map.cycleId}h · {map.map.localDate} · {map.map.status}</h3>
     <span>{map.meals.filter(m=>m.status!=='CANCELLED').length} dietas cadastradas</span>
    </div>
    {!!mapLateLabel(map.map)&&<p role="alert" data-testid="late-map-banner"
       className={'mt-3 rounded-xl border p-3 text-sm font-bold '+(map.map.submissionTimingStage==='AFTER_TOLERANCE'||map.map.latestExtraTimingStage==='AFTER_TOLERANCE'?'border-rose-300 bg-rose-50 text-rose-900':'border-amber-300 bg-amber-50 text-amber-900')}>
       {mapLateLabel(map.map)}. A justificativa e o alerta prioritário ficam visíveis para a cozinha. O atraso não suspende a dieta por si só.
      </p>}
    <details className="w3-no-print mt-4 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-500">Editor técnico anterior (opcional)</summary>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10,marginTop:16}}>
     <label>Paciente/internação<select style={inputStyle} value={selectedAdmission} onChange={e=>setSelectedAdmission(e.target.value)}><option value="">Selecione um paciente ativo</option>{admissions.map(a=><option key={a.admissionId} value={a.admissionId}>{a.patientName??'Paciente'} · leito {a.bedLabel??'a conferir'}</option>)}</select></label>
     <fieldset className="grid gap-2 rounded-xl border border-[#d6e5f4] bg-[#f8fbff] p-3"><legend className="px-1 text-xs font-bold text-[#275284]">Qual refeição será solicitada?</legend><div className="grid grid-cols-2 gap-2">{(['PRIMARY','SECONDARY'] as const).map(type=><button key={type} type="button" aria-pressed={selectedType===type} className={selectedType===type?'hospital-primary-action':'hospital-secondary-action'} onClick={()=>setSelectedType(type)}>{mealName(cycle,type)}</button>)}</div><p className="text-[11px] text-slate-500">Cada refeição segue para distribuição e confirmação no leito separadamente.</p></fieldset>
     <label>Dieta anotada no papel<input style={inputStyle} readOnly value={reference?`${reference.sourceRef} · ${catalog.find(x=>x.id===reference.catalogItemId)?.label??reference.catalogItemId}`:'Sem referência registrada'}/></label>
    </div>
    {patient?.fasting&&<p role="alert" style={{color:'#991b1b'}}>Jejum ativo: pedido será bloqueado para liberação até reconferência assistencial.</p>}
    {(patient?.allergyCodes.length??0)>0&&<p role="alert" style={{color:'#991b1b'}}>Alergias registradas: conferir compatibilidade antes de preparar ou distribuir.</p>}
    <div className="w3-no-print" style={{marginTop:10}}>
     <label>Observação da dieta (se houver)<textarea style={inputStyle} rows={2} maxLength={180} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Ex.: sem açúcar; manter consistência pastosa. Será impressa na etiqueta."/></label>
     {extraordinary&&<p role="alert" data-testid="late-meal-warning" className={'rounded-xl border p-3 text-sm font-semibold '+(urgent?'border-rose-300 bg-rose-50 text-rose-900':'border-amber-300 bg-amber-50 text-amber-900')}>
       {timingLabel(timing.stage,selectedType)}. Informe a justificativa. A cozinha receberá um alerta prioritário e a dieta poderá seguir normalmente, se não houver bloqueio de segurança.
      </p>}
     <label>Justificativa da dieta ou do mapa fora do prazo (obrigatória quando aplicável)<textarea style={inputStyle} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: solicitação da unidade após o horário; encaminhar com prioridade à cozinha"/></label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
      <button className="hospital-primary-action" disabled={disabled||!reference||(extraordinary&&reason.trim().length<5)} onClick={()=>void addMeal()}>{extraordinary?'Registrar dieta extraordinária':'Incluir '+mealName(cycle,selectedType).toLowerCase()}</button>
      {map.map.status==='DRAFT'&&<button className="hospital-primary-action" disabled={disabled||(extraordinary&&reason.trim().length<5)} onClick={()=>void send()}>{extraordinary?'Enviar mapa extraordinário à cozinha':'Enviar mapa à cozinha'}</button>}
      {map.map.status==='SUBMITTED'&&<button style={actionStyle} disabled={disabled} onClick={()=>void close()}>Fechar no horário oficial</button>}
           </div>
    </div></details>
    {editingMeal&&<div className="w3-no-print mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4" data-testid="map-meal-editor">
      <h4 className="font-extrabold text-[#174680]">{map.map.status==='DRAFT'?'Editar dieta antes do envio':'Solicitar correção à Cozinha'}</h4>
      <p className="text-sm text-slate-600">{mealName(cycle,editingMeal.mealType)} · {admissions.find(x=>x.admissionId===editingMeal.admissionId)?.patientName??'Paciente'}</p>
      <label className="grid gap-1 text-sm font-semibold">Dieta correta no catálogo<select style={inputStyle} value={editDiet} onChange={e=>setEditDiet(e.target.value)}>{catalog.map(d=><option value={d.id} key={d.id}>{d.label}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Observação<textarea style={inputStyle} rows={2} maxLength={180} value={editObservation} onChange={e=>setEditObservation(e.target.value)}/></label>
      {map.map.status!=='DRAFT'&&<label className="grid gap-1 text-sm font-semibold">Motivo da correção<textarea style={inputStyle} rows={2} value={editReason} onChange={e=>setEditReason(e.target.value)} placeholder="Descreva a dieta enviada incorretamente e a alteração necessária"/></label>}
      {map.map.status!=='DRAFT'&&<p className="text-xs font-semibold text-amber-800">A refeição incorreta será suspensa imediatamente. A nova dieta somente poderá retornar à produção após ciência da Cozinha, conferência do prazo e recolhimento físico, quando já expedida.</p>}
      <div className="flex flex-wrap gap-2">
       <button type="button" className="hospital-primary-action" disabled={disabled||(map.map.status!=='DRAFT'&&(editReason.trim().length<5||editDiet===editingMeal.dietCode))} onClick={()=>void saveEdit()}>{map.map.status==='DRAFT'?'Salvar alteração':'Solicitar correção e suspender dieta incorreta'}</button>
       <button type="button" className="hospital-secondary-action" onClick={()=>setEditingMeal(null)}>Cancelar edição</button>
      </div>
    </div>}
    <h4 className="w3-no-print">Pedidos e situação</h4>
    <label className="w3-no-print">Filtrar por internação, dieta ou status<input style={inputStyle} value={filter} onChange={e=>setFilter(e.target.value)}/></label>
    <div className="w3-no-print" style={{overflowX:'auto'}}>
     <table style={{width:'100%',borderCollapse:'collapse',marginTop:12}}><thead><tr><th align="left">Internação</th><th align="left">Refeição</th><th align="left">Dieta</th><th align="left">Estado</th><th>Ação</th></tr></thead>
      <tbody>{menu.map(meal=><tr key={meal.id} style={{borderTop:'1px solid #cbd5e1'}}><td>{admissions.find(a=>a.admissionId===meal.admissionId)?.patientName??'Paciente'} · leito {admissions.find(a=>a.admissionId===meal.admissionId)?.bedLabel??'a conferir'}</td><td>{mealName(cycle,meal.mealType)}</td><td>{catalog.find(x=>x.id===meal.dietCode)?.label??'Dieta'}</td><td><span className="block text-xs font-semibold">{meal.status==='DELIVERED'?'Entregue':meal.status==='SUSPENDED'?'Suspensa · conferir':meal.status==='SAFETY_BLOCKED'?'Bloqueada':meal.status==='PREPARING'?'Em preparo':meal.status==='READY'?'Pronta':meal.status==='DISPATCHED'?'Em distribuição':meal.status==='RECEIVED_BY_UNIT'?'Em distribuição':meal.status==='REQUESTED'?'Aguardando cozinha':meal.status==='CANCELLED'?'Cancelada':'Em análise'}</span>{meal.timingStage&&meal.timingStage!=='ON_TIME'&&<span className={'mt-1 inline-block rounded-full px-2 py-1 text-[11px] font-extrabold '+(meal.timingStage==='AFTER_TOLERANCE'?'bg-rose-100 text-rose-900':'bg-amber-100 text-amber-900')}>{timingLabel(meal.timingStage,meal.mealType)}</span>}{meal.allergyAlert&&<span role="alert" className="mt-1 block rounded-lg bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-950">ALERGIA — {meal.allergyNote}</span>}</td><td align="center"><div className="flex flex-wrap justify-center gap-2">
 <button type="button" disabled={disabled||['CANCELLED','DELIVERED','SUSPENDED'].includes(meal.status)} onClick={()=>openEdit(meal)}>{map.map.status==='DRAFT'?'Editar':'Solicitar correção'}</button>
 <button type="button" disabled={disabled||['CANCELLED','DELIVERED'].includes(meal.status)} onClick={()=>void removeMeal(meal)}>Remover/suspender</button></div></td></tr>)}</tbody>
     </table>
     {menu.length===0&&<p>Nenhum pedido corresponde ao filtro.</p>}
    </div>
    <h4 className="w3-no-print">Totais por dieta</h4>
    <div className="w3-no-print" style={{display:'flex',gap:12,flexWrap:'wrap'}}>{map.summary.length===0?'Sem refeições':map.summary.map(s=><span key={s.dietCode+s.mealType} style={{...panel,padding:8}}>{catalog.find(x=>x.id===s.dietCode)?.label??s.dietCode} · {s.mealType==='PRIMARY'?'principal':'secundária'}: {s.count} ({s.blocked} bloqueados)</span>)}</div>
   </section>}
   {map?.receipt&&<section className="w3-receipt" style={panel}>
    <h3>Recibo de envio de mapa</h3>
    <p>Unidade: {map.receipt.unitId} · Data: {map.receipt.localDate} · Ciclo: {map.receipt.cycleId}h</p>
    <p>Mapa: {map.receipt.mapId} · Versão de envio: {map.receipt.submissionVersion} · Versão atual: {map.receipt.currentVersion}</p>
    <p>Recebido em: {dateTime(map.receipt.submittedAt)} · Responsável (UID): {map.receipt.submittedByUid}</p>
    <p>{map.receipt.late?'Envio extraordinário fora do prazo — requer conferência da cozinha':'Enviado no prazo regular'} · Status: {map.receipt.status}</p>
    <p>Sem nome de paciente, leito, diagnóstico ou dados de prescrição neste recibo.</p>
    <button className="w3-no-print" style={actionStyle} type="button" onClick={()=>window.print()}>Imprimir somente recibo</button>
    <div className="w3-print-only"><small>Registro institucional sujeito à auditoria; não comprova entrega de refeição ao paciente.</small></div>
   </section>}
 </div>;
}
