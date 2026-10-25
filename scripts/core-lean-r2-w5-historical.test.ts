import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeWarehouseLocationBarcode, decodeWarehouseLocationBarcode,
  encodeWarehouseCompactLocationBarcode, encodeWarehouseNumericLocationBarcode,
  isWarehouseLocationBarcode,
} from '../lib/warehouse/locationBarcode';
import { createWarehouseBarcodeId, normalizeWarehouseBarcode } from '../lib/warehouse/barcode';
import { isWarehouseWithdrawalId, isWarehouseWithdrawalLineId } from '../lib/warehouse/withdrawal';

test('historical EPX1 encodes physical technical ID, never recycled logical name',()=>{
  const old='loc_'+'a'.repeat(32);
  const next='loc_'+'b'.repeat(32);
  const a=encodeWarehouseLocationBarcode({kind:'LOCAL',entityId:old});
  const b=encodeWarehouseLocationBarcode({kind:'LOCAL',entityId:next});
  assert.notEqual(a,b);
  assert.equal(decodeWarehouseLocationBarcode(a).ok,true);
  const decoded=decodeWarehouseLocationBarcode(a);
  assert.equal(decoded.ok&&decoded.value.entityId,old);
  assert.equal(isWarehouseLocationBarcode(a),true);
  assert.equal(decodeWarehouseLocationBarcode(a.slice(0,-1)).ok,false);
});
test('legacy EPX2 remains distinguishable and cannot impersonate an EPX1',()=>{
  const a=encodeWarehouseCompactLocationBarcode({
    kind:'LOCAL',depotCode:'DEP-001',locationCode:'LOC-01'});
  const b=encodeWarehouseCompactLocationBarcode({
    kind:'LOCAL',depotCode:'DEP-002',locationCode:'LOC-01'});
  assert.ok(a.startsWith('EPX2L:'));
  assert.notEqual(a,b);
  assert.equal(isWarehouseLocationBarcode(a),true);
  assert.equal(decodeWarehouseLocationBarcode(a).ok,false);
});
test('13-digit numeric position labels retain their kind and code checks',()=>{
  const a=encodeWarehouseNumericLocationBarcode({
    kind:'LOCAL',depotCode:'DEP-001',locationCode:'LOC-01'});
  const b=encodeWarehouseNumericLocationBarcode({
    kind:'LOCAL',depotCode:'DEP-002',locationCode:'LOC-01'});
  assert.match(a,/^9812[0-9]{9}$/);
  assert.equal(a.length,13);
  assert.notEqual(a,b);
  assert.equal(isWarehouseLocationBarcode(a),true);
});
test('material barcodes are immutable workspace-scoped identities',async()=>{
  const workspaceA='w5-workspace-a',workspaceB='w5-workspace-b';
  const a=await createWarehouseBarcodeId(workspaceA,'9810000000001');
  assert.match(a,/^bar_[a-f0-9]{64}$/);
  assert.equal(a,await createWarehouseBarcodeId(workspaceA,'9810000000001'));
  assert.notEqual(a,await createWarehouseBarcodeId(workspaceA,'9810000000002'));
  assert.notEqual(a,await createWarehouseBarcodeId(workspaceB,'9810000000001'));
  assert.equal(normalizeWarehouseBarcode(' 9810000000001 '),'9810000000001');
});
test('withdrawal and line identifiers preserve exact historical namespaces',()=>{
  assert.equal(isWarehouseWithdrawalId('wd_'+'a'.repeat(32)),true);
  assert.equal(isWarehouseWithdrawalLineId('wline_'+'a'.repeat(32)),true);
  assert.equal(isWarehouseWithdrawalId('wline_'+'a'.repeat(32)),false);
  assert.equal(isWarehouseWithdrawalLineId('wd_'+'a'.repeat(32)),false);
});
