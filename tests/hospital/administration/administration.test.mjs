import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {HospitalQAStore} from '../../../lib/server/hospital/core/qa-store.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {createHospitalAdministrationHandler} from '../../../lib/server/hospital/administration/handler.mjs';
import {HospitalAdministrationService} from '../../../lib/server/hospital/administration/service.mjs';

function fixture(filename=':memory:') {
  const store=new HospitalQAStore({filename,qa:true});
  for(const [id,ug] of [['A','160416'],['B','160999']]){
    store.seedOrganization({id,ug,name:'Hospital QA '+id,timezone:'America/Sao_Paulo',active:true});
    store.seedMembership({id:'adm_'+id,organizationId:id,ug,uid:'admin'+id,roles:['HOSPITAL_ADMIN'],unitIds:[],active:true});
  }
  store.seedMembership({id:'comercial',organizationId:'A',ug:'160416',uid:'comercial',roles:['UNIT'],unitIds:[],active:true});
  const verifyToken=async token=>({uid:token});
  const handler=createHospitalAdministrationHandler({store,verifyToken,userExists:async uid=>['colab','admin2','adminA'].includes(uid)});
  const req=(uid='adminA',org='A',operation='overview',payload={},method='GET')=>handler({authorization:'Bearer '+uid,organizationId:org,operation,payload,method});
  const unit=(code='UTI',name='Terapia Intensiva',org='A',uid='adminA',type='CARE')=>req(uid,org,'unit.save',{code,name,type,expectedRevision:0,active:true},'POST');
  return {store,req,unit,verifyToken};
}
const future=()=>new Date(Date.now()+4*86400e3).toISOString().slice(0,10);

test('isolamento entre hospitais e administrador comercial sem leitura clínica',async()=>{
  const {store,req,unit,verifyToken}=fixture();
  try {
    const other=await unit('UPI','Internação Hospital B','B','adminB');
    assert.equal(other.status,200);
    assert.equal((await req('adminA','B')).status,403);
    assert.equal((await req('comercial','A')).status,403);
    assert.equal((await req('adminA','A','unit.save',{id:other.body.data.id,code:'UPI',name:'Invasão',type:'CARE',expectedRevision:1},'POST')).status,404);
    const scope=await resolveHospitalScope({authorization:'Bearer adminA',organizationId:'A',store,verifyToken});
    assert.throws(()=>requireHospitalPermission(scope,'patient:read','uti'),{code:'FORBIDDEN'});
  } finally {store.close();}
});

test('unidades/leitos persistidos, unicidade e controle de revisão',async()=>{
  const {store,req,unit}=fixture();
  try {
    const first=await unit();assert.equal(first.status,200);const id=first.body.data.id;
    assert.equal((await unit('UTI','Outra')).status,409);
    assert.equal((await unit('UPI','terapia intensiva')).status,409);
    assert.equal((await req('adminA','A','bed.save',{unitId:id,label:'Leito 01',active:true,expectedRevision:0},'POST')).status,200);
    assert.equal((await req('adminA','A','bed.save',{unitId:id,label:'leito 01',active:true,expectedRevision:0},'POST')).status,409);
    assert.equal((await req('adminA','A','unit.save',{id,code:'UTI',name:'Unidade nova',type:'CARE',active:true,expectedRevision:0},'POST')).status,409);
    assert.equal((await req('adminA','A','unit.save',{id,code:'UTI',name:'Unidade nova',type:'KITCHEN',active:true,expectedRevision:1},'POST')).status,412);
    assert.equal((await req('adminA','A','units.list')).body.data[0].beds.length,1);
  } finally {store.close();}
});

test('UID Firebase verificado, unidade autorizada, sem convite fictício e sem self escalation',async()=>{
  const {store,req,unit}=fixture();
  try {
    const u=(await unit()).body.data;
    const k=(await unit('COZ','Cozinha','A','adminA','KITCHEN')).body.data;
    const payload={uid:'colab',unitIds:[u.id],roles:['UNIT'],active:true,expectedRevision:0};
    assert.equal((await req('adminA','A','membership.save',{...payload,uid:'inexistente'},'POST')).status,412);
    assert.equal((await req('adminA','A','membership.save',{...payload,uid:'adminA'},'POST')).status,403);
    assert.equal((await req('adminA','A','membership.save',{...payload,unitIds:[k.id]},'POST')).status,400);
    const created=await req('adminA','A','membership.save',payload,'POST');
    assert.equal(created.status,200);
    assert.equal(created.body.data.notification,'NOT_SENT');
    assert.equal(store.findMembership('A','colab').active,true);
    assert.equal((await req('colab','A','unit.save',{code:'FRAUDE',name:'Falha',type:'CARE',expectedRevision:0},'POST')).status,403);
    assert.equal((await req('adminA','A','membership.save',payload,'POST')).status,409);
    const modified=await req('adminA','A','membership.save',{...payload,expectedRevision:created.body.data.revision},'POST');
    assert.equal(modified.status,200);
  } finally {store.close();}
});

