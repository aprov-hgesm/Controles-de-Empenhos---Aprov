#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=process.cwd();
const source=path=>readFileSync(resolve(root,path),'utf8');
const applySource=source('lib/server/warehouseStructureLayoutApply.ts');
const collisionSource=source('lib/warehouse/layoutCollision.ts');
const collisionExports={};
runInNewContext(ts.transpileModule(collisionSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
}}).outputText,{
  exports:collisionExports,
  require:()=>{throw new Error('Unexpected helper import');},
});
const sequenceSource=source('lib/warehouse/locationCodeSequence.ts');
const sequenceExports={};
runInNewContext(ts.transpileModule(sequenceSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
}}).outputText,{
  exports:sequenceExports,
  require:()=>{throw new Error('Unexpected sequence helper import');},
});
const uiSource=source('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
const routeSource=source('app/api/central-depositos/operations/route.ts');
const panelSource=source('features/warehouse/components/WarehouseDepotsOperational.tsx');
const fixed=(prefix,letter)=>prefix+letter.repeat(32);
const depotId=fixed('dep_','a'),localId=fixed('loc_','b'),objId=fixed('obj_','c');
const access={uid:'operator',workspaceId:'ws-test',ug:'123456'};
const key=(group,id)=>'warehouse/ws-test/'+group+'/'+id;
const makeObject=(id,location=null,x=20,y=20)=>({
  id,kind:'SHELF',label:'EST-01 · Estante 01',
  x,y,width:140,height:60,rotation:0,layer:1,
  elevation:1,visualVariant:'solid',warehouseLocationId:location,
});
function input(overrides={}) {
  return {
    operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    name:'Croqui principal',depotId,logicalWidth:2000,logicalHeight:600,
    objects:[makeObject(objId)],baseLayoutId:null,expectedVersion:null,
    createLocals:[{
      objectId:objId,code:'EST-01',name:'Estante 01',
      description:null,sourceLocationId:null,subpositionCount:2,
    }],
    createSubpositions:[],editLocals:[],archiveLocationIds:[],archiveSubpositionIds:[],
    ...overrides,
  };
}
function createStore(){
  const docs=new Map();
  docs.set(key('depots',depotId),{
    workspaceId:access.workspaceId,ug:access.ug,code:'DEP-001',status:'active',
    name:'Principal',createdBy:'operator',updatedBy:'operator',
  });
  const rowsOf=(group)=>[...docs].filter(([k])=>k.startsWith('warehouse/ws-test/'+group+'/'))
    .map(([path,data])=>({path,data,updateTime:'2026-10-23T00:00:00.000Z'}));
  class WarehouseStoreError extends Error {
    constructor(message,status){super(message);this.status=status;}
  }
  const load=(module)=>{
    if(module==='node:crypto')return {createHash};
    if(module==='./sectorProvisioningAdmin')return {getGoogleAccessToken:async()=> 'token'};
    if(module==='./warehouseFirestoreTransaction')return {
      WarehouseStoreError,
      warehouseAdminListCollection:async(_t,_ws,kind)=>rowsOf(kind),
      warehouseAdminListByField:async(_t,_ws,kind,field,value)=>
        rowsOf(kind).filter(row=>row.data[field]===value),
      warehouseAdminTransaction:async(_t,paths,callback)=>{
        const rows=new Map(paths.map(path=>[path,docs.has(path)
          ?{path,data:{...docs.get(path)},updateTime:'2026-10-23T00:00:00.000Z'}:null]));
        const plan=callback(rows);
        assert.equal(new Set(plan.writes.map(row=>row.path)).size,plan.writes.length,
          'cada documento pode ser escrito uma única vez');
        for(const row of plan.writes)assert.ok(rows.has(row.path),'escrita fora do read set');
        for(const row of plan.writes)docs.set(row.path,{...row.data});
        return plan.result;
      },
    };
    if(module==='../warehouse/layoutCollision')return collisionExports;
    if(module==='../warehouse/locationCodeSequence')return sequenceExports;
    if(module==='../warehouse/location')return {
      WAREHOUSE_LOCATION_SCHEMA_VERSION:'warehouse_location_v1',
      normalizeWarehouseLogicalCode:value=>typeof value==='string'&&/^[A-Z0-9-]{1,32}$/.test(value)
        ?value:null,
      validateWarehouseLocation:x=>({ok:true,data:x}),
      validateWarehouseDepot:x=>({ok:true,data:x}),
      validateWarehouseLocationBalance:x=>({ok:true,data:x}),
    };
    if(module==='../warehouse/layout')return {
      validateWarehouseDepotLayout:x=>({
        ok:Array.isArray(x.objects)&&x.objects.length<=160&&x.logicalWidth>0,
        data:x,
      }),
    };
    if(module==='../warehouse/lot')return {validateWarehouseLot:x=>({ok:true,data:x})};
    if(module==='../warehouse/readCompatibility')return {
      warehouseCanonicalDepotReadInput:(_id,x)=>x,
      warehouseCanonicalLocationReadInput:(_id,x)=>x,
      warehouseCanonicalLocationBalanceReadInput:(_id,x)=>x,
      warehouseCanonicalLotReadInput:(_id,x)=>x,
    };
    throw new Error('unexpected module: '+module);
  };
  const js=ts.transpileModule(applySource,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const exp={};
  runInNewContext(js,{exports:exp,require:load,process:{env:{EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:'1'}},
    Date,console});
  return {apply:exp.warehouseStructureLayoutApplyServer,docs,rowsOf};
}

test('formulário único e operação autenticada substituem abas paralelas',()=>{
  assert.match(routeSource,/case 'STRUCTURE_LAYOUT_APPLY':/);
  assert.match(applySource,/warehouseAdminListByField\(authToken,ws,'layouts','depotId',depotId,500\)/);
  assert.match(applySource,/warehouseAdminListByField\(authToken,ws,'locations','depotId',depotId,500\)/);
  assert.match(routeSource,/verifyWarehouseRequest\(request\.headers\.get\('authorization'\)\)/);
  assert.match(panelSource,/<WarehouseCroquisR1Operational workspaceId=\{workspaceId\}/);
  assert.doesNotMatch(panelSource,/<WarehouseLocationsR1Operational workspaceId/);
  assert.match(uiSource,/data-testid="warehouse-croqui-primary-new-local"/);
  assert.match(uiSource,/data-testid="warehouse-croqui-create-subposition"/);
  assert.match(uiSource,/applyWarehouseCroquiStructure\(workspaceId/);
  assert.doesNotMatch(uiSource,/await createWarehouseLocation\(workspaceId/);
  assert.doesNotMatch(uiSource,/\b(?:setDoc|writeBatch|addDoc)\s*\(/);
});
test('um salvamento cria local, subposições e croqui no mesmo commit',async()=>{
  const store=createStore(),result=await store.apply(access,input());
  assert.equal(result.createdLocations.length,1);
  assert.equal(result.layout.version,1);
  assert.equal(result.layout.objects[0].warehouseLocationId,result.createdLocations[0].id);
  assert.equal(store.rowsOf('locations').length,3);
  assert.equal(store.rowsOf('layouts').length,1);
  assert.equal(store.rowsOf('structureCodeClaims').length,3);
  const subs=store.rowsOf('locations').filter(x=>x.data.kind==='SUBPOSITION');
  assert.deepEqual(subs.map(x=>x.data.code).sort(),['EST-01-01','EST-01-02']);
  assert.ok(subs.every(x=>x.data.parentLocationId===result.createdLocations[0].id));
});
test('repetir a mesma operação não gera códigos, subposições nem croquis extras',async()=>{
  const store=createStore(),request=input();
  const a=await store.apply(access,request),b=await store.apply(access,request);
  assert.equal(a.layout.id,b.layout.id);
  assert.equal(store.rowsOf('locations').length,3);
  assert.equal(store.rowsOf('layouts').length,1);
});
test('código repetido aborta sem alterar a versão anterior',async()=>{
  const store=createStore();const created=await store.apply(access,input());
  await assert.rejects(()=>store.apply(access,input({
    operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    objects:[...created.layout.objects,makeObject(fixed('obj_','d'))],
    baseLayoutId:created.layout.id,expectedVersion:1,
    createLocals:[{objectId:fixed('obj_','d'),code:'EST-01',name:'Repetido',
      description:null,sourceLocationId:null,subpositionCount:0}],
  })),/WAREHOUSE_CROQUI_DUPLICATE_CODE/);
  assert.equal(store.rowsOf('locations').length,3);
  assert.equal(store.rowsOf('layouts').length,1);
});
test('duplicação de estante clona os códigos filhos sem copiar estoque',async()=>{
  const store=createStore(),first=await store.apply(access,input());
  const cloneId=fixed('obj_','d');
  const second=await store.apply(access,input({
    operationId:'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    objects:[...first.layout.objects,makeObject(cloneId,null,220,20)],
    baseLayoutId:first.layout.id,expectedVersion:1,
    createLocals:[{objectId:cloneId,code:'EST-02',name:'Estante 02',
      description:null,sourceLocationId:first.createdLocations[0].id,subpositionCount:0}],
  }));
  assert.equal(second.layout.version,2);
  assert.equal(store.rowsOf('locations').length,6);
  assert.deepEqual(store.rowsOf('locations').filter(x=>x.data.code.startsWith('EST-02'))
    .map(x=>x.data.code).sort(),['EST-02','EST-02-01','EST-02-02']);
  assert.equal(store.rowsOf('locationBalances').length,0);
});
test('copia de estante com inclusao pelo menu cria subposicao extra no mesmo commit',async()=>{
  const store=createStore(),first=await store.apply(access,input());
  const cloneId=fixed('obj_','d');
  const second=await store.apply(access,input({
    operationId:'99999999-ffff-4999-8999-999999999999',
    objects:[...first.layout.objects,makeObject(cloneId,null,220,20)],
    baseLayoutId:first.layout.id,expectedVersion:1,
    createLocals:[{objectId:cloneId,code:'EST-02',name:'Estante 02',
      description:null,sourceLocationId:first.createdLocations[0].id,subpositionCount:1}],
  }));
  assert.equal(second.createdLocations.length,1);
  assert.deepEqual(store.rowsOf('locations').filter(x=>x.data.code.startsWith('EST-02'))
    .map(x=>x.data.code).sort(),['EST-02','EST-02-01','EST-02-02','EST-02-03']);
  assert.equal(store.rowsOf('locationBalances').length,0);
});

test('limite de 30 subposicoes copiadas e novas bloqueia todo o salvamento',async()=>{
  const store=createStore(),first=await store.apply(access,input());
  const cloneId=fixed('obj_','d');
  await assert.rejects(()=>store.apply(access,input({
    operationId:'88888888-ffff-4888-8888-888888888888',
    objects:[...first.layout.objects,makeObject(cloneId,null,220,20)],
    baseLayoutId:first.layout.id,expectedVersion:1,
    createLocals:[{objectId:cloneId,code:'EST-02',name:'Estante 02',
      description:null,sourceLocationId:first.createdLocations[0].id,subpositionCount:29}],
  })),/WAREHOUSE_CROQUI_TOO_MANY_SUBPOSITIONS/);
  assert.equal(store.rowsOf('locations').length,3);
  assert.equal(store.rowsOf('layouts').length,1);
});

test('servidor rejeita duplo local no mesmo espaço sem criar documentos extras',async()=>{
  const store=createStore(),first=await store.apply(access,input());
  const secondId=fixed('obj_','d');
  await assert.rejects(()=>store.apply(access,input({
    operationId:'99999999-9999-4999-9999-999999999999',
    baseLayoutId:first.layout.id,expectedVersion:1,
    objects:[...first.layout.objects,makeObject(secondId,null,40,20)],
    createLocals:[{objectId:secondId,code:'EST-02',name:'Estante 02',
      description:null,sourceLocationId:null,subpositionCount:0}],
  })),/WAREHOUSE_CROQUI_LOCATION_OVERLAP/);
  assert.equal(store.rowsOf('locations').length,3);
  assert.equal(store.rowsOf('layouts').length,1);
});

test('inativação com saldo bloqueia todo o commit e preserva layout e cadastro',async()=>{
  const store=createStore(),created=await store.apply(access,input());
  store.docs.set(key('locationBalances',fixed('lb_','e')),{
    workspaceId:access.workspaceId,ug:access.ug,quantity:5,
    position:{kind:'LOCATION',locationId:created.createdLocations[0].id},
  });
  await assert.rejects(()=>store.apply(access,input({
    operationId:'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    objects:[],baseLayoutId:created.layout.id,expectedVersion:1,
    createLocals:[],archiveLocationIds:[created.createdLocations[0].id],
  })),/WAREHOUSE_CROQUI_LOCATION_OCCUPIED/);
  assert.equal(store.rowsOf('layouts').length,1);
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===created.createdLocations[0].id)
    .data.status,'active');
});
test('versão desatualizada é recusada antes de criar novos locais',async()=>{
  const store=createStore();await store.apply(access,input());
  await assert.rejects(()=>store.apply(access,input({
    operationId:'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
  })),/WAREHOUSE_CROQUI_VERSION_CONFLICT/);
  assert.equal(store.rowsOf('layouts').length,1);
});
test('EST-02 liberada após inativação pode ser reutilizada com NOVO ID interno',async()=>{
  const store=createStore(),first=await store.apply(access,input());
  const archivedId=first.createdLocations[0].id;
  const removed=await store.apply(access,input({
    operationId:'12121212-1212-4121-8121-121212121212',
    baseLayoutId:first.layout.id,expectedVersion:1,objects:[],
    createLocals:[],archiveLocationIds:[archivedId],
  }));
  assert.equal(removed.layout.version,2);
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===archivedId).data.status,'inactive');
  const newer=await store.apply(access,input({
    operationId:'34343434-3434-4343-8343-343434343434',
    baseLayoutId:removed.layout.id,expectedVersion:2,
    createLocals:[{objectId:objId,code:'EST-01',name:'Estante 01 nova',
      description:null,sourceLocationId:null,subpositionCount:2}],
  }));
  const liveId=newer.createdLocations[0].id;
  assert.notEqual(liveId,archivedId);
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===archivedId).data.code,'EST-01');
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===archivedId).data.status,'inactive');
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===liveId).data.status,'active');
  const owner=store.rowsOf('structureCodeClaims').find(x=>x.data.code==='EST-01'&&x.data.entityKind==='LOCAL');
  assert.equal(owner.data.entityId,liveId);
  assert.equal(owner.data.previousEntityId,archivedId);
  assert.equal(store.rowsOf('locations').length,6);
});

