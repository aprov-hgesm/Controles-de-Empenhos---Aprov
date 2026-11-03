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
test('W3.0 — dez contratos fechados e nenhuma selecao arbitraria de dados',()=>{
  const valid=[
    ['supplier_contact_find',{nameQuery:'Fornecedor Alfa'}],
    ['commitment_get',{commitmentId:'2026NE0066'}],
    ['commitment_total_balance',{commitmentId:'2026NE0066'}],
    ['commitment_item_search',{materialQuery:'queijo'}],
    ['commitment_previous_open_list',{}],
    ['schedule_sent_history_list',{commitmentId:'2026NE0066'}],
    ['invoice_registration_period_list',{interval:{start:'2026-10-01',endExclusive:'2026-11-01'},dateMeaning:'registered'}],
    ['invoice_operational_pending_list',{stage:'pending_operational',pageSize:20}],
    ['warehouse_stock_get',{materialQuery:'arroz'}],
    ['warehouse_material_locations_list',{materialId:'mat_'+'a'.repeat(32)}]
  ];
  for(const [intent,params] of valid)
    assert.equal(contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent,params}).intent,intent);
  assert.equal(Object.keys(contracts.CONTRACTS).length,10);
  for(const field of ['workspaceId','ug','collection','path','query'])
    assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'commitment_get',
      params:{commitmentId:'2026NE0066',[field]:'evil'}}));
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'invoice_delete',params:{}}));
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',intent:'commitment_get',
    params:{commitmentId:'2026NE0/../admin'}}));
});
test('W3 — pending NFs use only operational stages and never infer unpaid status',async()=>{
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',
    intent:'invoice_operational_pending_list',params:{stage:'pending_payment'}}));
  assert.throws(()=>contracts.parseAiQuery({version:'emprovex.ai.query.v1',
    intent:'invoice_operational_pending_list',params:{stage:'pending_operational',workspaceId:'other'}}));
  const finance=load('lib/emprovex-ai/financial.ts',{
    './reader':{
      coreOperationalQuery:async(scoped,domain,filters,limit)=>{
        assert.equal(scoped.workspaceId,'setor-a');assert.equal(domain,'invoices');
        assert.equal(filters.length,0);assert.equal(limit,201);
        return {rows:[
          {id:'nf-A',data:{id:'101',localizacaoAtual:'APROVISIONAMENTO',empenhoId:'2026NE0066'}},
          {id:'nf-B',data:{id:'102',localizacaoAtual:'COMISSAO'}},
          {id:'nf-C',data:{id:'103',localizacaoAtual:'TESOURARIA'}},
        ],truncated:false,examined:3};
      }
    }
  });
  const result=await finance.executeFinancial(access,{intent:'invoice_operational_pending_list',
    version:'emprovex.ai.query.v1',params:{stage:'pending_operational',pageSize:20}});
  assert.equal(result.status,'ok');
  assert.deepEqual(result.data.map(x=>x.recordKey),['nf-A','nf-B']);
  assert.equal(result.evidence.length,2);
  assert.match(result.limitations.join(' '),/não comprova pagamento pendente/);
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

test('W3.1.8 — arroz resolves longer authorized material descriptions; never returns a fake zero',async()=>{
 const id1='mat_'+'a'.repeat(32),id2='mat_'+'b'.repeat(32);
 const warehouse=load('lib/emprovex-ai/warehouse.ts',{
   './reader':{
     warehouseQuery:async()=>({rows:[],truncated:false,examined:0}),
     warehouseMaterialNameSearch:async(_access,name)=>{
       assert.equal(name,'arroz');
       return {rows:[
         {id:id1,data:{workspaceId:'setor-a',ug:'160416',
           description:'ARROZ PARBOILIZADO TIPO 1',unit:'kg'}},
         {id:id2,data:{workspaceId:'setor-a',ug:'160416',
           description:'ARROZ BRANCO TIPO 1',unit:'kg'}}
       ],examined:25,truncated:false};
     },
     warehouseDocument:async()=>{throw Error('Cannot choose an ambiguous material');}
   },
   '../warehouse/barcode':{createWarehouseBarcodeId:async()=>''}
 });
 const result=await warehouse.executeWarehouse(access,{version:'emprovex.ai.query.v1',
   intent:'warehouse_material_locations_list',params:{materialQuery:'arroz'}});
 assert.equal(result.status,'ambiguous');
 assert.equal(result.coverage,'complete');
 assert.equal(result.data.candidates.length,2);
 assert.equal(result.data.candidates[0].materialId,id1);
 assert.equal(result.data.candidates[1].description,'ARROZ BRANCO TIPO 1');
 assert.equal(result.examinedDocuments,25);
});
test('W3.1.8 — incomplete catalog with a candidate cannot imply uniqueness or zero',async()=>{
 const id1='mat_'+'a'.repeat(32);
 const warehouse=load('lib/emprovex-ai/warehouse.ts',{
   './reader':{
     warehouseQuery:async()=>({rows:[],truncated:false,examined:0}),
     warehouseMaterialNameSearch:async()=>({rows:[{id:id1,data:{workspaceId:'setor-a',
       ug:'160416',description:'ARROZ PARBOILIZADO',unit:'kg'}}],examined:1200,truncated:true}),
     warehouseDocument:async()=>{throw Error('Should not assume a unique product in a partial scan');}
   },
   '../warehouse/barcode':{createWarehouseBarcodeId:async()=>''}
 });
 const result=await warehouse.executeWarehouse(access,{version:'emprovex.ai.query.v1',
   intent:'warehouse_material_locations_list',params:{materialQuery:'arroz'}});
 assert.equal(result.status,'partial');
 assert.equal(result.coverage,'incomplete');
 assert.equal(result.data.candidates.length,1);
 assert.equal(result.truncated,true);
 assert.match(result.limitations.join(' '),/parcial/i);
});
