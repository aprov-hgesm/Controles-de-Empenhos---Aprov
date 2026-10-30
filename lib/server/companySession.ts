import firebaseConfig from '../../firebase-applet-config.json';
import {
  isValidWorkspaceId,
  normalizePlatformEmail,
} from '../platformIdentity';
import {
  FounderAuthError,
  verifyFirebaseRequest,
} from './firebaseFounderAuth';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

const DB_ROOT = 'https://firestore.googleapis.com/v1/projects/'
  + encodeURIComponent(firebaseConfig.projectId)
  + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='
  + encodeURIComponent(firebaseConfig.apiKey);

type FireValue = {
  stringValue?: string;
  mapValue?: { fields?: Record<string, FireValue> };
};
type FireDocument = { fields?: Record<string, FireValue> };
type AuthLookup = { users?: Array<{
  localId?: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
}> };

export interface VerifiedCompanyContext {
  accountType: 'company';
  workspaceType: 'company';
  workspaceId: string;
  firebaseUid: string;
  authorizedEmail: string;
  companyName: string;
  tradeName: string | null;
  legalName: string | null;
}

export class CompanyAccessError extends Error {
  constructor(public readonly code: string, public readonly status: 401 | 403 | 503) {
    super(code);
    this.name = 'CompanyAccessError';
  }
}

function readString(doc: FireDocument | null, field: string): string {
  return doc?.fields?.[field]?.stringValue || '';
}

function readNestedString(doc: FireDocument, group: string, field: string): string {
  return doc.fields?.[group]?.mapValue?.fields?.[field]?.stringValue || '';
}

/**
 * Privileged, read-only lookups. The client does not need any new Firestore
 * Rules to read the company directory; only this endpoint owns that access.
 */
async function readDirectoryDocument(
  serviceToken: string,
  collection: 'platformAccounts' | 'workspaces',
  documentId: string
): Promise<FireDocument | null> {
  const result = await fetch(DB_ROOT + '/' + collection + '/' + encodeURIComponent(documentId), {
    headers: { authorization: 'Bearer ' + serviceToken },
    cache: 'no-store',
  });
  if (result.status === 404) return null;
  if (!result.ok) throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  return await result.json() as FireDocument;
}

async function verifyActiveFirebaseUser(token: string, uid: string, email: string): Promise<void> {
  const response = await fetch(IDENTITY_LOOKUP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
  });
  if (!response.ok) throw new CompanyAccessError('COMPANY_AUTH_INVALID', 401);
  const payload = await response.json() as AuthLookup;
  const candidate = payload.users?.[0];
  if (
    candidate?.localId !== uid ||
    normalizePlatformEmail(candidate.email || '') !== email ||
    candidate.emailVerified !== true ||
    candidate.disabled === true
  ) {
    throw new CompanyAccessError('COMPANY_AUTH_INVALID', 401);
  }
}

/**
 * Every company-facing data API must call this function before reading or
 * mutating company resources. Frontend routing is never an authorization gate.
 */
export async function verifyCompanySession(authorization: string | null): Promise<VerifiedCompanyContext> {
  let verified;
  try {
    verified = await verifyFirebaseRequest(authorization);
  } catch (error) {
    if (error instanceof FounderAuthError) {
      throw new CompanyAccessError('COMPANY_AUTH_INVALID', error.status);
    }
    throw new CompanyAccessError('COMPANY_AUTH_INVALID', 401);
  }

  if (verified.signInProvider !== 'password') {
    throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }

  await verifyActiveFirebaseUser(verified.idToken, verified.uid, verified.email);
  let serviceToken: string;
  try {
    serviceToken = await getGoogleAccessToken();
  } catch {
    throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  }

  const account = await readDirectoryDocument(serviceToken, 'platformAccounts', verified.email);
  if (!account) throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);

  const workspaceId = readString(account, 'workspaceId');
  const accountUid = readString(account, 'firebaseUid');
  const accountEmail = normalizePlatformEmail(readString(account, 'email'));
  const accountAuthorizedEmail = readString(account, 'authorizedEmail');
  const normalizedAccountAuthorizedEmail = accountAuthorizedEmail
    ? normalizePlatformEmail(accountAuthorizedEmail)
    : accountEmail;

  if (
    readString(account, 'accountType') !== 'company' ||
    readString(account, 'status') !== 'active' ||
    (readString(account, 'authProvider') || 'password') !== 'password' ||
    accountUid !== verified.uid ||
    accountEmail !== verified.email ||
    normalizedAccountAuthorizedEmail !== verified.email ||
    !isValidWorkspaceId(workspaceId)
  ) {
    throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
  }

  const workspace = await readDirectoryDocument(serviceToken, 'workspaces', workspaceId);
  if (!workspace) throw new CompanyAccessError('COMPANY_WORKSPACE_FORBIDDEN', 403);

  const workspaceEmail = normalizePlatformEmail(readString(workspace, 'authorizedEmail'));
  if (
    readString(workspace, 'id') !== workspaceId ||
    readString(workspace, 'workspaceType') !== 'company' ||
    readString(workspace, 'status') !== 'active' ||
    workspaceEmail !== verified.email
  ) {
    throw new CompanyAccessError('COMPANY_WORKSPACE_FORBIDDEN', 403);
  }

  const tradeName = readString(workspace, 'tradeName')
    || readString(workspace, 'nomeFantasia')
    || readNestedString(workspace, 'companyProfile', 'tradeName')
    || readNestedString(workspace, 'companyProfile', 'nomeFantasia');
  const legalName = readString(workspace, 'legalName')
    || readString(workspace, 'razaoSocial')
    || readNestedString(workspace, 'companyProfile', 'legalName')
    || readNestedString(workspace, 'companyProfile', 'razaoSocial');
  const companyName = tradeName || legalName || readString(workspace, 'name');

  if (!companyName.trim()) throw new CompanyAccessError('COMPANY_WORKSPACE_FORBIDDEN', 403);

  return {
    accountType: 'company',
    workspaceType: 'company',
    workspaceId,
    firebaseUid: verified.uid,
    authorizedEmail: verified.email,
    companyName,
    tradeName: tradeName || null,
    legalName: legalName || null,
  };
}
