import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {NutritionAuditService} from '../../../lib/server/hospital/nutrition-audit/service.mjs';
import {createNutritionAuditHandler} from '../../../lib/server/hospital/nutrition-audit/handler.mjs';
const verifier=async t=>{if(!['nutrition','other','other-om','admin','commercial','unit','nurse'].includes(t))throw Error('invalid');return {uid:t};};
const login=(db,org,token)=>resolveHospitalScope({authorization:`Bearer ${token}`,organizationId:org,store:db,verifyToken:verifier});
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'nutrition-w6-'));const filename=join(dir,'clinical.sqlite');const db=new HospitalQAStore({filename,qa:true});
 for(const [id,ug] of [['om-a','160416'],['om-b','160999']])db.seedOrganization({id,ug,active:true,name:'INVENTADA-TESTE'});
 for(const [uid,org,unitIds,roles] of [['nutrition','om-a',['uti-a'],['NUTRITION']],['other','om-a',['upi-a'],['NUTRITION']],['other-om','om-b',['uti-b'],['NUTRITION']],['admin','om-a',['uti-a','upi-a'],['HOSPITAL_ADMIN']],['commercial','om-a',[],[]],['unit','om-a',['uti-a'],['UNIT']],['nurse','om-a',['uti-a'],['KITCHEN']]])db.seedMembership({id:'member-'+uid,uid,organizationId:org,ug:org==='om-a'?'160416':'160999',unitIds,roles,active:true});
 for(const [org,unit,id] of [['om-a','uti-a','adm-a'],['om-a','upi-a','adm-upi'],['om-b','uti-b','adm-b']]){
  db.put(org,'patient',unit,{id:'patient-'+id,organizationId:org,unitId:unit,referenceCode:'SYNTHETIC-'+id});
  db.put(org,'admission',unit,{id,organizationId:org,unitId:unit,patientId:'patient-'+id,status:'ACTIVE',fasting:false,allergyCodes:['FAKE_ALLERGEN'],medicalReferenceId:'rx-'+id});
  db.put(org,'medical_reference',unit,{id:'rx-'+id,organizationId:org,unitId:unit,admissionId:id,catalogItemId:'diet-X',sourceRef:'SYNTHETIC-PRESCRIPTION',prescribedAt:'2026-11-10T10:00:00Z',enteredByUid:'unit',createdAt:'2026-11-10T11:00:00Z'});
 }
 const nutri=await login(db,'om-a','nutrition'),other=await login(db,'om-a','other'),b=await login(db,'om-b','other-om'),admin=await login(db,'om-a','admin'),unit=await login(db,'om-a','unit');
 const service=new NutritionAuditService(db);return {db,dir,filename,nutri,other,b,admin,unit,service,cleanup(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
const scenario=(name,fn)=>test(name,async()=>{const ctx=await fixture();try{await fn(ctx)}finally{ctx.cleanup()}});
const base=()=>({unitId:'uti-a',admissionId:'adm-a',medicalReferenceId:'rx-adm-a',category:'DOCUMENTATION',risk:'LOW',evidence:'EVIDÊNCIA FAKE, sem dados de paciente',recommendation:'Conferir a referência institucional',idempotencyKey:'test-idempotency-1'});
scenario('persistência SQLite, categorias configuráveis e idempotência real',async c=>{
 const a=c.service.createFinding(c.nutri,base());const repeat=c.service.createFinding(c.nutri,base());assert.deepEqual(a,repeat);assert.equal(a.status,'IDENTIFIED');assert.equal(c.service.listFindings(c.nutri,{unitId:'uti-a'}).total,1);
 const db2=new HospitalQAStore({filename:c.filename,qa:true});try{const second=new NutritionAuditService(db2);const scope=await login(db2,'om-a','nutrition');assert.equal(second.listFindings(scope,{unitId:'uti-a'}).total,1);}finally{db2.close();}
 assert.throws(()=>c.service.createFinding(c.nutri,{...base(),category:'INVENTED',idempotencyKey:'other-key'}),{code:'INVALID'});
 const catalog=c.service.configureCatalog(c.admin,{categories:['DOCUMENTATION','CUSTOM'],risks:['LOW','CRITICAL'],expectedRevision:0});assert.equal(catalog.revision,1);
 assert.throws(()=>c.service.configureCatalog(c.admin,{categories:['CUSTOM'],risks:['LOW'],expectedRevision:0}),{code:'CONFLICT'});
 assert.equal(c.service.catalog(c.nutri,'uti-a').categories.includes('CUSTOM'),true);
});
scenario('achado grave exige encaminhamento e não altera mapa/refeição',async c=>{
 const map=c.db.put('om-a','map','uti-a',{id:'map-a',organizationId:'om-a',unitId:'uti-a',status:'DRAFT',localDate:'2026-11-11',cycleId:'06'});
 const meal=c.db.put('om-a','meal','uti-a',{id:'meal-a',organizationId:'om-a',unitId:'uti-a',mapId:'map-a',status:'REQUESTED',admissionId:'adm-a'});
 assert.throws(()=>c.service.createFinding(c.nutri,{...base(),risk:'CRITICAL',idempotencyKey:'critical'}),{code:'PRECONDITION'});
 const finding=c.service.createFinding(c.nutri,{...base(),risk:'CRITICAL',escalation:'Acionar fluxo assistencial W0/W3',idempotencyKey:'critical'});
 assert.equal(finding.risk,'CRITICAL');assert.equal(c.db.get('om-a','map',map.id).status,'DRAFT');assert.equal(c.db.get('om-a','meal',meal.id).status,'REQUESTED');
});
scenario('Nutrição não edita dieta e não precisa de conta médica',async c=>{
 const f=c.service.createFinding(c.nutri,base());assert.throws(()=>c.service.readPatientDiet(c.unit,{unitId:'uti-a',admissionId:'adm-a'}),{code:'FORBIDDEN'});
 assert.throws(()=>c.service.readPatientDiet(c.nutri,{unitId:'upi-a',admissionId:'adm-upi'}),{code:'FORBIDDEN'});
 const p=c.service.readPatientDiet(c.nutri,{unitId:'uti-a',admissionId:'adm-a'});assert.equal(p.versions.length,1);assert.equal(p.metadata.consistency,'NOT_AVAILABLE_IN_W0');
 assert.equal(c.db.get('om-a','medical_reference','rx-adm-a').catalogItemId,'diet-X');assert.equal(f.status,'IDENTIFIED');
});
scenario('duas unidades e duas OMs isoladas, admin não lê dados clínicos',async c=>{
 c.service.createFinding(c.nutri,base());assert.equal(c.service.listFindings(c.other,{unitId:'upi-a'}).total,0);assert.equal(c.service.listFindings(c.b,{unitId:'uti-b'}).total,0);
 assert.throws(()=>c.service.listFindings(c.other,{unitId:'uti-a'}),{code:'FORBIDDEN'});assert.throws(()=>c.service.listFindings(c.admin,{unitId:'uti-a'}),{code:'FORBIDDEN'});
 await assert.rejects(login(c.db,'om-a','commercial'),{code:'FORBIDDEN'});await assert.rejects(login(c.db,'om-b','nutrition'),{code:'FORBIDDEN'});
 assert.throws(()=>c.service.readPatientDiet(c.nutri,{unitId:'uti-a',admissionId:'adm-upi'}),{code:'NOT_FOUND'});
});
scenario('contato requer confirmação; nenhuma resposta fantasma; cronologia real',async c=>{
 const f=c.service.createFinding(c.nutri,base());const contactData={unitId:'uti-a',findingId:f.id,physicianRef:'Médico fictício',channel:'PHONE',contactedAt:'2026-11-10T12:00:00Z',requestNote:'Revisão solicitada via telefone',idempotencyKey:'contact-1'};
 assert.throws(()=>c.service.recordMedicalContact(c.nutri,{...contactData,contactConfirmed:false}),{code:'PRECONDITION'});
 const contact=c.service.recordMedicalContact(c.nutri,{...contactData,contactConfirmed:true});assert.equal(contact.status,'REQUESTED');assert.equal(contact.responseNote,null);
 assert.equal(c.service.listMedicalContacts(c.nutri,{unitId:'uti-a'}).length,1);assert.equal(c.service.listFindings(c.nutri,{unitId:'uti-a'}).items[0].status,'CONTACTED');
 assert.throws(()=>c.service.recordMedicalResponse(c.nutri,{unitId:'uti-a',contactId:contact.id,respondedAt:'2026-11-10T15:00:00Z',responseNote:'Solicitação recebida',responseConfirmed:false,expectedRevision:1}),{code:'PRECONDITION'});
 assert.throws(()=>c.service.recordMedicalResponse(c.nutri,{unitId:'uti-a',contactId:contact.id,respondedAt:'2026-11-10T11:00:00Z',responseNote:'Retroativa',responseConfirmed:true,expectedRevision:1}),{code:'INVALID'});
 const answered=c.service.recordMedicalResponse(c.nutri,{unitId:'uti-a',contactId:contact.id,respondedAt:'2026-11-10T15:00:00Z',responseNote:'Aguardando avaliação presencial',responseConfirmed:true,expectedRevision:1});assert.equal(answered.status,'ANSWERED');
 assert.throws(()=>c.service.recordMedicalResponse(c.nutri,{unitId:'uti-a',contactId:contact.id,respondedAt:'2026-11-10T16:00:00Z',responseNote:'Dup',responseConfirmed:true,expectedRevision:1}),{code:'CONFLICT'});
 assert.equal(c.service.summary(c.nutri,{unitId:'uti-a'}).averageResponseHours,3);
});
scenario('histórico imutável, revisão otimista e encerramento não apagam registros',async c=>{
 const f=c.service.createFinding(c.nutri,base());const next=c.service.transitionFinding(c.nutri,{unitId:'uti-a',findingId:f.id,next:'FOLLOW_UP',reason:'Contato pendente',expectedRevision:1});
 assert.throws(()=>c.service.transitionFinding(c.nutri,{unitId:'uti-a',findingId:f.id,next:'CLOSED',reason:'Antigo',expectedRevision:1}),{code:'CONFLICT'});
 const done=c.service.transitionFinding(c.nutri,{unitId:'uti-a',findingId:f.id,next:'CLOSED',reason:'Resolvido fora da plataforma',expectedRevision:next.revision});assert.equal(done.closedAt!==null,true);
 const hist=c.service.readHistory(c.nutri,{unitId:'uti-a',kind:'nutrition_finding',id:f.id});assert.equal(hist.length,3);assert.equal(hist.at(-1).eventType,'nutritionAudit.closed');
 assert.throws(()=>c.db.db.prepare('UPDATE nutrition_history SET event_type=?').run('rewrite'),/immutable nutrition history/);
 assert.throws(()=>c.db.db.prepare('DELETE FROM nutrition_history').run(),/immutable nutrition history/);
 assert.throws(()=>c.service.transitionFinding(c.nutri,{unitId:'uti-a',findingId:f.id,next:'IDENTIFIED',reason:'Reabrir',expectedRevision:done.revision}),{code:'PRECONDITION'});
});
scenario('CSV minimizado, escapes contra fórmula e filtros',async c=>{
 const f=c.service.createFinding(c.nutri,{...base(),evidence:'=HYPERLINK("x")'});const csv=c.service.reportCsv(c.nutri,{unitId:'uti-a'});assert.ok(csv.includes(f.id));assert.ok(!csv.includes('=HYPERLINK'));assert.ok(!csv.includes('SYNTHETIC-PRESCRIPTION'));assert.ok(!csv.includes('adm-a'));
 assert.ok(!csv.includes('FAKE_ALLERGEN'));assert.ok(!csv.includes('EVIDÊNCIA'));
 const filtered=c.service.listFindings(c.nutri,{unitId:'uti-a',risk:'CRITICAL'});assert.equal(filtered.total,0);
});
scenario('eventos clínicos de leitura produzem alertas sem nova transação bloqueante',async c=>{
 c.db.appendEvent('om-a','admission','adm-a','dietReference.updated','unit',{referenceId:'rx-adm-a'});
 c.db.appendEvent('om-a','admission','adm-upi','dietReference.updated','other',{});
 c.db.appendEvent('om-b','admission','adm-b','dietReference.updated','other-om',{});
 const before=c.db.db.prepare('SELECT count(*) as n FROM hospital_events').get().n;
 const alerts=c.service.listAlerts(c.nutri,{unitId:'uti-a'});assert.equal(alerts.length,1);assert.equal(alerts[0].type,'dietReference.updated');
 assert.equal(c.db.db.prepare('SELECT count(*) as n FROM hospital_events').get().n,before);
});
scenario('handler HTTP valida método, role e token real via membership',async c=>{
 const handle=createNutritionAuditHandler({store:c.db,verifyToken:verifier});
 const args={authorization:'Bearer nutrition',organizationId:'om-a',operation:'finding.create',method:'POST',payload:base()};
 assert.equal((await handle({...args,method:'GET'})).status,400);
 assert.equal((await handle({...args,authorization:'Bearer missing'})).status,401);
 assert.equal((await handle({...args,authorization:'Bearer other'})).status,403);
 assert.equal((await handle({...args,organizationId:'om-b'})).status,403);
 const yes=await handle(args);assert.equal(yes.status,200);assert.equal(yes.body.ok,true);
 const list=await handle({method:'GET',authorization:'Bearer nutrition',organizationId:'om-a',operation:'finding.list',payload:{unitId:'uti-a'}});assert.equal(list.body.data.total,1);
});