test('revogação bloqueia novo token e escopo antigo rechecado; último admin preservado',async()=>{
  const {store,req,unit,verifyToken}=fixture();
  try {
    const u=(await unit()).body.data;
    const created=await req('adminA','A','membership.save',{uid:'admin2',unitIds:[u.id],roles:['HOSPITAL_ADMIN'],active:true,expectedRevision:0},'POST');
    assert.equal(created.status,200);
    const scope=await resolveHospitalScope({authorization:'Bearer admin2',organizationId:'A',store,verifyToken});
    assert.equal((await req('adminA','A','membership.revoke',{uid:'admin2',expectedRevision:created.body.data.revision},'POST')).status,200);
    assert.equal((await req('admin2','A')).status,403);
    assert.throws(()=>new HospitalAdministrationService(store).overview(scope),{code:'FORBIDDEN'});
    assert.equal((await req('adminA','A','membership.revoke',{uid:'adminA',expectedRevision:0},'POST')).status,403);
  } finally {store.close();}
});

test('política recarregada do SQLite e snapshot fechado imutável',async()=>{
  const filename=join(tmpdir(),'hospital-w7-'+randomUUID()+'.sqlite');
  const {store,req,verifyToken}=fixture(filename);
  try {
    const policy=(await req('adminA','A','settings.read')).body.data;
    assert.deepEqual(policy.cycles.map(c=>c.mapDue),['06:00','10:00','16:00']);
    const snapshot=store.saveMapVersion('A','map_qa',1,'CLOSE',{map:{status:'CLOSED'},meals:[]},null,'unidadeQA');
    const edited={...policy,effectiveFrom:future(),cycles:policy.cycles.map((c,i)=>i===0?{...c,mapDue:'05:50',primaryTolerance:'06:20',notifyAt:'05:20'}:c)};
    const saved=await req('adminA','A','settings.save',{policy:edited,expectedRevision:0},'POST');
    assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(saved.body.data.activation,'PENDING_W9_W0_ENGINE_INTEGRATION');
    assert.equal((await req('adminA','A','settings.save',{policy:edited,expectedRevision:0},'POST')).status,409);
    assert.equal((await req('adminA','A','settings.save',{policy:{...edited,clinicalApprovalRequired:false},expectedRevision:1},'POST')).status,400);
    const second=new HospitalQAStore({filename,qa:true});
    try {
      const reread=createHospitalAdministrationHandler({store:second,verifyToken});
      const result=await reread({authorization:'Bearer adminA',organizationId:'A',operation:'settings.read'});
      assert.equal(result.body.data.cycles[0].mapDue,'05:50');
      assert.deepEqual(second.listMapVersions('A','map_qa')[0].snapshot,snapshot.snapshot);
      assert.equal(second.listMapVersions('A','map_qa').length,1);
      const audit=await reread({authorization:'Bearer adminA',organizationId:'A',operation:'audit.list'});
      assert.equal(audit.body.data[0].type,'hospitalPolicy.changed');
    } finally {second.close();}
  } finally {store.close();}
});

test('indicadores agregados e trilha isolados por organização',async()=>{
  const {store,req,unit}=fixture();
  try {
    await unit();
    assert.equal((await req('adminA','A','overview')).body.data.counts.unit,1);
    assert.equal((await req('adminB','B','overview')).body.data.counts.unit,0);
    assert.equal((await req('adminB','B','audit.list')).body.data.length,0);
    assert.equal((await req('adminB','B','members.list')).body.data.some(m=>m.uid==='adminA'),false);
  } finally {store.close();}
});

test('operações e claims forjados são recusados pelo handler',async()=>{
  const {store,req}=fixture();
  try {
    assert.equal((await req('adminA','A','unit.save',{},'GET')).status,400);
    assert.equal((await req('adminA','A','overview',{},'POST')).status,400);
    assert.equal((await req('intruso','A','overview',{roles:['HOSPITAL_ADMIN']})).status,403);
    assert.equal((await req('comercial','A','settings.save',{roles:['HOSPITAL_ADMIN']},'POST')).status,403);
  } finally {store.close();}
});
