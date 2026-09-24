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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase8-domain-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
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
const barcode = require(resolve(outDir, 'warehouse/barcode.js'));
const outbound = require(resolve(outDir, 'warehouse/outbound.js'));
const lotDomain = require(resolve(outDir, 'warehouse/lot.js'));
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm-aprov';
const ug = '160416';
const materialId = 'mat_123e4567e89b12d3a456426614174000';
const actorUid = 'founder-phase-8';

const material = {
  schemaVersion: 'warehouse_material_v1',
  id: materialId,
  workspaceId,
  ug,
  description: 'Álcool 70%',
  aliases: ['Alcool 70'],
  unit: { code: 'unit', label: 'Frasco' },
  status: 'active',
  conversions: [
    {
      presentation: { code: 'box', label: 'Caixa 12 frascos' },
      factorToBaseUnit: 12,
    },
    {
      presentation: { code: 'package', label: 'Embalagem 24 frascos' },
      factorToBaseUnit: 24,
    },
  ],
};

const balance = {
  schemaVersion: 'warehouse_balance_v1',
  workspaceId,
  ug,
  materialId,
  quantity: 100,
  revision: 1,
  lastMovementId: 'mov_' + '1'.repeat(64),
};

function association(overrides = {}) {
  return {
    schemaVersion: barcode.WAREHOUSE_BARCODE_SCHEMA_VERSION,
    id: 'bar_' + 'a'.repeat(64),
    workspaceId,
    ug,
    materialId,
    barcode: '7891234567890',
    presentation: { code: 'box', label: 'Caixa 12 frascos' },
    factorToBaseUnit: 12,
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    ...overrides,
  };
}

function lot(overrides = {}) {
  return {
    schemaVersion: lotDomain.WAREHOUSE_LOT_SCHEMA_VERSION,
    id: 'lot_' + 'b'.repeat(32),
    workspaceId,
    ug,
    materialId,
    code: 'L-2026-01',
    expiresOn: '2026-11-10',
    quantity: 50,
    position: { kind: 'UNASSIGNED' },
    origin: {
      kind: 'MANUAL_ENRICHMENT',
      movementId: null,
      invoiceRecordKey: null,
      invoiceId: null,
      supplier: null,
      supplierCnpj: null,
    },
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    ...overrides,
  };
}

test('um material canônico aceita múltiplos códigos sem duplicar identidade', () => {
  const first = barcode.validateWarehouseBarcodeAssociation(association());
  const second = barcode.validateWarehouseBarcodeAssociation(
    association({
      id: 'bar_' + 'c'.repeat(64),
      barcode: '7891234567891',
      presentation: { code: 'package', label: 'Embalagem 24 frascos' },
      factorToBaseUnit: 24,
    })
  );
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.data.materialId, second.data.materialId);
  assert.notEqual(first.data.barcode, second.data.barcode);
});

test('scanner HID é resolvido pelo mesmo texto digitado e ENTER não exige SDK', () => {
  const associations = [association()];
  const resolved = barcode.findWarehouseBarcodeAssociation(
    associations,
    '7891234567890'
  );
  assert.equal(resolved?.materialId, materialId);
  assert.equal(
    barcode.findWarehouseBarcodeAssociation(associations, 'CODIGO-NAO-CADASTRADO'),
    null
  );
});

test('código inativo não é resolvido no fluxo operacional padrão', () => {
  assert.equal(
    barcode.findWarehouseBarcodeAssociation(
      [association({ status: 'inactive' })],
      '7891234567890'
    ),
    null
  );
});

test('associação de outro workspace/UG é rejeitada pelo contrato', () => {
  assert.equal(
    barcode.validateWarehouseBarcodeAssociation(
      association({ workspaceId: 'outro-workspace' }),
      { expectedWorkspaceId: workspaceId, expectedUg: ug }
    ).ok,
    false
  );
  assert.equal(
    barcode.validateWarehouseBarcodeAssociation(
      association({ ug: '999999' }),
      { expectedWorkspaceId: workspaceId, expectedUg: ug }
    ).ok,
    false
  );
});

