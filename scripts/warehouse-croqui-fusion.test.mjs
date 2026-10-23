#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const read=(path)=>readFileSync(resolve(process.cwd(),path),'utf8');
const croqui=read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
const route=read('app/api/central-depositos/operations/route.ts');
const archive=read('lib/server/warehouseLedgerAndArchive.ts');
const rules=read('firestore.warehouse.server-only.rules');
const selected=JSON.parse(read('firebase.json')).firestore
  .find(row=>row.database==='emprovex-warehouse');

test('a central unica cria locais e edita, inativa e imprime etiquetas sem a subaba antiga',()=>{
  assert.match(croqui,/data-testid="warehouse-croqui-primary-new-local"/);
  assert.match(croqui,/data-testid="warehouse-croqui-depot-settings"/);
  assert.match(croqui,/data-testid="warehouse-croqui-archive-depot"/);
  assert.match(croqui,/data-testid="warehouse-croqui-show-labels"/);
  assert.match(croqui,/<WarehouseLabelsR1/);
  assert.match(croqui,/<WarehouseDepotQuickCreate/);
  assert.doesNotMatch(croqui,/<WarehouseDepotRegistrationR1/);
  const entry=read('features/warehouse/components/WarehouseDepotsOperational.tsx');
  assert.match(entry,/<WarehouseCroquisR1Operational/);
  assert.doesNotMatch(entry,/<WarehouseLocationsR1Operational/);
});

