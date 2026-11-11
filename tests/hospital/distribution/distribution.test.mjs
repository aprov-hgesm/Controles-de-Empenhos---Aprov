import test from 'node:test';
import assert from 'node:assert/strict';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {DistributionService} from '../../../lib/server/hospital/distribution/service.mjs';
import {createDistributionHandler} from '../../../lib/server/hospital/distribution/handler.mjs';

const tokenUid={'kitchen':'kitchen','unit':'unit','other':'other','foreign':'foreign','nutrition':'nutrition'};
const verifyToken=async token=>{if(!tokenUid[token])throw Error('invalid token');return {uid:tokenUid[token]}};
const auth=(store,token,organizationId='hospital-a')=>resolveHospitalScope({authorization:'Bearer '+token,organizationId,store,verifyToken});
async function fixture(){
  const store=new HospitalQAStore({filename:':memory:',qa:true}),core=new HospitalCoreService(store),distribution=new DistributionService(store);
  store.seedOrganization({id:'hospital-a',ug:'160416',name:'FAKE HOSPITAL QA',active:true});
  store.seedOrganization({id:'hospital-b',ug:'160417',name:'FAKE HOSPITAL B',active:true});
  for(const [uid,org,roles,units] of [
    ['kitchen','hospital-a',['KITCHEN'],['uti','upi']],
    ['unit','hospital-a',['UNIT'],['uti','upi']],
    ['other','hospital-a',['UNIT'],['upi']],
    ['nutrition','hospital-a',['NUTRITION'],['uti']],
    ['foreign','hospital-b',['KITCHEN'],['uti']]
  ])store.seedMembership({id:'m-'+uid,uid,organizationId:org,ug:org==='hospital-a'?'160416':'160417',roles,unitIds:units,active:true});
  // QA catalog is seeded through the private test adapter, never an HTTP endpoint.
  store.put('hospital-a','catalog_diet','hospital_catalog',{id:'diet-a',organizationId:'hospital-a',unitId:'hospital_catalog',code:'diet-a',active:true,restrictionCodes:[],label:'Dieta QA'});
  const unit=await auth(store,'unit'),kitchen=await auth(store,'kitchen');
  const p=core.createPatient(unit,{patientId:'patient-qa',unitId:'uti',referenceCode:'REF-QA-001'});
  store.put('hospital-a','patient','uti',{...p,displayName:'Paciente <Teste> QA'},p.revision);
  const admission=core.createAdmission(unit,{admissionId:'admission-qa',patientId:p.id,unitId:'uti',bedId:'bed-01'});
  core.recordMedicalDiet(unit,{referenceId:'rx-a',admissionId:admission.id,unitId:'uti',catalogItemId:'diet-a',sourceRef:'RX-SYNTHETIC',prescribedAt:'2099-01-01T00:00:00Z'});
  const map=core.createDraftMap(unit,{unitId:'uti',localDate:'2099-11-11',cycleId:'10'});
  const meal=core.addMealRequest(unit,{mapId:map.id,admissionId:admission.id,mealType:'PRIMARY',dietCode:'diet-a',medicalReferenceId:'rx-a',idempotencyKey:'core-qa-primary'});
  core.submitMap(unit,{mapId:map.id,expectedRevision:map.revision});
  const p1=core.advanceMeal(kitchen,{mealId:meal.id,unitId:'uti',next:'PREPARING',expectedRevision:meal.revision});
  core.advanceMeal(kitchen,{mealId:meal.id,unitId:'uti',next:'READY',expectedRevision:p1.revision});
  const cmd=(op,body)=>distribution.command(kitchen,op,{unitId:'uti',mealId:meal.id,idempotencyKey:op.replace(/[^A-Za-z0-9]/g,'-')+'-'+Math.random().toString(36).slice(2),...body});
  return {store,core,distribution,unit,kitchen,admission,meal,map,cmd,close(){store.close()}};
}
const withFixture=(name,fn)=>test(name,async()=>{const c=await fixture();try{await fn(c)}finally{c.close()}});
const assemble=c=>{c.cmd('assembly.start');c.cmd('assembly.complete',{preparedDietCode:'diet-a',ingredientCodes:['ingredient-qa']});c.cmd('assembly.check')};
const dispatched=c=>{assemble(c);c.cmd('batch.dispatch',{mealIds:[c.meal.id]});};
const received=c=>{dispatched(c);c.cmd('batch.receive',{mealIds:[c.meal.id]})};

