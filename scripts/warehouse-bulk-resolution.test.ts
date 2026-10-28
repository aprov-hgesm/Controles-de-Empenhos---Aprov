import assert from 'node:assert/strict';
import test from 'node:test';
import { generateBulkStockTemplate, parseBulkStockWorkbook } from '../lib/server/warehouseBulkStockWorkbook';
import { resolveBulkStockRows, bulkStockOperationId } from '../lib/warehouse/bulkStockResolve';
import type { WarehouseLocation } from '../lib/warehouse/location';

const depot='dep_'+'a'.repeat(32),other='dep_'+'b'.repeat(32);
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
  const resolved=resolveBulkStockRows(rows,depot,locations);
  assert.deepEqual(resolved.map(row=>row.errors),[[],[],[]]);
  assert.ok(resolved.every(row=>!('materialId' in row)&&!('candidates' in row)));
  const first=resolved[0].position,second=resolved[1].position,freezer=resolved[2].position;
  assert.equal(first?.kind,'SUBPOSITION');
  assert.equal(second?.kind,'SUBPOSITION');
  assert.equal(freezer?.kind,'LOCATION');
  if(first?.kind!=='SUBPOSITION'||second?.kind!=='SUBPOSITION'||freezer?.kind!=='LOCATION')
    throw new Error('STOCK_IMPORT_POSITION_UNEXPECTED');
  assert.equal(first.subpositionId,'sub_2');
  assert.equal(second.subpositionId,'sub_2');
  assert.equal(freezer.subpositionId,null);
  assert.equal(first.depotId,depot);
  assert.equal(resolved[1].quantity,172);
  assert.equal(resolved[2].expiresOn,'2027-05-06');
});

test('prévia de Entrada Avulsa nunca oferece cadastro já existente',()=>{
  const rows=parseBulkStockWorkbook(generateBulkStockTemplate([
    ['Feijão preto','172','Kg','2027-05-06','','Estante','12','2','',''],
  ]));
  const resolved=resolveBulkStockRows(rows,depot,locations);
  assert.equal(resolved[0].material,'Feijão preto');
  assert.equal(resolved[0].position?.kind,'SUBPOSITION');
  assert.deepEqual(resolved[0].errors,[]);
  assert.ok(!('materialId' in resolved[0]));
  assert.ok(!('candidates' in resolved[0]));
});

test('locais inativos ou de outro deposito não recebem materiais',()=>{
  const rows=parseBulkStockWorkbook(generateBulkStockTemplate([
    ['Feijão preto','172','Kg','2027-05-06','','Estante','12','2','',''],
  ]));
  const resolved=resolveBulkStockRows(rows,other,locations);
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
