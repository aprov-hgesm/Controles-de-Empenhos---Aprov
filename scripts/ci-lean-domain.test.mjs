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

test('Warehouse Domain runs canonical server-only Rules and atomic command tests', async () => {
  const scripts = domainTests('warehouse');
  assert.ok(scripts.includes('test:warehouse-server-only-rules'));
  assert.ok(scripts.includes('test:warehouse-server-manual-entry-security'));
  assert.ok(scripts.includes('test:mobile-outbound-unified'));
  assert.ok(scripts.includes('test:core-lean-r2-w4-contract'));
  assert.ok(scripts.includes('test:core-lean-r2-w4-assurance'));
  assert.ok(scripts.includes('test:core-lean-r2-w5-profile'));
  assert.ok(scripts.includes('test:core-lean-r2-w5-historical'));
  assert.ok(domainTests('finance').includes('test:financial-identity-v2'));
  assert.ok(!scripts.includes('test:adm-deposito-modular-r1-security'),
    'Legacy ALLOW-to-client test is incompatible with the server-only security boundary');
  const packageJson = JSON.parse((await import('node:fs')).readFileSync(
    new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of scripts) {
    assert.ok(packageJson.scripts[name]?.includes('scripts/'), 'missing runnable suite: ' + name);
  }
});
