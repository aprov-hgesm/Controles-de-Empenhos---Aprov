import { createHash, randomBytes, randomUUID } from 'node:crypto';
import firebaseConfig from '../../../firebase-applet-config.json';
import { COMPANY_CONTRACT_VERSION, companyDocumentPath, type CompanyAction } from '../../company/contracts';
import { isValidPlatformEmail, normalizePlatformEmail } from '../../platformIdentity';
import { verifyFirebaseRequest, FounderAuthError } from '../firebaseFounderAuth';
import { assertCompanyPilotEnabled, type CompanyAuthorizedContext } from '../companyAuthz';
import {
  normalizeMemberRoles, permitsCompanyAction, canGrantRoles,
  type CompanyMemberRole,
} from '../../company/roles';
import { invitationMatches, canRevokeNonOwner } from '../../company/roles/invitation';
import {
  getDocument, listDocuments, commitMemberChange, readIdentityDocument,
  MembershipStoreError,
} from './firestore';

export type CompanyMemberStatus = 'invited' | 'active' | 'revoked' | 'expired';
export interface CompanyMember {
  schemaVersion: typeof COMPANY_CONTRACT_VERSION;
  id: string;
  companyId: string;
  workspaceId: string;
  status: CompanyMemberStatus;
  email: string;
  firebaseUid: string;
  roles: CompanyMemberRole[];
  invitationHash: string;
  invitationExpiresAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export type PublicCompanyMember = Omit<CompanyMember, 'invitationHash'>;
export class CompanyMembershipError extends Error {
  constructor(public readonly code:
    | 'COMPANY_AUTH_INVALID' | 'COMPANY_INVALID_INPUT' | 'COMPANY_OPERATION_FORBIDDEN' | 'COMPANY_SCOPE_FORBIDDEN'
    | 'COMPANY_ACCOUNT_FORBIDDEN' | 'COMPANY_CONFLICT' | 'COMPANY_DIRECTORY_UNAVAILABLE',
    public readonly status: 400 | 401 | 403 | 404 | 409 | 503) {
    super(code);
  }
}
const error = (code: CompanyMembershipError['code'], status: CompanyMembershipError['status']) =>
  new CompanyMembershipError(code, status);
const sha = (input: string) => createHash('sha256').update(input).digest('hex');
export const memberIdForEmail = (email: string) => sha(normalizePlatformEmail(email));
const inviteTTL = 7 * 24 * 60 * 60 * 1000;
const now = () => new Date().toISOString();

function memberPublic(member: CompanyMember): PublicCompanyMember {
  const { invitationHash: _hidden, ...publicFields } = member;
  void _hidden;
  return {
    ...publicFields,
    status: member.status === 'invited' && member.invitationExpiresAt
      && Date.parse(member.invitationExpiresAt) <= Date.now() ? 'expired' : member.status,
  };
}
function assertFounderOwner(ctx: CompanyAuthorizedContext) {
  // W0 verifies founder UID against the company account, workspace and UID index.
  // Until integrator extends W0's guard, no member is elevated based on a request.
  if (ctx.role !== 'owner' || ctx.workspaceId !== ctx.companyId) {
    throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  }
}
function makeAudit(companyId: string, actorUid: string, id: string, before: number | null, after: number) {
  const eventId = randomUUID();
  return {
    eventId,
    event: {
      schemaVersion: COMPANY_CONTRACT_VERSION, eventId, companyId, actorUid,
      action: 'members:write' as const, entityType: 'members' as const, entityId: id,
      correlationId: randomUUID(), beforeRevision: before, afterRevision: after,
      occurredAt: now(),
    },
  };
}
function validateEmail(input: unknown): string {
  if (typeof input !== 'string' || input.length > 254 || !isValidPlatformEmail(input)) {
    throw error('COMPANY_INVALID_INPUT', 400);
  }
  return normalizePlatformEmail(input);
}
function memberId(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw error('COMPANY_INVALID_INPUT', 400);
  return id;
}
function assertRecordScope(companyId: string, id: string, record: CompanyMember) {
  if (record.companyId !== companyId || record.workspaceId !== companyId
    || record.id !== id || memberIdForEmail(record.email) !== id) {
    throw error('COMPANY_SCOPE_FORBIDDEN', 403);
  }
}
async function readMember(companyId: string, id: string) {
  return getDocument<CompanyMember>(companyDocumentPath(companyId, 'members', memberId(id)));
}
export async function listCompanyMembers(ctx: CompanyAuthorizedContext, size = 25, cursor = '') {
  assertFounderOwner(ctx);
  if (!Number.isSafeInteger(size) || size < 1 || size > 50
    || cursor.length > 2048 || /[^A-Za-z0-9_+\-=/.]/.test(cursor)) {
    throw error('COMPANY_INVALID_INPUT', 400);
  }
  const page = await listDocuments<CompanyMember>(ctx.companyId, size, cursor);
  return {
    // Owner is bootstrap in W0 canonical directory, not an editable member row.
    owner: { id: 'owner', email: ctx.authorizedEmail, firebaseUid: ctx.uid,
      status: 'active' as const, roles: ['admin'] as const, immutable: true },
    members: page.members.map(x => {
      assertRecordScope(ctx.companyId, x.value.id, x.value);
      return memberPublic(x.value);
    }),
    nextPageToken: page.nextPageToken,
  };
}
export async function inviteCompanyMember(
  ctx: CompanyAuthorizedContext,
  input: { email?: unknown; roles?: unknown },
) {
  assertFounderOwner(ctx);
  const email = validateEmail(input.email);
  if (email === ctx.authorizedEmail) throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  let roles: CompanyMemberRole[];
  try { roles = normalizeMemberRoles(input.roles); }
  catch { throw error('COMPANY_INVALID_INPUT', 400); }
  if (!canGrantRoles('owner', roles)) throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  const id = memberIdForEmail(email);
  const existing = await readMember(ctx.companyId, id);
  if (existing) assertRecordScope(ctx.companyId, id, existing.value);
  if (existing?.value.status === 'active'
    || (existing?.value.status === 'invited'
      && Date.parse(existing.value.invitationExpiresAt || '') > Date.now())) {
    throw error('COMPANY_CONFLICT', 409);
  }
  // Refuse inviting an identity already assigned to a sector, founder or other company.
  if (await readIdentityDocument('platformAccounts', email)) {
    throw error('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }
  const issuedAt = now();
  const invitationToken = randomBytes(32).toString('base64url');
  const member: CompanyMember = {
    schemaVersion: COMPANY_CONTRACT_VERSION, id, companyId: ctx.companyId,
    workspaceId: ctx.companyId, status: 'invited', email, firebaseUid: '', roles,
    invitationHash: sha(invitationToken),
    invitationExpiresAt: new Date(Date.now() + inviteTTL).toISOString(),
    acceptedAt: null, revokedAt: null, createdByUid: ctx.uid,
    createdAt: existing?.value.createdAt || issuedAt, updatedAt: issuedAt,
    revision: (existing?.value.revision || 0) + 1,
  };
  const audit = makeAudit(ctx.companyId, ctx.uid, id, existing?.value.revision || null, member.revision);
  await commitMemberChange(ctx.companyId, id,
    member as unknown as Record<string, unknown>, existing?.updateTime || null, audit.eventId, audit.event);
  // Secret is returned ONCE to the verified owner. Never stored in plaintext, logs or audit.
  return { member: memberPublic(member), invitationToken };
}
export async function changeCompanyMemberRoles(
  ctx: CompanyAuthorizedContext, id: string, rolesInput: unknown,
) {
  assertFounderOwner(ctx);
  const existing = await readMember(ctx.companyId, id);
  if (!existing || existing.value.status !== 'active') throw error('COMPANY_CONFLICT', 409);
  assertRecordScope(ctx.companyId, id, existing.value);
  let roles: CompanyMemberRole[];
  try { roles = normalizeMemberRoles(rolesInput); }
  catch { throw error('COMPANY_INVALID_INPUT', 400); }
  if (!canGrantRoles('owner', roles, existing.value.roles)) throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  if (existing.value.firebaseUid === ctx.uid) throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  const changed: CompanyMember = { ...existing.value, roles, revision: existing.value.revision + 1, updatedAt: now() };
  const audit = makeAudit(ctx.companyId, ctx.uid, id, existing.value.revision, changed.revision);
  await commitMemberChange(ctx.companyId, id, changed as unknown as Record<string, unknown>,
    existing.updateTime, audit.eventId, audit.event);
  return memberPublic(changed);
}
export async function revokeCompanyMember(ctx: CompanyAuthorizedContext, id: string) {
  assertFounderOwner(ctx);
  const existing = await readMember(ctx.companyId, id);
  if (!existing) throw error('COMPANY_CONFLICT', 409);
  assertRecordScope(ctx.companyId, id, existing.value);
  // The immutable W0 owner is the final administrator. No last-admin removal.
  if (!canRevokeNonOwner(ctx.uid, ctx.authorizedEmail, ctx.uid, existing.value)) {
    throw error('COMPANY_OPERATION_FORBIDDEN', 403);
  }
  const changed: CompanyMember = {
    ...existing.value, status: 'revoked', invitationHash: '', invitationExpiresAt: null,
    revokedAt: now(), updatedAt: now(), revision: existing.value.revision + 1,
  };
  const audit = makeAudit(ctx.companyId, ctx.uid, id, existing.value.revision, changed.revision);
  await commitMemberChange(ctx.companyId, id, changed as unknown as Record<string, unknown>,
    existing.updateTime, audit.eventId, audit.event);
  return memberPublic(changed);
}
/** Confirm Auth is active *now*, not merely when ID token was issued. */
async function verifyCurrentAuth(authorization: string | null) {
  let verified;
  try { verified = await verifyFirebaseRequest(authorization); }
  catch (e) {
    if (e instanceof FounderAuthError) throw error('COMPANY_AUTH_INVALID', e.status === 401 ? 401 : 403);
    throw error('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  }
  if (verified.signInProvider !== 'password') throw error('COMPANY_ACCOUNT_FORBIDDEN', 403);
  const demo = process.env.EMPROVEX_E2E_SERVER_AUTH === '1';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  const demoId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || '';
  if (demo && (!demoId.startsWith('demo-')
    || !['127.0.0.1:9099', 'localhost:9099'].includes(authHost)
    || process.env.K_SERVICE || process.env.VERCEL || process.env.NODE_ENV === 'production')) {
    throw error('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  }
  const url = demo
    ? `http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(demoId)}/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`
    : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST', cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(demo ? {authorization:'Bearer owner'} : {}) },
      body: JSON.stringify(demo ? {localId:[verified.uid]} : {idToken:verified.idToken}),
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw error('COMPANY_DIRECTORY_UNAVAILABLE', 503); }
  if (!response.ok) throw error(response.status >= 500 ? 'COMPANY_DIRECTORY_UNAVAILABLE' : 'COMPANY_ACCOUNT_FORBIDDEN',
    response.status >= 500 ? 503 : 403);
  const payload = await response.json() as { users?: Array<{
    localId?: string; email?: string; emailVerified?: boolean; disabled?: boolean
  }> };
  const user = payload.users?.[0];
  if (!user || user.localId !== verified.uid
    || normalizePlatformEmail(user.email || '') !== verified.email
    || user.emailVerified !== true || user.disabled === true) {
    throw error('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }
  return verified;
}
async function assertCompanyDirectoryActive(companyId: string) {
  const workspace = (await readIdentityDocument('workspaces', companyId))?.value;
  const profile = workspace?.companyProfile as Record<string, unknown> | undefined;
  if (!workspace || workspace.workspaceType !== 'company' || workspace.status !== 'active'
    || workspace.id !== companyId || profile?.registrationStatus !== 'active') {
    throw error('COMPANY_SCOPE_FORBIDDEN', 403);
  }
}
async function assertNotMilitaryOrOtherTenant(email: string, uid: string) {
  // No automatic conversion of a sector/platform identity into a company member.
  if (await readIdentityDocument('platformAccounts', email)
    || await readIdentityDocument('platformAuthUidIndex', uid)) {
    throw error('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }
}
/**
 * One-time invitation redemption is intentionally narrower than the W0 data
 * guard. It returns only the accepted member row, never company resources.
 * Integrator must extend W0 directory/guard before this member can use APIs.
 */
export async function acceptCompanyInvitation(
  authorization: string | null,
  input: { companyId?: unknown; invitationToken?: unknown },
) {
  assertCompanyPilotEnabled();
  const principal = await verifyCurrentAuth(authorization);
  const companyId = input.companyId;
  const token = input.invitationToken;
  if (typeof companyId !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(companyId)
    || typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw error('COMPANY_INVALID_INPUT', 400);
  }
  await assertNotMilitaryOrOtherTenant(principal.email, principal.uid);
  await assertCompanyDirectoryActive(companyId);
  const id = memberIdForEmail(principal.email);
  const existing = await readMember(companyId, id);
  if (!existing || !invitationMatches(existing.value, companyId, principal.email, token)) {
    throw error('COMPANY_SCOPE_FORBIDDEN', 403);
  }
  const index = await readIdentityDocument('companyMemberAuthIndex', principal.uid);
  // A verified UID may not be mapped to a second tenant through an invitation.
  if (index && (index.value.firebaseUid !== principal.uid
    || index.value.companyId !== companyId || index.value.workspaceId !== companyId
    || index.value.email !== principal.email)) {
    throw error('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }
  const accepted: CompanyMember = {
    ...existing.value, status: 'active', firebaseUid: principal.uid,
    invitationHash: '', invitationExpiresAt: null,
    acceptedAt: now(), updatedAt: now(), revision: existing.value.revision + 1,
  };
  const audit = makeAudit(companyId, principal.uid, id, existing.value.revision, accepted.revision);
  await commitMemberChange(companyId, id, accepted as unknown as Record<string, unknown>,
    existing.updateTime, audit.eventId, audit.event, {
      uid: principal.uid, email: principal.email, companyId,
      existingUpdateTime: index?.updateTime || null,
    });
  return { member: memberPublic(accepted), accessPendingIntegration: false };
}
/** Hook for W0 integrator: must be invoked only after verifying company directory. */
export async function checkLiveMemberCapability(
  companyId: string, principal: { uid: string; email: string },
  action: CompanyAction,
): Promise<boolean> {
  await assertCompanyDirectoryActive(companyId);
  await assertNotMilitaryOrOtherTenant(principal.email, principal.uid);
  const found = await readMember(companyId, memberIdForEmail(principal.email));
  return Boolean(found && found.value.id === memberIdForEmail(principal.email)
    && found.value.email === principal.email
    && found.value.workspaceId === companyId
    && found.value.companyId === companyId
    && found.value.firebaseUid === principal.uid
    && permitsCompanyAction(found.value.roles, found.value.status, action));
}
/** Explicit mapping for API errors; no sensitive token or Firestore body in responses. */
export function membershipHttpError(e: unknown) {
  if (e instanceof CompanyMembershipError || e instanceof MembershipStoreError) {
    return { code: e.code, status: e.status };
  }
  return null;
}
