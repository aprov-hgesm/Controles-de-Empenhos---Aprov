import firebaseConfig from '../../config/empresas-firebase-web.json';
import {
  isValidWorkspaceId,
  normalizePlatformEmail,
} from '../platformIdentity';
import {
  FounderAuthError,
  verifyCompanyFirebaseRequest,
} from './companyFirebaseAuth';
import { getCompanyAccessToken } from './companyFirebaseRuntime';
import { checkLiveMemberCapability } from './companyMembership';

const DB_ROOT = 'https://firestore.googleapis.com/v1/projects/'
  + encodeURIComponent(firebaseConfig.projectId)
  + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='
  + encodeURIComponent(firebaseConfig.apiKey);

/**
 * Isolamento estrito: tokens do Firebase Auth Emulator nunca devem ser enviados
 * aos serviços reais de Auth/Firestore. Fora da suíte demo, somente os serviços
 * oficiais são consultados. Nenhum host variável não-local é aceito aqui.
 */
function e2eEmulators(): { auth: string; firestore: string; projectId: string } | null {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH !== '1') return null;
  const projectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || '';
  const firestore = process.env.FIRESTORE_EMULATOR_HOST?.trim() || '';
  if (
    !projectId.startsWith('demo-')
    || !['127.0.0.1:9099', 'localhost:9099'].includes(auth)
    || !['127.0.0.1:8080', 'localhost:8080'].includes(firestore)
  ) return null;
  return { auth, firestore, projectId };
}

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
  /** Present only for invited employees; not derived from the browser. */
  accessRole?: 'member';
  /** Set only after W10-III revalidates selected profile and action LIVE. */
  profileCapabilityVerified?: boolean;
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
  collection: 'platformAccounts' | 'workspaces' | 'platformAuthUidIndex' | 'companyMemberAuthIndex',
  documentId: string
): Promise<FireDocument | null> {
  const emulator = e2eEmulators();
  const root = emulator
    ? 'http://' + emulator.firestore + '/v1/projects/' + encodeURIComponent(emulator.projectId)
      + '/databases/(default)/documents'
    : DB_ROOT;
  const result = await fetch(root + '/' + collection + '/' + encodeURIComponent(documentId), {
    // Credencial privilegiada exclusivamente do Firestore Emulator em loopback;
    // o serviço real continua exigindo o token da service account.
    headers: emulator
      ? { authorization: 'Bearer owner' }
      : { authorization: 'Bearer ' + serviceToken },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (result.status === 404) return null;
  if (!result.ok) throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  return await result.json() as FireDocument;
}

async function verifyActiveFirebaseUser(token: string, uid: string, email: string): Promise<void> {
  const emulator = e2eEmulators();
  // O token já foi verificado por verifyFirebaseRequest (issuer/audience/expiry).
  // No Emulator, conferir adicionalmente UID, e-mail, status e verificação no
  // diretório local de Auth, sem enviar token demo à API de produção.
  const lookupUrl = emulator
    ? 'http://' + emulator.auth + '/identitytoolkit.googleapis.com/v1/projects/'
      + encodeURIComponent(emulator.projectId)
      + '/accounts:lookup?key=' + encodeURIComponent(firebaseConfig.apiKey)
    : IDENTITY_LOOKUP;
  const response = await fetch(lookupUrl, {
    method: 'POST',
    headers: emulator
      ? { 'content-type': 'application/json', authorization: 'Bearer owner' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(emulator ? { localId: [uid] } : { idToken: token }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (response.status >= 500) throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
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
  if (process.env.EMPROVEX_E2E_SERVER_AUTH === '1' && !e2eEmulators()) {
    throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  }
  let verified;
  try {
    verified = await verifyCompanyFirebaseRequest(authorization);
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
    // No E2E, o diretório lido é somente o Firestore Emulator demo. Jamais
    // obter credenciais de produção ou tocar o banco real neste caminho.
    serviceToken = e2eEmulators() ? '' : await getCompanyAccessToken();
  } catch {
    throw new CompanyAccessError('COMPANY_DIRECTORY_UNAVAILABLE', 503);
  }

  const account = await readDirectoryDocument(serviceToken, 'platformAccounts', verified.email);
  // A known founder/sector/company identity must NEVER fall back to membership.
  let workspaceId = '';
  let accessRole: 'member' | undefined;
  if (account) {
    workspaceId = readString(account, 'workspaceId');
    const accountUid = readString(account, 'firebaseUid');
    const accountEmail = normalizePlatformEmail(readString(account, 'email'));
    const authorizedEmail = readString(account, 'authorizedEmail');
    if (readString(account, 'accountType') !== 'company'
      || readString(account, 'status') !== 'active'
      || (readString(account, 'authProvider') || 'password') !== 'password'
      || accountUid !== verified.uid
      || accountEmail !== verified.email
      || normalizePlatformEmail(authorizedEmail || accountEmail) !== verified.email
      || !isValidWorkspaceId(workspaceId)) {
      throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
    }
    const index = await readDirectoryDocument(serviceToken, 'platformAuthUidIndex', verified.uid);
    if (!index || readString(index, 'firebaseUid') !== verified.uid
      || readString(index, 'workspaceId') !== workspaceId
      || normalizePlatformEmail(readString(index, 'email')) !== verified.email
      || readString(index, 'accountType') !== 'company') {
      throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
    }
  } else {
    // Persisted atomically with invitation acceptance; never sufficient on its own.
    const memberIndex = await readDirectoryDocument(serviceToken, 'companyMemberAuthIndex', verified.uid);
    if (!memberIndex || readString(memberIndex, 'firebaseUid') !== verified.uid
      || normalizePlatformEmail(readString(memberIndex, 'email')) !== verified.email) {
      throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
    }
    workspaceId = readString(memberIndex, 'companyId');
    if (!isValidWorkspaceId(workspaceId)
      || readString(memberIndex, 'workspaceId') !== workspaceId) {
      throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
    }
    // Never launder a sector or founder UID through a stale member selector.
    if (await readDirectoryDocument(serviceToken, 'platformAuthUidIndex', verified.uid)) {
      throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
    }
    accessRole = 'member';
  }
  const workspace = await readDirectoryDocument(serviceToken, 'workspaces', workspaceId);
  if (!workspace || readString(workspace, 'id') !== workspaceId
    || readString(workspace, 'workspaceType') !== 'company'
    || readString(workspace, 'status') !== 'active'
    || readNestedString(workspace, 'companyProfile', 'registrationStatus') !== 'active') {
    throw new CompanyAccessError('COMPANY_WORKSPACE_FORBIDDEN', 403);
  }
  if (accessRole === 'member') {
    // Check live persisted status/UID/email/roles on every new session.
    const permitted = await checkLiveMemberCapability(
      workspaceId, { uid: verified.uid, email: verified.email }, 'company:read');
    if (!permitted) throw new CompanyAccessError('COMPANY_ACCOUNT_FORBIDDEN', 403);
  } else if (normalizePlatformEmail(readString(workspace, 'authorizedEmail')) !== verified.email
    || readNestedString(workspace, 'companyProfile', 'accessEmail') !== verified.email) {
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
    ...(accessRole === 'member' ? { accessRole } : {}),
  };
}