test('EST-01 permanece reservado enquanto sua inativação está apenas pendente',async()=>{
  const store=createStore(),original=await store.apply(access,input());
  const oldId=original.createdLocations[0].id;
  const freshObject=fixed('obj_','d');
  await assert.rejects(()=>store.apply(access,input({
    operationId:'56565656-5656-4565-8565-565656565656',
    baseLayoutId:original.layout.id,expectedVersion:1,
    objects:[makeObject(freshObject,null,220,20)],
    archiveLocationIds:[oldId],
    createLocals:[{objectId:freshObject,code:'EST-01',name:'Estante substituta',
      description:null,sourceLocationId:null,subpositionCount:1}],
  })),/WAREHOUSE_CROQUI_DUPLICATE_CODE/);
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===oldId).data.status,'active');
  assert.equal(store.rowsOf('layouts').length,1);
  const saved=await store.apply(access,input({
    operationId:'68686868-6868-4686-8686-686868686868',
    baseLayoutId:original.layout.id,expectedVersion:1,
    objects:[makeObject(freshObject,null,220,20)],
    archiveLocationIds:[oldId],
    createLocals:[{objectId:freshObject,code:'EST-02',name:'Estante substituta',
      description:null,sourceLocationId:null,subpositionCount:1}],
  }));
  assert.equal(saved.createdLocations[0].code,'EST-02');
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===oldId).data.status,'inactive');
});

