import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMBER_ROLES, MEMBER_ROLE_ACTIONS, normalizeMemberRoles,
  permitsCompanyAction, canGrantRoles,
} from '../../../lib/company/roles/index.ts';

test('role table is complete, finite and least privilege', () => {
  assert.equal(MEMBER_ROLES.length, 6);
  for (const role of MEMBER_ROLES) {
    assert.ok(MEMBER_ROLE_ACTIONS[role].length);
    assert.equal(new Set(MEMBER_ROLE_ACTIONS[role]).size, MEMBER_ROLE_ACTIONS[role].length);
  }
  assert.equal(permitsCompanyAction(['driver'], 'active', 'accountsPayable:read'), false);
  assert.equal(permitsCompanyAction(['stock'], 'active', 'members:write'), false);
  assert.equal(permitsCompanyAction(['operations'], 'active', 'stockEvents:write'), false);
  assert.equal(permitsCompanyAction(['finance'], 'active', 'accountsPayable:write'), true);
  assert.equal(permitsCompanyAction(['driver'], 'active', 'deliveries:write'), true);
});
test('multiple roles compose without cross-domain privilege', () => {
  const roles = normalizeMemberRoles(['finance', 'stock', 'finance']);
  assert.deepEqual(roles, ['finance', 'stock']);
  assert.equal(permitsCompanyAction(roles, 'active', 'stockEvents:write'), true);
  assert.equal(permitsCompanyAction(roles, 'active', 'accountsReceivable:write'), true);
  assert.equal(permitsCompanyAction(roles, 'active', 'members:write'), false);
});
test('invited, revoked and expired have no effective rights', () => {
  for (const status of ['invited', 'revoked', 'expired']) {
    assert.equal(permitsCompanyAction(['admin'], status, 'members:write'), false);
    assert.equal(permitsCompanyAction(['admin'], status, 'company:read', true), false);
  }
});
test('request cannot forge roles, owner or administrator', () => {
  for (const input of [[], ['owner'], ['admin','owner'], ['finance','finance','bad'], null, 'admin']) {
    assert.throws(() => normalizeMemberRoles(input), /COMPANY_INVALID_ROLES/);
  }
  assert.equal(canGrantRoles('member', ['admin']), false);
  assert.equal(canGrantRoles('admin', ['admin']), false);
  assert.equal(canGrantRoles('admin', ['stock'], ['admin']), false);
  assert.equal(canGrantRoles('admin', ['stock']), true);
  assert.equal(canGrantRoles('owner', ['admin']), true);
});
