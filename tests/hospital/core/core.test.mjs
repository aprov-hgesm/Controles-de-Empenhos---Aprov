import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {classifyMealTiming,assertMealReleaseSafe,nextMealStatus} from '../../../features/hospital/core/domain.mjs';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {createHospitalCoreHandler} from '../../../lib/server/hospital/core/handler.mjs';
const uidByToken={'token-a':'user-a','token-b':'user-b','token-other-unit':'user-a-other','token-nutrition':'nutri','token-kitchen':'cook','token-admin':'commercial-admin','token-hospital-admin':'hospital-admin','token-inactive':'disabled'};
const verifier=async token=>{if(!uidByToken[token])throw Error('invalid');return {uid:uidByToken[token]}};
const auth=(db,org,token)=>resolveHospitalScope({authorization:`Bearer ${token}`,organizationId:org,store:db,verifyToken:verifier});
async function setup(){const dir=mkdtempSync(join(tmpdir(),'hospital-qa-'));const filename=join(dir,'test.sqlite');const db=new HospitalQAStore({filename,qa:true});
 for(const o of ['om-a','om-b'])db.seedOrganization({id:o,ug:o==='om-a'?'160416':'160999',name:'FAKE QA',active:true});
 for(const [id,org,units,roles,active] of [['user-a','om-a',['uti-a'],['UNIT'],true],['user-a-other','om-a',['upi-a'],['UNIT'],true],['nutri','om-a',['uti-a','upi-a'],['NUTRITION'],true],['cook','om-a',['uti-a','upi-a'],['KITCHEN'],true],['hospital-admin','om-a',['uti-a','upi-a'],['HOSPITAL_ADMIN'],true],['commercial-admin','om-a',[],[],true],['disabled','om-a',['uti-a'],['UNIT'],false],['user-b','om-b',['uti-b'],['UNIT'],true]])db.seedMembership({id:`member-${id}`,organizationId:org,uid:id,ug:org==='om-a'?'160416':'160999',unitIds:units,roles,active});
 const a=await auth(db,'om-a','token-a'),b=await auth(db,'om-b','token-b'),cook=await auth(db,'om-a','token-kitchen'),nutri=await auth(db,'om-a','token-nutrition');const service=new HospitalCoreService(db);
 const admin=await auth(db,'om-a','token-hospital-admin');service.upsertDietCatalogItem(admin,{catalogItemId:'diet1',code:'diet1',label:'Dieta sintética',restrictionCodes:['allergen-x']});service.createPatient(a,{patientId:'synthetic1',unitId:'uti-a',referenceCode:'FAKE-QA-001'});
 const admission=service.createAdmission(a,{admissionId:'ad1',patientId:'synthetic1',unitId:'uti-a'});
 service.recordMedicalDiet(a,{referenceId:'rx1',admissionId:'ad1',unitId:'uti-a',catalogItemId:'diet1',sourceRef:'FAKE-PRESCRIPTION-001',prescribedAt:'2026-11-10T00:00:00Z'});
 return {dir,filename,db,a,b,cook,nutri,service,admission,cleanup(){db.close();rmSync(dir,{recursive:true,force:true})}}}
