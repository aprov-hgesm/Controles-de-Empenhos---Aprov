import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { manifest, guardsFor, runGuardGroup } from './ci-lean-guards.mjs';
const workflow = readFileSync(new URL('../.github/workflows/application-ci.yml', import.meta.url), 'utf8');

test('legacy guard coverage is complete and in the same execution order', () => {
  const found = [];
  const groupUse = new Map();
  const re = /^\s+run:\s*(?:npm run (verify:[a-z0-9:-]+)|node scripts\/ci-lean-guards\.mjs --group (G\d+))\s*$/gm;
  for (const m of workflow.matchAll(re)) {
    if (m[1]) found.push(m[1]);
    else {
      const group = guardsFor(m[2]);
      groupUse.set(m[2], (groupUse.get(m[2]) || 0) + 1);
      found.push(...group.map(step => step.script));
    }
  }
  assert.deepEqual(found, manifest.legacyVerifyOrder, 'missing/duplicated/reordered legacy verifiers');
  for (const group of manifest.groups) assert.equal(groupUse.get(group.id), 1, group.id + ' must run once');
});
test('every manifest entry resolves to a defined npm script', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of manifest.legacyVerifyOrder) assert.equal(typeof pkg.scripts[name], 'string', name);
});
test('groups never silently PASS if unknown or executable fails', () => {
  assert.throws(() => guardsFor('G99'), /CI_LEAN_UNKNOWN_GUARD_GROUP/);
  const id = manifest.groups[0].id;
  const calls = [];
  const report = runGuardGroup(id, (_command, args) => {
    calls.push(args[1]);
    return { status: calls.length === 2 ? 1 : 0 };
  });
  assert.equal(report.success, false);
  assert.equal(report.failed, guardsFor(id)[1].script);
  assert.equal(calls.length, 2, 'must stop on first failure');
});
