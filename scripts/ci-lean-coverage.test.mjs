#!/usr/bin/env node
/** Executable parity and deliberate removal mutations for new mandatory suites. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEEP_DOMAIN_TESTS} from './ci-lean-domain.mjs';
import {classifyChanges} from './ci-lean-plan.mjs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const app=readFileSync(new URL('../.github/workflows/application-ci.yml',import.meta.url),'utf8');
const critical={
  warehouse:['test:core-lean-r2-w4-contract','test:core-lean-r2-w4-assurance',
    'test:core-lean-r2-w1-contract','test:core-lean-r2-w1-emulator',
    'test:core-lean-r2-w4-v3','test:core-lean-r2-w5-historical'],
  finance:['test:financial-identity-v2','test:core-lean-r2-w4-financial','test:invoice-identity',
    'test:ns-integrity','test:ns-integrity-contract','test:supplier-cnpj-migration','test:empenho-concurrency'],
  auth:['test:core-lean-r2-w4-authz','test:security:multitenant']
};
export function auditCriticalGates(yaml,domains=DEEP_DOMAIN_TESTS,scripts=pkg.scripts) {
  for(const [domain,suites] of Object.entries(critical)) {
    for(const name of suites) {
      if(typeof scripts[name]!=='string')throw Error('CI_LEAN_MISSING_NPM_SCRIPT: '+name);
      if(!domains[domain]?.includes(name))throw Error('CI_LEAN_MISSING_DOMAIN_GATE: '+domain+': '+name);
      if(!yaml.includes('run: npm run '+name))throw Error('CI_LEAN_MISSING_RELEASE_GATE: '+name);
    }
  }
  for(const name of ['block-16-release-gate','block-17-final-release-gate','block-18-final-release-gate',
    'block-19-final-closure-gate','block-20-final-release-gate','block-21-final-release-gate']) {
    if(!yaml.includes('  '+name+':'))throw Error('CI_LEAN_LEGACY_RELEASE_ALIAS_MISSING: '+name);
  }
  return true;
}
test('native Fast/Domain/Application financial coverage replaces transient W3 pretypecheck hook',()=>{
  assert.equal(pkg.scripts.pretypecheck,undefined,
    'remove W3 pretypecheck bridge only after retaining six native financial suites');
  for(const script of ['test:financial-identity-v2','test:invoice-identity','test:ns-integrity',
    'test:empenho-concurrency','test:supplier-cnpj-migration','test:ns-integrity-contract']) {
    assert.ok(DEEP_DOMAIN_TESTS.finance.includes(script),'missing native financial Domain '+script);
    assert.ok(classifyChanges(['lib/financialIdentityV2.ts']).scripts.includes(script),
      'missing native Fast coverage '+script);
    assert.ok(app.includes('run: npm run '+script),'missing native Release '+script);
  }
});
test('all inherited release aliases and critical W1/W3/W4/W5/AuthZ gates exist',()=>{
  assert.equal(auditCriticalGates(app),true);
});
test('mutation: deleting independent v3 adversarial from Release fails closed',()=>{
  const mutant=app.replace('run: npm run test:core-lean-r2-w4-v3','run: echo mutant_removed_v3');
  assert.throws(()=>auditCriticalGates(mutant),/CI_LEAN_MISSING_RELEASE_GATE/);
});
test('mutation: deleting financial test from Domain fails closed',()=>{
  const mutant={...DEEP_DOMAIN_TESTS,finance:DEEP_DOMAIN_TESTS.finance.filter(x=>x!=='test:financial-identity-v2')};
  assert.throws(()=>auditCriticalGates(app,mutant),/CI_LEAN_MISSING_DOMAIN_GATE/);
});
test('mutation: removing authz npm script or historical release alias is detected',()=>{
  const copy={...pkg.scripts};
  delete copy['test:core-lean-r2-w4-authz'];
  assert.throws(()=>auditCriticalGates(app,DEEP_DOMAIN_TESTS,copy),/CI_LEAN_MISSING_NPM_SCRIPT/);
  assert.throws(()=>auditCriticalGates(app.replace('  block-21-final-release-gate:','  removed:'),DEEP_DOMAIN_TESTS,pkg.scripts),/CI_LEAN_LEGACY_RELEASE_ALIAS_MISSING/);
});
test('path-to-risk mapping selects each new independent protection',()=>{
  for(const [path,script] of [
    ['scripts/core-lean-r2-w4-financial.test.mjs','test:core-lean-r2-w4-financial'],
    ['scripts/core-lean-r2-w4-authz.test.mjs','test:core-lean-r2-w4-authz'],
    ['lib/server/authorizationPolicy.ts','test:core-lean-r2-w4-authz'],
    ['lib/financialIdentityV2.ts','test:financial-identity-v2'],
    ['lib/server/warehouseWithdrawalWrite.ts','test:core-lean-r2-w1-contract'],
  ])assert.ok(classifyChanges([path]).scripts.includes(script),path+' did not include '+script);
});
