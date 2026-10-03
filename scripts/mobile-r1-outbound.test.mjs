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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-outbound-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileOutbound.ts'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/barcode.ts'),
    resolve(root, 'lib/warehouse/outbound.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    '--outDir',
    outDir,
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
const mobile = require(resolve(outDir, 'warehouse/mobileOutbound.js'));
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'ws_mobile_outbound';
const ug = '160416';
const materialId = 'mat_' + 'a'.repeat(32);
const depotId = 'dep_' + 'b'.repeat(32);
const locationAId = 'loc_' + 'c'.repeat(32);
const locationBId = 'loc_' + 'd'.repeat(32);
const subpositionId = 'sub_' + 'e'.repeat(32);
const movementId = 'mov_' + 'f'.repeat(64);

const positionA = {
  kind: 'LOCATION',
  depotId,
  locationId: locationAId,
  subpositionId: null,
};
const positionB = {
  kind: 'LOCATION',
  depotId,
  locationId: locationBId,
  subpositionId: null,
};
const subposition = {
  kind: 'SUBPOSITION',
  depotId,
  locationId: locationAId,
  subpositionId,
};

const material = {
  schemaVersion: 'warehouse_material_v1',
  id: materialId,
  workspaceId,
  ug,
  description: 'Material MOBILE-G',
  aliases: [],
  unit: { code: 'unit', label: 'Unidade' },
  status: 'active',
  conversions: [],
};
const balance = {
  schemaVersion: 'warehouse_balance_v1',
  workspaceId,
  ug,
  materialId,
  quantity: 20,
  revision: 1,
  lastMovementId: movementId,
};
const association = {
  schemaVersion: 'warehouse_barcode_v1',
  id: 'bar_' + '1'.repeat(64),
  workspaceId,
  ug,
  materialId,
  barcode: '7891234567890',
  presentation: material.unit,
  factorToBaseUnit: 1,
  status: 'active',
  createdBy: 'tester',
  updatedBy: 'tester',
};

function locationBalance(position, quantity, suffix = '2') {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + suffix.repeat(64),
    workspaceId,
    ug,
    materialId,
    position,
    quantity,
    revision: 1,
    lastMovementId: movementId,
  };
}

function lot(overrides = {}) {
  return {
    schemaVersion: 'warehouse_lot_v1',
    id: 'lot_' + '3'.repeat(32),
    workspaceId,
    ug,
    materialId,
    code: 'L-G',
    expiresOn: '2026-12-10',
    quantity: 10,
    position: positionA,
    origin: {
      kind: 'MANUAL_ENRICHMENT',
      movementId: null,
      invoiceRecordKey: null,
      invoiceId: null,
      supplier: null,
      supplierCnpj: null,
    },
    status: 'active',
    createdBy: 'tester',
    updatedBy: 'tester',
    ...overrides,
  };
}

test('MOBILE-G reutiliza classificador canônico PRODUCT/LOCATION', () => {
  const locationCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: locationAId,
  });
  assert.equal(
    mobile.classifyWarehouseMobileOutboundProductScan('7891234567890'),
    'PRODUCT'
  );
  assert.equal(
    mobile.classifyWarehouseMobileOutboundProductScan(locationCode),
    'LOCATION'
  );
});

test('LOCATION e SUBPOSITION podem ser oferecidas com saldo suficiente', () => {
  const result = mobile.prepareWarehouseMobileOutboundOptions({
    material,
    balance,
    barcodeAssociation: association,
    requestedQuantity: 2,
    locationBalances: [
      locationBalance(positionA, 5, '2'),
      locationBalance(subposition, 4, '4'),
    ],
    lots: [],
    today: new Date('2026-10-03T12:00:00Z'),
  });
  assert.equal(result.options.length, 2);
  assert.ok(result.options.some((item) => item.position.kind === 'LOCATION'));
  assert.ok(result.options.some((item) => item.position.kind === 'SUBPOSITION'));
});

