import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { invitationMatches, canRevokeNonOwner } from '../../../lib/company/roles/invitation.ts';
const secret = 'a'.repeat(43);
const hash = createHash('sha256').update(secret).digest('hex');
const now = Date.parse('2026-11-05T20:00:00Z');
const fixture = () => ({
  id: 'hashed-email', companyId:'company-a', workspaceId:'company-a',
  email:'invite@example.org', firebaseUid:'', status:'invited',
  invitationHash:hash, invitationExpiresAt:'2026-11-12T20:00:00Z',
});
test('verified invite is scoped, expires and is one-time', () => {
  const good = fixture();
  assert.equal(invitationMatches(good,'company-a','invite@example.org',secret,now),true);
  for(const bad of [
    { ...good, companyId:'company-b' },
    { ...good, workspaceId:'company-b' },
    { ...good, email:'other@example.org' },
    { ...good, firebaseUid:'another-uid' },
    { ...good, status:'revoked' },
    { ...good, status:'active' },
    { ...good, invitationHash:'bad' },
    { ...good, invitationExpiresAt:'2026-11-01T00:00:00Z' },
  ]) assert.equal(invitationMatches(bad,'company-a','invite@example.org',secret,now),false);
  assert.equal(invitationMatches(good,'company-b','invite@example.org',secret,now),false);
  assert.equal(invitationMatches(good,'company-a','other@example.org',secret,now),false);
  assert.equal(invitationMatches(good,'company-a','invite@example.org','b'.repeat(43),now),false);
  assert.equal(invitationMatches(good,'company-a','invite@example.org',secret,Date.parse('2026-11-12T20:00:00Z')),false);
});
test('bootstrap owner cannot be removed, self-revocation is rejected', () => {
  const ownerUid='owner-uid', ownerEmail='owner@example.org';
  assert.equal(canRevokeNonOwner(ownerUid,ownerEmail,ownerUid,
    {firebaseUid:ownerUid,email:ownerEmail,status:'active'}),false);
  assert.equal(canRevokeNonOwner(ownerUid,ownerEmail,ownerUid,
    {firebaseUid:'user-uid',email:'staff@example.org',status:'active'}),true);
  assert.equal(canRevokeNonOwner(ownerUid,ownerEmail,'user-uid',
    {firebaseUid:'user-uid',email:'staff@example.org',status:'active'}),false);
  assert.equal(canRevokeNonOwner(ownerUid,ownerEmail,ownerUid,
    {firebaseUid:'user-uid',email:'staff@example.org',status:'revoked'}),false);
});
