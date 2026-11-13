'use client';

import {useState} from 'react';
import {mealName,timeSituation} from '../integration/meal-period.mjs';

type Cycle='06'|'10'|'16';
type Catalog={id:string;label:string;code:string;consistency?:string;route?:string;type?:string;active:boolean};
type MapRef={id:string;revision:number;cycleId:Cycle;localDate:string;status:string};
type Props={organizationId:string;getIdToken:()=>Promise<string>;map:MapRef;catalog:Catalog[];
 onSaved:(finish:boolean,reason:string)=>Promise<void>;onCancel:()=>void;};
type Api<T>={ok:true;data:T}|{ok:false;error:{message:string}};
const field='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900';
const sections=['HIPOSSODICA','HIPOLIPIDICA','HIPOPROTEICA','DIABETICO','NPVO','SNE','OUTRO'] as const;
const names:Record<string,string>={HIPOSSODICA:'Hipossódica',HIPOLIPIDICA:'Hipolipídica',HIPOPROTEICA:'Hipoproteica',DIABETICO:'Diabético',NPVO:'NPVO',SNE:'SNE',OUTRO:'Outro'};
const consistencies=[
 ['LIVRE','Livre'],['BRANDA','Branda'],['PASTOSA','Pastosa'],
 ['LIQUIDA_RESTRITA','Líquida restrita'],['LIQUIDA_COMPLETA','Líquida completa'],
 ['LIQUIDA_SEM_RESIDUOS','Líquida sem resíduos'],['OUTRA','Outra']
] as const;
const empty=()=>({fullName:'',birthDate:'',bedLabel:'',consistency:'LIVRE',route:'ORAL',otherRestriction:'',allergyNote:'',observation:'',reason:''});
export function MapRapidRegistration({organizationId,getIdToken,map,catalog,onSaved,onCancel}:Props){
 const [form,setForm]=useState(empty);
 const [restrictions,setRestrictions]=useState<string[]>([]);
 const [primary,setPrimary]=useState(true),[secondary,setSecondary]=useState(true);
 const [companion,setCompanion]=useState(false);
 const [careChecked,setCareChecked]=useState(false);
 const [selectedDiet,setSelectedDiet]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=(key:keyof ReturnType<typeof empty>,value:string)=>setForm(p=>({...p,[key]:value}));
 const toggle=(code:string)=>setRestrictions(p=>p.includes(code)?p.filter(x=>x!==code):[...p,code]);
 const tube=form.route==='SONDA'||restrictions.includes('NPVO')||restrictions.includes('SNE');
 // Uma base oral institucional atende às texturas selecionadas no pedido.
 // A consistência não precisa ser duplicada como item do catálogo.
 const oralCatalog=catalog.filter(x=>x.active&&x.type==='ORAL'&&x.route==='ORAL');
 const diet=oralCatalog.find(x=>x.id===selectedDiet)??oralCatalog[0];
 const companionDiet=oralCatalog.find(x=>x.consistency==='NORMAL')??oralCatalog[0];
 const timing=timeSituation(map.cycleId,map.localDate);
 const extraordinary=timing.stage!=='ON_TIME';
 const submitted=map.status!=='DRAFT';
 const chosen=tube?[]:[...(primary?['PRIMARY']:[]),...(secondary?['SECONDARY']:[])];
 const canSave=careChecked&&!!form.fullName.trim()&&!!form.birthDate&&!!form.bedLabel.trim()&&(chosen.length>0||companion)&&
  (!chosen.length||!!diet)&&(!companion||!!companionDiet)&&(!extraordinary||form.reason.trim().length>=5);
 async function save(finish:boolean){
  if(!canSave){setError('Confira identificação, refeições, orientação assistencial e disponibilidade de uma dieta oral institucional.');return}
  setBusy(true);setError('');
  try{
   const token=await getIdToken();
   if(!token)throw Error('Sessão expirada');
   const response=await fetch('/api/hospital/maps',{method:'POST',cache:'no-store',headers:{
    'Content-Type':'application/json','Authorization':'Bearer '+token,'x-hospital-organization-id':organizationId
   },body:JSON.stringify({operation:'map.patient.add',payload:{
    mapId:map.id,expectedMapRevision:map.revision,idempotencyKey:crypto.randomUUID(),
    ...form,restrictions,meals:chosen,companion,catalogItemId:diet?.id,companionCatalogItemId:companionDiet?.id,
    confirmedAgainstCareInstruction:careChecked
   }})});
   const result=await response.json() as Api<unknown>;
   if(!response.ok||!result.ok)throw Error(!result.ok?result.error.message:'Falha ao salvar');
   const completedReason=form.reason;
   setForm({...empty(),reason:completedReason});setRestrictions([]);setPrimary(true);setSecondary(true);setCompanion(false);setSelectedDiet('');setCareChecked(false);
   await onSaved(finish,completedReason);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar paciente e dieta')}
  finally{setBusy(false)}
 }
 return <section className="hospital-panel space-y-5 p-5 sm:p-6" aria-label="Cadastro direto de dietas no mapa" data-testid="map-rapid-entry">
  <header><p className="hospital-hint-label">Cadastro direto · Mapa {map.cycleId}h</p>
   <h3 className="mt-1 text-xl font-extrabold text-[#173b69]">Cadastrar paciente e refeições</h3>
   <p className="mt-1 text-sm text-slate-600">Tudo em uma tela. Salve e continue para outro leito ou conclua para conferir o mapa antes do envio.</p>
  </header>
  <div className="grid gap-3 sm:grid-cols-3">
   <label className="grid gap-1 text-sm font-semibold">Nome completo do paciente<input className={field} autoComplete="off" value={form.fullName} maxLength={160} onChange={e=>change('fullName',e.target.value)}/></label>
   <label className="grid gap-1 text-sm font-semibold">Data de nascimento<input className={field} type="date" value={form.birthDate} onChange={e=>change('birthDate',e.target.value)}/></label>
   <label className="grid gap-1 text-sm font-semibold">Número do leito<input className={field} value={form.bedLabel} maxLength={60} onChange={e=>change('bedLabel',e.target.value)} placeholder="Ex.: 05-A"/></label>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="grid gap-1 text-sm font-semibold">Consistência da dieta<select className={field} value={form.consistency} onChange={e=>change('consistency',e.target.value)}>{consistencies.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label className="grid gap-1 text-sm font-semibold">Via de administração<select className={field} value={form.route} onChange={e=>change('route',e.target.value)}><option value="ORAL">Oral</option><option value="SONDA">Sonda</option></select></label>
  </div>
  <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Restrições alimentares</legend>
   <div className="flex flex-wrap gap-3">{sections.map(code=><label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restrictions.includes(code)} onChange={()=>toggle(code)}/>{names[code]}</label>)}</div>
   {restrictions.includes('OUTRO')&&<label className="mt-3 grid gap-1 text-sm">Especificar outra restrição<input className={field} value={form.otherRestriction} maxLength={120} onChange={e=>change('otherRestriction',e.target.value)}/></label>}
  </fieldset>
  <label className="grid gap-1 text-sm font-semibold">Alergias alimentares (se houver)
   <input className={field+' border-amber-300'} value={form.allergyNote} maxLength={180} onChange={e=>change('allergyNote',e.target.value)} placeholder="Ex.: leite, ovo, amendoim; separar por vírgulas"/>
   {form.allergyNote.trim()&&<span role="alert" className="rounded-lg bg-amber-50 p-2 text-xs font-extrabold text-amber-900">ALERTA DE ALERGIA — será destacado na Cozinha e na distribuição</span>}
  </label>
  <fieldset className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><legend className="px-1 text-sm font-bold">Quais refeições devem ser enviadas?</legend>
   {tube?<p className="text-sm font-semibold text-amber-900">NPVO / SNE / sonda: sem refeição oral para o paciente. É possível solicitar somente a principal para o acompanhante.</p>:
   <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={primary} onChange={e=>setPrimary(e.target.checked)}/>{mealName(map.cycleId,'PRIMARY')}</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={secondary} onChange={e=>setSecondary(e.target.checked)}/>{mealName(map.cycleId,'SECONDARY')}</label></div>}
   <label className="mt-3 flex items-center gap-2 border-t border-blue-100 pt-3 text-sm font-semibold"><input type="checkbox" checked={companion} onChange={e=>setCompanion(e.target.checked)}/>Enviar refeição ao acompanhante (somente {mealName(map.cycleId,'PRIMARY')})</label>
   {companion&&!companionDiet&&<p role="alert" className="mt-2 text-xs text-red-800">Nenhuma base oral está disponível para a refeição do acompanhante.</p>}
  </fieldset>
  {chosen.length>0&&oralCatalog.length>1&&<details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
    <summary className="cursor-pointer font-semibold text-[#28486f]">Base institucional da dieta (opcional)</summary>
    <label className="mt-3 grid gap-1 font-medium">Tipo autorizado no catálogo
      <select className={field} value={diet?.id??''} onChange={e=>setSelectedDiet(e.target.value)}>
        {oralCatalog.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
    </label>
    <p className="mt-2 text-xs text-slate-600">A consistência selecionada acima será preservada no preparo, no relatório e na etiqueta.</p>
  </details>}
  {chosen.length>0&&oralCatalog.length===0&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Nenhuma base oral ativa está disponível para registrar refeições do paciente.</p>}
  <label className="grid gap-1 text-sm font-semibold">Observações complementares da dieta (opcional)<textarea className={field} rows={2} maxLength={180} value={form.observation} onChange={e=>change('observation',e.target.value)} placeholder="Informações para a preparação e a etiqueta"/></label>
  {extraordinary&&<label className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold">Justificativa da solicitação {submitted?'extra ':''}fora do prazo<textarea className={field} rows={2} value={form.reason} onChange={e=>change('reason',e.target.value)}/></label>}
  <label className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-950">
   <input type="checkbox" className="mt-1" checked={careChecked} onChange={e=>setCareChecked(e.target.checked)}/>
   Confirmo que esta dieta foi conferida com a orientação assistencial vigente. Isto é uma transcrição para a Cozinha, não uma prescrição médica.
  </label>
  {submitted&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">Mapa já enviado: esta inclusão será registrada como dieta extra, com atualização do acompanhamento, dos relatórios e das etiquetas.</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  <div className="flex flex-wrap gap-2">
   <button className="hospital-secondary-action" type="button" disabled={busy||!canSave} onClick={()=>void save(false)}>{busy?'Salvando…':'Salvar e próximo paciente'}</button>
   <button className="hospital-primary-action" type="button" disabled={busy||!canSave} onClick={()=>void save(true)}>{submitted?'Salvar dieta extra e voltar ao mapa':'Salvar e concluir mapa'}</button>
   <button className="hospital-secondary-action" type="button" disabled={busy} onClick={onCancel}>Voltar ao detalhamento</button>
  </div>
 </section>;
}