withFixture('W5 E2E real SQLite: preparo -> montagem -> etiqueta -> conferência -> expedição -> recebimento -> entrega individual',c=>{
  assert.equal(c.distribution.status(c.kitchen,{unitId:'uti',mealId:c.meal.id}).distributionState,'NOT_STARTED');
  assert.throws(()=>c.cmd('batch.dispatch',{mealIds:[c.meal.id]}),{code:'PRECONDITION'});
  c.cmd('assembly.start');
  c.cmd('assembly.complete',{preparedDietCode:'diet-a',ingredientCodes:['ingredient-qa']});
  const html=c.distribution.printLabel(c.kitchen,{unitId:'uti',mealId:c.meal.id,format:'80mm'});
  assert.match(html,/Paciente &lt;Teste&gt; QA/);
  assert.doesNotMatch(html,/<script>|api\/hospital\/distribution\?/i);
  assert.match(html,/REF-QA-001/);
  assert.throws(()=>c.cmd('batch.dispatch',{mealIds:[c.meal.id]}),{code:'PRECONDITION'});
  c.cmd('assembly.check');
  c.cmd('batch.dispatch',{mealIds:[c.meal.id]});
  assert.equal(c.core.get(c.kitchen,'meal',c.meal.id,'uti').status,'DISPATCHED');
  assert.throws(()=>c.cmd('meal.deliver',{patientReferenceCode:'REF-QA-001',patientDisplayName:'Paciente <Teste> QA',identityMethod:'MANUAL'}),{code:'PRECONDITION'});
  c.distribution.command(c.unit,'batch.receive',{unitId:'uti',mealIds:[c.meal.id],idempotencyKey:'ward-receive'});
  assert.throws(()=>c.distribution.command(c.unit,'meal.deliver',{unitId:'uti',mealId:c.meal.id,idempotencyKey:'ward-forbidden',patientReferenceCode:'REF-QA-001',patientDisplayName:'Paciente <Teste> QA',identityMethod:'MANUAL'}),{code:'FORBIDDEN'});
  assert.throws(()=>c.cmd('meal.deliver',{patientReferenceCode:'WRONG',patientDisplayName:'Paciente <Teste> QA',identityMethod:'MANUAL'}),{code:'PRECONDITION'});
  const done=c.cmd('meal.deliver',{patientReferenceCode:'REF-QA-001',patientDisplayName:'Paciente <Teste> QA',identityMethod:'MANUAL'});
  assert.equal(done.meal.status,'DELIVERED');
  assert.equal(c.distribution.status(c.kitchen,{unitId:'uti',mealId:c.meal.id}).distributionState,'DELIVERED');
  const ev=c.store.events('hospital-a','meal',c.meal.id);
  assert.ok(ev.some(e=>e.eventType==='meal.assembly.checked'));
  assert.ok(ev.some(e=>e.eventType==='meal.delivered'&&e.actorUid==='kitchen'));
  assert.ok(ev.some(e=>e.eventType==='meal.received'&&e.actorUid==='unit'));
  assert.ok(ev.every(e=>!Number.isNaN(Date.parse(e.occurredAt))));
  assert.equal(c.store.list('hospital-a','delivery_event','uti').length,3);
});

withFixture('Jejum após montagem bloqueia expedição, sem perda de auditoria',c=>{
  assemble(c);
  const updated=c.core.get(c.unit,'admission',c.admission.id,'uti');
  c.core.updateClinicalSafety(c.unit,{admissionId:c.admission.id,unitId:'uti',fasting:true,allergyCodes:[],expectedRevision:updated.revision});
  assert.throws(()=>c.cmd('batch.dispatch',{mealIds:[c.meal.id]}),{code:'PRECONDITION'});
  assert.equal(c.store.list('hospital-a','delivery_event','uti').length,0);
});

withFixture('Alergia ao ingrediente antes de conferir impede expedição',c=>{
  c.cmd('assembly.start');
  c.cmd('assembly.complete',{preparedDietCode:'diet-a',ingredientCodes:['milk']});
  const admission=c.core.get(c.unit,'admission',c.admission.id,'uti');
  c.core.updateClinicalSafety(c.unit,{admissionId:c.admission.id,unitId:'uti',fasting:false,allergyCodes:['milk'],expectedRevision:admission.revision});
  assert.throws(()=>c.cmd('assembly.check'),{code:'PRECONDITION'});
});

withFixture('Mudança de prescrição vigente exige nova reconferência, sem expedição',c=>{
  assemble(c);
  c.core.recordMedicalDiet(c.unit,{referenceId:'rx-new',admissionId:c.admission.id,unitId:'uti',catalogItemId:'diet-a',sourceRef:'RX-NEW-SYNTHETIC',prescribedAt:'2099-02-01T00:00:00Z'});
  assert.throws(()=>c.cmd('batch.dispatch',{mealIds:[c.meal.id]}),{code:'PRECONDITION'});
});

