/**
 * Único resolvedor server-side da identidade EMPROVEX.
 * Os dados de autorização vêm do diretório operacional via IAM; o JWT
 * Firebase apenas autentica a pessoa e o provider.
 */
import { HGESM_SECTOR_EMAIL, HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER, SECTOR_AUTH_PROVIDER,
  isValidUnitUg, isValidWorkspaceId,
  normalizePlatformEmail, normalizeUnitUg, normalizeWorkspaceId,
} from '../platformIdentity';
import type { ServerPrincipal } from './authorizationPolicy';
import { verifyFirebaseRequest, type VerifiedFirebaseRequest } from './firebaseFounderAuth';
import { readCoreIdentityDocument, CoreIdentityStoreError } from './coreIdentityStore';

export interface VerifiedPlatformPrincipal extends ServerPrincipal {
  readonly claims: VerifiedFirebaseRequest['claims'];
}

export class PlatformAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403 | 503) {
    super('PLATFORM_SERVER_AUTHORIZATION_DENIED');
    this.name = 'PlatformAuthorizationError';
  }
}

interface StringDocument {
  fields?: Record<string, { stringValue?: string }>;
}

function value(doc: StringDocument | null, field: string): string {
  return doc?.fields?.[field]?.stringValue || '';
}

async function readIdentity(path: string): Promise<StringDocument | null> {
  try {
    return await readCoreIdentityDocument(path);
  } catch (error) {
    if (error instanceof CoreIdentityStoreError) {
      throw new PlatformAuthorizationError(error.status);
    }
    throw error;
  }
}

export async function verifyPlatformPrincipal(
  authorization: string | null,
): Promise<VerifiedPlatformPrincipal> {
  const verified = await verifyFirebaseRequest(authorization);

  if (verified.email === HGESM_SECTOR_EMAIL) {
    if (verified.signInProvider !== FOUNDER_AUTH_PROVIDER) {
      throw new PlatformAuthorizationError(403);
    }
    return {
      uid: verified.uid,
      email: verified.email,
      role: 'founder',
      workspaceId: HGESM_WORKSPACE_ID,
      ug: HGESM_UG,
      claims: verified.claims,
    };
  }

  if (verified.signInProvider !== SECTOR_AUTH_PROVIDER) {
    throw new PlatformAuthorizationError(403);
  }

  const account = await readIdentity('platformAccounts/' + verified.email);
  if (!account) throw new PlatformAuthorizationError(403);

  const workspaceId = normalizeWorkspaceId(value(account, 'workspaceId'));
  const ug = normalizeUnitUg(value(account, 'ug'));
  if (
    value(account, 'accountType') !== 'sector' ||
    value(account, 'status') !== 'active' ||
    normalizePlatformEmail(value(account, 'email')) !== verified.email ||
    value(account, 'firebaseUid') !== verified.uid ||
    (value(account, 'authProvider') || SECTOR_AUTH_PROVIDER) !== SECTOR_AUTH_PROVIDER ||
    !isValidWorkspaceId(workspaceId) || !isValidUnitUg(ug)
  ) {
    throw new PlatformAuthorizationError(403);
  }

  const workspace = await readIdentity('workspaces/' + workspaceId);
  if (!workspace ||
      normalizeWorkspaceId(value(workspace, 'id')) !== workspaceId ||
      value(workspace, 'status') !== 'active' ||
      normalizePlatformEmail(value(workspace, 'authorizedEmail')) !== verified.email ||
      normalizeUnitUg(value(workspace, 'ug')) !== ug) {
    throw new PlatformAuthorizationError(403);
  }

  return {
    uid: verified.uid,
    email: verified.email,
    role: 'sector',
    workspaceId,
    ug,
    claims: verified.claims,
  };
}
