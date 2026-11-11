import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/service.mjs';

const localDate='2026-11-11';
let serial=0;
const seed=(db,o,u,kind,value)=>db.put(o,kind,u,{...value,id:value.id,organizationId:o,unitId:u});
async function setup(){
  const dir=mkdtempSync(join(tmpdir(),'emprovex-w4-'));const filename=join(dir,'hospital.sqlite');
  const db=new HospitalQAStore({filename,qa:true});
  for(const [o,ug] of [['om1','160416'],['om2','999999']])db.seedOrganization({id:o,ug,name:`Synthetic ${o}`,timezone:'America/Sao_Paulo',active:true});
  for(const [o,uid,role,units] of [['om1','cook','KITCHEN',['uti','upi']],['om1','cook2','KITCHEN',['uti','upi']],['om1','nutri','NUTRITION',['uti']],['om1','unit','UNIT',['uti']],['om1','admin','HOSPITAL_ADMIN',['uti']],['om2','outside','KITCHEN',['uti']]]){
    db.seedMembership({organizationId:o,ug:o==='om1'?'160416':'999999',id:`mem-${uid}`,uid,roles:[role],unitIds:units,active:true});
  }
  const scope=async(uid,o='om1')=>resolveHospitalScope({authorization:'Bearer fixture',organizationId:o,store:db,verifyToken:async()=>({uid})});
  const kitchen=await scope('cook');
  const service=new ProductionService(db);
  const mealIds=[];
  const createMeal=(n,{u='uti',mapId=`map-${u}`,diet='diet-low',type='PRIMARY',status='REQUESTED',advisory='ROUTINE',restrictions=['LACTOSE']}={})=>{
    const admissionId=`admission-${n}`, ref=`reference-${n}`, id=`meal-${n}`;
    seed(db,'om1',u,'admission',{id:admissionId,patientId:`patient-${n}`,bedId:null,medicalReferenceId:ref,status:'ACTIVE',fasting:false,allergyCodes:[]});
    seed(db,'om1',u,'medical_reference',{id:ref,admissionId,catalogItemId:diet,sourceRef:`synthetic-${n}`});
    const m=seed(db,'om1',u,'meal',{id,mapId,admissionId,localDate,cycleId:'10',mealType:type,dietCode:diet,dietRestrictionCodes:restrictions,medicalReferenceId:ref,status,requestedAt:'2026-11-11T12:30:00.000Z',effectiveAt:null,advisory});
    mealIds.push(id);return m;
  };
  seed(db,'om1','hospital_catalog','catalog_diet',{id:'diet-low',code:'LOW',label:'Dieta sintética',restrictionCodes:['LACTOSE'],active:true});
  seed(db,'om1','hospital_catalog','catalog_diet',{id:'diet-alt',code:'ALT',label:'Outro preparo',restrictionCodes:[],active:true});
  seed(db,'om1','uti','map',{id:'map-uti',localDate,cycleId:'10',status:'SUBMITTED',submittedAt:'2026-11-11T12:59:00Z',closedAt:null});
  seed(db,'om1','upi','map',{id:'map-upi',localDate,cycleId:'10',status:'CLOSED',submittedAt:'2026-11-11T12:58:00Z',closedAt:'2026-11-11T13:00:00Z'});
  return {db,dir,filename,scope,kitchen,service,createMeal,mealIds,close:()=>{db.close();rmSync(dir,{recursive:true,force:true});}};
}
function base(ctx,ids,extra={}){return {unitId:'uti',localDate,cycleId:'10',mealIds:ids,preparationLabel:'Arroz sem lactose',idempotencyKey:`key_${++serial}`,...extra};}
function getBatch(ctx,ids){return ctx.service.createBatch(ctx.kitchen,base(ctx,ids));}
function assertCode(code){return e=>{assert.equal(e.code,code);return true;};}

test('dois mapas recebidos simultaneamente; drafts excluídos e sem duplicidade',async()=>{const c=await setup();try{
  c.createMeal(1);c.createMeal(2,{u:'upi'});
  seed(c.db,'om1','uti','map',{id:'map-draft',localDate,cycleId:'10',status:'DRAFT',submittedAt:null,closedAt:null});
  c.createMeal(3,{mapId:'map-draft'});
  const v=c.service.snapshot(c.kitchen,{unitIds:['uti','upi'],localDate,cycleId:'10'});
  assert.equal(v.maps.length,2);assert.equal(v.meals.length,2);assert.equal(v.groups[0].total,2);assert.equal(v.counts.requested,2);
}finally{c.close();}});

