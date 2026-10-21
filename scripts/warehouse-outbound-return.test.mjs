#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-outbound-return-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
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
const movement = require(resolve(outDir, 'warehouse/movement.js'));
const repositorySource = readFileSync(
  resolve(root, 'lib/warehouse/withdrawalRepository.ts'), 'utf8'
);
const returnServer = readFileSync(
  resolve(root, 'lib/server/warehouseReturnWrite.ts'), 'utf8'
);
const manualEntryServer = readFileSync(
  resolve(root, 'lib/server/warehouseManualEntry.ts'), 'utf8'
);

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const MATERIAL = 'mat_' + '1'.repeat(32);
const MOVEMENT = 'mov_' + 'a'.repeat(64);
const ORIGINAL_MOVEMENT = 'mov_' + 'b'.repeat(64);
const CONSUMPTION = 'cons_' + 'c'.repeat(64);
const POSITION = {
  kind: 'LOCATION',
  depotId: 'dep_' + '6'.repeat(32),
  locationId: 'loc_' + '6'.repeat(32),
  subpositionId: null,
};
const LOCATION_BALANCE = 'locbal_' + 'd'.repeat(64);

function returnEntry(overrides = {}) {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: MOVEMENT,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'OUTBOUND_RETURN',
    quantityDelta: 2,
    idempotencyKeyHash: 'a'.repeat(64),
    reversesMovementId: null,
    note: 'Devolução de saída',
    source: {
      kind: 'OUTBOUND_RETURN',
      actorUid: 'founder-uid',
      consumptionId: CONSUMPTION,
      originalMovementId: ORIGINAL_MOVEMENT,
      quantity: 2,
      position: POSITION,
      locationBalanceId: LOCATION_BALANCE,
      lotId: null,
      reason: 'Devolução de saída',
    },
    ...overrides,
  };
}

test('devolução usa OUTBOUND_RETURN positivo e vincula saída original', () => {
  const result = movement.validateWarehouseMovement(returnEntry(), {
    expectedWorkspaceId: WORKSPACE,
    expectedUg: UG,
    expectedMaterialId: MATERIAL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.type, 'OUTBOUND_RETURN');
  assert.equal(result.data.source.kind, 'OUTBOUND_RETURN');
  assert.equal(result.data.source.consumptionId, CONSUMPTION);
  assert.equal(result.data.source.originalMovementId, ORIGINAL_MOVEMENT);
});

test('OUTBOUND_RETURN rejeita delta negativo ou quantidade da origem divergente', () => {
  assert.equal(movement.validateWarehouseMovement(returnEntry({ quantityDelta: -2 })).ok, false);
  const wrong = returnEntry({
    source: { ...returnEntry().source, quantity: 1 },
  });
  const parsed = movement.validateWarehouseMovement(wrong);
  assert.equal(parsed.ok, false);
  assert.match(parsed.issues.map((item) => item.code).join(','), /return_quantity_mismatch/);
});

test('repository delega devolução ao motor canônico do servidor, sem gravação SDK', () => {
  assert.match(repositorySource, /warehouseServerCommand<ReturnWarehouseStockOutboundResult>/);
  assert.match(repositorySource, /'STOCK_RETURN'/);
  assert.match(returnServer, /warehouseAdminTransaction<ReturnWarehouseStockOutboundResult>/);
  assert.match(returnServer, /type:'OUTBOUND_RETURN'/);
  assert.doesNotMatch(repositorySource, /\brunTransaction\s*\(/);
  assert.doesNotMatch(repositorySource, /\bwriteBatch\s*\(/);
});

test('motor valida saldo ainda retirado, histórico e replay sem duplicação', () => {
  assert.match(returnServer, /previouslyReturned=Math\.max\(previousReturn,summarized\)/);
  assert.match(returnServer, /afterReturn>consumptionTotal\+0\.000001/);
  assert.match(returnServer, /WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING/);
  assert.match(returnServer, /if\(exists\)/);
  assert.match(returnServer, /summary\?\.lastReturnMovementId!==movementId/);
  assert.match(returnServer, /WAREHOUSE_IDEMPOTENCY_CONFLICT/);
});

test('motor atualiza consumption e índice de devolução na mesma transação', () => {
  assert.match(returnServer, /'warehouse_outbound_return_v1'/);
  assert.match(returnServer, /returnedQuantity:afterReturn/);
  assert.match(returnServer, /warehouseAdminTransaction/);
  assert.match(returnServer, /path:consumptionPath,data:nextConsumption/);
  assert.match(returnServer, /path:summaryPath,data:nextSummary/);
  assert.match(returnServer, /path:newMovementPath,data:/);
});

test('devolução exige origem física e Entrada Avulsa rejeita UNASSIGNED', () => {
  assert.match(returnServer, /source\.position\.kind==='UNASSIGNED'/);
  assert.match(returnServer, /WAREHOUSE_OUTBOUND_RETURN_ORIGINAL_INVALID/);
  assert.match(returnServer, /WAREHOUSE_OUTBOUND_RETURN_RECONCILIATION_REQUIRED/);
  assert.match(manualEntryServer, /position\.kind === 'UNASSIGNED'/);
  assert.match(manualEntryServer, /WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED/);
  assert.match(returnServer, /warehouseStockPositionsEqual/);
});

test('reserva pendente legada divergente é rejeitada; nova tentativa não a assume silenciosamente', () => {
  assert.match(returnServer, /summary\?\.pendingOperationId && summary\.pendingOperationId!==operationId/);
  assert.match(returnServer, /WAREHOUSE_OUTBOUND_RETURN_LEGACY_PENDING_RECONCILIATION/);
  assert.match(returnServer, /WAREHOUSE_IDEMPOTENCY_CONFLICT/);
});

test('devolução não depende da API server-only antiga ou segredo Firebase no cliente', () => {
  assert.equal(repositorySource.includes('/api/adm-deposito/outbound-return'), false);
  assert.equal(repositorySource.includes('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON'), false);
});
