'use client';

import {useCallback,useEffect,useState} from 'react';
type ScopeRole='UNIT'|'KITCHEN'|'NUTRITION'|'HOSPITAL_ADMIN';
type CatalogItem={id:string;code:string;label:string;type:'ORAL'|'ENTERAL'|'SUPPLEMENT'|'OTHER';consistency:string;route:string;device:string|null;restrictionCodes:string[];allergenCodes:string[];active:boolean;revision:number};
type Admission={admissionId:string;patientCode:string;patientName?:string;bedLabel?:string|null;bedId:string|null;medicalReferenceId:string|null};
type MedicalReference={id:string;sourceRef:string;sourceVersion?:string;prescriberAsRecorded?:string;prescribedAt:string;catalogItemId:string;enteredByUid:string};
export type DietasViewProps={organizationId:string;unitId?:string;roles:readonly ScopeRole[];getIdToken:()=>Promise<string>};
const input:React.CSSProperties={width:'100%',padding:'11px 12px',border:'1px solid #cfdbed',borderRadius:11,minHeight:42,color:'#173657',background:'#fff'};
const button:React.CSSProperties={padding:'11px 15px',border:'1px solid #bdd3f5',borderRadius:11,background:'#ebf3ff',color:'#164785',fontWeight:700,cursor:'pointer'};
const container:React.CSSProperties={display:'grid',gap:14,padding:22,border:'1px solid #e1e9f4',borderRadius:18,background:'#fff',boxShadow:'0 12px 36px rgba(17,44,87,.045)'};
export function DietasView({organizationId,unitId,roles,getIdToken}:DietasViewProps){
 const [catalog,setCatalog]=useState<CatalogItem[]>([]);
 const [admissions,setAdmissions]=useState<Admission[]>([]);
 const [history,setHistory]=useState<MedicalReference[]>([]);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [label,setLabel]=useState('');
 const [type,setType]=useState<CatalogItem['type']>('ORAL');
 const [consistency,setConsistency]=useState('NORMAL');
 const [route,setRoute]=useState('ORAL');
 const [device,setDevice]=useState('');
 const [restrictions,setRestrictions]=useState('');
 const [allergens,setAllergens]=useState('');
 const [volume,setVolume]=useState('');
 const [prescriber,setPrescriber]=useState('');
 const [prescribedAt,setPrescribedAt]=useState('');
 const [paperConfirmed,setPaperConfirmed]=useState(false);
 const [catalogItemId,setCatalogItemId]=useState('');
 const [fasting,setFasting]=useState(false);
 const [allergyCodes,setAllergyCodes]=useState('');
 const isAdmin=roles.includes('HOSPITAL_ADMIN'),canRecord=roles.includes('UNIT');
 const request=useCallback(async<T,>(area:'maps'|'diets',operation:string,payload:Record<string,unknown>)=>{
  const token=await getIdToken();
  if(!token)throw Error('Acesso expirado');
  const resp=await fetch(`/api/hospital/${area}`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'x-hospital-organization-id':organizationId},body:JSON.stringify({operation,payload})});
  const result=await resp.json() as {ok:boolean;data:T;error?:{message:string;code:string}};
  if(!result.ok)throw Error(`${result.error?.code??'ERROR'}: ${result.error?.message??'Falha na solicitação'}`);
  return result.data;
 },[organizationId,getIdToken]);
 const reload=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const [items,patients]=await Promise.all([
    request<CatalogItem[]>('diets','diet.list',isAdmin?{includeInactive:true}:{unitId}),
    unitId&&!isAdmin?request<Admission[]>('maps','admission.list',{unitId}):Promise.resolve([]),
   ]);
   setCatalog(items);setAdmissions(patients);
  }catch(e){setError(e instanceof Error?e.message:'Falha de leitura')}
  finally{setBusy(false)}
 },[request,unitId,isAdmin]);
 useEffect(()=>{void reload()},[reload]);
 useEffect(()=>{
  if(!selected||!unitId||isAdmin){setHistory([]);return}
  let cancelled=false;
  request<MedicalReference[]>('diets','reference.list',{unitId,admissionId:selected}).then(rows=>{if(!cancelled)setHistory(rows)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Falha ao consultar histórico')});
  return ()=>{cancelled=true};
 },[selected,unitId,isAdmin,request]);
 async function run(fn:()=>Promise<unknown>,ok:string){
  setBusy(true);setError('');setNotice('');
  try{await fn();setNotice(ok);await reload()}catch(e){setError(e instanceof Error?e.message:'Falha na gravação')}
  finally{setBusy(false)}
 }
 const splitCodes=(v:string)=>v.split(',').map(x=>x.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,63)).filter(Boolean);
 return <section aria-label="Dietas e prescrições de referência" className="hospital-dietas" style={{display:'grid',gap:18,width:'100%'}}>
  <header><h2 style={{fontSize:23,fontWeight:800,letterSpacing:'-.03em',color:'#173b69'}}>Registrar dieta do paciente</h2><p style={{marginTop:8,color:'#5d7291',fontSize:14}}>Copie apenas as informações da prescrição em papel ou do SIGH. A plataforma não cria nem modifica prescrições médicas.</p></header>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {notice&&<p role="status" style={{color:'#166534'}}>{notice}</p>}
  <article style={container}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{fontSize:17,fontWeight:750,color:'#1c436f'}}>Dietas disponíveis para solicitar</h3><button disabled={busy} style={button} onClick={()=>void reload()}>Atualizar</button></div>
   {catalog.length===0?<p>Não há dietas autorizadas cadastradas.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th align="left">Dieta</th><th align="left">Tipo</th><th align="left">Consistência</th><th align="left">Estado</th></tr></thead><tbody>{catalog.map(item=><tr key={item.id} style={{borderTop:'1px solid #e2e8f0'}}><td>{item.label}</td><td>{item.type??'A revisar'}</td><td>{item.consistency??'A revisar'}</td><td>{item.active?'Ativa':'Inativa'}</td></tr>)}</tbody></table></div>}
  </article>
  {isAdmin&&<form style={container} onSubmit={e=>{e.preventDefault();void run(()=>{const id='DIETA_'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();return request('diets','diet.save',{catalogItemId:id,code:id,label,type,consistency,route,device:device||null,restrictionCodes:splitCodes(restrictions),allergenCodes:splitCodes(allergens),volumeMl:volume?Number(volume):null,unit:volume?'mL':'portion',preparations:[],status:'ACTIVE'});},'Dieta registrada no catálogo com auditoria')}}>
   <h3>Cadastrar nova dieta autorizada</h3>
   <small>Alteração de item existente exige revisão/ETag; não é realizada por este formulário rápido.</small>
   <label>Nome completo<input required style={input} value={label} onChange={e=>setLabel(e.target.value)}/></label>
   <label>Tipo<select style={input} value={type} onChange={e=>setType(e.target.value as CatalogItem['type'])}><option value="ORAL">Oral</option><option value="ENTERAL">Enteral</option><option value="SUPPLEMENT">Suplemento</option><option value="OTHER">Outro</option></select></label>
   <label>Consistência<select style={input} value={consistency} onChange={e=>setConsistency(e.target.value)}><option value="NORMAL">Normal</option><option value="SOFT">Branda</option><option value="PUREED">Pastosa</option><option value="LIQUID">Líquida</option><option value="THICKENED">Espessada</option><option value="NOT_APPLICABLE">Não aplicável</option></select></label>
   <label>Via<input required style={input} value={route} onChange={e=>setRoute(e.target.value)}/></label>
   <label>Dispositivo, se aplicável (SNE não é consistência)<input style={input} value={device} onChange={e=>setDevice(e.target.value)}/></label>
   <label>Restrições (códigos separados por vírgula)<input style={input} value={restrictions} onChange={e=>setRestrictions(e.target.value)}/></label>
   <label>Alérgenos (códigos separados por vírgula)<input style={input} value={allergens} onChange={e=>setAllergens(e.target.value)}/></label>
   <label>Volume mL, se aplicável<input type="number" min={1} max={10000} style={input} value={volume} onChange={e=>setVolume(e.target.value)}/></label>
   <button style={button} disabled={busy} type="submit">Salvar no catálogo</button>
  </form>}
  {!isAdmin&&unitId&&<article style={container}>
   <h3>Escolha o paciente e confira as dietas anteriores</h3>
   <label>Paciente ativo<select style={input} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecionar</option>{admissions.map(a=><option key={a.admissionId} value={a.admissionId}>{a.patientName??'Paciente'} · leito {a.bedLabel??'não informado'}</option>)}</select></label>
   {selected&&<div><h4>Últimos registros da dieta</h4>{history.length===0?<p>Sem registro anterior.</p>:<ol>{history.map(ref=><li key={ref.id}>{catalog.find(item=>item.id===ref.catalogItemId)?.label??'Dieta registrada'} · {new Date(ref.prescribedAt).toLocaleString('pt-BR')}</li>)}</ol>}</div>}
  </article>}
  {canRecord&&unitId&&selected&&<form style={container} onSubmit={e=>{e.preventDefault();void run(async()=>{
    await request('diets','reference.record',{unitId,admissionId:selected,referenceId:`rx_${crypto.randomUUID()}`,catalogItemId,sourceRef:'PAPEL_'+selected,sourceVersion:crypto.randomUUID(),prescriberAsRecorded:prescriber.trim()||'NÃO INFORMADO NO PAPEL',prescribedAt:new Date(prescribedAt).toISOString(),fasting,allergyCodes:splitCodes(allergyCodes),restrictionCodes:[]});
    setPrescribedAt('');setPaperConfirmed(false);
    setHistory(await request<MedicalReference[]>('diets','reference.list',{unitId,admissionId:selected}));
   },'Referência registrada; refeições anteriores poderão exigir reconferência')}}>
   <h3 className="text-lg font-extrabold text-[#173b69]">O que está escrito na prescrição?</h3>
   <p className="text-sm text-slate-600">Não é necessário informar número ou versão do papel. Confira os dados antes de salvar.</p>
   <label>Médico responsável (se estiver legível)<input style={input} value={prescriber} onChange={e=>setPrescriber(e.target.value)} placeholder="Nome que consta no papel"/></label>
   <label>Data e hora da prescrição em papel<input style={input} type="datetime-local" required value={prescribedAt} onChange={e=>setPrescribedAt(e.target.value)}/></label>
   <label>Dieta institucional vinculada<select style={input} required value={catalogItemId} onChange={e=>setCatalogItemId(e.target.value)}><option value="">Escolher conforme prescrição</option>{catalog.filter(x=>x.active).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label>Alergias conforme a prescrição (separadas por vírgula)<input style={input} value={allergyCodes} onChange={e=>setAllergyCodes(e.target.value)} placeholder="Ex.: leite, ovo"/></label><p className="text-xs text-amber-800">Registre os alimentos conforme o papel e confira as restrições da dieta. Não há liberação automática de refeições com risco.</p>
   <label><input type="checkbox" checked={fasting} onChange={e=>setFasting(e.target.checked)}/> Prescrição indica jejum/NPVO</label>
   <label className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={paperConfirmed} onChange={e=>setPaperConfirmed(e.target.checked)}/> Conferi as informações na prescrição médica em papel ou no SIGH. Sei que este registro não substitui a prescrição médica.</label>
   <button className="hospital-primary-action" type="submit" disabled={busy||!paperConfirmed||!prescribedAt||!catalogItemId}>Salvar dieta do paciente</button>
  </form>}
 </section>;
}
