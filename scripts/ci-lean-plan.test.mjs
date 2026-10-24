#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyChanges, discoverImporters, DOMAINS } from './ci-lean-plan.mjs';

const has = (plan, domain) => assert.ok(plan.domains.includes(domain), domain + ' not selected');

test('changed unknown code never silently PASSes', () => {
  const p = classifyChanges(['new-service/unmapped.ts']);
  assert.deepEqual(p.domains, DOMAINS);
  assert.ok(p.scripts.length > 10);
  assert.match(p.reasons[0].reason, /unclassified/);
});
test('empty/unavailable diff fails closed', () => {
  assert.throws(() => classifyChanges([]), /CI_LEAN_EMPTY_DIFF/);
  assert.throws(() => classifyChanges(null), /CI_LEAN_EMPTY_DIFF/);
});
test('mobile change selects canonical integration and server guard', () => {
  const p = classifyChanges(['features/warehouse/mobile/WarehouseMobileOutbound.tsx']);
  has(p, 'warehouse');
  for (const script of [
    'verify:mobile-r1-integration-3', 'test:mobile-outbound-unified',
    'test:mobile-r1-integration-3',
  ]) assert.ok(p.scripts.includes(script), script);
});
test('server transactions and Firestore Rules select critical security tests', () => {
  const p = classifyChanges(['lib/server/warehouseWithdrawalWrite.ts', 'firestore.warehouse.server-only.rules']);
  has(p, 'warehouse');
  has(p, 'auth');
  for (const script of ['test:adm-deposito-inventory', 'verify:multitenant-security',
    'verify:emprovex-warehouse-isolation']) assert.ok(p.scripts.includes(script), script);
});
test('financial and shared identity paths cannot escape financial tests', () => {
  has(classifyChanges(['features/empenhos/components/EmpenhosView.tsx']), 'finance');
  const p = classifyChanges(['lib/identities/ids.ts']);
  has(p, 'finance');
  has(p, 'auth');
});
test('auth/login and legal changes select their protection suites', () => {
  has(classifyChanges(['app/api/auth/session/route.ts']), 'auth');
  has(classifyChanges(['lib/legalAcceptance.ts']), 'legal');
});
test('visual and recovery changes are differentiated', () => {
  has(classifyChanges(['components/visual/ThinkingOrb.tsx']), 'visual');
  has(classifyChanges(['scripts/firestore-recovery.mjs']), 'recovery');
});
test('CI, packages and unknown test scripts trigger conservative fallback', () => {
  for (const path of [
    '.github/workflows/application-ci.yml', 'package-lock.json',
    'scripts/verify-brand-logo-lock.mjs',
  ]) assert.deepEqual(classifyChanges([path]).domains, DOMAINS);
});
test('documentation-only changes do not schedule domain execution', () => {
  assert.deepEqual(classifyChanges(['docs/CI_LEAN_R2.md']).domains, []);
});
test('importer propagation includes dependent tests and their domains', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-lean-r2-'));
  try {
    mkdirSync(join(root, 'lib', 'shared'), { recursive: true });
    mkdirSync(join(root, 'lib', 'warehouse'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'lib/shared/identity.ts'), 'export const identity = 1;');
    writeFileSync(join(root, 'lib/warehouse/mobileOutbound.ts'),
      "import { identity } from '../shared/identity'; export const id = identity;");
    writeFileSync(join(root, 'scripts/mobile-r1-outbound.test.mjs'),
      "import { id } from '../lib/warehouse/mobileOutbound';");
    const deps = discoverImporters(['lib/shared/identity.ts'], root);
    assert.ok(deps.includes('lib/warehouse/mobileOutbound.ts'));
    assert.ok(deps.includes('scripts/mobile-r1-outbound.test.mjs'));
    has(classifyChanges(['lib/shared/identity.ts'], deps), 'warehouse');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
