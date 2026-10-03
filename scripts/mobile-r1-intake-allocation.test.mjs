#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-intake-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    '--outDir',
    outDir,
    '--rootDir',
    resolve(root, 'lib'),
    '--module',
    'commonjs',
    '--target',
    'ES2020',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const mobile = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test('classificador separa barcode comercial de identidade física EPX1', () => {
  assert.equal(
    mobile.classifyWarehouseMobileProductScan('7891234567890'),
    'PRODUCT'
  );

  const locationCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: 'loc_' + '1'.repeat(32),
  });
  assert.equal(
    mobile.classifyWarehouseMobileProductScan(locationCode),
    'LOCATION'
  );
  assert.equal(
    mobile.classifyWarehouseMobileProductScan('ABC\n123'),
    'UNKNOWN'
  );
});

test('quantidade aceita parcial e total, mas recusa zero, negativa e excesso', () => {
  assert.equal(
    mobile.normalizeWarehouseMobileAllocationQuantity('5', 10),
    5
  );
  assert.equal(
    mobile.normalizeWarehouseMobileAllocationQuantity(10, 10),
    10
  );
  assert.equal(
    mobile.normalizeWarehouseMobileAllocationQuantity(0, 10),
    null
  );
  assert.equal(
    mobile.normalizeWarehouseMobileAllocationQuantity(-1, 10),
    null
  );
  assert.equal(
    mobile.normalizeWarehouseMobileAllocationQuantity(10.01, 10),
    null
  );
});

test('barcode desconhecido pode seguir para associação explícita, conflito não', () => {
  const materialId = 'mat_' + 'a'.repeat(32);
  assert.equal(
    mobile.warehouseMobileBarcodeDisposition(null, materialId),
    'UNKNOWN'
  );
  assert.equal(
    mobile.warehouseMobileBarcodeDisposition({
      materialId,
      status: 'active',
    }, materialId),
    'MATCH'
  );
  assert.equal(
    mobile.warehouseMobileBarcodeDisposition({
      materialId: 'mat_' + 'b'.repeat(32),
      status: 'active',
    }, materialId),
    'CONFLICT'
  );
  assert.equal(
    mobile.warehouseMobileBarcodeDisposition({
      materialId,
      status: 'inactive',
    }, materialId),
    'INACTIVE'
  );
});

test('operationId é válido para idempotência e falha fechado com UUID inválido', () => {
  const id = mobile.createWarehouseMobileAllocationOperationId(
    () => '11111111-2222-3333-4444-555555555555'
  );
  assert.equal(
    id,
    'mobile_11111111222233334444555555555555'
  );
  assert.match(id, /^[A-Za-z0-9_-]{8,96}$/);
  assert.throws(
    () => mobile.createWarehouseMobileAllocationOperationId(() => 'invalido'),
    /WAREHOUSE_MOBILE_ALLOCATION_OPERATION_ID_INVALID/
  );
});

test('mudança concorrente exige recarga autoritativa antes de repetir', () => {
  for (const code of [
    'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION',
    'WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED',
    'WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING',
    'WAREHOUSE_FAST_PATH_CANONICAL_INVOICE_MISSING',
  ]) {
    assert.equal(
      mobile.shouldRefreshWarehouseMobileAllocationAfterError(new Error(code)),
      true
    );
  }

  assert.equal(
    mobile.shouldRefreshWarehouseMobileAllocationAfterError(
      new Error('WAREHOUSE_FAST_PATH_UNAVAILABLE')
    ),
    false
  );
});
