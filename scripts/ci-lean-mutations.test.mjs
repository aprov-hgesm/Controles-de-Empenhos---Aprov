#!/usr/bin/env node
/**
 * Controlled reversible negative controls. Nothing touches repository working
 * files: syntax mutation lives in OS tmp; runner failures use injected spawn.
 * Historical/transactional behavior remains in separate executable suites.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyChanges, discoverImporters, parseGitNameStatusZ, DOMAINS } from './ci-lean-plan.mjs';
import { checkChangedScripts } from './ci-lean-syntax.mjs';
import { domainTests, runDomain } from './ci-lean-domain.mjs';

const covers=(file,domain,script)=> {
  const p=classifyChanges([file]);
  assert.ok(p.domains.includes(domain), file+' missing '+domain);
  assert.ok(p.scripts.includes(script), file+' missing '+script);
};

test('mutation 1: syntactically broken executable script is rejected by real node --check',()=>{
  const root=mkdtempSync(join(tmpdir(),'emprovex-ci-mutation-'));
  try {
    mkdirSync(join(root,'scripts'));
    writeFileSync(join(root,'scripts','mutated.mjs'),'function broken( {');
    const result=checkChangedScripts(['scripts/mutated.mjs'],process.execPath,root);
    assert.deepEqual(result.failed,['scripts/mutated.mjs']);
  }finally{rmSync(root,{recursive:true,force:true});}
});

function failingDomain(domain,script){
  assert.ok(domainTests(domain).includes(script), 'missing deep suite '+script);
  const calls=[];
  const result=runDomain(domain,(_,args)=>{
    const name=args[1];calls.push(name);
    return {status:name===script?1:0};
  });
  assert.ok(calls.includes(script));
  assert.ok(result.failures.includes(script), 'domain incorrectly PASSed a failed command');
}
test('mutation 2: failed Warehouse idempotency/atomicity suite makes domain FAIL',()=>{
  covers('lib/server/warehouseWithdrawalAtomicWrite.ts','warehouse','test:core-lean-r2-w4-contract');
  failingDomain('warehouse','test:core-lean-r2-w4-assurance');
});
test('mutation 3: failed authorization suite makes auth FAIL',()=>{
  covers('lib/server/warehouseAccess.ts','warehouse','test:core-lean-r2-w4-contract');
  covers('lib/server/warehouseAccess.ts','auth','verify:multitenant-security');
  failingDomain('auth','test:security:multitenant');
});
test('mutation 4: institutional isolation regression cannot be ignored',()=>{
  covers('firestore.warehouse.server-only.rules','auth','verify:emprovex-warehouse-isolation');
  failingDomain('warehouse','test:core-lean-r2-w4-assurance');
});
test('mutation 5: financial identity assertion failure propagates to Domain FAIL',()=>{
  covers('lib/financialIdentityV2.ts','finance','test:financial-identity-v2');
  failingDomain('finance','test:financial-identity-v2');
});
test('mutation 6: shared file propagates transitively through importers',()=>{
  const root=mkdtempSync(join(tmpdir(),'emprovex-ci-imports-'));
  try{
    mkdirSync(join(root,'lib/shared'),{recursive:true});
    mkdirSync(join(root,'lib/warehouse'),{recursive:true});
    mkdirSync(join(root,'scripts'),{recursive:true});
    writeFileSync(join(root,'lib/shared/ids.ts'),'export const id=123;');
    writeFileSync(join(root,'lib/warehouse/withdrawal.ts'),"import { id } from '../shared/ids';");
    writeFileSync(join(root,'scripts/warehouse-withdrawal.test.mjs'),"import '../lib/warehouse/withdrawal';");
    const importers=discoverImporters(['lib/shared/ids.ts'],root);
    assert.ok(importers.includes('lib/warehouse/withdrawal.ts'));
    covers(importers.find(x=>x.includes('warehouse/withdrawal.ts')),'warehouse','test:core-lean-r2-w4-contract');
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('mutation 7: new unknown code expands to all domains',()=>{
  assert.deepEqual(classifyChanges(['new-module/new-command.ts']).domains,DOMAINS);
});
test('mutation 8: critical renamed into docs retains security selection',()=>{
  const files=parseGitNameStatusZ('R100\\0lib/server/warehouseAccess.ts\\0docs/warehouseAccess.md\\0'.replaceAll('\\0','\\0'));
  const plan=classifyChanges(files);
  assert.ok(plan.domains.includes('warehouse'));
  assert.ok(plan.domains.includes('auth'));
});
test('mutation 9: financial and adversarial test edits select their own execution',()=>{
  covers('scripts/financial-identity-v2.test.mjs','finance','test:financial-identity-v2');
  covers('scripts/core-lean-r2-w4-contract.test.ts','warehouse','test:core-lean-r2-w4-contract');
  covers('scripts/core-lean-r2-w4-assurance-emulator.ts','warehouse','test:core-lean-r2-w4-contract');
});
test('mutation 10: workflow edit triggers conservative all-domain coverage',()=>{
  assert.deepEqual(classifyChanges(['.github/workflows/application-ci.yml']).domains,DOMAINS);
});
