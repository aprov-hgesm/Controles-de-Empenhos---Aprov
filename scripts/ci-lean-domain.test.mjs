import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChanges, DOMAINS } from './ci-lean-plan.mjs';
import { domainTests, runDomain } from './ci-lean-domain.mjs';

test('all conservative plan domains have executable deep tests', () => {
  for (const domain of DOMAINS) assert.ok(domainTests(domain).length > 0);
  assert.deepEqual(classifyChanges(['unknown.mjs']).domains, DOMAINS);
});
test('unrecognized domain is never a no-op', () => {
  assert.throws(() => domainTests('none'), /CI_LEAN_UNKNOWN_DOMAIN/);
});
test('failure in one suite does not prevent later suites, but makes domain FAIL', () => {
  const calls = [];
  const fake = (_, args) => {
    calls.push(args[1]);
    return { status: calls.length === 1 ? 1 : 0 };
  };
  const result = runDomain('warehouse', fake);
  assert.equal(calls.length, domainTests('warehouse').length);
  assert.deepEqual(result.failures, [domainTests('warehouse')[0]]);
});
