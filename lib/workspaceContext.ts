import {
  HGESM_INSTITUTIONAL_PROFILE,
  HGESM_SECTOR_EMAIL,
  HGESM_WORKSPACE_ID,
} from './hgesmWorkspace';
import { getActiveProfileMode, type EmprovexProfileMode } from './profileMode';
import { normalizePlatformEmail, type WorkspaceInstitutionalProfile } from './platformIdentity';

export type WorkspaceContextStatus =
  | 'anonymous'
  | 'platformAdmin'
  | 'sector'
  | 'unauthorized';

export type WorkspaceResolutionSource =
  | 'hgesm-dual-profile'
  | 'legacy-hgesm-bootstrap'
  | 'platform-directory'
  | 'none';

interface WorkspaceContextBase {
  status: WorkspaceContextStatus;
  email: string | null;
  canLoadOperationalData: boolean;
  resolutionSource: WorkspaceResolutionSource;
}

export interface AnonymousWorkspaceContext extends WorkspaceContextBase {
  status: 'anonymous';
  email: null;
  canLoadOperationalData: false;
  resolutionSource: 'none';
}

export interface PlatformAdminWorkspaceContext extends WorkspaceContextBase {
  status: 'platformAdmin';
  email: string;
  accountType: 'platformAdmin';
  workspaceId: null;
  canLoadOperationalData: false;
  resolutionSource: 'hgesm-dual-profile';
}

export interface SectorWorkspaceContext extends WorkspaceContextBase {
  status: 'sector';
  email: string;
  accountType: 'sector';
  workspaceId: string;
  workspaceName: string;
  institutionalProfile: WorkspaceInstitutionalProfile;
  legacyDataMode: boolean;
  legacySettingsMode: boolean;
  canLoadOperationalData: true;
  resolutionSource: 'legacy-hgesm-bootstrap' | 'platform-directory';
}

export interface UnauthorizedWorkspaceContext extends WorkspaceContextBase {
  status: 'unauthorized';
  email: string;
  canLoadOperationalData: false;
  resolutionSource: 'none';
}

export type ResolvedWorkspaceContext =
  | AnonymousWorkspaceContext
  | PlatformAdminWorkspaceContext
  | SectorWorkspaceContext
  | UnauthorizedWorkspaceContext;

interface CachedWorkspaceSession {
  uid: string;
  email: string;
  context: SectorWorkspaceContext;
}

let cachedWorkspaceSession: CachedWorkspaceSession | null = null;

export function rememberResolvedWorkspaceContext(
  uid: string,
  context: SectorWorkspaceContext
): void {
  cachedWorkspaceSession = {
    uid,
    email: normalizePlatformEmail(context.email),
    context,
  };
}

export function clearResolvedWorkspaceContext(): void {
  cachedWorkspaceSession = null;
}

export function getResolvedWorkspaceContextForSession(
  uid: string,
  email?: string | null
): SectorWorkspaceContext | null {
  if (!cachedWorkspaceSession || cachedWorkspaceSession.uid !== uid || !email) return null;
  if (cachedWorkspaceSession.email !== normalizePlatformEmail(email)) return null;
  return cachedWorkspaceSession.context;
}

/**
 * Resolução síncrona usada durante o runtime depois que a sessão já foi validada.
 * O HGeSM continua sendo resolvido localmente por ser a identidade fundadora. Os
 * demais setores somente aparecem aqui depois que `platformAccess` validou conta e
 * workspace no Firestore e gravou o contexto em memória.
 */
export function resolveWorkspaceContext(
  email?: string | null,
  requestedProfile?: EmprovexProfileMode
): ResolvedWorkspaceContext {
  if (!email) {
    return {
      status: 'anonymous',
      email: null,
      canLoadOperationalData: false,
      resolutionSource: 'none',
    };
  }

  const normalizedEmail = normalizePlatformEmail(email);

  if (normalizedEmail === HGESM_SECTOR_EMAIL) {
    const activeProfile = requestedProfile || getActiveProfileMode(normalizedEmail);

    if (activeProfile === 'platformAdmin') {
      return {
        status: 'platformAdmin',
        email: normalizedEmail,
        accountType: 'platformAdmin',
        workspaceId: null,
        canLoadOperationalData: false,
        resolutionSource: 'hgesm-dual-profile',
      };
    }

    return {
      status: 'sector',
      email: normalizedEmail,
      accountType: 'sector',
      workspaceId: HGESM_WORKSPACE_ID,
      workspaceName: 'Aprovisionamento HGeSM',
      institutionalProfile: {
        ...HGESM_INSTITUTIONAL_PROFILE,
        documentHeaderLines: [...(HGESM_INSTITUTIONAL_PROFILE.documentHeaderLines || [])],
      },
      legacyDataMode: false,
      legacySettingsMode: false,
      canLoadOperationalData: true,
      resolutionSource: 'legacy-hgesm-bootstrap',
    };
  }

  if (cachedWorkspaceSession?.email === normalizedEmail) {
    return cachedWorkspaceSession.context;
  }

  return {
    status: 'unauthorized',
    email: normalizedEmail,
    canLoadOperationalData: false,
    resolutionSource: 'none',
  };
}

export function isOperationalSectorContext(
  context: ResolvedWorkspaceContext
): context is SectorWorkspaceContext {
  return context.status === 'sector' && context.canLoadOperationalData;
}
