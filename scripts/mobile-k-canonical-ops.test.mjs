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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-k-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/transfer.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
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
const transfer = require(resolve(outDir, 'warehouse/transfer.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const materialId = 'mat_' + 'a'.repeat(32);
const depotId = 'dep_' + 'b'.repeat(32);
const localA = 'loc_' + 'c'.repeat(32);
const localB = 'loc_' + 'd'.repeat(32);
const subAId = 'sub_' + 'e'.repeat(32);
const subBId = 'sub_' + 'f'.repeat(32);

const locationA = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
const locationB = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
const subA = { kind: 'SUBPOSITION', depotId, locationId: localA, subpositionId: subAId };
const subB = { kind: 'SUBPOSITION', depotId, locationId: localB, subpositionId: subBId };
const unassigned = { kind: 'UNASSIGNED' };

test('MOBILE-K aceita todas as combinações de posições físicas', () => {
  for (const [from, to] of [
    [locationA, locationB],
    [locationA, subB],
    [subA, locationB],
    [subA, subB],
  ]) {
    const result = transfer.prepareWarehousePhysicalTransfer({
      materialId,
      from,
      to,
      quantity: 2,
      availableQuantity: 10,
      lots: [],
    });
    assert.equal(result.ok, true);
    assert.equal(result.unattributedQuantity, 2);
  }
});

test('MOBILE-K rejeita UNASSIGNED como origem ou destino de transferência', () => {
  assert.deepEqual(
    transfer.prepareWarehousePhysicalTransfer({
      materialId,
      from: unassigned,
      to: locationA,
      quantity: 1,
      availableQuantity: 10,
      lots: [],
    }),
    { ok: false, error: 'NON_PHYSICAL_POSITION' }
  );
  assert.deepEqual(
    transfer.prepareWarehousePhysicalTransfer({
      materialId,
      from: locationA,
      to: unassigned,
      quantity: 1,
      availableQuantity: 10,
      lots: [],
    }),
    { ok: false, error: 'NON_PHYSICAL_POSITION' }
  );
});

test('PAL-01 permanece fail-closed quando lotes atribuídos excedem saldo físico', () => {
  const lots = [
    {
      schemaVersion: 'warehouse_lot_v1',
      id: 'lot_' + '1'.repeat(32),
      workspaceId: 'ws_mobile_k',
      ug: '160416',
      materialId,
      code: 'PAL-01-A',
      expiresOn: null,
      quantity: 540,
      position: locationA,
      origin: {
        kind: 'MANUAL_ENRICHMENT',
        movementId: null,
        invoiceRecordKey: null,
        invoiceId: null,
        supplier: null,
        supplierCnpj: null,
      },
      status: 'active',
      createdBy: 'test',
      updatedBy: 'test',
    },
  ];
  assert.deepEqual(
    transfer.prepareWarehousePhysicalTransfer({
      materialId,
      from: locationA,
      to: locationB,
      quantity: 10,
      availableQuantity: 440,
      lots,
    }),
    { ok: false, error: 'LOT_ATTRIBUTION_EXCEEDS_STOCK' }
  );
});