test('dez pedidos compatíveis: lote persistente, iniciar e completar com eventos individualizados',async()=>{const c=await setup();try{
  for(let n=1;n<=10;n++)c.createMeal(n);
  const b=getBatch(c,c.mealIds);assert.equal(b.quantity,10);assert.equal(b.status,'PENDING');
  const started=c.service.startBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'start_10'});
  assert.equal(started.eligibleCount,10);assert.equal(started.status,'IN_PROGRESS');
  const completed=c.service.completeBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:started.revision,confirmedQuantity:10,idempotencyKey:'complete_10'});
  assert.equal(completed.status,'COMPLETE');assert.equal(completed.preparedQuantity,10);
  assert.equal(c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10'}).counts.ready,10);
  assert.equal(c.db.events('om1','meal','meal-1').filter(e=>e.eventType==='meal.production.completed').length,1);
  assert.equal(c.db.get('om1','meal','meal-10').status,'READY');
  assert.equal(c.db.get('om1','meal','meal-10').status==='DELIVERED',false);
}finally{c.close();}});

test('jejum durante preparo interrompe conclusão sem marcar READY; reconciliação exclui só pedido bloqueado',async()=>{const c=await setup();try{
  c.createMeal(1);c.createMeal(2);const b=getBatch(c,c.mealIds);
  const started=c.service.startBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'start_fast'});
  const meal=c.db.get('om1','meal','meal-1');const admission=c.db.get('om1','admission',meal.admissionId);
  c.db.transaction(db=>{db.put('om1','admission','uti',{...admission,fasting:true},admission.revision);db.put('om1','meal','uti',{...meal,status:'SAFETY_BLOCKED'},meal.revision);db.appendEvent('om1','meal',meal.id,'meal.suspended','unit',{reason:'FASTING'});});
  const v=c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10'});
  assert.equal(v.batches[0].effectiveStatus,'NEEDS_REVIEW');
  assert.throws(()=>c.service.completeBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:started.revision,confirmedQuantity:2,idempotencyKey:'end_fast'}),assertCode('PRECONDITION'));
  const fixed=c.service.reconcileBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:started.revision,excludedMealIds:['meal-1'],idempotencyKey:'recon_fast'});
  assert.deepEqual(fixed.mealIds,['meal-2']);assert.deepEqual(fixed.excludedMealIds,['meal-1']);
  const done=c.service.completeBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:fixed.revision,confirmedQuantity:1,idempotencyKey:'complete_fast'});
  assert.equal(done.status,'COMPLETE');assert.equal(c.db.get('om1','meal','meal-1').status,'SAFETY_BLOCKED');
}finally{c.close();}});

test('alergia incompatível bloqueia lote; troca da referência médica impede concluir',async()=>{const c=await setup();try{
  c.createMeal(1);let ad=c.db.get('om1','admission','admission-1');c.db.put('om1','admission','uti',{...ad,allergyCodes:['LACTOSE']},ad.revision);
  assert.throws(()=>getBatch(c,c.mealIds),assertCode('PRECONDITION'));
  ad=c.db.get('om1','admission','admission-1');c.db.put('om1','admission','uti',{...ad,allergyCodes:[]},ad.revision);
  const b=getBatch(c,c.mealIds);const started=c.service.startBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'start_diet'});
  ad=c.db.get('om1','admission','admission-1');c.db.put('om1','admission','uti',{...ad,medicalReferenceId:'updated-reference'},ad.revision);
  assert.throws(()=>c.service.completeBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:started.revision,confirmedQuantity:1,idempotencyKey:'complete_diet'}),assertCode('PRECONDITION'));
  assert.equal(c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10'}).batches[0].effectiveStatus,'NEEDS_REVIEW');
}finally{c.close();}});

test('pedido tardio e secundário seguem na fila com aviso, sem aceitação automática',async()=>{const c=await setup();try{
  c.createMeal(1,{type:'SECONDARY',advisory:'KITCHEN_REVIEW'});
  const v=c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10',lateOnly:true});
  assert.equal(v.counts.late,1);assert.equal(v.meals[0].mealType,'SECONDARY');assert.equal(v.batches.length,0);
  const b=getBatch(c,c.mealIds);assert.equal(b.status,'PENDING');assert.equal(c.db.get('om1','meal','meal-1').status,'REQUESTED');
}finally{c.close();}});

test('cancelamento de refeição em lote e exclusão de item seguro são barrados',async()=>{const c=await setup();try{
  c.createMeal(1);c.createMeal(2);const b=getBatch(c,c.mealIds);
  assert.throws(()=>c.service.reconcileBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,excludedMealIds:['meal-1'],idempotencyKey:'recon_unsafe'}),assertCode('PRECONDITION'));
  const m=c.db.get('om1','meal','meal-1');c.db.put('om1','meal','uti',{...m,status:'CANCELLED'},m.revision);
  assert.equal(c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10'}).batches[0].effectiveStatus,'NEEDS_REVIEW');
  const corrected=c.service.reconcileBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,excludedMealIds:['meal-1'],idempotencyKey:'recon_cancelled'});
  assert.equal(corrected.eligibleCount,1);
}finally{c.close();}});