const tcase=(t,fn)=>test(t,async()=>{const ctx=await setup();try{await fn(ctx)}finally{ctx.cleanup()}});
for(const [cycle,base] of [['06','06'],['10','10'],['16','16']]){
 test(`horários ${cycle}: prazo do mapa não é tolerância`,()=>{
   const d='2026-11-11';
   const check=(h,m)=>classifyMealTiming({cycleId:cycle,localDate:d,at:`${d}T${h}:${m}:00-03:00`});
   assert.equal(check(String(Number(base)-1).padStart(2,'0'),'59').stage,'ON_TIME');
   assert.equal(check(base,'00').stage,'ON_TIME');assert.equal(check(base,'10').stage,'LATE_BEFORE_TOLERANCE');assert.equal(check(base,'31').stage,'AFTER_TOLERANCE');
   assert.equal(check(base,'10').mapOnTime,false);assert.equal(check(base,'10').principalDeliveryTolerancePassed,false);
   assert.equal(check(base,'31').recommendation,'PRIORITY_KITCHEN_ALERT');
 });
}
test('06h pode ser preparada no dia anterior e aplica timezone oficial',()=>{assert.equal(classifyMealTiming({cycleId:'06',localDate:'2026-11-11',at:'2026-11-10T23:00:00-03:00'}).stage,'ON_TIME');assert.equal(classifyMealTiming({cycleId:'06',localDate:'2026-11-11',at:'2026-11-11T09:10:00Z'}).stage,'LATE_BEFORE_TOLERANCE')});
tcase('OMs isoladas, unidade autorizada e admin comercial negado',async c=>{
 assert.throws(()=>c.service.get(c.b,'admission','ad1','uti-b'),{code:'NOT_FOUND'});
 assert.throws(()=>c.service.get(c.a,'admission','ad1','upi-a'),{code:'FORBIDDEN'});
 const other=await auth(c.db,'om-a','token-other-unit');assert.throws(()=>c.service.get(other,'admission','ad1','uti-a'),{code:'FORBIDDEN'});
 await assert.rejects(auth(c.db,'om-a','token-admin'),{code:'FORBIDDEN'});
 await assert.rejects(auth(c.db,'om-a','token-inactive'),{code:'FORBIDDEN'});
 await assert.rejects(auth(c.db,'om-b','token-a'),{code:'FORBIDDEN'});
 await assert.rejects(resolveHospitalScope({authorization:'Bearer forged',organizationId:'om-a',store:c.db,verifyToken:verifier}),{code:'UNAUTHORIZED'});
 assert.throws(()=>requireHospitalPermission({uid:'user-a',organizationId:'om-a',roles:['UNIT'],unitIds:['uti-a'],active:true},'meal:write','uti-a'),{code:'UNAUTHORIZED'});
 const admin=await auth(c.db,'om-a','token-hospital-admin');assert.throws(()=>c.service.get(admin,'admission','ad1','uti-a'),{code:'FORBIDDEN'});
});
tcase('SQLite: commit persiste em conexão independente e snapshot é inviolável',async c=>{
 const map=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-11-11',cycleId:'06'});
 const meal=c.service.addMealRequest(c.a,{mapId:map.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'idem-1'});
 const sent=c.service.submitMap(c.a,{mapId:map.id,expectedRevision:map.revision});const closed=c.service.closeMap(c.a,{mapId:map.id,expectedRevision:sent.revision});
 assert.equal(closed.status,'CLOSED');const versions=c.service.listMapVersions(c.a,{mapId:map.id,unitId:'uti-a'});assert.equal(versions.length,2);
 assert.equal(versions[0].snapshot.meals.length,1);
 const again=new HospitalQAStore({filename:c.filename,qa:true});try{assert.equal(again.get('om-a','meal',meal.id).id,meal.id);assert.equal(again.listMapVersions('om-a',map.id).length,2);assert.throws(()=>again.db.prepare('DELETE FROM map_versions').run(),/immutable map version/);assert.throws(()=>again.db.prepare('UPDATE hospital_events SET type=?').run('altered'),/immutable event/);}finally{again.close()}
});
tcase('adendo após fechamento mantém versões antigas e autoria',async c=>{
 const map=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-12-11',cycleId:'10'});
 const sent=c.service.submitMap(c.a,{mapId:map.id,expectedRevision:map.revision});c.service.closeMap(c.a,{mapId:map.id,expectedRevision:sent.revision});
 c.service.addMealRequest(c.a,{mapId:map.id,admissionId:'ad1',mealType:'SECONDARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'adendo',reason:'Nova informação clínica'});
 const v=c.service.listMapVersions(c.a,{mapId:map.id,unitId:'uti-a'});assert.equal(v.length,3);assert.equal(v[0].snapshot.meals.length,0);assert.equal(v[1].snapshot.meals.length,0);assert.equal(v[2].snapshot.meals.length,1);assert.equal(v[2].actorUid,'user-a');assert.equal(v[2].kind,'AMENDMENT');
});
tcase('duplicidade concorrente e conflito de ETag não duplicam refeições',async c=>{
 const m=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-11-12',cycleId:'16'});
 const input={mapId:m.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1'};
 const [x,y]=await Promise.all([Promise.resolve().then(()=>c.service.addMealRequest(c.a,{...input,idempotencyKey:'key1'})),Promise.resolve().then(()=>c.service.addMealRequest(c.a,{...input,idempotencyKey:'key2'}))]);
 assert.equal(x.id,y.id);assert.equal(c.service.list(c.a,'meal','uti-a').length,1);
 assert.throws(()=>c.service.addMealRequest(c.a,{...input,idempotencyKey:'key1',reason:'Different payload'}),{code:'CONFLICT'});
 const submitted=c.service.submitMap(c.a,{mapId:m.id,expectedRevision:m.revision});assert.throws(()=>c.service.closeMap(c.a,{mapId:m.id,expectedRevision:m.revision}),{code:'CONFLICT'});assert.equal(submitted.revision,2);
});
tcase('jejum e alergia crítica impedem liberação; evento registra hora do servidor',async c=>{
 const m=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-11-13',cycleId:'06'});
 const meal=c.service.addMealRequest(c.a,{mapId:m.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'critical'});
 const changed=c.service.updateClinicalSafety(c.a,{admissionId:'ad1',unitId:'uti-a',fasting:true,allergyCodes:[],expectedRevision:2});
 assert.equal(changed.fasting,true);assert.equal(c.service.get(c.a,'meal',meal.id,'uti-a').status,'SAFETY_BLOCKED');
 assert.throws(()=>c.service.advanceMeal(c.cook,{mealId:meal.id,unitId:'uti-a',next:'PREPARING',expectedRevision:2}),{code:'PRECONDITION'});
 assert.throws(()=>assertMealReleaseSafe({fasting:false,allergyCodes:['allergen-x'],dietRestrictionCodes:['allergen-x']}),{code:'PRECONDITION'});
 assert.throws(()=>nextMealStatus('READY','DELIVERED'),{code:'PRECONDITION'});
 const ev=c.db.events('om-a','meal',meal.id);assert.equal(ev.length,2);assert.equal(ev[0].actorUid,'user-a');assert.ok(Math.abs(Date.now()-Date.parse(ev[0].occurredAt))<15000);
});
tcase('Nutrição pode auditar sem homologar nem manipular entrega',async c=>{
 const audit=c.service.openNutritionAudit(c.nutri,{auditId:'audit1',unitId:'uti-a',admissionId:'ad1',observation:'Conferir referência médica'});
 assert.equal(audit.status,'IDENTIFIED');assert.throws(()=>c.service.createDraftMap(c.nutri,{unitId:'uti-a',localDate:'2099-11-14',cycleId:'06'}),{code:'FORBIDDEN'});
 const m=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-11-14',cycleId:'06'});const sent=c.service.submitMap(c.a,{mapId:m.id,expectedRevision:m.revision});assert.equal(sent.status,'SUBMITTED');
 assert.throws(()=>c.service.advanceMeal(c.nutri,{mealId:'missing',unitId:'uti-a',next:'DELIVERED',expectedRevision:1}),{code:'FORBIDDEN'});
 const closed=c.service.transitionNutritionAudit(c.nutri,{auditId:'audit1',unitId:'uti-a',next:'CLOSED',expectedRevision:1});assert.equal(closed.status,'CLOSED');
});
tcase('transferência planejada não muda leito; confirmação suspende refeição e troca unidade',async c=>{
 const m=c.service.createDraftMap(c.a,{unitId:'uti-a',localDate:'2099-11-15',cycleId:'10'});
 const meal=c.service.addMealRequest(c.a,{mapId:m.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'before-transfer'});
 const event=c.service.planTransfer(c.a,{eventId:'location1',admissionId:'ad1',fromUnitId:'uti-a',toUnitId:'upi-a'});
 assert.equal(event.status,'PLANNED');assert.equal(c.service.get(c.a,'admission','ad1','uti-a').unitId,'uti-a');
 assert.throws(()=>c.service.confirmTransfer(c.a,{eventId:'location1',fromUnitId:'uti-a',expectedRevision:1}),{code:'FORBIDDEN'});
 // Separate authorized cross-unit staff for transfer.
 c.db.seedMembership({id:'cross-unit-staff',organizationId:'om-a',uid:'cross-unit',ug:'160416',unitIds:['uti-a','upi-a'],roles:['UNIT'],active:true});
 const cross=await resolveHospitalScope({authorization:'Bearer valid',organizationId:'om-a',store:c.db,verifyToken:async()=>({uid:'cross-unit'})});
 c.service.confirmTransfer(cross,{eventId:'location1',fromUnitId:'uti-a',expectedRevision:1});
 assert.throws(()=>c.service.get(c.a,'admission','ad1','uti-a'),{code:'NOT_FOUND'});assert.equal(c.service.get(cross,'admission','ad1','upi-a').unitId,'upi-a');
 assert.equal(c.service.get(c.a,'meal',meal.id,'uti-a').status,'SUSPENDED');
});
tcase('handler real retorna erros tipados, ignora role do payload',async c=>{
 const handler=createHospitalCoreHandler({store:c.db,verifyToken:verifier});
 const data=await handler({authorization:'Bearer token-a',organizationId:'om-a',operation:'map.create',payload:{unitId:'uti-a',localDate:'2099-11-16',cycleId:'06',roles:['HOSPITAL_ADMIN']}});
 assert.equal(data.status,200);const denied=await handler({authorization:'Bearer token-b',organizationId:'om-a',operation:'map.create',payload:{unitId:'uti-a',localDate:'2099-11-16',cycleId:'06'}});assert.equal(denied.status,403);
 const invalid=await handler({authorization:'Bearer token-a',organizationId:'om-a',operation:'unknown',payload:{}});assert.equal(invalid.status,400);
});
test('QA fail-closed sem opt-in, sem conexão com DB de produção',()=>{assert.throws(()=>new HospitalQAStore({filename:':memory:'}),{code:'UNAVAILABLE'});assert.throws(()=>new HospitalQAStore({filename:'/var/run/production.sqlite',qa:true}),{code:'UNAVAILABLE'})});
