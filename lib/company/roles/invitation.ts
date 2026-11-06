import { createHash, timingSafeEqual } from 'node:crypto';

/** Pure, auditable policies. Caller must verify signed Firebase Auth and tenant first. */
export interface InvitationRecord {
  id: string;
  companyId: string;
  workspaceId: string;
  email: string;
  firebaseUid: string;
  status: 'invited' | 'active' | 'revoked' | 'expired';
  invitationHash: string;
  invitationExpiresAt: string | null;
}
export function invitationMatches(
  record: InvitationRecord, claimedCompanyId: string,
  verifiedEmail: string, token: string, timeMs: number = Date.now(),
): boolean {
  if (!record || record.companyId !== claimedCompanyId || record.workspaceId !== claimedCompanyId
    || record.status !== 'invited' || Boolean(record.firebaseUid)
    || record.email !== verifiedEmail
    || typeof record.invitationHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.invitationHash)
    || !record.invitationExpiresAt || !Number.isFinite(Date.parse(record.invitationExpiresAt))
    || Date.parse(record.invitationExpiresAt) <= timeMs
    || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const expected = Buffer.from(record.invitationHash, 'hex');
  const supplied = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
/** The W0 bootstrap owner is immutable, including its final admin grant. */
export function canRevokeNonOwner(
  ownerUid: string, ownerEmail: string, actorUid: string,
  member: { firebaseUid: string; email: string; status: string },
): boolean {
  return member.email !== ownerEmail && member.firebaseUid !== ownerUid
    && member.firebaseUid !== actorUid
    && (member.status === 'active' || member.status === 'invited');
}
