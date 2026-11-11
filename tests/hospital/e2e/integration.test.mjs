import test from 'node:test';
import assert from 'node:assert/strict';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/service.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/service.mjs';
import {DistributionService} from '../../../lib/server/hospital/distribution/service.mjs';
import {HospitalReportingService} from '../../../lib/server/hospital/reporting/service.mjs';
import {classifyMealTiming} from '../../../features/hospital/core/domain.mjs';

const localDate='2099-11-11';
async function fixture(){
 const store=new HospitalQAStore({filename:':memory:',qa:true});
 for(const [id,ug] of [['hospital-a','160416'],['hospital-b','160999']])
  store.seedOrganization({id,ug,name:'HOSPITAL SINTÉTICO QA',active:true});
 for(const [uid,organizationId,roles,unitIds] of [
  ['ward','hospital-a',['UNIT'],['uti']],
  ['ward-upi','hospital-a',['UNIT'],['upi']],
  ['cook','hospital-a',['KITCHEN'],['uti','upi']],
  ['nutri','hospital-a',['NUTRITION'],['uti','upi']],
  ['hospital-admin','hospital-a',['HOSPITAL_ADMIN'],[]],
  ['commercial','hospital-a',[],[]],
  ['outside','hospital-b',['KITCHEN'],['uti']],
 ])store.seedMembership({id:'member-'+uid,uid,organizationId,ug:organizationId==='hospital-a'?'160416':'160999',roles,unitIds,active:true});
 const login=(uid,organizationId='hospital-a')=>resolveHospitalScope({
  authorization:'Bearer '+uid,organizationId,store,
  verifyToken:async token=>{if(token!==uid)throw Error('token recusado');return {uid:token};}
 });
 const [ward,cook,nutri,admin,outside,otherUnit]=await Promise.all([
  login('ward'),login('cook'),login('nutri'),login('hospital-admin'),login('outside','hospital-b'),login('ward-upi')
 ]);
 const core=new HospitalCoreService(store);
 const maps=new HospitalMapsService(store);
 const production=new ProductionService(store);
 const distribution=new DistributionService(store);
 const reports=new HospitalReportingService(store);
 core.upsertDietCatalogItem(admin,{catalogItemId:'diet-qa',code:'diet-qa',label:'Dieta fictícia',restrictionCodes:[]});
 const patient=core.createPatient(ward,{patientId:'patient-qa',unitId:'uti',referenceCode:'QA-REF-0001'});
 store.put('hospital-a','patient','uti',{...patient,displayName:'Paciente Fictício QA'},patient.revision);
 core.createAdmission(ward,{admissionId:'admission-qa',patientId:'patient-qa',unitId:'uti',bedId:'bed-qa'});
 core.recordMedicalDiet(ward,{referenceId:'rx-qa',admissionId:'admission-qa',unitId:'uti',catalogItemId:'diet-qa',sourceRef:'RX-SINTETICA-001',prescribedAt:'2099-11-10T00:00:00Z'});
 return {store,core,maps,production,distribution,reports,ward,cook,nutri,admin,outside,otherUnit,login,close:()=>store.close()};
}
function withFixture(name,fn){test(name,async()=>{const f=await fixture();try{await fn(f);}finally{f.close();}});}
function sentMeal(f,cycleId='10'){
 const draft=f.core.createDraftMap(f.ward,{unitId:'uti',localDate,cycleId});
 const meal=f.core.addMealRequest(f.ward,{mapId:draft.id,admissionId:'admission-qa',mealType:'PRIMARY',dietCode:'diet-qa',medicalReferenceId:'rx-qa',idempotencyKey:'w9-'+cycleId});
 f.core.submitMap(f.ward,{mapId:draft.id,expectedRevision:draft.revision});
 return {draft,meal};
}
function prepare(f,meal,cycleId='10'){
 const args={unitId:'uti',localDate,cycleId,mealIds:[meal.id],preparationLabel:'Refeição sintética segura'};
 let batch=f.production.createBatch(f.cook,{...args,idempotencyKey:'w9-batch'});
 batch=f.production.startBatch(f.cook,{unitId:'uti',batchId:batch.id,expectedRevision:batch.revision,idempotencyKey:'w9-start'});
 batch=f.production.completeBatch(f.cook,{unitId:'uti',batchId:batch.id,expectedRevision:batch.revision,confirmedQuantity:1,idempotencyKey:'w9-complete'});
 return batch;
}
function cmd(f,meal,operation,payload={}){
 return f.distribution.command(f.cook,operation,{
  unitId:'uti',mealId:meal.id,idempotencyKey:'w9-'+operation.replaceAll('.','-'),...payload
 });
}
withFixture('E2E W0/W3/W4/W5/W8: mapa real, lote, montagem, recibo e entrega distintos',f=>{
 const {draft,meal}=sentMeal(f);
 assert.equal(f.maps.listMaps(f.ward,{unitId:'uti',localDate,cycleId:'10'}).length,1);
 assert.equal(f.maps.getMap(f.ward,{mapId:draft.id}).meals.length,1);
 const incoming=f.production.snapshot(f.cook,{unitIds:['uti'],localDate,cycleId:'10'});
 assert.equal(incoming.maps.length,1);
 assert.equal(incoming.counts.requested,1);
 assert.equal(incoming.meals[0].id,meal.id);
 assert.equal(prepare(f,meal).status,'COMPLETE');
 assert.equal(f.core.get(f.cook,'meal',meal.id,'uti').status,'READY');
 assert.equal(f.store.list('hospital-a','delivery_event','uti').length,0);
 cmd(f,meal,'assembly.start');
 cmd(f,meal,'assembly.complete',{preparedDietCode:'diet-qa',ingredientCodes:['ingredient-safe-qa']});
 cmd(f,meal,'assembly.check');
 cmd(f,meal,'batch.dispatch',{mealIds:[meal.id]});
 assert.equal(f.core.get(f.cook,'meal',meal.id,'uti').status,'DISPATCHED');
 f.distribution.command(f.ward,'batch.receive',{unitId:'uti',mealIds:[meal.id],idempotencyKey:'w9-ward-receive'});
 assert.equal(f.core.get(f.cook,'meal',meal.id,'uti').status,'RECEIVED_BY_UNIT');
 cmd(f,meal,'meal.deliver',{patientReferenceCode:'QA-REF-0001',patientDisplayName:'Paciente Fictício QA',identityMethod:'MANUAL'});
 assert.equal(f.core.get(f.cook,'meal',meal.id,'uti').status,'DELIVERED');
 assert.equal(f.store.list('hospital-a','delivery_event','uti').length,3);
 const report=f.reports.query(f.cook,{view:'production',filters:{from:localDate,to:localDate}});
 assert.ok(Array.isArray(report.rows));
 assert.ok(report.rows.length>0);
 assert.throws(()=>cmd(f,meal,'meal.deliver',{patientReferenceCode:'QA-REF-0001',patientDisplayName:'Paciente Fictício QA',identityMethod:'MANUAL'}),{code:'PRECONDITION'});
});
withFixture('segurança integrada: outra OM, outra unidade e admin não acessam o pedido',async f=>{
 const {meal}=sentMeal(f);
 assert.throws(()=>f.core.get(f.otherUnit,'meal',meal.id,'uti'),{code:'FORBIDDEN'});
 assert.throws(()=>f.core.get(f.outside,'meal',meal.id,'uti'),{code:'NOT_FOUND'});
 assert.throws(()=>f.production.snapshot(f.nutri,{unitIds:['uti'],localDate,cycleId:'10'}),{code:'FORBIDDEN'});
 assert.throws(()=>f.core.get(f.admin,'patient','patient-qa','uti'),{code:'FORBIDDEN'});
 assert.throws(()=>requireHospitalPermission({uid:'cook',organizationId:'hospital-a',roles:['KITCHEN'],unitIds:['uti'],active:true},'meal:distribution','uti'),{code:'UNAUTHORIZED'});
 await assert.rejects(f.login('commercial'),{code:'FORBIDDEN'});
 await assert.rejects(f.login('ward','hospital-b'),{code:'FORBIDDEN'});
});
withFixture('jejum registrado após preparo bloqueia expedição, sem entrega fantasma',f=>{
 const {meal}=sentMeal(f);
 prepare(f,meal);
 cmd(f,meal,'assembly.start');
 cmd(f,meal,'assembly.complete',{preparedDietCode:'diet-qa',ingredientCodes:['ingredient-safe-qa']});
 cmd(f,meal,'assembly.check');
 const admission=f.core.get(f.ward,'admission','admission-qa','uti');
 f.core.updateClinicalSafety(f.ward,{admissionId:admission.id,unitId:'uti',fasting:true,allergyCodes:[],expectedRevision:admission.revision});
 assert.throws(()=>cmd(f,meal,'batch.dispatch',{mealIds:[meal.id]}),{code:'PRECONDITION'});
 assert.equal(f.store.list('hospital-a','delivery_event','uti').length,0);
});
test('três ciclos: envio regular não inclui tolerância, 06h admite preparo na véspera',()=>{
 for(const cycleId of ['06','10','16']){
  const due=Number(cycleId);
  const d=localDate;
  const at=(hour,minute)=>d+'T'+hour+':'+minute+':00-03:00';
  assert.equal(classifyMealTiming({cycleId,localDate:d,at:at(cycleId,'00')}).mapOnTime,true);
  assert.equal(classifyMealTiming({cycleId,localDate:d,at:at(cycleId,'10')}).mapOnTime,false);
  assert.equal(classifyMealTiming({cycleId,localDate:d,at:at(cycleId,'31')}).recommendation,'SECONDARY_OR_CLINICAL_ESCALATION');
  assert.equal(due+30/60>due,true);
 }
 assert.equal(classifyMealTiming({cycleId:'06',localDate,at:'2099-11-10T23:00:00-03:00'}).mapOnTime,true);
});
