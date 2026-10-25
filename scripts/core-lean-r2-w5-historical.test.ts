import test from 'node:test';
import {createHash} from 'node:crypto';
import {createWarehouseMovementId} from '../lib/warehouse/movement';
import {warehouseCanonicalLotReadInput} from '../lib/warehouse/readCompatibility';
import {validateWarehouseLot} from '../lib/warehouse/lot';
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

test('historical movement and consumption identities remain deterministic and scoped',async()=>{
  const wsA='hgesm-aprov',wsB='hgesm-outro',wd='wd_'+'a'.repeat(32);
  const line='wline_'+'b'.repeat(32);
  const intent='material-withdrawal:'+wd+':'+line;
  const movement=await createWarehouseMovementId(wsA,intent);
  assert.match(movement,/^mov_[a-f0-9]{64}$/);
  assert.equal(movement,await createWarehouseMovementId(wsA,intent));
  assert.notEqual(movement,await createWarehouseMovementId(wsB,intent));
  assert.notEqual(movement,await createWarehouseMovementId(wsA,intent+'-changed'));
  const consumption='cons_'+createHash('sha256').update(
    wsA+'\n'+'stock:'+wd+':'+line).digest('hex');
  assert.match(consumption,/^cons_[a-f0-9]{64}$/);
  assert.notEqual(consumption,'cons_'+createHash('sha256').update(
    wsB+'\n'+'stock:'+wd+':'+line).digest('hex'));
});
test('legacy validity read canonicalizer preserves NF document reference and physical identity',()=>{
  const id='lot_'+'c'.repeat(32),materialId='mat_'+'d'.repeat(32);
  const position={kind:'LOCATION',depotId:'dep_'+'e'.repeat(32),
    locationId:'loc_'+'f'.repeat(32),subpositionId:null};
  const raw={
    schemaVersion:'warehouse_lot_v1',workspaceId:'hgesm-aprov',ug:'160416',
    materialId,code:'REF2026',expiresOn:'2027-01-09',quantity:7,position,
    origin:{kind:'INVOICE',movementId:null,invoiceRecordKey:'legacy_nf_0001',
      invoiceId:'invoice-historical',supplier:'Fornecedor de teste',
      supplierCnpj:'12345678000195'},status:'active',
    createdBy:'uid-historic',updatedBy:'uid-historic',
    createdAt:'2025-01-01T00:00:00Z',
  };
  const normalized=warehouseCanonicalLotReadInput(id,raw);
  assert.equal(normalized.id,id);
  assert.deepEqual(normalized.position,position);
  assert.equal((normalized.origin as {invoiceRecordKey:string}).invoiceRecordKey,
    'legacy_nf_0001');
  assert.equal((normalized.origin as {invoiceId:string}).invoiceId,
    'invoice-historical');
  const parsed=validateWarehouseLot(normalized,{expectedWorkspaceId:'hgesm-aprov',
    expectedUg:'160416',expectedMaterialId:materialId});
  assert.equal(parsed.ok,true);
  const missing=warehouseCanonicalLotReadInput(id,{...raw,origin:{
    ...(raw.origin),invoiceRecordKey:null}});
  assert.notDeepEqual(missing.origin,normalized.origin);
});
