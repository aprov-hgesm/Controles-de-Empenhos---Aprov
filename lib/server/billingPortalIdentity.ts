/**
 * EMPROVEX billing portal: identity-bound, READ-ONLY Firebase REST bridge.
 * Uses the caller's Firebase ID token, so existing Firestore Rules still
 * enforce all tenant permissions. No admin credential is required for /portal.
 */
import { decodeJwt } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json';
import { normalizePlatformEmail, type PlatformAccount, type Workspace } from '../platformIdentity';
import { validateBillingIdentity } from '../billing/billingWorkspaceIdentity.mjs';
import type { BillingAccount } from '../billing';

const PROJECT = firebaseConfig.projectId;
const DATABASE = firebaseConfig.firestoreDatabaseId;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT)}/databases/${encodeURIComponent(DATABASE)}/documents`;

export class BillingPortalFailure extends Error {
  constructor(public readonly code: string, public readonly status = 403) {
    super(code);
  }
}

export function extractBearer(request: Request): string {
  const auth = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_.-]{100,6000})$/.exec(auth);
  if (!match) throw new BillingPortalFailure('BILLING_AUTH_REQUIRED', 401);
  return match[1];
}

type AuthUser = {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
};

function firestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.stringValue === 'string') return value.stringValue;
  if (typeof value.timestampValue === 'string') return value.timestampValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (typeof value.booleanValue === 'boolean') return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.mapValue?.fields) return Object.fromEntries(
    Object.entries(value.mapValue.fields).map(([key, inner]) => [key, firestoreValue(inner)])
  );
  if (value.arrayValue) return (value.arrayValue.values || []).map(firestoreValue);
  return null;
}

function firestoreData(payload: any): Record<string, any> | null {
  if (!payload || !payload.fields) return null;
  return Object.fromEntries(Object.entries(payload.fields)
    .map(([key, value]) => [key, firestoreValue(value)]));
}

async function firestoreGet(
  token: string, collection: string, document: string,
  fetchImpl: typeof fetch
): Promise<Record<string, any> | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(collection)
    || !/^[a-zA-Z0-9@._+-]{1,240}$/.test(document)) {
    throw new BillingPortalFailure('BILLING_INVALID_DOCUMENT', 400);
  }
  const path = `${FIRESTORE_ROOT}/${encodeURIComponent(collection)}/${encodeURIComponent(document)}`;
  const response = await fetchImpl(path, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new BillingPortalFailure('BILLING_DIRECTORY_UNAVAILABLE', 503);
  return firestoreData(await response.json());
}

export async function resolveBillingPortalSession(
  request: Request,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<{ uid: string; email: string; workspace: Workspace; account: BillingAccount | null }> {
  const token = extractBearer(request);
  const response = await fetchImpl(AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
  });
  if (!response.ok) throw new BillingPortalFailure('BILLING_AUTH_INVALID', 401);
  const result = await response.json() as { users?: AuthUser[] };
  const user = result.users?.[0];
  if (!user?.localId || !user.email || user.emailVerified !== true || user.disabled === true) {
    throw new BillingPortalFailure('BILLING_AUTH_INVALID', 401);
  }
  let claims: ReturnType<typeof decodeJwt>;
  try { claims = decodeJwt(token); }
  catch { throw new BillingPortalFailure('BILLING_TOKEN_INVALID', 401); }
  const signedEmail = normalizePlatformEmail(user.email);
  const jwtEmail = typeof claims.email === 'string' ? normalizePlatformEmail(claims.email) : '';
  const provider = (claims.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (claims.aud !== PROJECT || claims.iss !== `https://securetoken.google.com/${PROJECT}`
    || claims.sub !== user.localId || jwtEmail !== signedEmail
    || claims.email_verified !== true || provider !== 'password') {
    throw new BillingPortalFailure('BILLING_IDENTITY_INVALID');
  }

  const accountData = await firestoreGet(token, 'platformAccounts', signedEmail, fetchImpl);
  if (!accountData) throw new BillingPortalFailure('BILLING_ACCOUNT_NOT_FOUND');
  const platformAccount = accountData as PlatformAccount;
  if (platformAccount.accountType !== 'sector'
    || !platformAccount.workspaceId
    || !/^[a-z0-9-]{3,48}$/.test(platformAccount.workspaceId)) {
    throw new BillingPortalFailure('BILLING_ACCOUNT_NOT_AUTHORIZED');
  }
  const workspaceData = await firestoreGet(token, 'workspaces', platformAccount.workspaceId, fetchImpl);
  if (!workspaceData) throw new BillingPortalFailure('BILLING_WORKSPACE_NOT_FOUND');
  const workspace = workspaceData as Workspace;
  if (!validateBillingIdentity({
    uid: user.localId, email: signedEmail, verifiedEmail: true,
    provider, account: platformAccount, workspace,
  })) throw new BillingPortalFailure('BILLING_IDENTITY_MISMATCH');

  const billingData = await firestoreGet(token, 'billingAccounts', workspace.id, fetchImpl);
  const account = billingData as BillingAccount | null;
  if (account && (
    account.workspaceId !== workspace.id
    || normalizePlatformEmail(account.authorizedEmail) !== signedEmail
    || account.ug !== (workspace.ug || '')
  )) throw new BillingPortalFailure('BILLING_ACCOUNT_TENANT_MISMATCH');

  return { uid: user.localId, email: signedEmail, workspace, account };
}