test('cadastro de deposito e um comando simples, locais gravam no salvamento transacional',()=>{
  const form=read('features/warehouse/components/WarehouseDepotQuickCreate.tsx');
  assert.match(form,/createWarehouseDepot\(workspaceId/);
  assert.doesNotMatch(form,/(?:createWarehouseLocation|saveWarehouseDepotLayoutVersion)\(/);
  assert.match(croqui,/applyWarehouseCroquiStructure\(workspaceId/);
});

test('Croqui 2D nao consulta estrutura diretamente com SDK',()=>{
  assert.match(croqui,/readWarehouseCroquiCatalog\(workspaceId\)/);
  assert.match(croqui,/readWarehouseCroquiLayouts\(workspaceId,selectedDepotId\)/);
  assert.doesNotMatch(croqui,/listWarehouseDepots\(workspaceId/);
  assert.doesNotMatch(croqui,/getActiveWarehouseDepotLayout\(workspaceId/);
  assert.match(route,/case 'CROQUI_READ'/);
  assert.match(read('lib/warehouse/croquiReadRepository.ts'),/warehouseServerCommand<CroquiReadResult>/);
});

test('o Warehouse fica em Rules minimas, sem mutacoes via browser',()=>{
  assert.equal(selected.rules,'firestore.warehouse.server-only.rules');
  assert.match(rules,/allow get, list: if canReadWorkspace\(workspaceId\);/);
  assert.match(rules,/allow create, update, delete: if false;/);
  assert.match(rules,/emprovexWarehouseVersion == 'v1'/);
  assert.match(rules,/sectorLifecycleAllowsAccess\(workspaceId\)/);
  assert.doesNotMatch(rules,/allow (?:create|update|write|delete): if true/);
});

test('inativar deposito bloqueia saldos, lotes e layout concorrente no mesmo commit',()=>{
  for(const pattern of [
    /WAREHOUSE_ARCHIVE_OCCUPIED/,/WAREHOUSE_ARCHIVE_ACTIVE_LOT/,
    /warehouseAdminListByField\(authToken,ws,'layouts','depotId',archiveId,500\)/,
    /WAREHOUSE_ARCHIVE_INVALID_LAYOUT/,
    /status:'archived',updatedBy:access\.uid/,
    /status:'inactive',updatedBy:access\.uid/,
    /WAREHOUSE_ARCHIVE_CATALOG_LIMIT/,
  ])assert.match(archive,pattern);
});

test('acoes de deposito mostram erros junto ao comando sem depender do rodape',()=>{
  assert.match(croqui,/warehouse-croqui-operation-message/);
  assert.match(croqui,/role="alert" aria-live="polite"/);
  assert.match(croqui,/WAREHOUSE_ARCHIVE_OCCUPIED/);
  assert.match(croqui,/WAREHOUSE_ARCHIVE_ACTIVE_LOT/);
  assert.match(croqui,/Salve ou descarte as altera[cç][oõ]es/);
});

test('exclusao do deposito vazio preserva auditoria, bloqueia estoque e impede reativacao',()=>{
  const structure=read('lib/server/warehouseStructureWrite.ts');
  const quickCreate=read('features/warehouse/components/WarehouseDepotQuickCreate.tsx');
  const repository=read('lib/warehouse/locationRepository.ts');
  assert.match(croqui,/warehouse-croqui-delete-empty-depot/);
  assert.match(croqui,/mode: 'DELETE', confirmCode: selectedDepot.code/);
  assert.match(repository,/mode\?: 'DELETE'; confirmCode\?: string/);
  assert.match(archive,/WAREHOUSE_DEPOT_DELETE_INVALID_CONFIRMATION/);
  assert.match(archive,/depotDeletions/);
  assert.match(archive,/WAREHOUSE_ARCHIVE_OCCUPIED/);
  assert.match(archive,/WAREHOUSE_ARCHIVE_ACTIVE_LOT/);
  assert.match(structure,/WAREHOUSE_DEPOT_PERMANENTLY_DELETED/);
  assert.match(quickCreate,/row.depot.status === 'active'/);
});

const serverSource=read('lib/server/warehouseCroquiRead.ts');
const source=ts.transpileModule(serverSource,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;

function setup({invalid=false,otherWorkspace=false}={}) {
  let listCalls=[];
  class WarehouseStoreError extends Error {}
  const docs={
    depots:[{path:'warehouse/w1/depots/dep_'+ 'a'.repeat(32),data:{
      code:'DEP-001',status:'active',ug:'123456',name:'Principal',
    }}],
    locations:[{path:'warehouse/w1/locations/loc_'+ 'b'.repeat(32),data:{
      code:'EST-01',status:'active',ug:otherWorkspace?'999999':'123456',
    }}],
    layouts:[{path:'warehouse/w1/layouts/lay_'+ 'c'.repeat(32),data:{
      depotId:'dep_'+ 'a'.repeat(32),status:'active',version:1,ug:'123456',
    }}],
  };
  const result={exports:{}};
  const validate=(input,opt)=>({
    ok:!invalid&&input.ug===opt.expectedUg,
    data:input,
  });
  const mocks={
    './warehouseAccess':{},
    './sectorProvisioningAdmin':{getGoogleAccessToken:async()=> 'token'},
    './warehouseFirestoreTransaction':{
      warehouseAdminListCollection:async(_token,ws,kind,max)=>{
        listCalls.push({ws,kind,max});
        return docs[kind];
      },
      warehouseAdminListByField:async(_token,ws,kind,field,value)=>{
        listCalls.push({ws,kind,field,value});
        return docs.layouts.filter(x=>x.data.depotId===value);
      },
      WarehouseStoreError,
    },
    '../warehouse/readCompatibility':{
      warehouseCanonicalDepotReadInput:(_id,data)=>data,
      warehouseCanonicalLocationReadInput:(_id,data)=>data,
    },
    '../warehouse/location':{
      validateWarehouseDepot:validate,
      validateWarehouseLocation:validate,
    },
    '../warehouse/layout':{
      validateWarehouseDepotLayout:validate,
    },
  };
  runInNewContext(source,{
    exports:result.exports,
    process:{env:{EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:'1'}},
    require:(name)=>{
      if(!mocks[name])throw new Error('Unexpected import '+name);
      return mocks[name];
    },
  });
  return {read:result.exports.warehouseCroquiReadServer,listCalls};
}

test('servidor limita catalogo ao workspace e retorna documentos validados',async()=>{
  const {read,listCalls}=setup();
  const result=await read({workspaceId:'w1',ug:'123456'}, {kind:'CATALOG'});
  assert.equal(result.kind,'CATALOG');
  assert.equal(result.depots[0].depot.code,'DEP-001');
  assert.equal(result.locations[0].location.code,'EST-01');
  assert.deepEqual(listCalls.map(x=>x.kind),['depots','locations']);
  assert.ok(listCalls.every(x=>x.ws==='w1'));
});

test('servidor seleciona layout ativo e historico para somente um deposito',async()=>{
  const {read,listCalls}=setup();
  const depot='dep_'+ 'a'.repeat(32);
  const result=await read({workspaceId:'w1',ug:'123456'}, {kind:'LAYOUTS',depotId:depot});
  assert.equal(result.kind,'LAYOUTS');
  assert.equal(result.active.layout.status,'active');
  assert.equal(result.layouts.length,1);
  assert.equal(listCalls[0].value,depot);
});

test('leitura recusa query arbitraria e documento com UG diferente',async()=>{
  const {read}=setup();
  await assert.rejects(()=>read({workspaceId:'w1',ug:'123456'},{
    kind:'CATALOG',collection:'materials',
  }),/WAREHOUSE_CROQUI_READ_INVALID/);
  const other=setup({otherWorkspace:true});
  await assert.rejects(()=>other.read({workspaceId:'w1',ug:'123456'},{
    kind:'CATALOG',
  }),/WAREHOUSE_CROQUI_LOCATION_INVALID/);
});
