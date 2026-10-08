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
