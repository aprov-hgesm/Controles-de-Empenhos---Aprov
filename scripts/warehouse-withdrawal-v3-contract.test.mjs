#!/usr/bin/env node
/** Testes de comportamento do contrato v3, sem escrita no Firestore. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  warehouseWithdrawalV3IntentHash as hash,
  warehouseWithdrawalV3DerivedLineId as lineId,
} from '../lib/server/warehouseWithdrawalV3Identity.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=mkdtempSync(resolve(tmpdir(),'warehouse-v3-contract-'));
try {
  execFileSync(process.execPath,[
    resolve(root,'node_modules/typescript/bin/tsc'),
    resolve(root,'lib/warehouse/withdrawalV3.ts'),
    '--outDir',dir,'--module','commonjs','--target','ES2020',
    '--moduleResolution','node','--skipLibCheck','--esModuleInterop',
  ],{cwd:root,stdio:'pipe'});
} catch(error) {
  // Preserve diagnostic details instead of masking TypeScript compilation errors.
  if(error?.stdout)process.stderr.write(String(error.stdout));
  if(error?.stderr)process.stderr.write(String(error.stderr));
  rmSync(dir,{recursive:true,force:true});
  throw error;
}
const require=createRequire(import.meta.url);
const {parseWarehouseWithdrawalV3:parse,WAREHOUSE_WITHDRAWAL_COMMAND_V3:version}
  =require(resolve(dir,'warehouse/withdrawalV3.js'));
test.after(()=>rmSync(dir,{recursive:true,force:true}));

const withdrawalId='wd_'+'1'.repeat(32);
const destinationId='dest_'+'2'.repeat(32);
const materialId='mat_'+'3'.repeat(32);
const position={
  kind:'LOCATION',depotId:'dep_'+'4'.repeat(32),
  locationId:'loc_'+'5'.repeat(32),subpositionId:null,
};
const body=(lines=[{materialId,position,requestedQuantity:2}])=>({
  schemaVersion:version,withdrawalId,destinationId,lines,
});

test('v3 aceita apenas intenção operacional mínima e normaliza quantidade',()=>{
  const parsed=parse(body([{materialId,position,requestedQuantity:2.5}]));
  assert.equal(parsed.lines[0].requestedQuantity,2.5);
  assert.deepEqual(Object.keys(parsed.lines[0]),['materialId','position','requestedQuantity']);
  assert.equal(parsed.schemaVersion,'warehouse_withdrawal_command_v3');
});
test('v3 não aceita saldo, operador, tenant ou detalhes técnicos injetados',()=>{
  for(const field of ['workspaceId','ug','withdrawnBy','balance','baseQuantity']) {
    assert.throws(()=>parse({...body(),[field]:'forged'}),/WAREHOUSE_WITHDRAWAL_V3_INPUT_INVALID/);
  }
  for(const field of ['lotId','lineId','baseQuantity','materialDescription','positionLabel']) {
    assert.throws(()=>parse(body([{materialId,position,requestedQuantity:2,[field]:'forged'}])),
      /WAREHOUSE_WITHDRAWAL_V3_LINE_INVALID/);
  }
});
test('v3 rejeita quantidade inválida, identidade irregular e posição falsa',()=>{
  assert.throws(()=>parse(body([{materialId,position,requestedQuantity:-1}])));
  assert.throws(()=>parse(body([{materialId,position,requestedQuantity:Infinity}])));
  assert.throws(()=>parse({...body(),withdrawalId:'wd_fake'}));
  assert.throws(()=>parse(body([{materialId,position:{kind:'UNASSIGNED'},requestedQuantity:1}])));
  assert.throws(()=>parse(body([{materialId,position,requestedQuantity:1,barcodeId:'bar_wrong'}])));
});
test('identidade das partes não colide entre linhas iguais nem ao repetir o comando',()=>{
  const a=lineId(withdrawalId,0,0),b=lineId(withdrawalId,1,0),c=lineId(withdrawalId,0,1);
  assert.match(a,/^wline_[a-f0-9]{32}$/);
  assert.equal(a,lineId(withdrawalId,0,0));
  assert.equal(new Set([a,b,c]).size,3);
  assert.notEqual(a,lineId('wd_'+'f'.repeat(32),0,0));
});
test('hash v3 usa intenção e versão, não dados documentais mutáveis',()=>{
  const first=parse(body());
  const second=parse(body());
  assert.equal(hash(first),hash(second));
  assert.match(hash(first),/^[a-f0-9]{64}$/);
  assert.notEqual(hash(first),hash(parse({...first,destinationId:'dest_'+'a'.repeat(32)})));
  assert.notEqual(hash(first),hash(parse(body([{materialId,position,requestedQuantity:3}]))));
  assert.notEqual(hash(first),hash(parse(body([
    {materialId,position,requestedQuantity:2},
    {materialId,position,requestedQuantity:2},
  ]))));
  // Descrições/nomes são deliberadamente ausentes do contrato normalizado.
  assert.equal(JSON.stringify(first).includes('materialDescription'),false);
});