test('conversão caixa × 12 transforma 3 caixas em 36 unidades oficiais', () => {
  const converted = barcode.convertWarehouseBarcodeQuantityToBase(
    association(),
    3
  );
  assert.equal(converted, 36);

  const plan = outbound.prepareWarehouseExpressOutbound({
    material,
    balance,
    requestedQuantity: 3,
    presentation: { code: 'box', label: 'Caixa 12 frascos' },
    position: { kind: 'UNASSIGNED' },
    barcodeAssociation: association(),
  });
  assert.equal(plan.baseQuantity, 36);
  assert.equal(plan.factorToBaseUnit, 12);
  assert.equal(plan.interface, 'BARCODE_SCANNER');
});

test('outras apresentações preservam fator determinístico do material', () => {
  const assoc24 = association({
    id: 'bar_' + 'd'.repeat(64),
    barcode: '7891234567892',
    presentation: { code: 'package', label: 'Embalagem 24 frascos' },
    factorToBaseUnit: 24,
  });
  assert.equal(
    barcode.convertWarehouseBarcodeQuantityToBase(assoc24, 2),
    48
  );
  assert.equal(barcode.warehousePresentationFactor(material, material.unit), 1);
});

test('saída acima do saldo oficial é recusada antes de produzir movimento', () => {
  assert.throws(
    () =>
      outbound.prepareWarehouseExpressOutbound({
        material,
        balance: { ...balance, quantity: 20 },
        requestedQuantity: 2,
        presentation: { code: 'box', label: 'Caixa 12 frascos' },
        position: { kind: 'UNASSIGNED' },
        barcodeAssociation: association(),
      }),
    /WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/
  );
});

test('lote escolhido precisa corresponder à posição e quantidade; lote continua opcional', () => {
  const withoutLot = outbound.prepareWarehouseExpressOutbound({
    material,
    balance,
    requestedQuantity: 1,
    presentation: material.unit,
    position: { kind: 'UNASSIGNED' },
  });
  assert.equal(withoutLot.lot, null, 'FEFO não escolhe lote silenciosamente');

  assert.throws(
    () =>
      outbound.prepareWarehouseExpressOutbound({
        material,
        balance,
        requestedQuantity: 5,
        presentation: { code: 'box', label: 'Caixa 12 frascos' },
        position: { kind: 'UNASSIGNED' },
        barcodeAssociation: association(),
        lot: lot({ quantity: 50 }),
      }),
    /WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION/
  );
});

test('FEFO existente continua sendo recomendação derivada e não entra no plano sem escolha', () => {
  const sooner = lot({ id: 'lot_' + '1'.repeat(32), code: 'PRIMEIRO', expiresOn: '2026-10-01' });
  const later = lot({ id: 'lot_' + '2'.repeat(32), code: 'DEPOIS', expiresOn: '2026-12-01' });
  assert.equal(
    lotDomain.selectWarehouseFefoLot(
      [later, sooner],
      new Date('2026-09-23T12:00:00Z')
    )?.code,
    'PRIMEIRO'
  );
  const plan = outbound.prepareWarehouseExpressOutbound({
    material,
    balance,
    requestedQuantity: 1,
    presentation: material.unit,
    position: { kind: 'UNASSIGNED' },
  });
  assert.equal(plan.lot, null);
});

test('fonte EXPRESS_OUTBOUND é auditável e deve corresponder ao delta do ledger', () => {
  const valid = movement.validateWarehouseMovement({
    schemaVersion: movement.WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id: 'mov_' + 'f'.repeat(64),
    workspaceId,
    ug,
    materialId,
    type: 'OUTBOUND',
    quantityDelta: -36,
    idempotencyKeyHash: 'f'.repeat(64),
    reversesMovementId: null,
    note: 'Saída expressa',
    source: {
      kind: 'EXPRESS_OUTBOUND',
      interface: 'BARCODE_SCANNER',
      actorUid,
      requestedQuantity: 3,
      quantity: 36,
      presentation: { code: 'box', label: 'Caixa 12 frascos' },
      factorToBaseUnit: 12,
      barcodeId: 'bar_' + 'a'.repeat(64),
      barcode: '7891234567890',
      position: { kind: 'UNASSIGNED' },
      locationBalanceId: 'locbal_' + 'e'.repeat(64),
      lotId: null,
      lotCode: null,
    },
  });
  assert.equal(valid.ok, true);

  const mismatch = movement.validateWarehouseMovement({
    ...valid.data,
    quantityDelta: -35,
  });
  assert.equal(mismatch.ok, false);
  assert.ok(
    mismatch.issues.some((item) => item.code === 'outbound_quantity_mismatch')
  );
});
