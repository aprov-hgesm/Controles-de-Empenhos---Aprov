import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {HospitalCoreService} from '../../../lib/server/hospital/core/service.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalReportingService} from '../../../lib/server/hospital/reporting/service.mjs';
import {createHospitalReportingHandler} from '../../../lib/server/hospital/reporting/handler.mjs';
import {serializeHospitalCSV,exportHospitalReport} from '../../../lib/server/hospital/reporting/export.mjs';

const localDate='2099-11-11';
const f={from:localDate,to:localDate};
const tokenVerifier=async token=>({uid:token});
const token=(uid)=>'Bearer '+uid;
const authorize=(store,org,uid)=>resolveHospitalScope({authorization:token(uid),organizationId:org,store,verifyToken:tokenVerifier});

async function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'w8-report-'));
  const store=new HospitalQAStore({filename:join(dir,'qa.sqlite'),qa:true});
  const time=(clock)=>{store.now=()=>new Date(localDate+'T'+clock+':00-03:00').toISOString()};
  time('05:30');
  for(const [id,ug] of [['om-a','160416'],['om-b','160999']]){
    store.seedOrganization({id,ug,name:'QA SYNTHETIC ONLY',timezone:'America/Sao_Paulo',active:true});
  }
  const members=[
    ['unit-a','om-a','uti-a',['UNIT']],['unit-a2','om-a','upi-a',['UNIT']],
    ['cross','om-a','uti-a',['UNIT']],['cook','om-a','uti-a',['KITCHEN']],
    ['nutri','om-a','uti-a',['NUTRITION']],['admin','om-a','uti-a',['HOSPITAL_ADMIN']],
    ['foreign','om-b','uti-b',['UNIT']],['foreign-admin','om-b','uti-b',['HOSPITAL_ADMIN']]
  ];
  for(const [uid,org,unit,roles] of members)store.seedMembership({
    id:'member-'+uid,uid,organizationId:org,ug:org==='om-a'?'160416':'160999',
    unitIds:uid==='cross'||uid==='cook'||uid==='nutri'||uid==='admin'?['uti-a','upi-a']:[unit],roles,active:true,
  });
  const scope={
    unit:await authorize(store,'om-a','unit-a'),
    unit2:await authorize(store,'om-a','unit-a2'),
    cross:await authorize(store,'om-a','cross'),
    cook:await authorize(store,'om-a','cook'),
    nutri:await authorize(store,'om-a','nutri'),
    admin:await authorize(store,'om-a','admin'),
    foreign:await authorize(store,'om-b','foreign'),
    foreignAdmin:await authorize(store,'om-b','foreign-admin'),
  };
  const core=new HospitalCoreService(store);
  const reports=new HospitalReportingService(store);
  core.upsertDietCatalogItem(scope.admin,{catalogItemId:'diet1',code:'diet1',label:'Dieta QA',restrictionCodes:['test-allergen']});
  core.upsertDietCatalogItem(scope.foreignAdmin,{catalogItemId:'diet-b',code:'diet-b',label:'Outra OM',restrictionCodes:[]});
  const patient=(who,unitId,pId,aId,rId,diet='diet1')=>{
    core.createPatient(who,{patientId:pId,unitId,referenceCode:'FAKE-'+pId});
    core.createAdmission(who,{admissionId:aId,patientId:pId,unitId,bedId:'synthetic-bed'});
    core.recordMedicalDiet(who,{referenceId:rId,admissionId:aId,unitId,catalogItemId:diet,sourceRef:'QA-RX-'+rId,prescribedAt:'2099-11-10T00:00:00Z'});
  };
  patient(scope.unit,'uti-a','p1','ad1','rx1');
  patient(scope.unit,'uti-a','p2','ad2','rx2');
  patient(scope.unit2,'upi-a','p3','ad3','rx3');
  patient(scope.foreign,'uti-b','p4','ad4','rx4','diet-b');

  time('05:50');
  const m06=core.createDraftMap(scope.unit,{unitId:'uti-a',localDate,cycleId:'06'});
  const p=core.addMealRequest(scope.unit,{mapId:m06.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'w8-p06'});
  const s=core.addMealRequest(scope.unit,{mapId:m06.id,admissionId:'ad1',mealType:'SECONDARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'w8-s06'});
  time('05:59');
  const submitted=core.submitMap(scope.unit,{mapId:m06.id,expectedRevision:m06.revision});
  core.closeMap(scope.unit,{mapId:m06.id,expectedRevision:submitted.revision});
  time('06:10');
  const late=core.addMealRequest(scope.unit,{mapId:m06.id,admissionId:'ad2',mealType:'SECONDARY',dietCode:'diet1',medicalReferenceId:'rx2',idempotencyKey:'w8-s06-extra',reason:'QA adendo posterior ao fechamento'});
  // Distinct recorded events; no leap from READY to DELIVERED.
  let current=p;
  for(const [clock,next] of [['06:11','PREPARING'],['06:18','READY'],['06:20','DISPATCHED'],['06:25','RECEIVED_BY_UNIT'],['06:28','DELIVERED']]){
    time(clock);
    current=core.advanceMeal(scope.cook,{mealId:p.id,unitId:'uti-a',next,expectedRevision:current.revision});
  }
  time('09:40');
  const m10=core.createDraftMap(scope.unit2,{unitId:'upi-a',localDate,cycleId:'10'});
  let p10=core.addMealRequest(scope.unit2,{mapId:m10.id,admissionId:'ad3',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx3',idempotencyKey:'w8-p10'});
  time('09:59');
  core.submitMap(scope.unit2,{mapId:m10.id,expectedRevision:m10.revision});
  time('10:01');
  p10=core.advanceMeal(scope.cook,{mealId:p10.id,unitId:'upi-a',next:'CANCELLED',expectedRevision:p10.revision});

  time('15:50');
  const m16=core.createDraftMap(scope.unit,{unitId:'uti-a',localDate,cycleId:'16'});
  let p16=core.addMealRequest(scope.unit,{mapId:m16.id,admissionId:'ad1',mealType:'PRIMARY',dietCode:'diet1',medicalReferenceId:'rx1',idempotencyKey:'w8-p16'});
  time('15:58');
  core.submitMap(scope.unit,{mapId:m16.id,expectedRevision:m16.revision});
  time('16:01');
  p16=core.advanceMeal(scope.cook,{mealId:p16.id,unitId:'uti-a',next:'PREPARING',expectedRevision:p16.revision});
  time('16:05');
  p16=core.advanceMeal(scope.cook,{mealId:p16.id,unitId:'uti-a',next:'READY',expectedRevision:p16.revision});
  time('16:08');
  p16=core.advanceMeal(scope.cook,{mealId:p16.id,unitId:'uti-a',next:'CANCELLED',expectedRevision:p16.revision});

  time('16:20');
  const fMap=core.createDraftMap(scope.foreign,{unitId:'uti-b',localDate,cycleId:'16'});
  core.addMealRequest(scope.foreign,{mapId:fMap.id,admissionId:'ad4',mealType:'PRIMARY',dietCode:'diet-b',medicalReferenceId:'rx4',idempotencyKey:'w8-foreign'});
  const fs=core.submitMap(scope.foreign,{mapId:fMap.id,expectedRevision:fMap.revision});

  time('16:25');
  const audit=core.openNutritionAudit(scope.nutri,{auditId:'audit1',unitId:'uti-a',admissionId:'ad1',observation:'Anotação QA sem identificação clínica'});
  time('16:30');
  core.transitionNutritionAudit(scope.nutri,{auditId:'audit1',unitId:'uti-a',next:'CONTACTED',expectedRevision:audit.revision});
  time('16:35');
  const update=store.get('om-a','nutrition_audit','audit1');
  core.transitionNutritionAudit(scope.nutri,{auditId:'audit1',unitId:'uti-a',next:'CLOSED',expectedRevision:update.revision});
  store.put('om-a','incident','uti-a',{id:'inc1',organizationId:'om-a',unitId:'uti-a',type:'TECH_INTERRUPTION',note:'QA sintético',status:'OPEN',createdAt:store.now()});
  return {store,dir,time,scope,core,reports,m06,m10,m16,p,s,late,cleanup(){store.close();rmSync(dir,{force:true,recursive:true})}};
}
function withFixture(name,fn){test(name,async()=>{const ctx=await fixture();try{await fn(ctx)}finally{ctx.cleanup()}})}
withFixture('2 OMs/2 unidades: consultas SQL isoladas e total reconciliado, sem duplicar adendos',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'production',filters:f});
  assert.equal(r.summary.planned,5);
  assert.equal(r.summary.sent,5);
  assert.equal(r.summary.ready,2);
  assert.equal(r.summary.delivered,1);
  assert.equal(r.summary.cancelled,2);
  assert.equal(r.partial,false);
  assert.equal(r.rows.every(x=>x.unitId!=='uti-b'),true);
  const other=c.reports.query(c.scope.foreign,{view:'production',filters:f});
  assert.equal(other.summary.planned,1);
  assert.equal(other.rows[0].dietCode,'diet-b');
  assert.equal(other.rows.some(x=>x.unitId==='uti-a'),false);
});
withFixture('3 mapas e congelamento: SUBMISSION, CLOSE e AMENDMENT são versões distintas',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'maps',filters:f});
  assert.equal(r.summary.maps,3);
  assert.equal(r.summary.adendos,1);
  const m06=r.rows.filter(x=>x.cycleId==='06');
  assert.deepEqual(m06.map(x=>x.versionKind),['SUBMISSION','CLOSE','AMENDMENT']);
  assert.deepEqual(m06.map(x=>x.items),[2,2,3]);
  assert.deepEqual(m06.map(x=>x.addedItems),[2,0,1]);
  assert.equal(m06[0].submittedWithinDeadline,true);
});
withFixture('pontualidade: prazo de mapa e tolerância de principal independentes',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'timeliness',filters:f});
  assert.equal(r.summary.lateSubmissions,0);
  assert.equal(r.summary.extraordinaryRequests,1);
  assert.equal(r.summary.primaryDeliveredAfterTolerance,0);
  const at06=r.rows.find(x=>x.cycleId==='06');
  assert.equal(at06.submittedOnTime,1);
  assert.equal(at06.extraordinary,1);
  assert.equal(at06.primaryDeliveredWithinTolerance,1);
  assert.equal(at06.secondaryDelivered,0);
  assert.equal(at06.averagePrepMinutes,7);
  assert.equal(at06.averageDispatchToDeliveryMinutes,8);
});
withFixture('ocorrências: tardia, adendo e interrupção com evidência sem atribuição de culpa',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'occurrences',filters:f});
  assert.equal(r.summary.lateRequests,1);
  assert.equal(r.summary.amendments,1);
  assert.equal(r.summary.incidents,1);
  assert.equal(r.summary.automaticBlame,false);
  assert.equal(r.rows.every(x=>x.administrativeAttribution===null),true);
  assert.ok(r.rows.filter(x=>x.category!=='INCIDENT').every(x=>typeof x.evidenceEventId==='number'));
});
withFixture('Nutrição: acesso restrito, tempo de resposta médica não inventado',async c=>{
  const r=c.reports.query(c.scope.nutri,{view:'nutrition',filters:f});
  assert.equal(r.summary.audits,1);
  assert.equal(r.summary.contacts,1);
  assert.equal(r.summary.medicalResponsesRecorded,0);
  assert.equal(r.summary.averageMedicalResponseMinutes,null);
  assert.equal(r.rows[0].status,'CLOSED');
  assert.throws(()=>c.reports.query(c.scope.unit,{view:'nutrition',filters:f}),{code:'FORBIDDEN'});
});
withFixture('desperdício: potencial sem transformar não-entregue em quantidade aferida',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'waste',filters:f});
  assert.equal(r.summary.cancelledBeforePreparation,1);
  assert.equal(r.summary.cancelledAfterPreparation,1);
  assert.equal(r.summary.readyNotDeliveredPotential,1);
  assert.equal(r.summary.measuredQuantity,null);
  assert.equal(r.summary.measurementStatus,'NOT_RECORDED');
});
withFixture('paginador e filtros por ciclo, refeição, dieta, data e unidade',async c=>{
  const p1=c.reports.query(c.scope.cook,{view:'production',filters:f,page:1,pageSize:1});
  const p2=c.reports.query(c.scope.cook,{view:'production',filters:f,page:2,pageSize:1});
  assert.equal(p1.rows.length,1);assert.equal(p2.rows.length,1);
  assert.notDeepEqual(p1.rows,p2.rows);
  assert.equal(p1.total,p2.total);
  const late=c.reports.query(c.scope.cook,{view:'production',filters:{...f,late:true}});
  assert.equal(late.summary.planned,1);
  const one=c.reports.query(c.scope.cook,{view:'production',filters:{...f,unitId:'upi-a',cycleId:'10',mealType:'PRIMARY'}});
  assert.equal(one.summary.planned,1);
  assert.equal(one.rows[0].unitId,'upi-a');
  assert.throws(()=>c.reports.query(c.scope.unit,{view:'maps',filters:{...f,unitId:'upi-a'}}),{code:'FORBIDDEN'});
  assert.throws(()=>c.reports.query(c.scope.cook,{view:'production',filters:{...f,from:'2099-01-01'}}),{code:'INVALID'});
});
withFixture('nega OM/UG forjadas, scope falso, admin comercial e cross-tenant',async c=>{
  assert.throws(()=>c.reports.query({...c.scope.unit,organizationId:'om-b'},{view:'production',filters:f}),{code:'UNAUTHORIZED'});
  assert.throws(()=>c.reports.query(c.scope.cook,{view:'maps',filters:{...f,organizationId:'om-b'}}),{code:'FORBIDDEN'});
  assert.throws(()=>c.reports.query(c.scope.cook,{view:'maps',filters:{...f,ug:'160999'}}),{code:'FORBIDDEN'});
  assert.throws(()=>c.reports.query(c.scope.admin,{view:'production',filters:f}),{code:'FORBIDDEN'});
  await assert.rejects(authorize(c.store,'om-b','unit-a'),{code:'FORBIDDEN'});
});
withFixture('handler verifica token, autorização e devolve CSV completo em vez da página atual',async c=>{
  const handler=createHospitalReportingHandler({store:c.store,verifyToken:tokenVerifier});
  const denied=await handler({authorization:token('foreign'),organizationId:'om-a',view:'production',filters:f});
  assert.equal(denied.status,403);
  const response=await handler({authorization:token('cook'),organizationId:'om-a',view:'production',filters:f,page:2,pageSize:1});
  assert.equal(response.status,200);assert.equal(response.body.data.rows.length,1);
  const exported=await handler({authorization:token('cook'),organizationId:'om-a',view:'production',filters:f,format:'csv'});
  assert.equal(exported.status,200);
  const csv=new TextDecoder().decode(exported.bytes);
  assert.ok(csv.includes('EMPROVEX Cozinha Dietetica'));
  assert.equal(csv.split(/\r?\n/).filter(x=>x.startsWith('"uti-')||x.startsWith('"upi-')).length,response.body.data.total);
  assert.equal(csv.includes('p1'),false);
  assert.equal(csv.includes('ad1'),false);
});
test('CSV: impede fórmula, escape de aspas e caracteres de controle',()=>{
  const report={view:'occurrences',filters:{organizationId:'om-a',ug:'160416',from:localDate,to:localDate},
    rows:[{unitId:'uti-a',category:'INCIDENT',eventType:'TEST',occurredAt:'2099-11-11T09:00:00Z',detail:'  =HYPERLINK("evil")\nitem',evidenceEventId:1,actorRef:null}],partial:false,generatedAt:'2099-11-11T09:00:00Z'};
  const s=serializeHospitalCSV(report);
  assert.ok(s.includes("'  =HYPERLINK"));
  assert.ok(!s.includes('"\nitem'));
  assert.ok(s.startsWith('\uFEFF'));
});
withFixture('PDF: bytes assinados PDF, somente colunas autorizadas e nome sem PHI',async c=>{
  const r=c.reports.query(c.scope.cook,{view:'maps',filters:f,exportAll:true,pageSize:5000});
  const p=await exportHospitalReport(r,'pdf');
  assert.ok(new TextDecoder().decode(p.bytes.slice(0,8)).startsWith('%PDF-'));
  assert.ok(!p.filename.includes('ad1'));
  assert.match(p.filename,/^emprovex-dietetica-maps-2099/);
});
withFixture('SQLite: índice QA e leituras bounded sem segundo journal',async c=>{
  const index=c.store.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_hospital_reporting_record_day'").get();
  assert.equal(index.name,'idx_hospital_reporting_record_day');
  const journals=c.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%events%'").all();
  assert.deepEqual(journals.map(x=>x.name),['hospital_events']);
  const plan=c.store.db.prepare("EXPLAIN QUERY PLAN SELECT body FROM records WHERE organization_id=? AND kind=? AND unit_id IN (?) AND json_extract(body,'$.localDate') BETWEEN ? AND ?").all('om-a','meal','uti-a',localDate,localDate);
  assert.ok(plan.length>0);
  assert.ok(c.reports.query(c.scope.cook,{view:'maps',filters:f}).estimatedReadRows>0);
});
