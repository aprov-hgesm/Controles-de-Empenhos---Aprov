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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-ledger-contract-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/movement.ts'),
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
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const materialId = 'mat_123e4567e89b12d3a456426614174000';

async function sample(overrides = {}) {
  const {
    idempotencyKey = 'phase2:test:initial-balance',
    ...movementOverrides
  } = overrides;
  const id = await movement.createWarehouseMovementId('hgesm-aprov', idempotencyKey);
  return {
    schemaVersion: movement.WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id,
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    materialId,
    type: 'INITIAL_BALANCE',
    quantityDelta: 10,
    idempotencyKeyHash: id.slice(4),
    reversesMovementId: null,
    note: null,
    ...movementOverrides,
  };
}

test('suporta os sete tipos iniciais do ledger da FASE 2', () => {
  assert.deepEqual(movement.WAREHOUSE_MOVEMENT_TYPES, [
    'INITIAL_BALANCE',
    'INVOICE_ENTRY',
    'OUTBOUND',
    'TRANSFER',
    'INVENTORY_ADJUSTMENT',
    'INVOICE_CORRECTION',
    'REVERSAL',
  ]);
});

test('gera ID determinístico por workspace e chave de idempotência', async () => {
  const first = await movement.createWarehouseMovementId(
    'hgesm-aprov',
    'invoice:123:item:1'
  );
  const repeat = await movement.createWarehouseMovementId(
    'hgesm-aprov',
    'invoice:123:item:1'
  );
  const other = await movement.createWarehouseMovementId(
    'hgesm-aprov',
    'invoice:123:item:2'
  );

  assert.equal(first, repeat);
  assert.notEqual(first, other);
  assert.match(first, /^mov_[a-f0-9]{64}$/);
});

test('valida direção da quantidade conforme o tipo', async () => {
  for (const [type, quantityDelta, expected] of [
    ['INITIAL_BALANCE', 10, true],
    ['INVOICE_ENTRY', 4, true],
    ['OUTBOUND', -2, true],
    ['TRANSFER', 0, true],
    ['INVENTORY_ADJUSTMENT', -1, true],
    ['INVOICE_CORRECTION', 1, true],
    ['REVERSAL', -10, true],
    ['OUTBOUND', 2, false],
    ['TRANSFER', 1, false],
  ]) {
    const candidate = await sample({
      idempotencyKey: 'phase2:' + type + ':' + String(quantityDelta),
      type,
      quantityDelta,
      reversesMovementId: type === 'REVERSAL'
        ? 'mov_' + 'a'.repeat(64)
        : null,
    });
    candidate.idempotencyKeyHash = candidate.id.slice(4);
    const result = movement.validateWarehouseMovement(candidate);
    assert.equal(result.ok, expected, type + ' / ' + quantityDelta);
  }
});

test('saldo materializado é derivado do ledger e incrementa revisão', async () => {
  const firstResult = movement.validateWarehouseMovement(await sample());
  assert.equal(firstResult.ok, true);

  const balance1 = movement.applyWarehouseMovementToBalance(firstResult.data, null);
  assert.deepEqual(balance1, {
    schemaVersion: 'warehouse_balance_v1',
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    materialId,
    quantity: 10,
    revision: 1,
    lastMovementId: firstResult.data.id,
  });

  const outboundCandidate = await sample({
    idempotencyKey: 'phase2:test:outbound',
    type: 'OUTBOUND',
    quantityDelta: -2.5,
  });
  outboundCandidate.idempotencyKeyHash = outboundCandidate.id.slice(4);
  const outboundResult = movement.validateWarehouseMovement(outboundCandidate);
  assert.equal(outboundResult.ok, true);

  const balance2 = movement.applyWarehouseMovementToBalance(
    outboundResult.data,
    balance1
  );
  assert.equal(balance2.quantity, 7.5);
  assert.equal(balance2.revision, 2);
  assert.equal(balance2.lastMovementId, outboundResult.data.id);
});

test('replay idempotente exige payload canônico idêntico', async () => {
  const candidate = await sample();
  const validated = movement.validateWarehouseMovement(candidate);
  assert.equal(validated.ok, true);

  assert.equal(
    movement.warehouseMovementMatchesReplay(validated.data, validated.data),
    true
  );
  assert.equal(
    movement.warehouseMovementMatchesReplay(
      validated.data,
      { ...validated.data, quantityDelta: 11 }
    ),
    false
  );
});

test('REVERSAL exige referência e delta oposto é preservado como movimento explícito', async () => {
  const original = movement.validateWarehouseMovement(await sample());
  assert.equal(original.ok, true);

  const reversalCandidate = await sample({
    idempotencyKey: 'phase2:test:reversal',
    type: 'REVERSAL',
    quantityDelta: -10,
    reversesMovementId: original.data.id,
  });
  reversalCandidate.idempotencyKeyHash = reversalCandidate.id.slice(4);

  const reversal = movement.validateWarehouseMovement(reversalCandidate);
  assert.equal(reversal.ok, true);
  const balance = movement.applyWarehouseMovementToBalance(original.data, null);
  const reversedBalance = movement.applyWarehouseMovementToBalance(
    reversal.data,
    balance
  );
  assert.equal(reversedBalance.quantity, 0);
  assert.equal(reversedBalance.revision, 2);
});

test('quantidades rejeitam ruído além de seis casas decimais', () => {
  assert.equal(movement.normalizeWarehouseQuantity(1.123456), 1.123456);
  assert.equal(movement.normalizeWarehouseQuantity(1.1234567), null);
});
