#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nativeRequire=createRequire(import.meta.url);
const sharedCache=new Map();
function load(path,mocks={},scenarioCache=Object.keys(mocks).length?new Map():sharedCache){
  const name=resolve(root,path);
  if(scenarioCache.has(name))return scenarioCache.get(name);
  const code=ts.transpileModule(readFileSync(name,'utf8'),{fileName:name,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
  }}).outputText;
  const mod={exports:{}};
  // Registrar antes de carregar dependencias: um ciclo retorna exports parciais.
  scenarioCache.set(name,mod.exports);
  const importer=(id)=>{
    if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
    if(id.startsWith('.')){
      const local=resolve(dirname(name),id);
      if(local.endsWith('.json'))return nativeRequire(local);
      return load(local.slice(root.length+1)+(local.endsWith('.ts')?'':'.ts'),mocks,scenarioCache);
    }
    return nativeRequire(id);
  };
  new Function('require','module','exports','process','Buffer',code)(importer,mod,mod.exports,process,Buffer);
  return mod.exports;
}
const contracts=load('lib/emprovex-ai/contracts.ts');
const access={uid:'uid-1',workspaceId:'setor-a',ug:'160416',email:'a@example.com',googleToken:'stub'};
test('W3.0 — oito contratos fechados e nenhuma selecao arbitraria de dados',()=>{
  const valid=[
    ['supplier_contact_find',{nameQuery:'Fornecedor Alfa'}],
    ['commitment_get',{commitmentId:'2026NE0066'}],
    ['commitment_total_balance',{commitmentId:'2026NE0066'}],
    ['commitment_previous_open_list',{}],
    ['schedule_sent_history_list',{commitmentId:'2026NE0066'}],
    ['invoice_registration_period_list',{interval:{start:'2026-10-01',endExclusive:'2026-11-01'},dateMeaning:'registered'}],
    ['warehouse_stock_get',{materialQuery:'arroz'}],
    ['warehouse_material_locations_list',{materialId:'mat_'+'a'.repeat(32)}]
  ];
  for(const [intent,params] of valid)
    assert.equal(contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent,params}).intent,intent);
  assert.equal(Object.keys(contracts.CONTRACTS).length,8);
  for(const field of ['workspaceId','ug','collection','path','query'])
    assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'commitment_get',
      params:{commitmentId:'2026NE0066',[field]:'evil'}}));
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'invoice_delete',params:{}}));
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'commitment_get',
    params:{commitmentId:'2026NE0/../admin'}}));
});
test('W3 — datas relativas em America/Sao_Paulo',()=>{
  const period=load('lib/emprovex-ai/period.ts');
  const now=new Date('2026-10-31T02:30:00Z');
  assert.deepEqual(period.resolveRelativeAiPeriod('today',now),
    {start:'2026-10-30',endExclusive:'2026-10-31'});
  assert.equal(period.operationalMidnightUtc('2026-10-30'),'2026-10-30T03:00:00.000Z');
  assert.throws(()=>period.resolveAiPeriod({start:'2026-02-30',endExclusive:'2026-03-03'}));
});
test('W3 — cursor assinado e vinculado ao tenant e identidade',()=>{
  process.env.EMPROVEX_AI_CURSOR_SECRET='unit-test-secret-32-chars-minimum-01234';
  const cursor=load('lib/emprovex-ai/cursor.ts');
  const filters={pageSize:20};
  const token=cursor.makeAiCursor(access,'commitment_previous_open_list',filters,'row1');
  assert.equal(cursor.parseAiCursor(token,access,'commitment_previous_open_list',filters).id,'row1');
  assert.throws(()=>cursor.parseAiCursor(token,{...access,workspaceId:'setor-b'},
    'commitment_previous_open_list',filters));
  assert.throws(()=>cursor.parseAiCursor(token+'x',access,'commitment_previous_open_list',filters));
  delete process.env.EMPROVEX_AI_CURSOR_SECRET;
});
test('W3.1 — isolamento de identidade, UID, tipo e UG',()=>{
  const auth=load('lib/emprovex-ai/authorize.ts',{
    '../server/firebaseFounderAuth':{verifyFirebaseRequest:()=>{}},
    '../server/sectorProvisioningAdmin':{getGoogleAccessToken:()=>{}},
    '../hgesmWorkspace':{HGESM_SECTOR_EMAIL:'founder@example.com',HGESM_WORKSPACE_ID:'hgesm-aprov',HGESM_UG:'160416'},
    '../platformIdentity':{
      isFounderSignInProvider:()=>false,normalizePlatformEmail:x=>x,
      isValidWorkspaceId:x=>/^[a-z0-9-]{2,48}$/.test(x),isValidUnitUg:x=>/^\d{6}$/.test(x)
    },
    '../warehouse/featureFlag':{warehouseModuleEnabled:true},
    '../billingAccess':{decideBillingAccess:()=>({allowed:true})},
    '../billing':{billingCycleId:()=>'',paidServicePeriod:()=>null,
      billingCycleReferenceForPeriod:()=>'',renewalGraceDaysForAccount:()=>0,getReferenceMonth:()=>''},
    './reader':{coreDocument:()=>null}
  });
  const account={accountType:'sector',status:'active',email:'a@example.com',firebaseUid:'uid-1',
    workspaceId:'setor-a',ug:'160416',authProvider:'password'};
  const workspace={id:'setor-a',status:'active',ug:'160416',authorizedEmail:'a@example.com'};
  assert.deepEqual(auth.validateAiIdentity({uid:'uid-1',email:'a@example.com',account,workspace}),
    {workspaceId:'setor-a',ug:'160416'});
  for(const bad of [{...account,accountType:'platformAdmin'},
    {...account,status:'disabled'}, {...account,workspaceId:'setor-b'},
    {...account,firebaseUid:'uid-2'}])
    assert.throws(()=>auth.validateAiIdentity({uid:'uid-1',email:'a@example.com',
      account:bad,workspace}));
});
test('W3.3 — saldo operacional calculado, ressalva SIAFI',async()=>{
  const finance=load('lib/emprovex-ai/financial.ts',{
    './reader':{
      coreOperationalDocument:async()=>({id:'2026NE0066',data:{
        items:[{id:'i',quantity:10,received:4,unitPrice:2.5,unit:'kg',name:'Arroz'}]}}),
      coreOperationalQuery:async()=>({rows:[],truncated:false,examined:0}),
      coreDocument:async()=>null
    },
    '../../features/empenhos/domain/empenhoExercise':{getEmpenhoExerciseYear:()=>2026}
  });
  const result=await finance.executeFinancial(access,{intent:'commitment_total_balance',
    version:'emprovex.ai.query.v1',params:{commitmentId:'2026NE0066'}});
  assert.equal(result.data.operationalBalance,15);
  assert.equal(result.data.items[0].pendingQuantity,6);
  assert.match(result.limitations.join(' '),/SIAFI/);
});
test('W3.6 — saldo inexistente nao vira zero',async()=>{
  const warehouse=load('lib/emprovex-ai/warehouse.ts',{
    './reader':{
      warehouseDocument:async(_access,domain,id)=>domain==='materials'?{id,data:{
        workspaceId:'setor-a',ug:'160416',description:'Arroz',unit:{code:'kg'}}}:null,
      warehouseQuery:async()=>({rows:[],truncated:false,examined:0})
    },
    '../warehouse/barcode':{createWarehouseBarcodeId:async()=>''}
  });
  const result=await warehouse.executeWarehouse(access,{intent:'warehouse_stock_get',
    version:'emprovex.ai.query.v1',params:{materialId:'mat_'+'a'.repeat(32)}});
  assert.equal(result.status,'partial');
  assert.equal(result.data.quantity,null);
});
