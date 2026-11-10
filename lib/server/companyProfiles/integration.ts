/**
 * W10-III — additive company profile resolution. Never treats a UID index,
 * cookie, browser CNPJ or workspace ID as an authorization grant.
 * Legacy W0 directory remains immutable. No sector/founder fallback.
 */
import { verifyCompanyFirebaseRequest } from '../companyFirebaseAuth';
import { createFiscalTransport } from '../../company/fiscal/issuance/firestoreTransport.mjs';
import { requestAdditionalCompany } from '../../company/profiles/registration.mjs';
import { createQaAdditionalCompanyRegistry } from '../../company/profiles/qaRegistration.mjs';
import { CompanyAccessError, verifyCompanySession, type VerifiedCompanyContext } from '../companySession';
import { assertCompanyPilotEnabled } from '../companyAuthz';
import { getDocument } from '../companyMembership/firestore';
import { memberIdForEmail } from '../companyMembership';
import { COMPANY_ACTIONS, companyDocumentPath, type CompanyAction } from '../../company/contracts';
import { permitsCompanyAction, type CompanyMemberRole } from '../../company/roles';
import {
  authorizeCompanyProfile, listAuthorizedCompanyProfiles,
  type ProfileError,
} from '../../company/profiles/core.mjs';
import {
  PROFILE_COOKIE, signProfileSelection, verifyProfileSelection, resolveUnselectedCompany,
} from '../../company/profiles/selection.mjs';

type Principal = { uid: string; email: string; verified: true; active: true;
  emailVerified: true; provider: 'password'; accountType: 'company' };
type Profile = { companyId: string; workspaceId: string; cnpj: string;
  name: string; legalName: string; role: 'owner' | 'member' };
type Member = { companyId: string; workspaceId: string; firebaseUid: string; email: string;
  status: 'active' | 'revoked' | 'invited' | 'expired'; roles: CompanyMemberRole[] };
type Owner = { companyId: string; workspaceId: string; firebaseUid: string; email: string; status: string };
type LinkIndex = { uid?: string; email?: string; companyIds?: string[]; revision?: number };
const ID = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const bad = (code: string, status: 401 | 403 | 503 = 403) =>
  new CompanyAccessError(code, status);
