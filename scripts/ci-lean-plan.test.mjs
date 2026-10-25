#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyChanges, discoverImporters, parseGitNameStatusZ, DOMAINS } from './ci-lean-plan.mjs';

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
  assert.ok(p.scripts.includes('test:core-lean-r2-w4-contract'));
  for (const script of ['test:adm-deposito-inventory', 'verify:multitenant-security',
    'verify:emprovex-warehouse-isolation']) assert.ok(p.scripts.includes(script), script);
});
test('financial and shared identity paths cannot escape financial tests', () => {
  const nf=classifyChanges(['features/empenhos/components/EmpenhosView.tsx']);
  has(nf, 'finance');
  assert.ok(nf.scripts.includes('test:financial-identity-v2'));
  for(const p of ['lib/financialIdentityV2.ts','lib/invoiceIdentity.ts','lib/nsIntegrity.ts','lib/empenhoConcurrency.ts','scripts/financial-identity-v2.test.mjs']) {
    const plan=classifyChanges([p]);
    assert.ok(plan.scripts.includes('test:financial-identity-v2'),p);
  }
  const p = classifyChanges(['lib/identities/ids.ts']);
  has(p, 'finance');
  has(p, 'auth');
});
test('Warehouse authentication and API entry points also select institutional authorization', () => {
  for (const path of ['lib/server/warehouseAccess.ts', 'lib/server/warehouseMobileTrust.mjs', 'app/api/central-depositos/operations/route.ts']) {
    const plan = classifyChanges([path]);
    has(plan, 'auth');
    has(plan, 'warehouse');
    assert.ok(plan.scripts.includes('verify:emprovex-warehouse-isolation'));
  }
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

test('tsconfig @/ aliases and side-effect imports extend transitive reverse import graph', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-lean-alias-'));
  try {
    mkdirSync(join(root, 'lib/shared'), {recursive:true});
    mkdirSync(join(root, 'features/empenhos'), {recursive:true});
    mkdirSync(join(root, 'scripts'), {recursive:true});
    writeFileSync(join(root,'lib/shared/financial.ts'),'export const value=1;');
    writeFileSync(join(root,'features/empenhos/financial.ts'),"import { value } from '@/lib/shared/financial';");
    writeFileSync(join(root,'scripts/financial-alias.test.mjs'),"import '../features/empenhos/financial';");
    const deps=discoverImporters(['lib/shared/financial.ts'],root);
    assert.ok(deps.includes('features/empenhos/financial.ts'), JSON.stringify(deps));
    assert.ok(deps.includes('scripts/financial-alias.test.mjs'), JSON.stringify(deps));
    has(classifyChanges(['lib/shared/financial.ts'],deps),'finance');
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('new W4 cross-domain suites and server authorization cannot be skipped',()=>{
  const auth=classifyChanges(['lib/server/authorizationPolicy.ts']);
  has(auth,'auth');
  assert.ok(auth.scripts.includes('test:core-lean-r2-w4-authz'));
  const wt=classifyChanges(['scripts/core-lean-r2-w4-v3-emulator.mjs']);
  has(wt,'warehouse');
  assert.ok(wt.scripts.includes('test:core-lean-r2-w1-contract'));
  const fi=classifyChanges(['scripts/core-lean-r2-w4-financial.test.mjs']);
  has(fi,'finance');
  assert.ok(fi.scripts.includes('test:core-lean-r2-w4-financial'));
});
test('W3 six pretypecheck suites remain selected natively for financial changes',()=>{
  const plan=classifyChanges(['lib/financialIdentityV2.ts']);
  for(const s of ['test:financial-identity-v2','test:invoice-identity','test:ns-integrity',
    'test:empenho-concurrency','test:supplier-cnpj-migration','test:ns-integrity-contract'])
    assert.ok(plan.scripts.includes(s),s);
});
test('W1 v3 changed paths always select its behavioral contract',()=>{
  for(const path of ['lib/server/warehouseWithdrawalV3Write.ts','lib/server/warehouseWithdrawalV3Identity.mjs',
    'lib/warehouse/withdrawalV3.ts','scripts/warehouse-withdrawal-v3-contract.test.mjs','scripts/warehouse-w1-v3-emulator.ts']) {
    const plan=classifyChanges([path]);
    has(plan,'warehouse');
    assert.ok(plan.scripts.includes('test:core-lean-r2-w1-contract'),path);
  }
});
test('W5 performance and historical scripts remain within Warehouse domain',()=>{
  for(const path of ['scripts/core-lean-r2-w5-profile.mjs','scripts/core-lean-r2-w5-profile.test.mjs',
    'scripts/core-lean-r2-w5-historical.test.ts','lib/warehouse/locationBarcode.ts']) {
    const plan=classifyChanges([path]);
    has(plan,'warehouse');
    assert.ok(plan.scripts.includes('test:core-lean-r2-w5-profile'),path);
  }
});
test('renaming an auth or stock module cannot become docs-only', () => {
  const files = parseGitNameStatusZ('R100\0lib/server/warehouseWithdrawalWrite.ts\0docs/old-withdrawal.md\0');
  assert.deepEqual(files, ['lib/server/warehouseWithdrawalWrite.ts', 'docs/old-withdrawal.md']);
  has(classifyChanges(files), 'warehouse');
  assert.throws(() => parseGitNameStatusZ('R100\0old.ts\0'), /CI_LEAN_MALFORMED_RENAME/);
  assert.throws(() => parseGitNameStatusZ('Z\0file.ts\0'), /CI_LEAN_UNRECOGNIZED_DIFF_STATUS/);
});