test('saldo agregado insuficiente falha antes da revisão', () => {
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundOptions({
      material,
      balance: { ...balance, quantity: 1 },
      barcodeAssociation: association,
      requestedQuantity: 2,
      locationBalances: [locationBalance(positionA, 5)],
      lots: [],
    }),
    /WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/
  );
});

test('saldo da posição insuficiente não produz opção operacional', () => {
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundOptions({
      material,
      balance,
      barcodeAssociation: association,
      requestedQuantity: 6,
      locationBalances: [locationBalance(positionA, 5)],
      lots: [],
    }),
    /WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK/
  );
});

test('barcode inativo ou de outro material é rejeitado pelo contrato canônico', () => {
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundOptions({
      material,
      balance,
      barcodeAssociation: { ...association, status: 'inactive' },
      requestedQuantity: 1,
      locationBalances: [locationBalance(positionA, 5)],
      lots: [],
    }),
    /WAREHOUSE_BARCODE_INACTIVE/
  );
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundOptions({
      material,
      balance,
      barcodeAssociation: {
        ...association,
        materialId: 'mat_' + '9'.repeat(32),
      },
      requestedQuantity: 1,
      locationBalances: [locationBalance(positionA, 5)],
      lots: [],
    }),
    /WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH/
  );
});

test('FEFO recomenda lote futuro mais próximo sem seleção silenciosa', () => {
  const sooner = lot({
    id: 'lot_' + '5'.repeat(32),
    code: 'FEFO-1',
    expiresOn: '2026-10-20',
    position: positionB,
  });
  const later = lot({
    id: 'lot_' + '6'.repeat(32),
    code: 'FEFO-2',
    expiresOn: '2026-11-20',
    position: positionA,
  });
  const result = mobile.prepareWarehouseMobileOutboundOptions({
    material,
    balance,
    barcodeAssociation: association,
    requestedQuantity: 2,
    locationBalances: [
      locationBalance(positionA, 5, '2'),
      locationBalance(positionB, 5, '4'),
    ],
    lots: [later, sooner],
    today: new Date('2026-10-03T12:00:00Z'),
  });
  assert.equal(result.recommendedLot?.id, sooner.id);
  assert.deepEqual(result.recommendedPosition, positionB);
  assert.equal(result.plan.lot, null);
});

test('lote inativo, divergente ou insuficiente é rejeitado na revisão', () => {
  const baseInput = {
    material,
    balance,
    barcodeAssociation: association,
    requestedQuantity: 2,
    position: positionA,
    locationBalance: locationBalance(positionA, 5),
  };
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundReview({
      ...baseInput,
      lot: lot({ status: 'inactive' }),
    }),
    /WAREHOUSE_OUTBOUND_LOT_INACTIVE/
  );
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundReview({
      ...baseInput,
      lot: lot({ position: positionB }),
    }),
    /WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH/
  );
  assert.throws(
    () => mobile.prepareWarehouseMobileOutboundReview({
      ...baseInput,
      lot: lot({ quantity: 1 }),
    }),
    /WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION/
  );
});

test('posição escaneada precisa ser exatamente a posição escolhida', () => {
  assert.equal(
    mobile.warehouseMobileOutboundScannedPositionMatches(positionA, positionA),
    true
  );
  assert.equal(
    mobile.warehouseMobileOutboundScannedPositionMatches(positionB, positionA),
    false
  );
  assert.equal(
    mobile.warehouseMobileOutboundScannedPositionMatches(subposition, positionA),
    false
  );
});

test('quantidade zero e negativa são rejeitadas', () => {
  for (const requestedQuantity of [0, -1]) {
    assert.throws(
      () => mobile.prepareWarehouseMobileOutboundOptions({
        material,
        balance,
        barcodeAssociation: association,
        requestedQuantity,
        locationBalances: [locationBalance(positionA, 5)],
        lots: [],
      }),
      /WAREHOUSE_OUTBOUND_INVALID_QUANTITY/
    );
  }
});
