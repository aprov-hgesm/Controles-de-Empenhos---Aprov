import {createHash,randomUUID} from 'node:crypto';
import {assertHospital,assertIdentifier,assertDate} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const DEFAULT_CATEGORIES=['DOCUMENTATION','DIET_MISMATCH','ALLERGY','FASTING','DELIVERY','OTHER'];
const DEFAULT_RISKS=['LOW','MODERATE','HIGH','CRITICAL'];
const CHANNELS=['PHONE','IN_PERSON','INSTITUTIONAL_EMAIL','OTHER'];
const csvHeader=['caseId','unitId','category','risk','status','openedAt','updatedAt','closedAt','medicalContacts','answeredContacts','firstResponseHours'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const required=(value,name,max=500)=>{assertHospital(typeof value==='string'&&value.trim()&&value.trim().length<=max,'INVALID',name+' obrigatório');return value.trim()};
const optional=(value,name)=>value?required(value,name):null;
const actualTime=(value,label)=>{
 assertHospital(typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+300000,'INVALID',label+' inválido');
 return new Date(value).toISOString();
};
const countLimit=n=>Math.min(100,Math.max(1,Number.isInteger(Number(n))?Number(n):30));
const csv=x=>{const v=String(x??''),safe=/^\s*[=+@\-\t\r]/.test(v)?"'"+v:v;return '"'+safe.replace(/"/g,'""')+'"';};

/** Single canonical Firestore ledger, nutrition is an auditor and NEVER approves routine maps. */
export class NutritionAuditService {
 constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Storage clínico indisponível');this.store=store}
 unit(scope,unit,write=false){assertIdentifier(unit);requireHospitalPermission(scope,write?'nutrition:write':'nutrition:read',unit);return scope.organizationId}
 async admission(scope,unit,id){
  assertIdentifier(id);
  const a=await this.store.get(scope.organizationId,'admission',id);
  assertHospital(a&&a.unitId===unit,'NOT_FOUND','Internação fora do escopo');return a;
 }
 async finding(scope,unit,id){
  assertIdentifier(id);
  const a=await this.store.get(scope.organizationId,'nutrition_finding',id);
  assertHospital(a?.unitId===unit,'NOT_FOUND','Achado fora do escopo');return a;
 }
 async contact(scope,unit,id){
  assertIdentifier(id);
  const a=await this.store.get(scope.organizationId,'nutrition_contact',id);
  assertHospital(a?.unitId===unit,'NOT_FOUND','Contato fora do escopo');return a;
 }
 async historyEvent(scope,unit,kind,id,event,details){
  return this.store.appendEvent(scope.organizationId,kind,id,event,scope.uid,{unitId:unit,...details});
 }
 async catalog(scope,unitId){
  this.unit(scope,unitId);
  return (await this.store.get(scope.organizationId,'nutrition_catalog','nutrition_catalog'))
    ??{revision:0,categories:DEFAULT_CATEGORIES,risks:DEFAULT_RISKS};
 }
 async configureCatalog(scope,{categories,risks,expectedRevision=0}){
  requireHospitalPermission(scope,'hospital:manage');
  const valid=a=>Array.isArray(a)&&a.length>0&&a.length<=30&&new Set(a).size===a.length
    &&a.every(x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{1,39}$/.test(x));
  assertHospital(valid(categories)&&valid(risks),'INVALID','Catálogo inválido');
  return this.store.transaction(async db=>{
   const previous=await db.get(scope.organizationId,'nutrition_catalog','nutrition_catalog');
   assertHospital((previous?.revision??0)===expectedRevision,'CONFLICT','Catálogo alterado');
   const item=await db.put(scope.organizationId,'nutrition_catalog','hospital_catalog',{
    id:'nutrition_catalog',organizationId:scope.organizationId,unitId:'hospital_catalog',categories,risks
   },previous?.revision);
   await this.historyEvent(scope,'hospital_catalog','nutrition_catalog',item.id,'nutritionCatalog.updated',{revision:item.revision});
   return item;
  });
 }
 async createFinding(scope,{unitId,admissionId,medicalReferenceId=null,category,risk,evidence,recommendation,escalation=null,idempotencyKey}){
  this.unit(scope,unitId,true);assertIdentifier(idempotencyKey);
  const a=await this.admission(scope,unitId,admissionId);
  const cat=await this.catalog(scope,unitId);
  assertHospital(cat.categories.includes(category)&&cat.risks.includes(risk),'INVALID','Categoria/risco inválido');
  const ev=required(evidence,'Evidência',500),rec=required(recommendation,'Recomendação',500),esc=optional(escalation,'Escalonamento');
  if(risk==='CRITICAL')assertHospital(!!esc,'PRECONDITION','Achado crítico exige comunicação assistencial');
  if(medicalReferenceId){const ref=await this.store.get(scope.organizationId,'medical_reference',medicalReferenceId);
    assertHospital(ref&&ref.unitId===unitId&&ref.admissionId===a.id,'NOT_FOUND','Referência médica inválida')}
  const input={unitId,admissionId,medicalReferenceId,category,risk,ev,rec,esc};
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'nutrition.finding:'+scope.uid,idempotencyKey,hash(input),async()=>{
   await this.admission(scope,unitId,admissionId);
   const id='nf_'+randomUUID(),now=db.now();
   const finding=await db.put(scope.organizationId,'nutrition_finding',unitId,{
     id,organizationId:scope.organizationId,unitId,admissionId,medicalReferenceId,category,risk,
     evidence:ev,recommendation:rec,escalation:esc,status:'IDENTIFIED',createdAt:now,updatedAt:now,
     closedAt:null,createdBy:scope.uid
   },0);
   await this.historyEvent(scope,unitId,'nutrition_finding',id,'nutritionAudit.opened',{
     category,risk,admissionId,medicalReferenceId,criticalEscalationRequired:risk==='CRITICAL'
   });
   return finding;
  }));
 }
 async transitionFinding(scope,{unitId,findingId,next,reason,expectedRevision}){
  this.unit(scope,unitId,true);const why=required(reason,'Motivo');
  return this.store.transaction(async db=>{
   const old=await this.finding(scope,unitId,findingId);
   assertHospital(old.revision===expectedRevision,'CONFLICT','Achado obsoleto');
   const transitions={IDENTIFIED:['FOLLOW_UP','CLOSED'],CONTACTED:['FOLLOW_UP','CLOSED'],FOLLOW_UP:['CLOSED'],CLOSED:[]};
   assertHospital(transitions[old.status]?.includes(next),'PRECONDITION','Transição inválida');
   const now=db.now();
   const nextRow=await db.put(scope.organizationId,'nutrition_finding',unitId,{
     ...old,status:next,updatedAt:now,closedAt:next==='CLOSED'?now:null
   },expectedRevision);
   await this.historyEvent(scope,unitId,'nutrition_finding',findingId,
     next==='CLOSED'?'nutritionAudit.closed':'nutritionAudit.updated',{from:old.status,to:next,reason:why});
   return nextRow;
  });
 }
 async recordMedicalContact(scope,{unitId,findingId,physicianRef,channel,contactedAt,requestNote,contactConfirmed,idempotencyKey}){
  this.unit(scope,unitId,true);assertIdentifier(idempotencyKey);
  assertHospital(contactConfirmed===true,'PRECONDITION','Confirmar contato real antes de registrar');
  assertHospital(CHANNELS.includes(channel),'INVALID','Canal inválido');
  const at=actualTime(contactedAt,'Horário do contato'),physician=required(physicianRef,'Médico',160),
    note=required(requestNote,'Revisão médica');
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'nutrition.contact:'+scope.uid,idempotencyKey,
    hash({unitId,findingId,physician,channel,at,note}),async()=>{
      const finding=await this.finding(scope,unitId,findingId);
      assertHospital(finding.status!=='CLOSED','PRECONDITION','Achado encerrado');
      const id='mr_'+randomUUID(),now=db.now();
      const record=await db.put(scope.organizationId,'nutrition_contact',unitId,{
       id,organizationId:scope.organizationId,unitId,findingId,physicianRef:physician,
       channel,contactedAt:at,requestNote:note,status:'REQUESTED',responseNote:null,respondedAt:null,
       createdAt:now,updatedAt:now,registeredBy:scope.uid
      },0);
      await this.historyEvent(scope,unitId,'nutrition_contact',id,'medicalReview.contacted',{findingId,channel,contactedAt:at});
      if(finding.status==='IDENTIFIED'){
        await db.put(scope.organizationId,'nutrition_finding',unitId,{...finding,status:'CONTACTED',updatedAt:now},finding.revision);
        await this.historyEvent(scope,unitId,'nutrition_finding',findingId,'nutritionAudit.updated',{from:'IDENTIFIED',to:'CONTACTED',contactId:id});
      }
      return record;
    }));
 }
 async recordMedicalResponse(scope,{unitId,contactId,respondedAt,responseNote,responseConfirmed,expectedRevision}){
  this.unit(scope,unitId,true);
  assertHospital(responseConfirmed===true,'PRECONDITION','Resposta não confirmada');
  const at=actualTime(respondedAt,'Retorno'),answer=required(responseNote,'Resposta');
  return this.store.transaction(async db=>{
   const current=await this.contact(scope,unitId,contactId);
   assertHospital(current.revision===expectedRevision,'CONFLICT','Contato obsoleto');
   assertHospital(current.status==='REQUESTED'&&Date.parse(at)>=Date.parse(current.contactedAt),
    'PRECONDITION','Resposta incompatível');
   const next=await db.put(scope.organizationId,'nutrition_contact',unitId,{
     ...current,status:'ANSWERED',respondedAt:at,responseNote:answer,updatedAt:db.now()
   },current.revision);
   await this.historyEvent(scope,unitId,'nutrition_contact',contactId,'medicalReview.answered',{findingId:current.findingId,respondedAt:at});
   return next;
  });
 }
 async closeMedicalContact(scope,{unitId,contactId,expectedRevision,reason}){
  this.unit(scope,unitId,true);const why=required(reason,'Motivo');
  return this.store.transaction(async db=>{
   const c=await this.contact(scope,unitId,contactId);
   assertHospital(c.revision===expectedRevision,'CONFLICT','Versão obsoleta');
   assertHospital(c.status!=='CLOSED','PRECONDITION','Contato encerrado');
   const next=await db.put(scope.organizationId,'nutrition_contact',unitId,{...c,status:'CLOSED',updatedAt:db.now()},c.revision);
   await this.historyEvent(scope,unitId,'nutrition_contact',contactId,'medicalReview.closed',{reason:why,wasAnswered:!!c.respondedAt});
   return next;
  });
 }
 async listFindings(scope,{unitId,category,risk,status,from,to,admissionId,limit=30,offset=0}={}){
  this.unit(scope,unitId);
  if(from)assertDate(from);if(to)assertDate(to);
  assertHospital(!from||!to||from<=to,'INVALID','Período invertido');
  assertHospital(Number.isInteger(Number(offset))&&Number(offset)>=0&&Number(offset)<=100000,'INVALID','Paginação inválida');
  const rows=(await this.store.list(scope.organizationId,'nutrition_finding',unitId)).filter(f=>
    (!category||f.category===category)&&(!risk||f.risk===risk)&&(!status||f.status===status)
    &&(!admissionId||f.admissionId===admissionId)&&(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to))
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  return {total:rows.length,items:rows.slice(Number(offset),Number(offset)+countLimit(limit))};
 }
 async listMedicalContacts(scope,{unitId,findingId,status,limit=100}={}){
  this.unit(scope,unitId);
  return (await this.store.list(scope.organizationId,'nutrition_contact',unitId)).filter(c=>
    (!findingId||c.findingId===findingId)&&(!status||c.status===status))
    .sort((a,b)=>b.contactedAt.localeCompare(a.contactedAt)).slice(0,countLimit(limit));
 }
 async readHistory(scope,{unitId,kind,id}={}){
  this.unit(scope,unitId);
  assertHospital(['nutrition_finding','nutrition_contact'].includes(kind),'INVALID','Histórico inválido');
  if(kind==='nutrition_finding')await this.finding(scope,unitId,id);else await this.contact(scope,unitId,id);
  return (await this.store.events(scope.organizationId,kind,id)).map(e=>({
   id:e.id,eventType:e.eventType,actorUid:e.actorUid,occurredAt:e.occurredAt,details:e.payload
  }));
 }
 async readPatientDiet(scope,{unitId,admissionId}={}){
  this.unit(scope,unitId);
  const a=await this.admission(scope,unitId,admissionId);
  const p=await this.store.get(scope.organizationId,'patient',a.patientId);
  assertHospital(p?.unitId===unitId,'NOT_FOUND','Paciente fora da unidade');
  const refs=(await this.store.list(scope.organizationId,'medical_reference',unitId))
    .filter(x=>x.admissionId===a.id).sort((x,y)=>x.createdAt.localeCompare(y.createdAt));
  const events=(await this.store.events(scope.organizationId,'admission',a.id))
    .filter(e=>['dietReference.updated','patient/admission.updated'].includes(e.eventType));
  return {admissionId:a.id,unitId,referenceCode:p.referenceCode,fasting:a.fasting,
   allergyCodes:a.allergyCodes,activeMedicalReferenceId:a.medicalReferenceId,
   versions:refs.map((r,i)=>({id:r.id,catalogItemId:r.catalogItemId,sourceRef:r.sourceRef,
    prescribedAt:r.prescribedAt,enteredByUid:r.enteredByUid,createdAt:r.createdAt,
    previousCatalogItemId:i?refs[i-1].catalogItemId:null})),
   events:events.map(e=>({eventType:e.eventType,actorUid:e.actorUid,occurredAt:e.occurredAt})),
   metadata:{consistency:'NOT_AVAILABLE_IN_W0',route:'NOT_AVAILABLE_IN_W0'}};
 }
 async listPatients(scope,{unitId,limit=50}={}){
  this.unit(scope,unitId);
  return (await this.store.list(scope.organizationId,'admission',unitId)).slice(0,countLimit(limit))
    .map(a=>({admissionId:a.id,unitId:a.unitId,fasting:a.fasting,medicalReferenceId:a.medicalReferenceId,status:a.status}));
 }
 async listAlerts(scope,{unitId,limit=60}={}){
  this.unit(scope,unitId);
  const allowed=new Set(['dietReference.updated','meal.suspended','map.amended','patient/admission.updated']);
  return (await this.store.listUnitEvents(scope.organizationId,unitId,500))
    .filter(x=>allowed.has(x.eventType)).slice(0,countLimit(limit))
    .map(x=>({id:x.id,type:x.eventType,occurredAt:x.occurredAt,unitId}));
 }
 async summary(scope,{unitId,from,to}={}){
  this.unit(scope,unitId);
  const rows=(await this.store.list(scope.organizationId,'nutrition_finding',unitId))
    .filter(f=>(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to));
  const ids=new Set(rows.map(f=>f.id));
  const contacts=(await this.store.list(scope.organizationId,'nutrition_contact',unitId)).filter(c=>ids.has(c.findingId));
  const hours=contacts.filter(c=>c.respondedAt).map(c=>(Date.parse(c.respondedAt)-Date.parse(c.contactedAt))/3600000);
  return {total:rows.length,pending:rows.filter(f=>f.status!=='CLOSED').length,
    critical:rows.filter(f=>f.risk==='CRITICAL'&&f.status!=='CLOSED').length,
    contactsPending:contacts.filter(c=>c.status==='REQUESTED').length,answered:hours.length,
    averageResponseHours:hours.length?Math.round(hours.reduce((a,b)=>a+b,0)/hours.length*10)/10:null};
 }
 async reportCsv(scope,{unitId,from,to}={}){
  this.unit(scope,unitId);
  const rows=(await this.store.list(scope.organizationId,'nutrition_finding',unitId))
    .filter(f=>(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to));
  const contacts=await this.store.list(scope.organizationId,'nutrition_contact',unitId);
  const out=rows.map(f=>{
    const linked=contacts.filter(c=>c.findingId===f.id),first=linked.find(c=>c.respondedAt);
    return [f.id,f.unitId,f.category,f.risk,f.status,f.createdAt,f.updatedAt,f.closedAt,
      linked.length,linked.filter(c=>c.respondedAt).length,
      first?Math.round((Date.parse(first.respondedAt)-Date.parse(first.contactedAt))/3600000*10)/10:''];
  });
  return '\ufeff'+[csvHeader,...out].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
 }
}