function currentSessionKey(token: Awaited<ReturnType<typeof verifyCompanyFirebaseRequest>>) {
  const authTime = token.claims.auth_time;
  if (typeof authTime !== 'number' || !Number.isSafeInteger(authTime) || authTime <= 0) {
    throw bad('COMPANY_AUTH_INVALID', 401);
  }
  return { uid: token.uid, authTime };
}
function cookieValue(header: string | null): string | null {
  const found = (header || '').split(';').map(x => x.trim()).find(x => x.startsWith(PROFILE_COOKIE + '='));
  return found ? found.slice(PROFILE_COOKIE.length + 1) : null;
}
function secret() {
  const value = process.env.EMPROVEX_COMPANY_PROFILE_HMAC_SECRET || '';
  if (!value) throw bad('COMPANY_PROFILE_SELECTION_DISABLED', 503);
  return value;
}
async function identity(request: Request) {
  assertCompanyPilotEnabled();
  // Legacy session proves live Auth/email/password + immutable W0 indexes.
  // Do not weaken these checks for new owner/member links.
  const base = await verifyCompanySession(request.headers.get('authorization'));
  const token = await verifyCompanyFirebaseRequest(request.headers.get('authorization'));
  if (base.firebaseUid !== token.uid || base.authorizedEmail !== token.email
    || token.signInProvider !== 'password') throw bad('COMPANY_ACCOUNT_FORBIDDEN');
  const principal: Principal = { uid: token.uid, email: token.email, verified: true,
    active: true, emailVerified: true, provider: 'password', accountType: 'company' };
  return { base, principal, key: currentSessionKey(token) };
}
async function candidates(principal: Principal, base: VerifiedCompanyContext): Promise<string[]> {
  const stored = await getDocument<LinkIndex>('companyProfileUidLinks/' + principal.uid);
  const value = stored?.value;
  if (value && (value.uid !== principal.uid || value.email !== principal.email
    || !Array.isArray(value.companyIds) || value.companyIds.length > 31
    || value.companyIds.some(id => typeof id !== 'string' || !ID.test(id)))) {
    throw bad('COMPANY_PROFILE_INDEX_INVALID', 503);
  }
  return [...new Set([base.workspaceId, ...(value?.companyIds || [])])];
}
function adapters(principal: Principal, base: VerifiedCompanyContext) {
  return {
    listCandidateIds: () => candidates(principal, base),
    readWorkspace: async (id: string) =>
      (await getDocument<Record<string, unknown>>('workspaces/' + id))?.value ?? null,
    readOwner: async (id: string): Promise<Owner | null> => {
      if (base.workspaceId === id && !base.accessRole) {
        return { companyId: id, workspaceId: id,
          firebaseUid: base.firebaseUid, email: base.authorizedEmail, status: 'active' };
      }
      const doc = await getDocument<Owner>(
        'supplierCompanyWorkspaces/' + id + '/ownerBinding/primary');
      return doc?.value ?? null;
    },
    readMember: async (id: string, p: Principal): Promise<Member | null> =>
      (await getDocument<Member>(companyDocumentPath(id, 'members', memberIdForEmail(p.email))))?.value ?? null,
    verifyCnpjBinding: async (cnpj: string, id: string): Promise<boolean> => {
      const doc = await getDocument<{ cnpj?: string; workspaceId?: string }>(
        'platformCnpjIndex/' + cnpj);
      return doc?.value?.cnpj === cnpj && doc?.value?.workspaceId === id;
    },
    permitsAction: (roles: CompanyMemberRole[], status: Member['status'], action: CompanyAction) =>
      permitsCompanyAction(roles, status, action),
    isKnownAction: (action: string) => (COMPANY_ACTIONS as readonly string[]).includes(action),
  };
}
/** Per-request fresh workspace, CNPJ, owner/membership and action, never cached. */
async function authorized(principal: Principal, base: VerifiedCompanyContext, companyId: string, action: CompanyAction): Promise<Profile> {
  if (!ID.test(companyId)) throw bad('COMPANY_SCOPE_FORBIDDEN');
  const ids = await candidates(principal, base);
  if (!ids.includes(companyId)) throw bad('COMPANY_SCOPE_FORBIDDEN');
  const profile = await authorizeCompanyProfile(principal, companyId, adapters(principal, base), action);
  return profile as Profile;
}
function normalizeError(error: unknown): never {
  if (error instanceof CompanyAccessError) throw error;
  const e = error as Partial<ProfileError> | null;
  if (e?.name === 'ProfileError') {
    const status = e.status === 403 ? 403 : 503;
    throw bad(typeof e.code === 'string' ? e.code : 'COMPANY_PROFILE_UNAVAILABLE', status);
  }
  throw bad('COMPANY_PROFILE_UNAVAILABLE', 503);
}
/** Existing single-workspace behavior remains unchanged without selection cookie. */
export async function verifySelectedCompanySession(
  request: Request, action: CompanyAction = 'company:read',
): Promise<VerifiedCompanyContext> {
  try {
    const { base, principal, key } = await identity(request);
    const cookie = cookieValue(request.headers.get('cookie'));
    if (!cookie) {
      resolveUnselectedCompany(base.workspaceId, await candidates(principal, base));
      return base;
    }
    const selected = verifyProfileSelection(cookie, key, secret()) as string;
    const p = await authorized(principal, base, selected, action);
    return { ...base, workspaceId: p.companyId, companyName: p.name,
      legalName: p.legalName, tradeName: p.name,
      ...(p.role === 'member' ? { accessRole: 'member' as const } : { accessRole: undefined }),
      profileCapabilityVerified: true };
  } catch (e) { return normalizeError(e); }
}
export async function getCompanyProfiles(request: Request) {
  try {
    const { base, principal, key } = await identity(request);
    const profiles = await listAuthorizedCompanyProfiles(principal, adapters(principal, base)) as Profile[];
    const cookie = cookieValue(request.headers.get('cookie'));
    // Listing verified profiles remains possible even after cookie expiry,
    // so a user can explicitly reselect a tenant without granting data access.
    let active: string | null = null;
    if (cookie) {
      try { active = verifyProfileSelection(cookie, key, secret()) as string; }
      catch (error) {
        const e = error as Partial<ProfileError> | null;
        if (e?.name !== 'ProfileError' || e.code !== 'PROFILE_NOT_AUTHORIZED') throw error;
      }
    } else if ((await candidates(principal, base)).every(id => id === base.workspaceId)) {
      active = base.workspaceId; // W0 legacy single-company case only.
    }
    if (active && !profiles.some(p => p.companyId === active)) active = null;
    if (!profiles.length) throw bad('COMPANY_PROFILE_REVOKED');
    return { ok: true, profiles, activeCompanyId: active,
      selectionRequired: active === null,
      canSwitch: (profiles.length > 1 || active === null) && Boolean(process.env.EMPROVEX_COMPANY_PROFILE_HMAC_SECRET),
      integrationPending: false };
  } catch (e) { return normalizeError(e); }
}
/**
 * No cookie is accepted as identity. Origin enforcement + bearer header + custom
 * fetch header protect selection POST from cross-site browser form submissions.
 */
