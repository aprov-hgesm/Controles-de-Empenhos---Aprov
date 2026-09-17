import { isBootstrapPlatformAdminEmail } from './platformBootstrap';
import {
  HGESM_INSTITUTIONAL_PROFILE,
  HGESM_SECTOR_EMAIL,
  HGESM_WORKSPACE_ID,
} from './hgesmWorkspace';
import { normalizePlatformEmail, type WorkspaceInstitutionalProfile } from './platformIdentity';

export type WorkspaceContextStatus =
  | 'anonymous'
  | 'platformAdmin'
  | 'sector'
  | 'unauthorized';

interface WorkspaceContextBase {
  status: WorkspaceContextStatus;
  email: string | null;
  canLoadOperationalData: boolean;
  resolutionSource: 'bootstrap-platform-admin' | 'legacy-hgesm-bootstrap' | 'none';
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
  resolutionSource: 'bootstrap-platform-admin';
}

export interface SectorWorkspaceContext extends WorkspaceContextBase {
  status: 'sector';
  email: string;
  accountType: 'sector';
  workspaceId: string;
  workspaceName: string;
  institutionalProfile: WorkspaceInstitutionalProfile;
  /**
   * Enquanto os dados do HGeSM ainda estiverem nas coleções globais, o contexto
   * autoriza o hook operacional a usar temporariamente os paths legados.
   */
  legacyDataMode: boolean;
  canLoadOperationalData: true;
  resolutionSource: 'legacy-hgesm-bootstrap';
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

/**
 * Resolve a identidade autenticada antes de qualquer subscription operacional.
 *
 * Bloco 4: a resolução ainda usa apenas os dois registros bootstrap conhecidos.
 * A persistência administrativa no Firestore substituirá esta fonte estática nos
 * próximos blocos sem alterar o contrato consumido pelo restante da aplicação.
 */
export function resolveWorkspaceContext(email?: string | null): ResolvedWorkspaceContext {
  if (!email) {
    return {
      status: 'anonymous',
      email: null,
      canLoadOperationalData: false,
      resolutionSource: 'none',
    };
  }

  const normalizedEmail = normalizePlatformEmail(email);

  if (isBootstrapPlatformAdminEmail(normalizedEmail)) {
    return {
      status: 'platformAdmin',
      email: normalizedEmail,
      accountType: 'platformAdmin',
      workspaceId: null,
      canLoadOperationalData: false,
      resolutionSource: 'bootstrap-platform-admin',
    };
  }

  if (normalizedEmail === HGESM_SECTOR_EMAIL) {
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
      legacyDataMode: true,
      canLoadOperationalData: true,
      resolutionSource: 'legacy-hgesm-bootstrap',
    };
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
