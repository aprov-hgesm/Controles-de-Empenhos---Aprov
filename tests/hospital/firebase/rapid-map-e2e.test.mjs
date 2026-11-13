import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/firestore-service.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/firestore-service.mjs';
import {DistributionService} from '../../../lib/server/hospital/distribution/firestore-service.mjs';

assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/);
const id=p=>p+'_'+randomUUID().replaceAll('-','').slice(0,18);
const localDay=day=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})
 .formatToParts(new Date(Date.now()+day*86400000)).reduce((r,x)=>(x.type!=='literal'?(r[x.type]=x.value,r):r),{});
const day=offset=>{const x=localDay(offset);return x.year+'-'+x.month+'-'+x.day;};

test('quick map: two independent meals, NPVO companion only, extras, correction and tenant isolation',async()=>{
 const db=new HospitalFirestoreStore(),org=id('hospital'),ward='UTI',other='UPI',uid=id('unit'),kid=id('cook'),aid=id('admin'),oid=id('foreign');
 try{
  await db.seedOrganization({id:org,ug:'UG_SYNTH',active:true});
  for(const [who,roles,units] of [[uid,['UNIT'],[ward]],[kid,['KITCHEN'],[ward]],[aid,['HOSPITAL_ADMIN'],[ward,other]],[oid,['UNIT'],[other]]])
   await db.seedMembership({id:'m_'+who,uid:who,organizationId:org,ug:'UG_SYNTH',active:true,roles,unitIds:units});
  const scope=async who=>resolveHospitalScope({authorization:'Bearer '+who,organizationId:org,store:db,verifyToken:async x=>({uid:x})});
  const u=await scope(uid),k=await scope(kid),a=await scope(aid),outside=await scope(oid);
  await db.transaction(async tx=>{
   for(const unitId of [ward,other]){
    const u=await tx.put(org,'unit',unitId,{id:unitId,organizationId:org,unitId,code:unitId,name:unitId,type:'CARE',active:true},0);
    await tx.saveOrgUnit(org,u);
   }
  });
  const diets=new HospitalDietsService(db),maps=new HospitalMapsService(db),production=new ProductionService(db),dist=new DistributionService(db);
  const normal=await diets.saveCatalog(a,{catalogItemId:id('diet'),code:id('code'),label:'Livre de teste',
   type:'ORAL',consistency:'NORMAL',route:'ORAL',restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
  const soft=await diets.saveCatalog(a,{catalogItemId:id('diet'),code:id('code'),label:'Branda de teste',
   type:'ORAL',consistency:'SOFT',route:'ORAL',restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
  const date=day(-1),draft=await maps.createDraft(u,{unitId:ward,cycleId:'06',localDate:date});
  const common={mapId:draft.id,fullName:'Paciente Sintetico Principal',birthDate:'1991-08-10',
   bedLabel:'01',consistency:'LIVRE',route:'ORAL',restrictions:[],allergyNote:'AMENDOIM',
   meals:['PRIMARY','SECONDARY'],companion:false,catalogItemId:normal.id,
   confirmedAgainstCareInstruction:true,reason:'Solicitacao extraordinaria de homologacao'};
  await assert.rejects(maps.rapidEnroll(outside,{...common,idempotencyKey:id('unauthorized'),expectedMapRevision:draft.revision}),{code:'FORBIDDEN'});
  await assert.rejects(maps.rapidEnroll(u,{...common,confirmedAgainstCareInstruction:false,idempotencyKey:id('unconfirmed'),expectedMapRevision:draft.revision}),{code:'PRECONDITION'});
  const primary=await maps.rapidEnroll(u,{...common,idempotencyKey:id('meal1'),expectedMapRevision:draft.revision});
  assert.equal(primary.added,2);
  assert.equal(primary.extra,false);
  assert.equal(primary.priority,true);
  const main=primary.mealIds[0],secondary=primary.mealIds[1];
  const mealPrimary=await db.get(org,'meal',main),mealSecondary=await db.get(org,'meal',secondary);
  assert.notEqual(main,secondary);
  assert.equal(mealPrimary.mealType,'PRIMARY');assert.equal(mealSecondary.mealType,'SECONDARY');
  assert.equal(mealPrimary.allergyAlert,true);
  const companion=await maps.rapidEnroll(u,{
   mapId:draft.id,expectedMapRevision:primary.map.revision,idempotencyKey:id('companion'),
   fullName:'Paciente Sintetico NPVO',birthDate:'1984-04-19',bedLabel:'02',consistency:'LIVRE',route:'SONDA',
   restrictions:['NPVO','SNE'],allergyNote:'',meals:[],companion:true,companionCatalogItemId:normal.id,
   confirmedAgainstCareInstruction:true,reason:'Solicitacao extraordinaria NPVO ficticia'
  });
  assert.equal(companion.added,1);
  const cmp=await db.get(org,'meal',companion.mealIds[0]);
  assert.equal(cmp.recipientType,'COMPANION');assert.equal(cmp.mealType,'PRIMARY');
  const adm=await db.get(org,'admission',cmp.admissionId);assert.equal(adm.fasting,true);
  await assert.rejects(maps.rapidEnroll(u,{...common,fullName:'Outro Teste',birthDate:'1977-01-01',
    bedLabel:'02',idempotencyKey:id('occupied'),expectedMapRevision:companion.map.revision}),{code:'CONFLICT'});
  const sent=await maps.submitMap(u,{mapId:draft.id,expectedRevision:companion.map.revision,
    idempotencyKey:id('submit'),lateReason:'Mapa extraordinario de homologacao'});
  assert.equal(sent.map.status,'SUBMITTED');
  const snapshot=await production.snapshot(k,{unitIds:[ward],localDate:date,cycleId:'06'});
  assert.equal(snapshot.meals.filter(x=>x.status==='REQUESTED').length,3);
  assert.ok(snapshot.meals.some(x=>x.recipientType==='COMPANION'&&x.patientName.startsWith('ACOMPANHANTE de ')));
  const cmpBatch=await production.createBatch(k,{unitId:ward,localDate:date,cycleId:'06',mealIds:[cmp.id],preparationLabel:'Acompanhante ficticio',idempotencyKey:id('batch')});
  assert.equal(cmpBatch.mealIds.length,1,'NPVO do paciente nao bloqueia refeicao do acompanhante');
  await assert.rejects(maps.requestCorrection(k,{mapId:draft.id,mealId:main,newDietCode:soft.id,
   expectedMapRevision:sent.map.revision,expectedMealRevision:mealPrimary.revision,
   reason:'Dieta errada',idempotencyKey:id('forbid')}),{code:'FORBIDDEN'});
  const correction=await maps.requestCorrection(u,{mapId:draft.id,mealId:main,newDietCode:soft.id,
   expectedMapRevision:sent.map.revision,expectedMealRevision:mealPrimary.revision,
   reason:'Consistencia enviada incorretamente',idempotencyKey:id('correct')});
  assert.equal(correction.meal.status,'SUSPENDED');
  assert.equal((await production.snapshot(k,{unitIds:[ward],localDate:date,cycleId:'06'})).meals.find(x=>x.id===main).status,'SUSPENDED');
  const toAcknowledge=await maps.listCorrections(k,{unitId:ward});
  assert.equal(toAcknowledge.length,1);assert.equal(toAcknowledge[0].proposedDietCode,soft.id);
  const ack=await maps.acknowledgeCorrection(k,{unitId:ward,issueId:correction.incident.id,
   expectedRevision:correction.incident.revision,idempotencyKey:id('ack')});
  assert.equal(ack.returnedToProduction,true);
  assert.equal(ack.meal.dietCode,soft.id);
  assert.equal(ack.meal.status,'REQUESTED');
  assert.equal((await production.snapshot(k,{unitIds:[ward],localDate:date,cycleId:'06'})).meals.find(x=>x.id===main).safetyIssue,null);
  assert.equal((await maps.listCorrections(k,{unitId:ward})).length,0);
  const extra=await maps.rapidEnroll(u,{
   ...common,fullName:'Paciente Ficticio Extra',birthDate:'1960-01-04',bedLabel:'03',
   consistency:'PASTOSA',meals:['PRIMARY'],allergyNote:'',expectedMapRevision:ack.map.revision,
   idempotencyKey:id('extra')
  });
  assert.equal(extra.extra,true);assert.equal(extra.added,1);
  assert.equal((await db.get(org,'meal',extra.mealIds[0])).consistency,'PASTOSA');
  assert.equal((await dist.status(k,{unitId:ward,mealId:extra.mealIds[0]})).dietLabel,'Dieta pastosa');
  assert.equal((await production.snapshot(k,{unitIds:[ward],localDate:date,cycleId:'06'})).meals.find(x=>x.id===extra.mealIds[0]).dietLabel,'Dieta pastosa');
  const after=await maps.getMap(u,{mapId:draft.id});
  assert.equal(after.meals.filter(x=>x.status!=='CANCELLED').length,4);
  assert.ok(after.versions.some(x=>x.kind==='AMENDMENT'));
  assert.equal((await production.snapshot(k,{unitIds:[ward],localDate:date,cycleId:'06'})).meals.length,4);
 }finally{db.close()}
});