test('código visual ativo nunca pode ser sequestrado por um novo registro',async()=>{
  const store=createStore(),original=await store.apply(access,input());
  await assert.rejects(()=>store.apply(access,input({
    operationId:'78787878-7878-4787-8787-787878787878',
    baseLayoutId:original.layout.id,expectedVersion:1,
    objects:[...original.layout.objects,makeObject(fixed('obj_','d'),null,220,20)],
    createLocals:[{objectId:fixed('obj_','d'),code:'EST-01',
      name:'Estante indevida',description:null,sourceLocationId:null,subpositionCount:0}],
  })),/WAREHOUSE_CROQUI_DUPLICATE_CODE/);
  assert.equal(store.rowsOf('locations').filter(x=>x.data.kind==='LOCAL').length,1);
});

test('referências diferentes não podem compartilhar o mesmo código operacional',async()=>{
  const store=createStore(),original=await store.apply(access,input());
  const duplicateId=fixed('loc_','d'), secondObject=fixed('obj_','d');
  store.docs.set(key('locations',duplicateId),{
    ...original.createdLocations[0],id:duplicateId,code:'EST-01',
    name:'Estante duplicada legada',
  });
  await assert.rejects(()=>store.apply(access,input({
    operationId:'90909090-9090-4909-8909-909090909090',
    baseLayoutId:original.layout.id,expectedVersion:1,
    objects:[...original.layout.objects,
      {...makeObject(secondObject,duplicateId,220,20),
        label:'EST-01 · Estante duplicada legada'}],
    createLocals:[],
  })),/WAREHOUSE_CROQUI_DUPLICATE_CODE/);
  assert.equal(store.rowsOf('layouts').length,1);
});

