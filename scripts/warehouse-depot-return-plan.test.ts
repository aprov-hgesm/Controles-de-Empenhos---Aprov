import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planDepotReturnToReceiving,DepotReturnPlanError,
  type DepotReturnBalance,type DepotReturnLot,
} from '../lib/warehouse/depotReturnToReceivingPlan';

const depot='dep_'+'a'.repeat(32);
const other='dep_'+'b'.repeat(32);
const beans='mat_'+'1'.repeat(32);
const rice='mat_'+'2'.repeat(32);
const loc='loc_'+'3'.repeat(32);
const sub='sub_'+'4'.repeat(32);
const position={kind:'SUBPOSITION' as const,depotId:depot,locationId:loc,subpositionId:sub};
const balance=(id='f',quantity=172,materialId=beans,at=position):DepotReturnBalance=>({
  id:'locbal_'+id.repeat(64),materialId,quantity,position:at,
});
const lot=(id='c',quantity=150,materialId=beans,at=position):DepotReturnLot=>({
  id:'lot_'+id.repeat(32),materialId,quantity,position:at,
  status:'active',code:'L-2026',expiresOn:'2027-10-20',
});
const code=(fn:()=>unknown,value:string)=>assert.throws(fn,(e:unknown)=>
  e instanceof DepotReturnPlanError&&e.code===value);

test('devolve todo o saldo mantendo lote e identidade para recebimento',()=>{
  const rows=planDepotReturnToReceiving(depot,[balance()],[lot()]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].materialId,beans);
  assert.equal(rows[0].quantity,172);
  assert.equal(rows[0].lotReferences.length,1);
  assert.equal(rows[0].lotReferences[0].quantity,150);
  assert.equal(rows[0].lotReferences[0].expiresOn,'2027-10-20');
});
test('não mistura saldos de depósitos nem de materiais',()=>{
  const elsewhere={kind:'SUBPOSITION' as const,depotId:other,locationId:loc,subpositionId:sub};
  const rows=planDepotReturnToReceiving(depot,[
    balance(),balance('e',99,rice),balance('d',10,beans,elsewhere)
  ],[lot()]);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>row.quantity).sort((a,b)=>a-b),[99,172]);
});
test('depósito vazio produz plano vazio, sem saldo inventado',()=>{
  assert.deepEqual(planDepotReturnToReceiving(depot,[balance('f',0)],[]),[]);
});
test('lote ativo com excesso quantitativo bloqueia a exclusão atômica',()=>{
  code(()=>planDepotReturnToReceiving(depot,[balance('f',10)],[lot('c',11)]),
    'WAREHOUSE_DEPOT_RETURN_LOT_EXCEEDS_STOCK');
});
test('lote positivo órfão de saldo não pode ser perdido',()=>{
  code(()=>planDepotReturnToReceiving(depot,[],[lot()]),
    'WAREHOUSE_DEPOT_RETURN_LOT_WITHOUT_STOCK');
});
test('um local legado ausente do croqui não elimina o saldo do plano',()=>{
  const missing={kind:'LOCATION' as const,depotId:depot,
    locationId:'loc_'+'9'.repeat(32),subpositionId:null};
  const rows=planDepotReturnToReceiving(depot,[balance('f',13,beans,missing)],[]);
  assert.equal(rows[0].quantity,13);
  assert.deepEqual(rows[0].sourcePosition,missing);
});
test('posição duplicada para mesmo material falha fechada',()=>{
  code(()=>planDepotReturnToReceiving(depot,[balance('f',10),balance('e',10)],[]),
    'WAREHOUSE_DEPOT_RETURN_DUPLICATE_POSITION');
});
