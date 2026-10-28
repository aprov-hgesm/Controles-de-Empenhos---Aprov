import assert from 'node:assert/strict';
import test from 'node:test';
import { generateBulkStockTemplate, parseBulkStockWorkbook } from '../lib/server/warehouseBulkStockWorkbook';
import { resolveBulkStockRows, bulkStockOperationId } from '../lib/warehouse/bulkStockResolve';
import type { WarehouseMaterial } from '../lib/warehouse/material';
import type { WarehouseLocation } from '../lib/warehouse/location';

const depot='dep_'+'a'.repeat(32),other='dep_'+'b'.repeat(32);
const id=(v:string)=>'mat_'+v.repeat(32);
function material(v:string,description:string):WarehouseMaterial{
  return {id:id(v),schemaVersion:'warehouse_material_v1',workspaceId:'test',ug:'160416',
    description,unit:{code:'kg',label:null},status:'active',conversions:[],aliases:[]};
}
const locations=[
  {id:'loc_12',kind:'LOCAL',depotId:depot,parentLocationId:null,status:'active',code:'EST-12',name:'Estante 12'},
  {id:'sub_2',kind:'SUBPOSITION',depotId:depot,parentLocationId:'loc_12',status:'active',code:'PRT-02',name:'Prateleira 02'},
  {id:'loc_frz',kind:'LOCAL',depotId:depot,parentLocationId:null,status:'active',code:'FRZ-01',name:'Freezer 01'},
  {id:'loc_other',kind:'LOCAL',depotId:other,parentLocationId:null,status:'active',code:'EST-12',name:'Estante 12'},
] as WarehouseLocation[];

test('importação completa identifica feijões diferentes na mesma prateleira e freezer sem subposição',()=>{
  const buffer=generateBulkStockTemplate([
    ['Feijão vermelho','330','Kg','2027-05-12','','Estante','12','2','',''],
    ['Feijão preto','172','Kg','2027-05-06','','Estante','12','2','',''],
    ['Peixe congelado','15','Kg','2027-05-06','','Freezer','1','—','',''],
  ]);
  const rows=parseBulkStockWorkbook(buffer);
  assert.equal(rows[2].subposition,null);
  const resolved=resolveBulkStockRows(rows,depot,[
    material('1','Feijão vermelho'),material('2','Feijão preto'),
    material('3','Peixe congelado'),
  ],locations);
  assert.deepEqual(resolved.map(row=>row.errors),[[],[],[]]);
  assert.deepEqual(resolved.map(row=>row.materialId),[id('1'),id('2'),id('3')]);
  assert.equal(resolved[0].position?.subpositionId,'sub_2');
  assert.equal(resolved[1].position?.subpositionId,'sub_2');
  assert.equal(resolved[2].position?.subpositionId,null);
  assert.equal(resolved[0].position?.depotId,depot);
  assert.equal(resolved[1].quantity,172);
  assert.equal(resolved[2].expiresOn,'2027-05-06');
});

test('cadastros realmente ambiguos exigem seleção, nunca vinculação arbitrária',()=>{
  const rows=parseBulkStockWorkbook(generateBulkStockTemplate([
    ['Feijão preto','172','Kg','2027-05-06','','Estante','12','2','',''],
  ]));
  const resolved=resolveBulkStockRows(rows,depot,[material('1','Feijão preto'),material('2','Feijão preto')],locations);
  assert.equal(resolved[0].materialId,null);
  assert.equal(resolved[0].candidates.length,2);
  assert.deepEqual(resolved[0].errors,['Selecione o cadastro do material na prévia']);
});

test('locais inativos ou de outro deposito não recebem materiais',()=>{
  const rows=parseBulkStockWorkbook(generateBulkStockTemplate([
    ['Feijão preto','172','Kg','2027-05-06','','Estante','12','2','',''],
  ]));
  const resolved=resolveBulkStockRows(rows,other,[material('1','Feijão preto')],locations);
  assert.ok(resolved[0].errors.includes('Subposição não cadastrada'));
});

test('ID de operação isola depósito, linha e arquivo; é estável em reenvios',()=>{
  const digest='a'.repeat(64),otherDigest='b'.repeat(64);
  const first=bulkStockOperationId(depot,digest,69);
  assert.equal(first,bulkStockOperationId(depot,digest,69));
  assert.notEqual(first,bulkStockOperationId(other,digest,69));
  assert.notEqual(first,bulkStockOperationId(depot,digest,70));
  assert.notEqual(first,bulkStockOperationId(depot,otherDigest,69));
  assert.ok(first.length<=96);
  assert.match(first,/^[A-Za-z0-9_-]{8,96}$/);
  assert.throws(()=>bulkStockOperationId('wrong',digest,69));
});
