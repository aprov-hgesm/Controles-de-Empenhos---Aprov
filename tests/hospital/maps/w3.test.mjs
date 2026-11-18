import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/service.mjs';
import {createHospitalW3Handler} from '../../../lib/server/hospital/maps/handler.mjs';
import {classifyMealTiming} from '../../../features/hospital/core/domain.mjs';

const identities={'unit-a':'uid-unit-a','unit-b':'uid-unit-b','cross':'uid-cross','other-om':'uid-other-om','kitchen':'uid-kitchen','nutrition':'uid-nutrition','hospital-admin':'uid-hospital-admin'};
const verifyToken=async token=>{if(!identities[token])throw Error('token refused');return {uid:identities[token]}};
async function init(){
 const dir=mkdtempSync(join(tmpdir(),'emprovex-w3-'));
 const filename=join(dir,'hospital.sqlite');
 const db=new HospitalQAStore({filename,qa:true});
 for(const [id,ug] of [['hospital-a','160416'],['hospital-b','160999']])
  db.seedOrganization({id,ug,name:'HOSPITAL SINTETICO QA',active:true});
 const memberships=[
  ['unit-a','hospital-a',['uti-a'],['UNIT']],
  ['unit-b','hospital-a',['upi-a'],['UNIT']],
  ['cross','hospital-a',['uti-a','upi-a'],['UNIT']],
  ['other-om','hospital-b',['uti-b'],['UNIT']],
  ['kitchen','hospital-a',['uti-a','upi-a'],['KITCHEN']],
  ['nutrition','hospital-a',['uti-a','upi-a'],['NUTRITION']],
  ['hospital-admin','hospital-a',['uti-a','upi-a'],['HOSPITAL_ADMIN']],
 ];
 for(const [token,org,units,roles] of memberships){
  db.seedMembership({id:`member-${token}`,uid:identities[token],organizationId:org,ug:org==='hospital-a'?'160416':'160999',unitIds:units,roles,active:true});
 }
 const scope=async token=>resolveHospitalScope({authorization:`Bearer ${token}`,organizationId:token==='other-om'?'hospital-b':'hospital-a',store:db,verifyToken});
 const s={a:await scope('unit-a'),b:await scope('unit-b'),cross:await scope('cross'),other:await scope('other-om'),cook:await scope('kitchen'),nutrition:await scope('nutrition'),admin:await scope('hospital-admin')};
 const core=new HospitalCoreService(db),diets=new HospitalDietsService(db),maps=new HospitalMapsService(db);
 dietFixture(diets,s.admin);
 core.createPatient(s.a,{patientId:'patient-synthetic-1',unitId:'uti-a',referenceCode:'SINTETICO-001'});
 core.createAdmission(s.a,{admissionId:'admission-1',patientId:'patient-synthetic-1',unitId:'uti-a',bedId:'bed-QA'});
 diets.recordReference(s.a,refInput());
 const clock={value:'2099-11-10T23:00:00-03:00'};
 db.now=()=>new Date(clock.value).toISOString();
 return {db,filename,dir,scope,s,core,diets,maps,clock,close(){db.close();rmSync(dir,{recursive:true,force:true})}};
}
function refInput(other={}){return {unitId:'uti-a',admissionId:'admission-1',referenceId:'ref-1',catalogItemId:'diet-1',sourceRef:'RX-SINTETICA-001',sourceVersion:'v1',prescriberAsRecorded:'MEDICO QA IDENTIFICADO NA FONTE',prescribedAt:'2099-11-10T19:00:00-03:00',fasting:false,allergyCodes:[],restrictionCodes:[],...other}}
function dietFixture(diets,admin){return diets.saveCatalog(admin,{catalogItemId:'diet-1',code:'DIET-QA-1',label:'Dieta sintética QA',type:'ORAL',consistency:'SOFT',route:'ORAL',allergenCodes:['ALERGENO-A'],restrictionCodes:[],preparations:['Preparação sintética'],status:'ACTIVE'});}
function run(name,fn){test(name,async()=>{const c=await init();try{await fn(c)}finally{c.close()}})}
function mealInput(m,other={}){return {mapId:m.id,admissionId:'admission-1',medicalReferenceId:'ref-1',dietCode:'diet-1',mealType:'PRIMARY',expectedMapRevision:m.revision,idempotencyKey:`idem-${Math.random().toString(16).slice(2)}`,...other}}
run('catálogo: somente admin; valida tipo, dispositivo, alergênicos, histórico e unicidade',async c=>{
 const item=c.diets.getCatalog(c.s.a,{unitId:'uti-a',catalogItemId:'diet-1'});
 assert.equal(item.consistency,'SOFT');assert.ok(item.allergenCodes.includes('ALERGENO-A'));
 assert.throws(()=>c.diets.saveCatalog(c.s.a,{catalogItemId:'other',code:'D',label:'Dieta',type:'ORAL'}),{code:'FORBIDDEN'});
 assert.throws(()=>c.diets.saveCatalog(c.s.admin,{catalogItemId:'bad',code:'BAD',label:'Dieta',type:'ORAL',consistency:'SNE'}),{code:'INVALID'});
 assert.throws(()=>c.diets.saveCatalog(c.s.admin,{catalogItemId:'other',code:'DIET-QA-1',label:'duplicada',type:'ORAL'}),{code:'CONFLICT'});
 const revised=c.diets.saveCatalog(c.s.admin,{catalogItemId:'diet-1',code:'DIET-QA-1',label:'Dieta sintética revisada',type:'ORAL',consistency:'SOFT',status:'ACTIVE',expectedRevision:item.revision});
 assert.equal(revised.revision,2);assert.equal(c.diets.catalogHistory(c.s.admin,{catalogItemId:'diet-1'}).length,2);
 assert.throws(()=>c.diets.saveCatalog(c.s.admin,{catalogItemId:'diet-1',code:'DIET-QA-1',label:'Alteração concorrente',type:'ORAL',expectedRevision:item.revision}),{code:'CONFLICT'});
 assert.throws(()=>c.diets.listCatalog(c.s.other,{unitId:'uti-a'}),{code:'FORBIDDEN'});
});
run('referência clínica: origem/versão imutáveis, origem médica declarada, vínculo e Nutrição somente leitura',async c=>{
 const refs=c.diets.listReferences(c.s.nutrition,{unitId:'uti-a',admissionId:'admission-1'});
 assert.equal(refs.length,1);assert.equal(refs[0].enteredByUid,c.s.a.uid);
 assert.throws(()=>c.diets.recordReference(c.s.nutrition,refInput({referenceId:'nope'})),{code:'FORBIDDEN'});
 assert.throws(()=>c.diets.recordReference(c.s.a,refInput()),{code:'CONFLICT'});
 assert.throws(()=>c.diets.recordReference(c.s.a,refInput({referenceId:'ref-2'})),{code:'CONFLICT'});
 assert.throws(()=>c.diets.recordReference(c.s.b,refInput({referenceId:'other-unit',unitId:'upi-a'})),{code:'NOT_FOUND'});
 assert.equal(c.db.events('hospital-a','admission','admission-1').filter(x=>x.eventType==='dietReference.updated').length,1);
});
for(const cycle of ['06','10','16']){
 run(`ciclo ${cycle}: data anterior, hora limite, +29 e +31 tratados sem confundir tolerância`,async c=>{
  const date='2099-11-11';
  const before=classifyMealTiming({cycleId:cycle,localDate:date,at:'2099-11-10T23:00:00-03:00'});
  assert.equal(before.stage,'ON_TIME');
  c.clock.value=`${date}T${cycle}:00:00-03:00`;
  assert.equal(classifyMealTiming({cycleId:cycle,localDate:date,at:c.clock.value}).stage,'ON_TIME');
  const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:date,cycleId:cycle});
  c.clock.value=`${date}T${cycle}:29:00-03:00`;
  assert.throws(()=>c.maps.setMeal(c.s.a,mealInput(m)),{code:'INVALID'});
  const add=c.maps.setMeal(c.s.a,mealInput(m,{reason:'Pedido extra conferido pela equipe'}));
  assert.equal(add.extraordinary,true);assert.equal(add.meal.advisory,'KITCHEN_REVIEW');assert.equal(add.meal.status,'SUSPENDED');assert.equal(add.meal.requiresRecheck,true);
  c.clock.value=`${date}T${cycle}:31:00-03:00`;
  assert.throws(()=>c.maps.setMeal(c.s.a,mealInput(add.map,{reason:'Principal fora da tolerância'})),{code:'PRECONDITION'});
  const secondary=c.maps.setMeal(c.s.a,mealInput(add.map,{mealType:'SECONDARY',reason:'Adendo após horário institucional'}));
  assert.equal(secondary.meal.mealType,'SECONDARY');assert.equal(secondary.extraordinary,true);
  assert.equal(c.db.list('hospital-a','meal','uti-a').length,2);
 });
}
run('mapa da véspera: envio antes do prazo, recibo sem PHI, fechamento só após horário',async c=>{
 const map=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const meal=c.maps.setMeal(c.s.a,mealInput(map));
 assert.equal(meal.meal.status,'REQUESTED');
 const sent=c.maps.submitMap(c.s.a,{mapId:map.id,expectedRevision:meal.map.revision,idempotencyKey:'send-day-before'});
 assert.equal(sent.timing.mapOnTime,true);assert.equal(sent.receipt.late,false);
 assert.throws(()=>c.maps.closeDue(c.s.a,{mapId:map.id,expectedRevision:sent.map.revision,idempotencyKey:'close-on-time'}),{code:'PRECONDITION'});
 c.clock.value='2099-11-11T06:00:00-03:00';
 const closed=c.maps.closeDue(c.s.a,{mapId:map.id,expectedRevision:sent.map.revision,idempotencyKey:'close-on-time'});
 assert.equal(closed.map.status,'CLOSED');
 assert.deepEqual(c.maps.closeDue(c.s.a,{mapId:map.id,expectedRevision:sent.map.revision,idempotencyKey:'close-on-time'}),closed);
 const receipt=c.maps.receipt(c.s.a,{mapId:map.id});
 assert.ok(receipt.submittedByUid);assert.equal(receipt.submissionVersion,1);
 assert.ok(!JSON.stringify(receipt).includes('SINTETICO-001'));assert.ok(!JSON.stringify(receipt).includes('bed-QA'));
 assert.equal(c.maps.listVersions(c.s.a,{mapId:map.id}).length,2);
});
run('late submit: justificativa, recibo extraordinário, reenvio idempotente',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 c.clock.value='2099-11-11T06:10:00-03:00';
 assert.throws(()=>c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:m.revision,idempotencyKey:'send-without-reason'}),{code:'INVALID'});
 const s=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:m.revision,idempotencyKey:'send-late',lateReason:'Solicitação institucional recebida após prazo'});
 assert.equal(s.receipt.late,true);assert.equal(s.receipt.needsKitchenReview,true);
 const again=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:m.revision,idempotencyKey:'send-late',lateReason:'Solicitação institucional recebida após prazo'});
 assert.deepEqual(again,s);
 assert.equal(c.maps.listVersions(c.s.a,{mapId:m.id}).length,1);
});
run('ETag+idempotência: duas sessões não duplicam o mesmo pedido e snapshots preservam autoria',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const input=mealInput(m,{idempotencyKey:'identical'});
 const first=c.maps.setMeal(c.s.a,input);
 const again=c.maps.setMeal(c.s.a,input);
 assert.deepEqual(again,first);
 assert.throws(()=>c.maps.setMeal(c.s.a,mealInput(m,{idempotencyKey:'other'})),{code:'CONFLICT'});
 const sub=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:first.map.revision,idempotencyKey:'submit1'});
 const before=c.maps.listVersions(c.s.a,{mapId:m.id})[0];
 assert.equal(before.snapshot.meals.length,1);
 c.clock.value='2099-11-11T06:10:00-03:00';
 const amended=c.maps.setMeal(c.s.a,mealInput(sub.map,{mealType:'SECONDARY',reason:'Adendo clínico comunicado em horário extraordinário'}));
 assert.equal(amended.amendmentVersion,2);
 const versions=c.maps.listVersions(c.s.a,{mapId:m.id});
 assert.equal(versions.length,2);assert.equal(versions[0].snapshot.meals.length,1);
 assert.equal(versions[1].snapshot.meals.length,2);assert.equal(versions[1].actorUid,c.s.a.uid);
 assert.throws(()=>c.db.db.exec('DELETE FROM map_versions'),/immutable map version/);
 assert.throws(()=>c.db.db.exec('DELETE FROM hospital_events'),/immutable event/);
 assert.throws(()=>c.maps.setMeal(c.s.a,mealInput(sub.map,{mealType:'SECONDARY',reason:'Concorrente depois do adendo'})),{code:'CONFLICT'});
});
run('suspensão por referência alterada após envio e preparo sem entrega presumida',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'10'});
 const add=c.maps.setMeal(c.s.a,mealInput(m));
 const sent=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:add.map.revision,idempotencyKey:'send'});
 const prepping=c.core.advanceMeal(c.s.cook,{mealId:add.meal.id,unitId:'uti-a',next:'PREPARING',expectedRevision:add.meal.revision});
 assert.equal(prepping.status,'PREPARING');
 const changed=c.diets.recordReference(c.s.a,refInput({referenceId:'ref-2',sourceVersion:'v2',prescribedAt:'2099-11-10T20:00:00-03:00'}));
 assert.equal(changed.affectedMaps.length,1);
 const after=c.db.get('hospital-a','meal',add.meal.id);
 assert.equal(after.status,'SAFETY_BLOCKED');assert.equal(after.requiresRecheck,true);
 assert.notEqual(after.status,'DELIVERED');
 assert.throws(()=>c.core.advanceMeal(c.s.cook,{mealId:add.meal.id,unitId:'uti-a',next:'READY',expectedRevision:after.revision}),{code:'PRECONDITION'});
 assert.equal(c.maps.listVersions(c.s.a,{mapId:m.id}).length,2);
 assert.equal(c.maps.receipt(c.s.a,{mapId:m.id}).currentVersion,2);
});
run('jejum e alérgeno: pedido não liberável mesmo quando registrado; exceção não libera automaticamente',async c=>{
 c.diets.recordReference(c.s.a,refInput({referenceId:'ref-fasting',sourceVersion:'v2',fasting:true}));
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'16'});
 const a=c.maps.setMeal(c.s.a,mealInput(m,{medicalReferenceId:'ref-fasting'}));
 assert.equal(a.meal.status,'SAFETY_BLOCKED');
 assert.throws(()=>c.core.advanceMeal(c.s.cook,{mealId:a.meal.id,unitId:'uti-a',next:'PREPARING',expectedRevision:a.meal.revision}),{code:'PRECONDITION'});
 c.diets.recordReference(c.s.a,refInput({referenceId:'ref-allergy',sourceVersion:'v3',fasting:false,allergyCodes:['ALERGENO-A']}));
 const blocked=c.db.get('hospital-a','meal',a.meal.id);
 assert.equal(blocked.status,'SAFETY_BLOCKED');
 c.clock.value='2099-11-11T16:31:00-03:00';
 const ex=c.maps.escalateClinicalException(c.s.a,{mapId:m.id,admissionId:'admission-1',mealType:'PRIMARY',reason:'Avaliação clínica necessária em atraso',contactReference:'Contato registrado com equipe assistencial QA',idempotencyKey:'clinical-escalation'});
 assert.equal(ex.status,'PENDING_ASSISTANCE');
 assert.deepEqual(c.maps.escalateClinicalException(c.s.a,{mapId:m.id,admissionId:'admission-1',mealType:'PRIMARY',reason:'Avaliação clínica necessária em atraso',contactReference:'Contato registrado com equipe assistencial QA',idempotencyKey:'clinical-escalation'}),ex);
 assert.equal(c.db.list('hospital-a','incident','uti-a').length,1);
 assert.equal(c.db.get('hospital-a','incident',ex.incidentId).status,'OPEN');
 assert.equal(c.db.list('hospital-a','meal','uti-a').length,1);
});
run('transferência entre unidades: vínculo de refeição permanece único; sem duplicar por novo leito',async c=>{
 const m=c.maps.createDraft(c.s.cross,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const add=c.maps.setMeal(c.s.cross,mealInput(m));
 c.core.planTransfer(c.s.cross,{eventId:'move-1',admissionId:'admission-1',fromUnitId:'uti-a',toUnitId:'upi-a'});
 c.core.confirmTransfer(c.s.cross,{eventId:'move-1',fromUnitId:'uti-a',expectedRevision:1});
 assert.equal(c.db.get('hospital-a','meal',add.meal.id).status,'SUSPENDED');
 c.diets.recordReference(c.s.cross,{...refInput({referenceId:'ref-new-unit',sourceRef:'RX-QA-TRANSFER',sourceVersion:'v1',unitId:'upi-a'})});
 const destination=c.maps.createDraft(c.s.cross,{unitId:'upi-a',localDate:'2099-11-11',cycleId:'06'});
 assert.throws(()=>c.maps.setMeal(c.s.cross,mealInput(destination,{medicalReferenceId:'ref-new-unit'})),{code:'CONFLICT'});
 assert.equal(c.db.db.prepare("SELECT count(*) as count FROM meal_keys WHERE organization_id='hospital-a'").get().count,1);
});
run('fronteiras: outra OM, outra unidade e admin comercial sem acesso clínico; API ignora roles do payload',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 assert.throws(()=>c.maps.getMap(c.s.b,{mapId:m.id}),{code:'FORBIDDEN'});
 assert.throws(()=>c.maps.getMap(c.s.other,{mapId:m.id}),{code:'NOT_FOUND'});
 assert.throws(()=>c.maps.createDraft(c.s.nutrition,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'}),{code:'FORBIDDEN'});
 assert.throws(()=>c.maps.listAdmissions(c.s.admin,{unitId:'uti-a'}),{code:'FORBIDDEN'});
 const handler=createHospitalW3Handler({store:c.db,verifyToken});
 const good=await handler({area:'maps',authorization:'Bearer unit-a',organizationId:'hospital-a',operation:'map.get',payload:{mapId:m.id,roles:['HOSPITAL_ADMIN']}});
 assert.equal(good.status,200);
 const denied=await handler({area:'maps',authorization:'Bearer unit-b',organizationId:'hospital-a',operation:'map.get',payload:{mapId:m.id,roles:['HOSPITAL_ADMIN']}});
 assert.equal(denied.status,403);
 const unauthorized=await handler({area:'maps',authorization:'Bearer forged',organizationId:'hospital-a',operation:'map.get',payload:{mapId:m.id}});
 assert.equal(unauthorized.status,401);
 const otherOrg=await handler({area:'maps',authorization:'Bearer other-om',organizationId:'hospital-a',operation:'map.get',payload:{mapId:m.id}});
 assert.equal(otherOrg.status,403);
});
run('SQLite persiste entre processos/conexões e eventos usam timestamp do servidor',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const added=c.maps.setMeal(c.s.a,mealInput(m));
 const reopened=new HospitalQAStore({filename:c.filename,qa:true});
 try{
  assert.equal(reopened.get('hospital-a','meal',added.meal.id).id,added.meal.id);
  assert.equal(reopened.get('hospital-a','map',m.id).revision,2);
  const events=reopened.events('hospital-a','meal',added.meal.id);
  assert.equal(events.length,1);
  assert.equal(events[0].actorUid,c.s.a.uid);
  assert.equal(events[0].occurredAt,new Date(c.clock.value).toISOString());
 }finally{reopened.close()}
});

run('envio do mapa atrasado suspende principal ja lancada e exige reconferencia',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const add=c.maps.setMeal(c.s.a,mealInput(m));
 assert.equal(add.meal.status,'REQUESTED');
 c.clock.value='2099-11-11T06:10:00-03:00';
 const sent=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:add.map.revision,idempotencyKey:'late-with-meal',lateReason:'Mapa enviado fora da janela prevista'});
 assert.equal(sent.receipt.late,true);
 const meal=c.db.get('hospital-a','meal',add.meal.id);
 assert.equal(meal.status,'SUSPENDED');
 assert.equal(meal.suspensionReason,'LATE_MAP_SUBMISSION_REVIEW');
 assert.equal(c.maps.listVersions(c.s.a,{mapId:m.id})[0].snapshot.meals[0].status,'SUSPENDED');
});
run('inativacao do catalogo suspende pedido em preparo e bloqueia reconfirmacao automatica',async c=>{
 const m=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'10'});
 const add=c.maps.setMeal(c.s.a,mealInput(m));
 const submitted=c.maps.submitMap(c.s.a,{mapId:m.id,expectedRevision:add.map.revision,idempotencyKey:'sent-before-catalog'});
 const started=c.core.advanceMeal(c.s.cook,{mealId:add.meal.id,unitId:'uti-a',next:'PREPARING',expectedRevision:add.meal.revision});
 const old=c.diets.getCatalog(c.s.admin,{catalogItemId:'diet-1'});
 c.diets.saveCatalog(c.s.admin,{catalogItemId:'diet-1',code:'DIET-QA-1',label:old.label,type:old.type,consistency:old.consistency,route:old.route,
   allergenCodes:old.allergenCodes,restrictionCodes:old.restrictionCodes,status:'INACTIVE',expectedRevision:old.revision});
 const paused=c.db.get('hospital-a','meal',add.meal.id);
 assert.equal(paused.status,'SAFETY_BLOCKED');
 assert.equal(paused.revision,started.revision+1);
 assert.equal(c.maps.listVersions(c.s.a,{mapId:m.id}).length,2);
 assert.equal(c.db.get('hospital-a','map',m.id).revision,submitted.map.revision+1);
 assert.throws(()=>c.maps.setMeal(c.s.a,mealInput(c.db.get('hospital-a','map',m.id),{idempotencyKey:'after-inactivation',reason:'Solicitação após alteração do catálogo'})),{code:'PRECONDITION'});
});

