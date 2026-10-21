import assert from 'node:assert/strict';
import {
  matchBulkStockLocal, matchBulkStockSubposition,
  type StockLocationRef,
} from '../lib/warehouse/bulkStockLocationMatcher';

// Reprodução isolada da nomenclatura no Controle de Depósitos:
// "Estante 01..10" com "Prateleira 01..04", "Freezer 01..02",
// "Palete 01..07" e "Geladeira 01". Sem Firestore de produção.
const depot='depot_001';
const other='depot_002';
const entries:StockLocationRef[]=[];
const make=(kind:'LOCAL'|'SUBPOSITION',type:string,prefix:string,number:number,
  parentLocationId:string|null=null,target=depot,status:'active'|'inactive'='active')=>{
  const digits=String(number).padStart(2,'0');
  const id=target+'/'+kind+'/'+prefix+'/'+digits+'/'+(parentLocationId||'');
  const value:StockLocationRef={
    id,kind,code:prefix+'-'+digits,name:type+' '+digits,
    depotId:target,parentLocationId,status,
  };
  entries.push(value);
  return value;
};
for(let n=1;n<=10;n++){
  const shelf=make('LOCAL','Estante','EST',n);
  for(let p=1;p<=4;p++)make('SUBPOSITION','Prateleira','PRT',p,shelf.id);
}
for(let n=1;n<=7;n++)make('LOCAL','Palete','PAL',n);
for(let n=1;n<=2;n++)make('LOCAL','Freezer','FRZ',n);
make('LOCAL','Geladeira','GEL',1);
assert.equal(entries.filter(item=>item.kind==='LOCAL').length,20);
assert.equal(entries.filter(item=>item.kind==='SUBPOSITION').length,40);

for(let n=1;n<=10;n++){
  const locals=matchBulkStockLocal(entries,depot,'Estante',String(n));
  assert.equal(locals.length,1,'Estante '+n);
  assert.equal(locals[0].name,'Estante '+String(n).padStart(2,'0'));
  for(let pos=1;pos<=4;pos++){
    const subs=matchBulkStockSubposition(entries,depot,locals[0].id,String(pos));
    assert.equal(subs.length,1,'Estante '+n+' / Prateleira '+pos);
    assert.equal(subs[0].name,'Prateleira '+String(pos).padStart(2,'0'));
  }
}
for(let n=1;n<=7;n++)
  assert.equal(matchBulkStockLocal(entries,depot,'Palete',String(n)).length,1);
for(let n=1;n<=2;n++)
  assert.equal(matchBulkStockLocal(entries,depot,'Freezer',String(n)).length,1);
assert.equal(matchBulkStockLocal(entries,depot,'Geladeira','1').length,1);
console.log('PASS: 20 locais e nomenclatura não padronizada de estantes, paletes, freezers e geladeira');
const shelf09=matchBulkStockLocal(entries,depot,'Estante','9')[0];
assert.equal(shelf09.code,'EST-09');
assert.equal(matchBulkStockSubposition(entries,depot,shelf09.id,'1')[0].code,'PRT-01');
assert.equal(matchBulkStockSubposition(entries,depot,shelf09.id,'Prateleira 01').length,1);
assert.equal(matchBulkStockSubposition(entries,depot,shelf09.id,'Subposição 1').length,1);
assert.equal(matchBulkStockLocal(entries,depot,'Estante','09').length,1);
assert.equal(matchBulkStockLocal(entries,depot,'EST','09').length,1);
assert.equal(matchBulkStockLocal(entries,depot,'Estante','19').length,0);
assert.equal(matchBulkStockLocal(entries,depot,'Freezer','9').length,0);
assert.equal(matchBulkStockSubposition(entries,depot,shelf09.id,'5').length,0);
console.log('PASS: Estante 9 = EST-09 e subposição 1 = PRT-01; sem aproximação numérica');

const oldShelf=make('LOCAL','Estante','EST',9,null,other);
assert.equal(matchBulkStockLocal(entries,depot,'Estante','9').length,1);
const isolated=matchBulkStockLocal(entries,other,'Estante','9');
assert.deepEqual(isolated.map(item=>item.id),[oldShelf.id]);
const inactive=make('LOCAL','Estante','EST',11,null,depot,'inactive');
assert.equal(matchBulkStockLocal(entries,depot,'Estante','11').length,0);
assert.equal(inactive.status,'inactive');
make('LOCAL','Estante','EST',9,null,depot);
assert.equal(matchBulkStockLocal(entries,depot,'Estante','9').length,2);
console.log('PASS: isolamento por depósito, bloqueio de locais inativos e ambiguidade explícita');
console.log('WAREHOUSE BULK LOCATION MATCH R1 PASS');