test('idempotência da criação e concorrência de dois cozinheiros; mesmo pedido nunca em dois lotes',async()=>{const c=await setup();let second;try{
  c.createMeal(1);const args=base(c,c.mealIds,{idempotencyKey:'samekey'});const b=c.service.createBatch(c.kitchen,args);
  assert.deepEqual(c.service.createBatch(c.kitchen,args),b);
  assert.throws(()=>c.service.createBatch(c.kitchen,{...args,idempotencyKey:'anotherkey'}),assertCode('CONFLICT'));
  second=new HospitalQAStore({filename:c.filename,qa:true});const service2=new ProductionService(second);
  const kitchen2=await resolveHospitalScope({authorization:'Bearer fixture',organizationId:'om1',store:second,verifyToken:async()=>({uid:'cook2'})});
  const updated=c.service.startBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'onecook'});
  assert.equal(updated.status,'IN_PROGRESS');
  assert.throws(()=>service2.startBatch(kitchen2,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'twocook'}),assertCode('CONFLICT'));
  assert.equal(c.db.get('om1','meal','meal-1').revision,2);
}finally{second?.close();c.close();}});

test('pedido duplicado e mistura de dietas no lote recusados',async()=>{const c=await setup();try{
  c.createMeal(1);c.createMeal(2,{diet:'diet-alt',restrictions:[]});
  assert.throws(()=>c.service.createBatch(c.kitchen,base(c,['meal-1','meal-1'])),assertCode('CONFLICT'));
  assert.throws(()=>getBatch(c,c.mealIds),assertCode('PRECONDITION'));
}finally{c.close();}});

test('transferência confirmada não duplica contagem nem libera destino antigo',async()=>{const c=await setup();try{
  c.createMeal(1);const a=c.db.get('om1','admission','admission-1');c.db.transaction(db=>{const moved={...a,unitId:'upi',revision:a.revision+1};db.db.prepare('UPDATE records SET unit_id=?,revision=?,body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?').run('upi',moved.revision,JSON.stringify(moved),'om1','admission',a.id,a.revision);}); // W0 move pattern
  const v=c.service.snapshot(c.kitchen,{unitIds:['uti','upi'],localDate,cycleId:'10'});
  assert.equal(v.meals.length,1);assert.equal(v.groups.length,0);assert.equal(v.counts.blocked,1);
  assert.throws(()=>getBatch(c,c.mealIds),assertCode('PRECONDITION'));
}finally{c.close();}});

test('bloqueia OM diferente, unidade não vinculada, Nutrição e administrador da plataforma',async()=>{const c=await setup();try{
  c.createMeal(1);const outside=await c.scope('outside','om2');const nutrition=await c.scope('nutri');const admin=await c.scope('admin');const unit=await c.scope('unit');
  for(const s of [nutrition,admin,unit])assert.throws(()=>c.service.snapshot(s,{unitIds:['uti'],localDate,cycleId:'10'}),assertCode('FORBIDDEN'));
  assert.equal(c.service.snapshot(outside,{unitIds:['uti'],localDate,cycleId:'10'}).meals.length,0);
  assert.throws(()=>c.service.snapshot(c.kitchen,{unitIds:['unknown'],localDate,cycleId:'10'}),assertCode('FORBIDDEN'));
  assert.throws(()=>c.service.createBatch(outside,base(c,c.mealIds)),assertCode('NOT_FOUND'));
}finally{c.close();}});

test('desconexão/reconexão: segunda conexão lê lote persistido e progressão correta',async()=>{const c=await setup();let second;try{
  c.createMeal(1);const b=getBatch(c,c.mealIds);
  second=new HospitalQAStore({filename:c.filename,qa:true});const serverB=new ProductionService(second);
  const scopeB=await resolveHospitalScope({authorization:'Bearer synthetic',organizationId:'om1',store:second,verifyToken:async()=>({uid:'cook2'})});
  assert.equal(serverB.snapshot(scopeB,{unitIds:['uti'],localDate,cycleId:'10'}).batches[0].id,b.id);
  const started=serverB.startBatch(scopeB,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'reconnected'});
  assert.equal(c.service.snapshot(c.kitchen,{unitIds:['uti'],localDate,cycleId:'10'}).batches[0].status,started.status);
}finally{second?.close();c.close();}});

test('cancelar lote em preparo suspende pedidos e jamais simula entrega',async()=>{const c=await setup();try{
  c.createMeal(1);const b=getBatch(c,c.mealIds);
  const started=c.service.startBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:b.revision,idempotencyKey:'start_cancel'});
  const cancelled=c.service.cancelBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:started.revision,reason:'Falha operacional sintética',idempotencyKey:'cancel_batch'});
  assert.equal(cancelled.status,'CANCELLED');assert.equal(c.db.get('om1','meal','meal-1').status,'SUSPENDED');
  assert.ok(c.db.events('om1','production_batch',b.id).every(e=>!JSON.stringify(e).includes('patient-')));
  assert.throws(()=>c.service.completeBatch(c.kitchen,{unitId:'uti',batchId:b.id,expectedRevision:cancelled.revision,confirmedQuantity:1,idempotencyKey:'fail_end'}),assertCode('PRECONDITION'));
}finally{c.close();}});
