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

interface WorkspaceContextBase {
  status: WorkspaceContextStatus;
  email: string | null;
  canLoadOperationalData: boolean;
  resolutionSource: 'hgesm-dual-profile' | 'legacy-hgesm-bootstrap' | 'none';
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
  /**
   * Enquanto os dados do HGeSM ainda estiverem nas coleções globais, o contexto
   * autoriza o hook operacional a usar temporariamente os paths legados.
   */
  legacyDataMode: boolean;
  /**
   * Settings operacionais possuem migração independente das coleções principais.
   * No Bloco 11 começa true e só muda para false após validação ao vivo do contador.
   */
  legacySettingsMode: boolean;
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
 * Bloco 6.1: a conta fundadora do HGeSM possui dois perfis de interface na mesma
 * sessão Firebase. O perfil operacional é o padrão; o modo administrativo só é
 * ativado explicitamente pelo seletor de perfil e nunca carrega dados operacionais.
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
      legacyDataMode: true,
      legacySettingsMode: true,
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
