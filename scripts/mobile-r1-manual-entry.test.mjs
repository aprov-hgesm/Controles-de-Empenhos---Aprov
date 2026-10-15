#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-manual-'));

execFileSync(process.execPath, [
  resolve(root, 'node_modules/typescript/bin/tsc'),
  resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
  resolve(root, 'lib/warehouse/mobileLocationScan.ts'),
  resolve(root, 'lib/warehouse/lot.ts'),
  resolve(root, 'lib/warehouse/movement.ts'),
  resolve(root, 'lib/warehouse/location.ts'),
  resolve(root, 'lib/warehouse/barcode.ts'),
  resolve(root, 'lib/warehouse/material.ts'),
  resolve(root, 'lib/platformIdentity.ts'),
  '--outDir', outDir, '--module', 'commonjs', '--target', 'ES2020',
  '--moduleResolution', 'node', '--skipLibCheck', '--esModuleInterop',
  '--lib', 'ES2020,DOM',
], { cwd: root, stdio: 'pipe' });

const require = createRequire(import.meta.url);
const allocation = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));
const location = require(resolve(outDir, 'warehouse/mobileLocationScan.js'));
const lot = require(resolve(outDir, 'warehouse/lot.js'));
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const screen = read('features/warehouse/mobile/WarehouseMobileManualEntry.tsx');
const manual = read('lib/warehouse/manualEntryRepository.ts');

test('Central Móvel tem rota e cartão exclusivos para entrada avulsa, sem remover alocação por NF', () => {
  assert.match(read('app/central-mobile/avulso/page.tsx'), /WarehouseMobileManualEntry/);
  const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
  assert.match(home, /href: '\/central-mobile\/avulso'/);
  assert.match(home, /href: '\/central-mobile\/alocar'/);
  const mobileLayout = read('app/central-mobile/layout.tsx');
  assert.match(mobileLayout, /WarehouseMobileProtectedLayout/);
  assert.match(read('features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx'), /HGESM_SECTOR_EMAIL/);
});

test('scanner reutilizado distingue produto comercial de posição física', () => {
  const numericPositionBarcode = '9813001201101';
  assert.equal(allocation.classifyWarehouseMobileProductScan('7891234567890'), 'PRODUCT');
  assert.equal(allocation.classifyWarehouseMobileProductScan(numericPositionBarcode), 'LOCATION');
  assert.equal(location.classifyWarehouseMobileLocationScan(numericPositionBarcode), 'LOCATION');
  assert.equal(location.classifyWarehouseMobileLocationScan('7891234567890'), 'UNKNOWN');
  assert.match(screen, /expectation="EXPECT_PRODUCT"/);
  assert.match(screen, /expectation="EXPECT_LOCATION"/);
});

test('escaneamento consulta barcode autoritativo antes de buscar material e bloqueia apresentação convertida', () => {
  assert.match(screen, /getWarehouseBarcodeByCode\(workspace\.workspaceId, event\.value\)/);
  assert.match(screen, /getWarehouseMaterial\(workspace\.workspaceId, association\.materialId\)/);
  assert.match(screen, /association\.factorToBaseUnit !== 1/);
  assert.match(screen, /association\.status !== 'active'/);
  assert.match(screen, /current\.materialId !== selectedMaterial\?\.id/);
  assert.match(screen, /current\.status !== 'active'/);
  assert.match(screen, /product\.status !== 'known'/);
  assert.match(screen, /product\.confirmed/);
});

test('posição requer resolver autoritativo LOCAL ou SUBPOSITION, nunca depósito/UNASSIGNED', () => {
  assert.match(screen, /resolveWarehouseStockPositionBarcode/);
  assert.match(screen, /DEPOT_NOT_STOCK_POSITION/);
  assert.match(screen, /location\.position\.kind === 'UNASSIGNED'/);
  assert.match(manual, /await assertManualEntryPositionActive\(scope\.workspaceId, position\)/);
});

test('entrada usa motor canônico MANUAL_ENTRY: ledger, saldo geral e posição em transação', () => {
  assert.match(screen, /registerWarehouseManualEntry\(workspace\.workspaceId/);
  assert.match(screen, /provenance: provenance\.trim\(\)/);
  assert.match(screen, /expiresOn: expiresOn \|\| null/);
  assert.match(screen, /barcode: product\.status === 'unknown' \? barcode : null/);
  assert.match(manual, /type: 'MANUAL_ENTRY'/);
  assert.match(manual, /transaction\.set\(movementRef/);
  assert.match(manual, /transaction\.set\(balanceRef/);
  assert.match(manual, /transaction\.set\(locationBalanceRef/);
  assert.match(manual, /warehouseMovementMatchesReplay/);
  assert.match(screen, /submittingRef\.current/);
  assert.match(screen, /setOperationId\(createWarehouseMobileAllocationOperationId\(\)\)/);
});

test('validade é data de calendário ou nula; movimentos avulsos têm origem auditável', () => {
  assert.equal(lot.normalizeWarehouseExpiryDate(null), null);
  assert.equal(lot.normalizeWarehouseExpiryDate('2026-12-31'), '2026-12-31');
  assert.equal(lot.normalizeWarehouseExpiryDate('2026-02-30'), undefined);
  const candidate = {
    schemaVersion: 'warehouse_movement_v1',
    id: 'mov_' + 'f'.repeat(64),
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    materialId: 'mat_' + '1'.repeat(32),
    type: 'MANUAL_ENTRY',
    quantityDelta: 2,
    idempotencyKeyHash: 'f'.repeat(64),
    reversesMovementId: null,
    note: 'Entrada avulsa · doação',
    source: { kind: 'MANUAL_ENTRY', actorUid: 'uid', provenance: 'Doação', reference: null },
  };
  assert.equal(movement.validateWarehouseMovement(candidate).ok, true);
});

test('sem NF e sem escrita ao ler: confirmação é gatilho único e rascunho permanece em falha', () => {
  assert.doesNotMatch(screen, /allocateWarehousePendingItemFast|loadWarehouseInvoiceIntakeQueue/);
  assert.match(screen, /const submit = async \(\) =>/);
  assert.match(screen, /onClick=\{\(\) => void submit\(\)\}/);
  assert.match(screen, /O rascunho foi preservado/);
  assert.match(manual, /warnings\.push\('A entrada foi registrada/);
});
