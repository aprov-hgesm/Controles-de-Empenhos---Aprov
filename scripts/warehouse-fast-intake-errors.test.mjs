#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(resolve('app/api/adm-deposito/intake-action/route.ts'), 'utf8');
const errorClass = source.match(/class FastPathError extends Error \{[\s\S]*?\n\}/)?.[0];
const classifier = source.match(/function firestoreFailure\([\s\S]*?\n\}/)?.[0];
assert.ok(errorClass && classifier, 'Fast path classifier must remain explicit');
const compiled = ts.transpileModule(
  errorClass + '\n' + classifier + '\n(globalThis).classify = firestoreFailure;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }
).outputText;
const context = {};
runInNewContext(compiled, context);
const classify = context.classify;

test('falhas REST permanecem distinguíveis sem revelar payload upstream', () => {
  const cases = [
    [401, '', 'WAREHOUSE_FAST_PATH_UPSTREAM_AUTH', 503],
    [403, '', 'WAREHOUSE_FAST_PATH_UPSTREAM_PERMISSION', 503],
    [429, '', 'WAREHOUSE_FAST_PATH_RATE_LIMITED', 503],
    [503, '', 'WAREHOUSE_FAST_PATH_UPSTREAM_UNAVAILABLE', 503],
    [400, '', 'WAREHOUSE_FAST_PATH_UPSTREAM_REJECTED', 503],
    [409, '', 'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 409],
    [412, '', 'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 409],
    [400, 'FAILED_PRECONDITION', 'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 409],
  ];
  for (const [status, body, code, httpStatus] of cases) {
    const error = classify(status, body);
    assert.equal(error.code, code);
    assert.equal(error.status, httpStatus);
    assert.equal(error.message, code);
  }
});

const intentBlock = source.match(/const allocationIntentHash = await sha256Hex\(JSON\.stringify\(\{[\s\S]*?\}\)\);/)?.[0];
assert.ok(intentBlock, 'allocation fingerprint must be bound to persisted movement');
assert.match(source, /movementDocument\.data\.note !== allocationMovementNote/);
assert.match(source, /note: allocationMovementNote/);
assert.match(source, /await commit\(accessToken, WAREHOUSE_DATABASE_ID, writes\)/);

async function fingerprint(input) {
  const { intakeId, materialId, quantity, position, lotCode, expiresOn, barcode, presentation } = input;
  const context = { materialId };
  const warehouseStockPositionKey = (p) => p;
  const warehouseUnitFromOperationalLabel = (u) => u;
  const sha256Hex = async (v) => {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(v).digest('hex');
  };
  // Execute the exact fingerprint expression extracted from the production route.
  const expression = intentBlock.replace('const allocationIntentHash = ', '').replace(/;$/, '');
  const evaluate = new Function(
    'input', 'context', 'quantity', 'position', 'lotCode', 'expiresOn', 'barcode',
    'warehouseStockPositionKey', 'warehouseUnitFromOperationalLabel', 'sha256Hex',
    'return (async () => ' + expression + ')();'
  );
  return evaluate({ intakeId }, { materialId, unitLabel: presentation }, quantity, position, lotCode, expiresOn, barcode, warehouseStockPositionKey, warehouseUnitFromOperationalLabel, sha256Hex);
}

test('replay: identidade completa estável e divergências produzem conflito', async () => {
  const original = {
    intakeId: 'intake-1', materialId: 'mat-1', quantity: 5,
    position: 'LOCAL:depot1:loc1', lotCode: 'L-1', expiresOn: '2027-01-01',
    barcode: '7891234567890', presentation: { code: 'UN', label: 'UN' },
  };
  const first = await fingerprint(original);
  assert.equal(await fingerprint({ ...original }), first);
  for (const [field, changed] of Object.entries({
    materialId: 'mat-2', quantity: 6, position: 'LOCAL:depot1:loc2',
    lotCode: 'L-2', expiresOn: '2027-02-01', barcode: null,
    presentation: { code: 'CX', label: 'CX' },
  })) {
    assert.notEqual(await fingerprint({ ...original, [field]: changed }), first, field);
  }
  assert.notEqual(await fingerprint({ ...original, barcode: '7891234567891' }), first);
});
