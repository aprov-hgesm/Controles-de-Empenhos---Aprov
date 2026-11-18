import test from 'node:test';
import assert from 'node:assert/strict';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/service.mjs';
import {createHospitalPatientsHandler} from '../../../lib/server/hospital/patients/handler.mjs';

async function fixture(){
  const db=new HospitalQAStore({filename:':memory:',qa:true});
  for(const [id,ug] of [['hospital-a','160416'],['hospital-b','160999']])db.seedOrganization({id,ug,name:'SINTÉTICO QA',active:true});
  for(const [uid,org,units,roles] of [
    ['staff','hospital-a',['uti','upi','bloco'],['UNIT']],
    ['uti-staff','hospital-a',['uti'],['UNIT']],
    ['upi-staff','hospital-a',['upi'],['UNIT']],
    ['admin','hospital-a',['uti','upi','bloco'],['HOSPITAL_ADMIN']],
    ['kitchen','hospital-a',['uti','upi'],['KITCHEN']],
    ['other','hospital-b',['uti'],['UNIT']]
  ])db.seedMembership({id:'member-'+uid,organizationId:org,uid,ug:org==='hospital-a'?'160416':'160999',unitIds:units,roles,active:true});
  const verifier=async token=>({uid:token});
  const auth=(uid,org='hospital-a')=>resolveHospitalScope({authorization:'Bearer '+uid,organizationId:org,store:db,verifyToken:verifier});
  const [staff,uti,upi,admin,kitchen,other]=await Promise.all([auth('staff'),auth('uti-staff'),auth('upi-staff'),auth('admin'),auth('kitchen'),auth('other','hospital-b')]);
  const service=new HospitalPatientsService(db),core=new HospitalCoreService(db);
  for(const [id,unitId] of [['uti-1','uti'],['uti-2','uti'],['upi-1','upi'],['upi-2','upi']])
    service.saveBed(admin,{unitId,bedId:id,label:id});
  const patient=service.registerPatient(staff,{unitId:'uti',referenceCode:'FAKE-0001',displayName:'Nome Fictício',patientId:'p1'});
  const admission=service.admit(staff,{unitId:'uti',patientId:patient.id,admissionId:'a1',bedId:'uti-1'});
  return {db,service,core,staff,uti,upi,admin,kitchen,other,patient,admission,verifier,close:()=>db.close()};
}
function scenario(name,fn){test(name,async()=>{const x=await fixture();try{await fn(x);}finally{x.close();}});}
scenario('homônimos com identificadores distintos e deduplicação institucional',({service,staff})=>{
  const other=service.registerPatient(staff,{unitId:'uti',referenceCode:'FAKE-0002',displayName:'Nome Fictício',patientId:'p2'});
  assert.notEqual(other.id,'p1');
  assert.equal(service.search(staff,{unitId:'uti',q:'Nome Fictício'}).total,2);
  assert.throws(()=>service.registerPatient(staff,{unitId:'uti',referenceCode:'fake-0001',displayName:'Duplicado'}),{code:'CONFLICT'});
  assert.equal(service.search(staff,{unitId:'uti',q:'FAKE-0001'}).total,1);
});
scenario('duas internações no tempo para a mesma pessoa e alta confirmada',({service,staff,admission})=>{
  const done=service.confirmDischarge(staff,{unitId:'uti',admissionId:admission.id,expectedRevision:admission.revision});
  assert.equal(done.status,'DISCHARGED');
  const newEpisode=service.admit(staff,{unitId:'uti',patientId:'p1',bedId:'uti-2'});
  assert.equal(newEpisode.status,'ACTIVE');assert.notEqual(newEpisode.id,admission.id);
  assert.equal(service.search(staff,{unitId:'uti',status:'ALL'}).total,2);
});
scenario('conflito de leito não gera internação órfã, nem evento extra',({service,staff,db})=>{
  const second=service.registerPatient(staff,{unitId:'uti',referenceCode:'FAKE-0003',displayName:'Teste',patientId:'p3'});
  const count=db.db.prepare("SELECT count(*) as n FROM hospital_events WHERE kind='admission'").get().n;
  assert.throws(()=>service.admit(staff,{unitId:'uti',patientId:second.id,admissionId:'a3',bedId:'uti-1'}),{code:'CONFLICT'});
  assert.equal(db.get('hospital-a','admission','a3'),null);
  assert.equal(db.db.prepare("SELECT count(*) as n FROM hospital_events WHERE kind='admission'").get().n,count);
});
scenario('previsão de alta não efetiva nem suspende refeições',({service,staff,admission})=>{
  const planned=service.planDischarge(staff,{unitId:'uti',admissionId:'a1',plannedAt:'2099-11-11T12:00:00Z',expectedRevision:admission.revision});
  assert.equal(planned.status,'ACTIVE');
  const back=service.cancelDischarge(staff,{unitId:'uti',admissionId:'a1',expectedRevision:planned.revision});
  assert.equal(back.status,'ACTIVE');assert.equal(back.plannedDischargeAt,null);
});
scenario('transferência prevista, cancelada, confirmada UTI → UPI e auditoria imutável',({service,staff,uti,db,admission})=>{
  const planned=service.planTransfer(staff,{unitId:'uti',admissionId:'a1',toUnitId:'upi',toBedId:'upi-1'});
  assert.equal(planned.status,'PLANNED');
  assert.equal(service.getAdmission(uti,{unitId:'uti',admissionId:'a1'}).admission.unitId,'uti');
  const cancelled=service.cancelTransfer(staff,{unitId:'uti',eventId:planned.id,expectedRevision:planned.revision});
  assert.equal(cancelled.status,'CANCELLED');
  const again=service.planTransfer(staff,{unitId:'uti',admissionId:'a1',toUnitId:'upi',toBedId:'upi-1'});
  assert.throws(()=>service.confirmTransfer(uti,{unitId:'uti',eventId:again.id,expectedRevision:again.revision,admissionRevision:admission.revision}),{code:'FORBIDDEN'});
  const confirmed=service.confirmTransfer(staff,{unitId:'uti',eventId:again.id,expectedRevision:again.revision,admissionRevision:admission.revision});
  assert.equal(confirmed.admission.unitId,'upi');assert.equal(confirmed.admission.bedId,'upi-1');
  assert.throws(()=>service.getAdmission(uti,{unitId:'uti',admissionId:'a1'}),{code:'NOT_FOUND'});
  assert.throws(()=>db.db.prepare('DELETE FROM hospital_events').run(),/immutable event/);
});
scenario('ciclo das 10h: transferência preserva dieta e não cria pedido duplicado',({service,core,staff,admin,db,admission})=>{
  core.upsertDietCatalogItem(admin,{catalogItemId:'diet-1',code:'diet-1',label:'Dieta FAKE',restrictionCodes:[]});
  core.recordMedicalDiet(staff,{referenceId:'rx-1',admissionId:'a1',unitId:'uti',catalogItemId:'diet-1',sourceRef:'RX-SINTETICA',prescribedAt:'2099-11-10T00:00:00Z'});
  const map=core.createDraftMap(staff,{unitId:'uti',localDate:'2099-11-11',cycleId:'10'});
  const meal=core.addMealRequest(staff,{mapId:map.id,admissionId:'a1',mealType:'PRIMARY',dietCode:'diet-1',medicalReferenceId:'rx-1',idempotencyKey:'map-10-fake'});
  const latest=db.get('hospital-a','admission','a1');
  const event=service.planTransfer(staff,{unitId:'uti',admissionId:'a1',toUnitId:'upi',toBedId:'upi-1'});
  service.confirmTransfer(staff,{unitId:'uti',eventId:event.id,expectedRevision:event.revision,admissionRevision:latest.revision});
  assert.equal(db.get('hospital-a','medical_reference','rx-1').unitId,'upi');
  assert.equal(db.get('hospital-a','admission','a1').medicalReferenceId,'rx-1');
  assert.equal(db.get('hospital-a','meal',meal.id).status,'SUSPENDED');
  assert.equal(db.get('hospital-a','meal',meal.id).unitId,'upi');
  assert.equal(db.getMealKey('hospital-a','a1','2099-11-11','10','PRIMARY'),meal.id);
  assert.equal(db.db.prepare("SELECT count(*) as n FROM records WHERE organization_id='hospital-a' AND kind='meal'").get().n,1);
});
scenario('erro de leito destino impede transferência e preserva estado anterior',({service,staff,db})=>{
  const p=service.registerPatient(staff,{unitId:'upi',referenceCode:'FAKE-0004',displayName:'Outro'});
  service.admit(staff,{unitId:'upi',patientId:p.id,bedId:'upi-1'});
  const ev=service.planTransfer(staff,{unitId:'uti',admissionId:'a1',toUnitId:'upi',toBedId:'upi-1'});
  const before=db.events('hospital-a','admission','a1').length;
  assert.throws(()=>service.confirmTransfer(staff,{unitId:'uti',eventId:ev.id,expectedRevision:ev.revision,admissionRevision:1}),{code:'CONFLICT'});
  assert.equal(db.get('hospital-a','admission','a1').unitId,'uti');
  assert.equal(db.get('hospital-a','location_event',ev.id).status,'PLANNED');
  assert.equal(db.events('hospital-a','admission','a1').length,before);
});
scenario('Bloco temporário e retorno preservam leito e unidade assistencial',({service,staff,admission})=>{
  const leave=service.temporaryDeparture(staff,{unitId:'uti',admissionId:'a1',toUnitId:'bloco',expectedRevision:admission.revision});
  assert.equal(leave.unitId,'uti');assert.equal(leave.bedId,'uti-1');assert.equal(leave.temporaryUnitId,'bloco');
  const back=service.temporaryReturn(staff,{unitId:'uti',admissionId:'a1',expectedRevision:leave.revision});
  assert.equal(back.temporaryUnitId,null);
});
scenario('cross-OM e cross-unit não revelam paciente ou mutam internação',({service,uti,upi,other})=>{
  assert.throws(()=>service.getAdmission(other,{unitId:'uti',admissionId:'a1'}),{code:'NOT_FOUND'});
  assert.throws(()=>service.getAdmission(upi,{unitId:'uti',admissionId:'a1'}),{code:'FORBIDDEN'});
  assert.throws(()=>service.confirmDischarge(upi,{unitId:'uti',admissionId:'a1',expectedRevision:1}),{code:'FORBIDDEN'});
  assert.equal(service.search(upi,{unitId:'upi'}).total,0);
});
scenario('concorrência de leito e conflitos ETag são serializados',async({service,staff})=>{
  const p2=service.registerPatient(staff,{unitId:'uti',referenceCode:'FAKE-0002',displayName:'P2'});
  const p3=service.registerPatient(staff,{unitId:'uti',referenceCode:'FAKE-0003',displayName:'P3'});
  const r=await Promise.allSettled([
    Promise.resolve().then(()=>service.admit(staff,{unitId:'uti',patientId:p2.id,bedId:'uti-2'})),
    Promise.resolve().then(()=>service.admit(staff,{unitId:'uti',patientId:p3.id,bedId:'uti-2'}))
  ]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(r.filter(x=>x.status==='rejected').length,1);
  assert.throws(()=>service.changeBed(staff,{unitId:'uti',admissionId:'a1',toBedId:null,expectedRevision:99}),{code:'CONFLICT'});
});
scenario('API real resolve UID verificado, rejeita token e ignora papel injetado',async({db,verifier})=>{
  const handle=createHospitalPatientsHandler({store:db,verifyToken:verifier});
  const ok=await handle({authorization:'Bearer staff',organizationId:'hospital-a',operation:'patient.search',payload:{unitId:'uti',roles:['HOSPITAL_ADMIN']}});
  assert.equal(ok.status,200);assert.equal(ok.body.ok,true);
  const forbidden=await handle({authorization:'Bearer upi-staff',organizationId:'hospital-a',operation:'admission.get',payload:{unitId:'uti',admissionId:'a1'}});
  assert.equal(forbidden.status,403);
  const absent=await handle({authorization:'Bearer staff',organizationId:'hospital-a',operation:'admission.get',payload:{unitId:'uti',admissionId:'unknown'}});
  assert.equal(absent.status,404);
  const invalid=await handle({authorization:'',organizationId:'hospital-a',operation:'patient.search',payload:{unitId:'uti'}});
  assert.equal(invalid.status,401);
});
scenario('paginação limitada, avisos vinculados e logs sem identificador nominal',({service,staff,db})=>{
  assert.equal(service.search(staff,{unitId:'uti',limit:1,offset:0}).items.length,1);
  assert.throws(()=>service.search(staff,{unitId:'uti',limit:500}),{code:'INVALID'});
  const ev=service.planTransfer(staff,{unitId:'uti',admissionId:'a1',toUnitId:'upi',toBedId:null});
  service.confirmTransfer(staff,{unitId:'uti',eventId:ev.id,expectedRevision:1,admissionRevision:1});
  assert.ok(service.listNotices(staff,{unitId:'upi'}).length>0);
  assert.ok(!JSON.stringify(db.events('hospital-a','patient','p1')).includes('Nome Fictício'));
});
