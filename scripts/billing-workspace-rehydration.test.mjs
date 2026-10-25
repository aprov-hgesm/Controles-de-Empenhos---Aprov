import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBillingIdentity } from '../lib/billing/billingWorkspaceIdentity.mjs';

const base = () => ({
  uid: 'uid-owner',
  email: 'account@example.com',
  verifiedEmail: true,
  provider: 'password',
  account: {
    accountType: 'sector', status: 'active', authProvider: 'password',
    email: 'account@example.com', firebaseUid: 'uid-owner',
    workspaceId: 'workspace-owner', ug: '123456',
  },
  workspace: {
    id: 'workspace-owner', status: 'active',
    authorizedEmail: 'account@example.com', ug: '123456',
  },
});

test('owner session with matching provider, UID, account and workspace is accepted', () => {
  assert.equal(validateBillingIdentity(base()), true);
});

test('rejects missing email verification, incorrect provider and forged UID', () => {
  for (const changes of [
    { verifiedEmail: false }, { provider: 'google.com' }, { uid: 'other-uid' },
    { email: 'someone-else@example.com' }, { uid: '' },
  ]) {
    assert.equal(validateBillingIdentity({ ...base(), ...changes }), false);
  }
});

test('rejects disabled, incorrect account type or invalid directory entry', () => {
  for (const changes of [
    { status: 'disabled' }, { accountType: 'platformAdmin' },
    { firebaseUid: undefined }, { firebaseUid: 'different-uid' },
    { email: 'wrong@example.com' }, { authProvider: 'google.com' },
    { workspaceId: 'other-tenant' },
  ]) {
    const obj = base();
    obj.account = { ...obj.account, ...changes };
    assert.equal(validateBillingIdentity(obj), false);
  }
});

test('rejects workspace ID, email and active-state mismatches', () => {
  for (const changes of [
    { id: 'different-tenant' }, { authorizedEmail: 'other@example.com' },
    { status: 'disabled' },
  ]) {
    const obj = base();
    obj.workspace = { ...obj.workspace, ...changes };
    assert.equal(validateBillingIdentity(obj), false);
  }
});

test('rejects tenant UG mismatch and missing UG on only one side', () => {
  for (const accountUg of ['000000', '12345', null, undefined]) {
    const obj = base();
    obj.account.ug = accountUg;
    assert.equal(validateBillingIdentity(obj), false);
  }
  const missingAccountUg = base();
  delete missingAccountUg.account.ug;
  assert.equal(validateBillingIdentity(missingAccountUg), false);
  const missingWorkspaceUg = base();
  delete missingWorkspaceUg.workspace.ug;
  assert.equal(validateBillingIdentity(missingWorkspaceUg), false);
  const historical = base();
  delete historical.account.ug;
  delete historical.workspace.ug;
  assert.equal(validateBillingIdentity(historical), true);
});

test('read-only resolver never uses a user-provided tenant ID or writes', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile('lib/billing/resolveBillingWorkspaceContext.ts', 'utf8');
  assert.match(source, /getDoc\(doc\(db, 'platformAccounts', email\)\)/);
  assert.match(source, /getDoc\(doc\(db, 'workspaces', account.workspaceId\)\)/);
  assert.match(source, /validatePlatformAccount\(account\)/);
  assert.match(source, /validateWorkspace\(workspace\)/);
  assert.match(source, /validateBillingIdentity/);
  assert.doesNotMatch(source, /runTransaction|setDoc|updateDoc|writeBatch|localStorage|sessionStorage/);
});