export async function selectCompanyProfile(request: Request, companyId: unknown) {
  try {
    const origin = request.headers.get('origin');
    const requested = new URL(request.url);
    if (!origin || origin !== requested.origin
      || request.headers.get('x-emprovex-profile-switch') !== '1') {
      throw bad('COMPANY_PROFILE_CSRF_FORBIDDEN');
    }
    if (typeof companyId !== 'string' || !ID.test(companyId)) throw bad('COMPANY_SCOPE_FORBIDDEN');
    const { base, principal, key } = await identity(request);
    await authorized(principal, base, companyId, 'company:read');
    return { activeCompanyId: companyId,
      cookie: signProfileSelection(companyId, key, secret()) as string };
  } catch (e) { return normalizeError(e); }
}

/**
 * Additional CNPJ is explicitly QA-only until legal-proof workflow is
 * implemented and certified for production. No second Auth user is created.
 * The approved representation is a privileged server-managed Firestore doc.
 */
export async function registerAdditionalCompanyQa(request: Request, body: {
  proposedCompanyId?: unknown; legalName?: unknown; cnpj?: unknown;
  idempotencyKey?: unknown;
}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  const projectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || '';
  if (process.env.EMPROVEX_COMPANY_PROFILE_QA_REGISTRATION_ENABLED !== '1'
    || process.env.EMPROVEX_E2E_SERVER_AUTH !== '1'
    || !projectId.startsWith('demo-')
    || !['127.0.0.1:8080', 'localhost:8080'].includes(emulatorHost)
    || !['127.0.0.1:9099', 'localhost:9099'].includes(authHost)
    || process.env.K_SERVICE || process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw bad('PROFILE_REGISTRATION_DISABLED', 503);
  }
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin
    || request.headers.get('x-emprovex-profile-register') !== '1') {
    throw bad('PROFILE_CSRF_FORBIDDEN');
  }
  const { base, principal } = await identity(request);
  if (base.accessRole) throw bad('PROFILE_OWNER_REQUIRED');
  // No caller-provided primary workspace, UID or e-mail can elevate authority.
  const transport = createFiscalTransport({ projectId,
    emulatorHost, tokenProvider: async () => 'owner' });
  const registry = createQaAdditionalCompanyRegistry(transport);
  return requestAdditionalCompany(principal, {
    primaryCompanyId: base.workspaceId,
    proposedCompanyId: body.proposedCompanyId,
    legalName: body.legalName,
    cnpj: body.cnpj,
    idempotencyKey: body.idempotencyKey,
  }, { ...adapters(principal, base), ...registry });
}
