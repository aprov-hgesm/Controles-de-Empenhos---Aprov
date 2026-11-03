#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=process.cwd();
const read=p=>readFileSync(resolve(root,p),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const shelf={};
runInNewContext(compile(read('lib/warehouse/subpositionCode.ts')),{exports:shelf});

const workspaceId='aprovisionamento-6-bda-inf-bld',ug='160413';
const depotId='dep_'+'a'.repeat(32),localId='loc_'+'b'.repeat(32),subId='sub_'+'c'.repeat(32);
const path=(domain,id)=>'warehouse/'+workspaceId+'/'+domain+'/'+id;
const idHash=s=>createHash('sha256').update(s).digest('hex');
const claim=code=>path('structureCodeClaims','claim_'+idHash(
  'LOCATION:SUBPOSITION:'+depotId+':'+localId+':'+code));
const access={workspaceId,ug,uid:'operator-6-bda',email:'operator@example.com',claimsUpdated:false};

function fakeStore(options={}){
  const docs=new Map();
  const dep={schemaVersion:'warehouse_depot_v1',id:depotId,workspaceId,ug,
    code:'DEP-001',name:'Gêneros Secos',description:null,
    visualType:'STANDARD',sizeProfile:'MEDIUM',status:'active',
    createdBy:'operator',updatedBy:'operator'};
  const parent={schemaVersion:'warehouse_location_v1',id:localId,workspaceId,ug,
    depotId,kind:'LOCAL',parentLocationId:null,code:'EST-01',name:'Estante 01',
    description:null,status:'active',createdBy:'operator',updatedBy:'operator'};
  const child={...parent,id:subId,kind:'SUBPOSITION',parentLocationId:localId,
    code:'EST-01-01',name:'Subposição 01'};
  docs.set(path('depots',depotId),dep);
  docs.set(path('locations',localId),parent);
  docs.set(path('locations',subId),child);
  docs.set(claim(child.code),{workspaceId,ug,entityId:subId,code:child.code,
    entityKind:'SUBPOSITION',depotId,parentLocationId:localId});
  docs.set(path('locationBalances','locbal_'+'d'.repeat(64)),{
    workspaceId,ug,quantity:7,position:{kind:'SUBPOSITION',depotId,locationId:localId,subpositionId:subId},
  });
  if(options.conflict){
    const occupied='sub_'+'e'.repeat(32);
    docs.set(path('locations',occupied),{...child,id:occupied,code:'PRAT-01'});
    docs.set(claim('PRAT-01'),{workspaceId,ug,entityId:occupied,code:'PRAT-01'});
  }
  class WarehouseStoreError extends Error{
    constructor(code,status){super(code);this.code=code;this.status=status;}
  }
  const transaction=async(_t,paths,fn)=>{
    const reads=new Map(paths.map(p=>[p,docs.has(p)
      ?{path:p,data:{...docs.get(p)},updateTime:'2026-11-03T00:00:00.000Z'}:null]));
    const plan=fn(reads);
    const once=new Set();
    for(const item of plan.writes){
      assert.ok(reads.has(item.path),'writes must be in the read set');
      assert.ok(!once.has(item.path),'writes must be unique');
      once.add(item.path);
      if(item.delete===true)docs.delete(item.path);
      else docs.set(item.path,{...item.data});
    }
    return plan.result;
  };
  const load=p=>{
    if(p==='node:crypto')return {createHash};
    if(p==='./sectorProvisioningAdmin')return {getGoogleAccessToken:async()=> 'token'};
    if(p==='./warehouseFirestoreTransaction')return {
      WarehouseStoreError,
      warehouseAdminListByField:async(_t,_ws,group,field,val)=>
        [...docs.entries()].filter(([key,row])=>key.startsWith(path(group,''))
          &&row[field]===val).map(([key,data])=>({path:key,data,updateTime:'2026-11-03T00:00:00.000Z'})),
      warehouseAdminTransaction:transaction,
    };
    if(p==='../warehouse/subpositionCode')return shelf;
    if(p==='../warehouse/location')return {
      validateWarehouseLocation:row=>({ok:true,data:row}),
      validateWarehouseDepot:row=>({ok:true,data:row}),
    };
    if(p==='../warehouse/readCompatibility')return {
      warehouseCanonicalDepotReadInput:(id,data)=>({id,...data}),
      warehouseCanonicalLocationReadInput:(id,data)=>({id,...data}),
    };
    throw new Error('unexpected import '+p);
  };
  const exported={};
  runInNewContext(compile(read('lib/server/warehouseShelfMigration.ts')),{exports:exported,
    require:load,process:{env:{EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:'1'}},
    Date,console});
  return {apply:exported.warehouseShelfMigrationServer,docs};
}

test('prévia é read-only e confirma uma prateleira legada',async()=>{
  const s=fakeStore(),before=s.docs.size;
  const p=await s.apply(access,{mode:'PREVIEW',depotId});
  assert.equal(p.candidateCount,1);
  assert.equal(p.conflicts,0);
  assert.equal(p.sample[0].after,'PRAT-01');
  assert.equal(s.docs.size,before);
  assert.equal(s.docs.get(path('locations',subId)).code,'EST-01-01');
});

test('aplica sem recadastro, preserva IDs, saldo, auditoria e reivindicação de código',async()=>{
  const s=fakeStore();
  const preview=await s.apply(access,{mode:'PREVIEW',depotId});
  const applied=await s.apply(access,{mode:'APPLY',depotId,
    planHash:preview.planHash,confirmDepotCode:'DEP-001'});
  assert.equal(applied.updated,1);
  assert.equal(s.docs.get(path('locations',subId)).id,subId);
  assert.equal(s.docs.get(path('locations',subId)).code,'PRAT-01');
  assert.equal(s.docs.get(path('locations',subId)).name,'Prateleira 01');
  assert.equal(s.docs.get(path('locationBalances','locbal_'+'d'.repeat(64))).quantity,7);
  assert.equal(s.docs.has(claim('EST-01-01')),false);
  assert.equal(s.docs.get(claim('PRAT-01')).entityId,subId);
  assert.equal(s.docs.get(path('structureMigrations',applied.auditId)).records.length,1);
  const after=await s.apply(access,{mode:'PREVIEW',depotId});
  assert.equal(after.candidateCount,0);
});

test('não aplica para escopo/UG incorretos, plano adulterado ou colisão',async()=>{
  const s=fakeStore();
  await assert.rejects(()=>s.apply({...access,ug:'000000'},{mode:'PREVIEW',depotId}),
    /WAREHOUSE_SHELF_PILOT_SCOPE/);
  const preview=await s.apply(access,{mode:'PREVIEW',depotId});
  await assert.rejects(()=>s.apply(access,{mode:'APPLY',depotId,
    planHash:'f'.repeat(64),confirmDepotCode:'DEP-001'}),/WAREHOUSE_SHELF_CONFIRMATION_REQUIRED/);
  assert.equal(s.docs.get(path('locations',subId)).code,'EST-01-01');
  const collision=fakeStore({conflict:true});
  const blocked=await collision.apply(access,{mode:'PREVIEW',depotId});
  assert.equal(blocked.conflicts,1);
  await assert.rejects(()=>collision.apply(access,{mode:'APPLY',depotId,
    planHash:blocked.planHash,confirmDepotCode:'DEP-001'}),/WAREHOUSE_SHELF_CONFIRMATION_REQUIRED/);
  assert.equal(collision.docs.get(path('locations',subId)).code,'EST-01-01');
});

test('origem do cadastro real continua única e não expõe operações públicas de migração',()=>{
  const route=read('app/api/central-depositos/operations/route.ts');
  const ui=read('features/warehouse/components/WarehouseLabelsR1.tsx');
  const croqui=read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  assert.match(route,/verifyWarehouseRequest\(request\.headers\.get\('authorization'\)\)/);
  assert.match(route,/case 'SHELF_MIGRATION'/);
  assert.match(route,/return reject\('WAREHOUSE_SHELF_MIGRATION_CLOSED',410\)/);
  assert.doesNotMatch(route,/import \{ warehouseShelfMigrationServer \}/);
  assert.doesNotMatch(ui,/warehouse-shelf-migration-bda|SHELF_MIGRATION|migrationPreview|migrationBusy/);
  assert.doesNotMatch(croqui,/onRefresh=\{reloadBase\}/);
  assert.doesNotMatch(croqui,/\b(?:updateDoc|writeBatch|setDoc)\s*\(/);
});
