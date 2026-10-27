import assert from 'node:assert/strict';
import test from 'node:test';
import { billingQaPilotEnabledFor } from '../lib/server/payments/billingAccessQaPilot.mjs';

const workspaceId = 'aprovisionamento-teste-3';
const base = {
  EMPROVEX_BILLING_QA_WORKSPACE_ID: workspaceId,
  INFINITEPAY_BILLING_ENABLED: '1',
  INFINITEPAY_BILLING_SCOPE: 'pilot',
  INFINITEPAY_BILLING_PILOT_WORKSPACE_ID: workspaceId,
};
test('QA gate permits only the specifically selected unpaid sector', () => {
  assert.equal(billingQaPilotEnabledFor({ workspaceId, env: base }), true);
  for (const id of ['aprovisionamento-teste-2', 'hgesm-aprov', 'vip-legacy-a', '']) {
    assert.equal(billingQaPilotEnabledFor({ workspaceId: id, env: base }), false);
  }
});
test('QA gate defaults OFF and requires same checkout allowlist', () => {
  for (const field of Object.keys(base)) {
    const env = { ...base };
    delete env[field];
    assert.equal(billingQaPilotEnabledFor({ workspaceId, env }), false, 'missing '+field);
  }
  assert.equal(billingQaPilotEnabledFor({ workspaceId, env: { ...base, INFINITEPAY_BILLING_SCOPE: 'all' } }), false);
  assert.equal(billingQaPilotEnabledFor({ workspaceId, env: { ...base, INFINITEPAY_BILLING_PILOT_WORKSPACE_ID: 'aprovisionamento-teste-2' } }), false);
  assert.equal(billingQaPilotEnabledFor({ workspaceId, env: { ...base, EMPROVEX_BILLING_QA_WORKSPACE_ID: 'hgesm-aprov' } }), false);
});