run('fila da cozinha: rascunhos e pedidos suspensos nunca entram em producao',async c=>{
 const map=c.maps.createDraft(c.s.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const added=c.maps.setMeal(c.s.a,mealInput(map));
 assert.deepEqual(c.maps.listKitchenQueue(c.s.cook,{unitId:'uti-a',cycleId:'06'}),[]);
 assert.throws(()=>c.maps.listKitchenQueue(c.s.a,{unitId:'uti-a'}),{code:'FORBIDDEN'});
 assert.throws(()=>c.maps.listKitchenQueue(c.s.cook,{unitId:'uti-b'}),{code:'FORBIDDEN'});
 const sent=c.maps.submitMap(c.s.a,{mapId:map.id,expectedRevision:added.map.revision,idempotencyKey:'queue-submit'});
 const queue=c.maps.listKitchenQueue(c.s.cook,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 assert.equal(queue.length,1);assert.equal(queue[0].mealId,added.meal.id);
 assert.equal(queue[0].version,1);
 c.diets.recordReference(c.s.a,refInput({referenceId:'ref-queue-changed',sourceVersion:'v2'}));
 assert.deepEqual(c.maps.listKitchenQueue(c.s.cook,{unitId:'uti-a',cycleId:'06'}),[]);
 assert.equal(c.db.get('hospital-a','meal',added.meal.id).status,'SAFETY_BLOCKED');
});
