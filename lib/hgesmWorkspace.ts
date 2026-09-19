import type { SectorAccount, Workspace, WorkspaceInstitutionalProfile } from './platformIdentity';
import { normalizePlatformEmail, normalizeWorkspaceId } from './platformIdentity';

/**
 * Identidade estável do workspace fundador do EMPROVEX.
 *
 * Este arquivo é apenas declarativo no Bloco 3: ele não altera paths do Firestore,
 * regras de segurança, autenticação ou subscriptions operacionais existentes.
 */
export const HGESM_WORKSPACE_ID = normalizeWorkspaceId('hgesm-aprov');
export const HGESM_SECTOR_EMAIL = normalizePlatformEmail('aprov1hgesm@gmail.com');
export const HGESM_UG = '160416';
export const HGESM_WORKSPACE_BOOTSTRAP_SOURCE = 'system:legacy-workspace-bootstrap';

/**
 * Perfil institucional que reproduz os textos atualmente usados pelo HGeSM.
 * Os próximos blocos poderão substituir hardcodes documentais por estes valores
 * sem alterar a aparência/conteúdo dos documentos do workspace fundador.
 */
export const HGESM_INSTITUTIONAL_PROFILE: WorkspaceInstitutionalProfile = {
  organizationName: 'Hospital Geral de Santa Maria',
  organizationShortName: 'HGeSM',
  sectionName: 'Seção de Aprovisionamento',
  documentHeaderLines: [
    'MINISTÉRIO DA DEFESA',
    'EXÉRCITO BRASILEIRO',
    'HOSPITAL GERAL DE SANTA MARIA',
  ],
  defaultDeliveryLocation: 'Almoxarifado Geral / Seção de Aprovisionamento - HGeSM',
  defaultResponsibleRole: 'Fiscal de Contrato / Seção de Aprovisionamento - HGeSM',
};

/**
 * Contrato do primeiro workspace da plataforma.
 * legacyWorkspace=true identifica temporariamente a origem pré-multi-tenant para
 * permitir migração e compatibilidade controladas nos blocos posteriores.
 */
export function createHgesmFoundingWorkspace(
  now: string = new Date().toISOString()
): Workspace {
  return {
    id: HGESM_WORKSPACE_ID,
    name: 'Aprovisionamento HGeSM',
    status: 'active',
    ug: HGESM_UG,
    authorizedEmail: HGESM_SECTOR_EMAIL,
    legacyWorkspace: true,
    institutionalProfile: {
      ...HGESM_INSTITUTIONAL_PROFILE,
      documentHeaderLines: [...(HGESM_INSTITUTIONAL_PROFILE.documentHeaderLines || [])],
    },
    createdAt: now,
    updatedAt: now,
    createdBy: HGESM_WORKSPACE_BOOTSTRAP_SOURCE,
  };
}

/**
 * Contrato da conta operacional histórica do HGeSM.
 * O firebaseUid permanece opcional nesta etapa e será associado de forma segura
 * quando a resolução de identidade/workspace entrar em operação.
 */
export function createHgesmSectorAccount(
  now: string = new Date().toISOString()
): SectorAccount {
  return {
    email: HGESM_SECTOR_EMAIL,
    accountType: 'sector',
    workspaceId: HGESM_WORKSPACE_ID,
    ug: HGESM_UG,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: HGESM_WORKSPACE_BOOTSTRAP_SOURCE,
  };
}
