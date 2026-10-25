import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkChangedScripts, isNodeRunnable } from './ci-lean-syntax.mjs';

test('TypeScript does not silently substitute JS syntax checks', () => {
  assert.equal(isNodeRunnable('scripts/verify.mjs'), true);
  assert.equal(isNodeRunnable('scripts/worker.js'), true);
  assert.equal(isNodeRunnable('lib/domain.ts'), false);
});
test('syntactic errors in changed .mjs are a hard failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-lean-syntax-'));
  try {
    writeFileSync(join(dir, 'broken.mjs'), 'export const = invalid;');
    writeFileSync(join(dir, 'valid.mjs'), 'export const ok = 1;');
    const report = checkChangedScripts(['broken.mjs', 'valid.mjs', 'lib/domain.ts'], process.execPath, dir);
    assert.deepEqual(report.failed, ['broken.mjs']);
    assert.equal(report.selected.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
