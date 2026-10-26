import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const hook = read('hooks/usePlatformAdminBilling.ts');
const billingStore = read('lib/platformBillingStore.ts');
const billingDomain = read('lib/billing.ts');

const parsed = ts.createSourceFile('usePlatformAdminBilling.ts', hook, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const calls = [];
function visit(node) {
  if (ts.isCallExpression(node)) calls.push(node);
  ts.forEachChild(node, visit);
}
visit(parsed);
const name = (call) => call.expression.getText(parsed);
const effects = calls.filter((c) => name(c) === 'useEffect');

test('opening admin dashboard only attaches billing subscriptions and does not write', () => {
  assert.equal(effects.length, 1, 'unexpected effect added to billing dashboard');
  const body = effects[0].getText(parsed);
  for (const subscription of [
    'subscribePlatformBillingConfig', 'subscribePlatformBillingAccounts',
    'subscribePlatformBillingCycles'
  ]) assert.ok(body.includes(subscription), subscription);
  for (const forbidden of [
    'ensurePlatformBillingFoundation', 'runTransaction', 'setDoc(',
    'updateDoc(', 'addDoc(', 'batch.commit(', 'billing.price_migration'
  ]) assert.ok(!body.includes(forbidden), 'load time write risk: ' + forbidden);
  assert.equal(effects[0].arguments[1].getText(parsed), '[adminEmail]');
  assert.ok(!hook.includes('ensurePlatformBillingFoundation'), 'auto bootstrap must be absent from UI');
});

test('explicit billing administration actions are preserved', () => {
  for (const action of ['updateConfig', 'grantTrial', 'setExemption', 'setStatus', 'setCycleStatus']) {
    assert.ok(hook.includes(action + ','), 'missing explicit action: ' + action);
  }
  assert.ok(hook.includes('runMutation('), 'mutation error handling must remain');
});

test('no mutation to price and VIP domain contracts as a side effect of this hotfix', () => {
  assert.ok(billingDomain.includes('EMPROVEX_FULL_PLAN_PRICE_CENTS = 7000'));
  assert.ok(billingDomain.includes("if (account.status === 'exempt')") || billingDomain.includes("status === 'exempt'"));
  assert.ok(billingStore.includes('migratePlatformBillingConfigToSaasR1'), 'legacy migration remains available for future explicit controlled operation');
  assert.ok(billingStore.includes('appendPlatformAuditEvent'), 'audit must remain on explicit writes');
});
