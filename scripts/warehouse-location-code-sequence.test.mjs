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
const exports={};
runInNewContext(ts.transpileModule(read('lib/warehouse/locationCodeSequence.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports,require:()=>{throw new Error('Unexpected module');}});
const {warehouseNextAvailableLocationCode:next,warehouseCodeFromVisualLabel:fromLabel}=exports;
test('dez estantes: duplicar EST-03 gera EST-11 sem herdar numero 03',()=>{
  const used=new Set(Array.from({length:10},(_,i)=>'EST-'+String(i+1).padStart(2,'0')));
  assert.equal(next('EST-03',used),'EST-11');
  assert.equal(next('EST-10',used),'EST-11');
});
test('estante 02 inativada: o menor numero livre volta a ser EST-02',()=>{
  const active=new Set(Array.from({length:10},(_,i)=>'EST-'+String(i+1).padStart(2,'0'))
    .filter(code=>code!=='EST-02'));
  assert.equal(next('EST-03',active),'EST-02');
  active.add('EST-02');
  assert.equal(next('EST-03',active),'EST-11');
});
test('tipos independentes e padding preservado',()=>{
  assert.equal(next('PAL-03',new Set(['PAL-01','PAL-03'])),'PAL-02');
  assert.equal(next('GEL-02',new Set(['GEL-01','GEL-02'])),'GEL-03');
  assert.equal(next('EST-009',new Set(['EST-001','EST-002'])),'EST-003');
  assert.equal(fromLabel('EST-03 · Estante 03','EST-'),'EST-03');
  assert.equal(fromLabel('EST-03','EST-'),'EST-03');
});
test('a prévia 20x6 não produz texto Cópia fictícia e usa o mesmo gerador',()=>{
  const source=read('features/warehouse/components/WarehouseDepot20x6Demo.tsx');
  assert.doesNotMatch(source,/Cópia fictícia/);
  assert.match(source,/warehouseNextAvailableLocationCode\(sourceCode,used\)/);
  const real=read('features/warehouse/components/WarehouseCroquisR1Operational.tsx');
  assert.match(real,/warehouseNextAvailableLocationCode\(sourceCode,usedCroquiCodes\(\)\)/);
  assert.match(real,/!pendingRemovedLocationIds\.includes\(row\.location\.id\)/);
});
test('salvamento preserva ID histórico e transfere a reivindicação somente de dono inativo',()=>{
  const source=read('lib/server/warehouseStructureLayoutApply.ts');
  assert.match(source,/previous\.status==='active' && !archives\.has\(oldId\)/);
  assert.match(source,/previousEntityId:previousClaim\.data\.entityId/);
  assert.match(source,/WAREHOUSE_CROQUI_CODE_CLAIM_INVALID/);
  assert.match(source,/path\(ws,'locations',oldId\)/);
});