withFixture('Transferência confirmada durante rota impede entrega antiga e exige reconciliação',c=>{
  dispatched(c);
  const transfer=c.core.planTransfer(c.unit,{eventId:'loc-qa',admissionId:c.admission.id,fromUnitId:'uti',toUnitId:'upi'});
  c.core.confirmTransfer(c.unit,{eventId:transfer.id,fromUnitId:'uti',expectedRevision:transfer.revision});
  assert.equal(c.distribution.status(c.kitchen,{unitId:'uti',mealId:c.meal.id}).routeReconciliationRequired,true);
  assert.throws(()=>c.cmd('batch.receive',{mealIds:[c.meal.id]}),{code:'PRECONDITION'});
  const flagged=c.cmd('route.flag',{reason:'Redirecionar manualmente, nova conferência obrigatória'});
  assert.equal(flagged.state,'ROUTE_RECONCILIATION_REQUIRED');
  assert.equal(c.store.get('hospital-a','meal',c.meal.id).status,'SUSPENDED');
});

withFixture('Entrega duplicada, scanner indisponível, autenticação por OM/unidade',async c=>{
  received(c);
  const p={unitId:'uti',mealId:c.meal.id,identityMethod:'MANUAL',patientReferenceCode:'REF-QA-001',patientDisplayName:'Paciente <Teste> QA',idempotencyKey:'single-delivery'};
  const first=c.distribution.command(c.kitchen,'meal.deliver',p);
  const idem=c.distribution.command(c.kitchen,'meal.deliver',p);
  assert.deepEqual(idem,first);
  assert.throws(()=>c.distribution.command(c.kitchen,'meal.deliver',{...p,idempotencyKey:'other-delivery'}),{code:'PRECONDITION'});
  const other=await auth(c.store,'other'),foreign=await auth(c.store,'foreign','hospital-b');
  assert.throws(()=>c.distribution.command(other,'meal.cancel',{unitId:'uti',mealId:c.meal.id,idempotencyKey:'other-unit',reason:'No permission'}),{code:'FORBIDDEN'});
  assert.throws(()=>c.distribution.status(foreign,{unitId:'uti',mealId:c.meal.id}),{code:'NOT_FOUND'});
  assert.throws(()=>c.distribution.command({uid:'kitchen',roles:['KITCHEN'],organizationId:'hospital-a',unitIds:['uti'],active:true},'meal.cancel',{unitId:'uti',mealId:c.meal.id,idempotencyKey:'forged',reason:'forged'}),{code:'UNAUTHORIZED'});
  assert.equal(c.store.list('hospital-a','delivery_event','uti').length,3);
});

withFixture('Concorrência/atomicidade: duas entregas com chaves diferentes, somente uma vence',async c=>{
  received(c);
  const body={unitId:'uti',mealId:c.meal.id,identityMethod:'MANUAL',patientReferenceCode:'REF-QA-001',patientDisplayName:'Paciente <Teste> QA'};
  const settled=await Promise.allSettled(['first','second'].map(key=>Promise.resolve().then(()=>c.distribution.command(c.kitchen,'meal.deliver',{...body,idempotencyKey:key}))));
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(c.store.list('hospital-a','delivery_event','uti').filter(x=>x.type==='DELIVERED').length,1);
});

withFixture('Lote com pedido inválido faz rollback integral; cancelamento/devolução auditáveis',c=>{
  assemble(c);
  assert.throws(()=>c.cmd('batch.dispatch',{mealIds:[c.meal.id,'missing']}),{code:'NOT_FOUND'});
  assert.equal(c.store.get('hospital-a','meal',c.meal.id).status,'READY');
  c.cmd('batch.dispatch',{mealIds:[c.meal.id]});
  const returned=c.cmd('meal.return',{reason:'Ocorrência na rota de QA'});
  assert.equal(returned.job.state,'RETURNED');
  assert.equal(c.store.get('hospital-a','meal',c.meal.id).status,'SUSPENDED');
});

withFixture('Handler: token verificado, impressão privada e nenhuma role do body concede entrega',async c=>{
  const handler=createDistributionHandler({store:c.store,verifyToken});
  const denied=await handler({authorization:'Bearer nutrition',organizationId:'hospital-a',operation:'assembly.start',payload:{unitId:'uti',mealId:c.meal.id,idempotencyKey:'denied',roles:['KITCHEN']}});
  assert.equal(denied.status,403);
  const unauth=await handler({authorization:'Bearer fake',organizationId:'hospital-a',operation:'label.print',payload:{unitId:'uti',mealId:c.meal.id}});
  assert.equal(unauth.status,401);
  assemble(c);
  const label=await handler({authorization:'Bearer kitchen',organizationId:'hospital-a',operation:'label.print',payload:{unitId:'uti',mealId:c.meal.id}});
  assert.equal(label.status,200);
  assert.match(label.headers['cache-control'],/no-store/);
  assert.doesNotMatch(label.html,/<script>|https?:\/\//);
});