test('subposição pode ser criada, renomeada e inativada em versões posteriores',async()=>{
  const store=createStore(),created=await store.apply(access,input());
  const parent=created.createdLocations[0].id;
  const child=store.rowsOf('locations').find(x=>x.data.code==='EST-01-01')?.data;
  const version=await store.apply(access,input({
    operationId:'ffffffff-ffff-4fff-ffff-ffffffffffff',
    objects:created.layout.objects,
    baseLayoutId:created.layout.id,expectedVersion:1,createLocals:[],
    createSubpositions:[{parentLocationId:parent,code:'EST-01-03',name:'Subposição 03',description:null}],
    editLocals:[{id:parent,name:'Estante reformada',description:null}],
    archiveSubpositionIds:[child.id],
  }));
  assert.equal(version.layout.version,2);
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===child.id).data.status,'inactive');
  assert.equal(store.rowsOf('locations').find(x=>x.data.id===parent).data.name,'Estante reformada');
  assert.equal(store.rowsOf('locations').filter(x=>x.data.code==='EST-01-03').length,1);
});


test('inativa mais de 12 locais legados vazios numa única transação',async()=>{
  const store=createStore();
  const ids=Array.from({length:13},(_,i)=>'loc_'+(i+1).toString(16).padStart(32,'0'));
  for(const [index,id] of ids.entries())store.docs.set(key('locations',id),{
    id,workspaceId:access.workspaceId,ug:access.ug,depotId,
    kind:'LOCAL',parentLocationId:null,code:'EST-'+String(index+1).padStart(2,'0'),
    name:'Legado '+(index+1),description:null,status:'active',createdBy:'operator',updatedBy:'operator',
  });
  const result=await store.apply(access,input({
    objects:[],createLocals:[],archiveLocationIds:ids,
  }));
  assert.equal(result.layout.version,1);
  assert.equal(result.archivedLocationIds.length,13);
  assert.ok(ids.every(id=>store.docs.get(key('locations',id)).status==='inactive'));
});

