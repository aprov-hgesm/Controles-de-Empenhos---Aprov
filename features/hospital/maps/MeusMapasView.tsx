'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';

type Cycle='06'|'10'|'16';
type MealType='PRIMARY'|'SECONDARY';
type AdmissionRow={admissionId:string;patientId:string;patientCode:string;bedId:string|null;medicalReferenceId:string|null;fasting:boolean;allergyCodes:string[]};
type DietRow={id:string;code:string;label:string;type?:string;active:boolean};
type Reference={id:string;catalogItemId:string;sourceRef:string;sourceVersion?:string};
type MapRow={id:string;unitId:string;localDate:string;cycleId:Cycle;status:'DRAFT'|'SUBMITTED'|'CLOSED';revision:number;late?:boolean};
type MealRow={id:string;admissionId:string;mealType:MealType;dietCode:string;status:string;revision:number;advisory:string};
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
 const items=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
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
 const [available,setAvailable]=useState<MapRow[]>([]);
 const [admissions,setAdmissions]=useState<AdmissionRow[]>([]);
 const [catalog,setCatalog]=useState<DietRow[]>([]);
 const [selectedAdmission,setSelectedAdmission]=useState('');
 const [selectedType,setSelectedType]=useState<MealType>('PRIMARY');
 const [reference,setReference]=useState<Reference|null>(null);
 const [reason,setReason]=useState('');
 const [contact,setContact]=useState('');
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
 const updateMap=async()=>{
  await perform(async()=>{
   const result=await request<MapRow>('maps','map.create',{unitId,localDate:date,cycleId:cycle});
   await loadMap(result.id);
  },'Mapa disponível para conferência');
 };
 const addMeal=async()=>{
  if(!map||!selectedAdmission||!reference)return setError('Selecione uma internação com prescrição médica vigente');
  await perform(async()=>{
   await request('maps','meal.set',{mapId:map.map.id,admissionId:selectedAdmission,mealType:selectedType,medicalReferenceId:reference.id,dietCode:reference.catalogItemId,expectedMapRevision:map.map.revision,idempotencyKey:crypto.randomUUID(),reason:reason.trim()||null});
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
  await perform(async()=>{
   await request('maps','map.submit',{mapId:map.map.id,expectedRevision:map.map.revision,idempotencyKey:crypto.randomUUID(),lateReason:reason.trim()||null});
   await loadMap(map.map.id);
  },'Mapa enviado. Recibo disponível');
 };
 const close=async()=>{
  if(!map)return;
  await perform(async()=>{
   await request('maps','map.close',{mapId:map.map.id,expectedRevision:map.map.revision,idempotencyKey:crypto.randomUUID()});
   await loadMap(map.map.id);
  },'Mapa fechado no horário oficial; adendos permanecem possíveis');
 };
 const escalate=async()=>{
  if(!map||!selectedAdmission)return setError('Selecione a internação para registrar a exceção');
  await perform(async()=>{
   await request('maps','exception.escalate',{mapId:map.map.id,admissionId:selectedAdmission,mealType:selectedType,reason,contactReference:contact,idempotencyKey:crypto.randomUUID()});
  },'Exceção pendente: contate imediatamente a assistência e a cozinha');
 };
 return <div aria-label="Meus Mapas — Cozinha Dietética" style={{display:'grid',gap:18,width:'100%',color:'#173151'}}>
  <style>{`@media print { .w3-no-print {display:none !important} .w3-print-only {display:block !important} .w3-receipt {border:0 !important;padding:0 !important} } @media screen {.w3-print-only{display:none !important}}`}</style>
  <header className="w3-no-print">
   <h2 style={{fontSize:23,fontWeight:800,letterSpacing:'-.03em',marginBottom:4,color:'#173b69'}}>Planejamento e envio de mapas</h2>
   <p style={{margin:0,color:'#475569'}}>Unidade: {unitLabel??unitId}. Envio manual; a Nutrição audita sem homologação obrigatória.</p>
  </header>
  <section className="w3-no-print" style={panel}>
   <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Selecionar ciclo do mapa">{CYCLES.map(c=><button key={c.value} type="button" aria-pressed={cycle===c.value} onClick={()=>setCycle(c.value)} className={cycle===c.value?'hospital-primary-action':'hospital-secondary-action'}>{c.value}h</button>)}</div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,alignItems:'end'}}>
    <label>Data local<input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Mapa<select style={inputStyle} value={cycle} onChange={e=>setCycle(e.target.value as Cycle)}>{CYCLES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <button style={actionStyle} type="button" disabled={disabled} onClick={()=>void reload()}>Atualizar</button>
    <button style={{...actionStyle,background:'#1452ba',color:'#fff',borderColor:'#1452ba'}} type="button" disabled={disabled} onClick={()=>void updateMap()}>Abrir rascunho</button>
   </div>
   <details style={{marginTop:12,marginBottom:10}}>
     <summary style={{cursor:'pointer',fontWeight:600}}>Filtros avançados de mapas</summary>
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
   <small>06h, 10h e 16h são prazos dos mapas. A tolerância de 30 minutos é apenas para a principal, não para enviar no prazo.</small>
   <p style={{marginBottom:0}}>Mapas existentes: {available.length===0?'nenhum para o período':available.map(m=><button key={m.id} style={{...actionStyle,margin:4}} disabled={disabled} onClick={()=>void loadMap(m.id).catch(e=>setError(e instanceof Error?e.message:'Erro de leitura'))}>{m.status} · revisão {m.revision}</button>)}</p>
  </section>
  {loading&&<p role="status">Carregando mapas autorizados…</p>}
  {error&&<div role="alert" className="w3-no-print" style={{...panel,borderColor:'#b91c1c',color:'#991b1b'}}>{error} {error.includes('CONFLICT')&&'Recarregue antes de tentar novamente.'}</div>}
  {notice&&<p className="w3-no-print" role="status" style={{color:'#166534'}}>{notice}</p>}
  {map&&<section style={panel}>
    <div className="w3-no-print" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
     <h3 style={{margin:0}}>Mapa {map.map.cycleId}h · {map.map.localDate} · {map.map.status}</h3>
     <span>Revisão {map.map.revision} · {map.meals.filter(m=>m.status!=='CANCELLED').length} refeições</span>
    </div>
    <div className="w3-no-print" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10,marginTop:16}}>
     <label>Paciente/internação<select style={inputStyle} value={selectedAdmission} onChange={e=>setSelectedAdmission(e.target.value)}><option value="">Selecione um paciente ativo</option>{admissions.map(a=><option key={a.admissionId} value={a.admissionId}>{a.patientCode} · leito {a.bedId??'a conferir'}</option>)}</select></label>
     <label>Refeição<select style={inputStyle} value={selectedType} onChange={e=>setSelectedType(e.target.value as MealType)}><option value="PRIMARY">Principal</option><option value="SECONDARY">Secundária</option></select></label>
     <label>Prescrição vigente<input style={inputStyle} readOnly value={reference?`${reference.sourceRef} · ${catalog.find(x=>x.id===reference.catalogItemId)?.label??reference.catalogItemId}`:'Sem referência registrada'}/></label>
    </div>
    {patient?.fasting&&<p role="alert" style={{color:'#991b1b'}}>Jejum ativo: pedido será bloqueado para liberação até reconferência assistencial.</p>}
    {(patient?.allergyCodes.length??0)>0&&<p role="alert" style={{color:'#991b1b'}}>Alergias registradas: conferir compatibilidade antes de preparar ou distribuir.</p>}
    <div className="w3-no-print" style={{marginTop:10}}>
     <label>Motivo de adendo, atraso ou alteração (obrigatório quando aplicável)<textarea style={inputStyle} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Informe motivo e comunicação assistencial, quando necessária"/></label>
     <label>Contato assistencial para exceção clínica<input style={inputStyle} value={contact} onChange={e=>setContact(e.target.value)} placeholder="Referência do contato efetuado"/></label>
     <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
      <button style={{...actionStyle,background:'#1452ba',color:'#fff',borderColor:'#1452ba'}} disabled={disabled||!reference} onClick={()=>void addMeal()}>Adicionar/atualizar refeição</button>
      {map.map.status==='DRAFT'&&<button style={{...actionStyle,background:'#0a338d',color:'#fff',borderColor:'#0a338d'}} disabled={disabled} onClick={()=>void send()}>Enviar mapa explicitamente</button>}
      {map.map.status==='SUBMITTED'&&<button style={actionStyle} disabled={disabled} onClick={()=>void close()}>Fechar no horário oficial</button>}
      <button style={actionStyle} disabled={disabled||!selectedAdmission} onClick={()=>void escalate()}>Registrar exceção clínica</button>
     </div>
    </div>
    <h4 className="w3-no-print">Pedidos e situação</h4>
    <label className="w3-no-print">Filtrar por internação, dieta ou status<input style={inputStyle} value={filter} onChange={e=>setFilter(e.target.value)}/></label>
    <div className="w3-no-print" style={{overflowX:'auto'}}>
     <table style={{width:'100%',borderCollapse:'collapse',marginTop:12}}><thead><tr><th align="left">Internação</th><th align="left">Refeição</th><th align="left">Dieta</th><th align="left">Estado</th><th>Ação</th></tr></thead>
      <tbody>{menu.map(meal=><tr key={meal.id} style={{borderTop:'1px solid #cbd5e1'}}><td>{admissions.find(a=>a.admissionId===meal.admissionId)?.patientCode??meal.admissionId}</td><td>{meal.mealType==='PRIMARY'?'Principal':'Secundária'}</td><td>{catalog.find(x=>x.id===meal.dietCode)?.label??meal.dietCode}</td><td>{meal.status} {meal.advisory==='KITCHEN_REVIEW'&&'· revisão cozinha'}</td><td align="center"><button type="button" disabled={disabled||['CANCELLED','DELIVERED'].includes(meal.status)} onClick={()=>void removeMeal(meal)}>Remover/suspender</button></td></tr>)}</tbody>
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
