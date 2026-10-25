#!/usr/bin/env node
/**
 * Contract tests anchored to public observable v2 behavior.
 * v3 contract cases are intentionally NOT assumed before Worker 1 publishes it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { atomicWarehouseWithdrawalHash } from '../lib/server/warehouseWithdrawalAtomicWrite';
import { createWarehouseMovementId } from '../lib/warehouse/movement';
import type { FinalizeWarehouseMaterialWithdrawalInput } from '../lib/warehouse/withdrawalRepository';

const request=():FinalizeWarehouseMaterialWithdrawalInput=>({
  withdrawalId:'wd_'+'a'.repeat(32),
  destinationId:'dest_'+'b'.repeat(32),
  withdrawnBy:'Operador W4',
  lines:[{
    lineId:'wline_'+'c'.repeat(32),materialId:'mat_'+'d'.repeat(32),
    materialDescription:'Material W4',
    requestedQuantity:2,baseQuantity:2,
    presentation:{code:'kg',label:'KG'},
    presentationLabel:'KG',unitLabel:'KG',
    position:{kind:'LOCATION',depotId:'dep_'+'e'.repeat(32),
      locationId:'loc_'+'f'.repeat(32),subpositionId:null},
    positionLabel:'D/L',barcodeAssociation:null,barcode:null,
    lotId:null,lotCode:null,
  }],
});

test('vetor v2 é estável entre serializações e execuções',()=>{
  const input=request();
  const canonical='dc55d383c233bf8aa569e1e683c91a52592faaf74c5d2536291bbbb43fb41169';
  assert.equal(atomicWarehouseWithdrawalHash(input),canonical);
  assert.equal(atomicWarehouseWithdrawalHash(JSON.parse(JSON.stringify(input))),canonical);
});

test('alterar quantidade com a mesma identidade não mantém a impressão v2',()=>{
  const input=request();
  assert.notEqual(atomicWarehouseWithdrawalHash(input),
    atomicWarehouseWithdrawalHash({...input,
      lines:[{...input.lines[0],requestedQuantity:3,baseQuantity:3}]}));
});

test('hash v2 continua considerando campos documentais legados',()=>{
  const input=request();
  assert.notEqual(atomicWarehouseWithdrawalHash(input),
    atomicWarehouseWithdrawalHash({...input,withdrawnBy:'Outro operador'}));
  assert.notEqual(atomicWarehouseWithdrawalHash(input),
    atomicWarehouseWithdrawalHash({...input,lines:[{
      ...input.lines[0],materialDescription:'Novo rótulo',
    }]}));
});

test('identidade derivada de movimento é estável e distingue comandos/linhas',async()=>{
  const workspace='hgesm-aprov';
  const key='material-withdrawal:'+request().withdrawalId+':'+request().lines[0].lineId;
  const first=await createWarehouseMovementId(workspace,key);
  const second=await createWarehouseMovementId(workspace,key);
  const foreign=await createWarehouseMovementId('outro-workspace',key);
  const distinct=await createWarehouseMovementId(workspace,key+'-outra-linha');
  assert.equal(first,second);
  assert.notEqual(first,foreign);
  assert.notEqual(first,distinct);
  assert.match(first,/^mov_[a-f0-9]{64}$/);
});