test('inativa mais de 20 subposições legadas sem barrar pelo antigo teto',async()=>{
  const store=createStore();
  const ids=Array.from({length:21},(_,i)=>'sub_'+(i+1).toString(16).padStart(32,'0'));
  for(const [index,id] of ids.entries())store.docs.set(key('locations',id),{
    id,workspaceId:access.workspaceId,ug:access.ug,depotId,
    kind:'SUBPOSITION',parentLocationId:localId,code:'EST-01-'+String(index+1).padStart(2,'0'),
    name:'Subposição legada '+(index+1),description:null,status:'active',
    createdBy:'operator',updatedBy:'operator',
  });
  const result=await store.apply(access,input({
    objects:[],createLocals:[],archiveSubpositionIds:ids,
  }));
  assert.equal(result.archivedLocationIds.length,21);
  assert.ok(ids.every(id=>store.docs.get(key('locations',id)).status==='inactive'));
});

test('inativação em lote com saldo bloqueia tudo mesmo acima do limite antigo',async()=>{
  const store=createStore();
  const ids=Array.from({length:13},(_,i)=>'loc_'+(i+1).toString(16).padStart(32,'0'));
  for(const [index,id] of ids.entries())store.docs.set(key('locations',id),{
    id,workspaceId:access.workspaceId,ug:access.ug,depotId,
    kind:'LOCAL',parentLocationId:null,code:'EST-'+String(index+1).padStart(2,'0'),
    name:'Legado '+(index+1),description:null,status:'active',
    createdBy:'operator',updatedBy:'operator',
  });
  store.docs.set(key('locationBalances',fixed('lb_','e')),{
    id:fixed('lb_','e'),workspaceId:access.workspaceId,ug:access.ug,quantity:1,
    position:{kind:'LOCATION',depotId,locationId:ids[12],subpositionId:null},
  });
  await assert.rejects(()=>store.apply(access,input({
    objects:[],createLocals:[],archiveLocationIds:ids,
  })),/WAREHOUSE_CROQUI_LOCATION_OCCUPIED/);
  assert.equal(store.rowsOf('layouts').length,0);
  assert.ok(ids.every(id=>store.docs.get(key('locations',id)).status==='active'));
});

test('o usuário pode inativar local sem desenho e descartar rascunho ao excluir depósito',()=>{
  assert.match(uiSource,/warehouse-croqui-archive-unmapped-legacy/);
  assert.match(uiSource,/setPendingRemovedLocationIds\(current=>/);
  assert.match(uiSource,/const discardNotice = hasUncommitted/);
  assert.match(uiSource,/rascunho será descartado/);
  assert.match(uiSource,/WAREHOUSE_CROQUI_CATALOG_LIMIT/);
});
