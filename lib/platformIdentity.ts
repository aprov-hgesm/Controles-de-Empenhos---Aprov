export type PlatformAccountType = 'platformAdmin' | 'sector' | 'company';
export type SectorType = 'aprovisionamento' | 'almoxarifado';

/** Somente o campo ausente representa uma conta legada de Aprovisionamento. */
export function resolveSectorType(type?: SectorType): SectorType {
  return type ?? 'aprovisionamento';
}
export function isSectorType(value: unknown): value is SectorType {
  return value === 'aprovisionamento' || value === 'almoxarifado';
}
export function sectorEntryPath(type?: SectorType): '/central-empenhos' | '/almoxarifado' {
  return resolveSectorType(type) === 'almoxarifado' ? '/almoxarifado' : '/central-empenhos';
}

export type PlatformAccountStatus = 'active' | 'disabled';

export type PlatformAuthProvider = 'google.com' | 'password';

export const FOUNDER_AUTH_PROVIDER: PlatformAuthProvider = 'password';
// Compatibilidade: o Google permanece habilitado no Firebase para a conta
// fundadora. A interface pública oferece somente e-mail e senha.
export const FOUNDER_GOOGLE_AUTH_PROVIDER: PlatformAuthProvider = 'google.com';
export function isFounderSignInProvider(value: string | null | undefined): boolean {
  return value === FOUNDER_AUTH_PROVIDER || value === FOUNDER_GOOGLE_AUTH_PROVIDER;
}
export const SECTOR_AUTH_PROVIDER: PlatformAuthProvider = 'password';

export type WorkspaceStatus = 'active' | 'disabled';

export interface PlatformAccountBase {
  /** E-mail normalizado usado como identidade lógica única da plataforma. */
  email: string;
  /**
   * Provedor esperado para autenticação.
   *
   * Transitório no Bloco 1: documentos legados podem ainda não possuir este campo.
   * Para setores externos, a ausência é interpretada como 'password'. O Bloco 2
   * passa a persistir explicitamente o provedor durante o provisionamento.
   */
  authProvider?: PlatformAuthProvider;
  /**
   * UID do Firebase. Novos setores são pré-vinculados durante o provisionamento
   * server-side; o campo permanece opcional apenas para compatibilidade legada.
   */
  firebaseUid?: string;
  accountType: PlatformAccountType;
  status: PlatformAccountStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  firstLoginAt?: string;
  lastLoginAt?: string;
}

export interface PlatformAdminAccount extends PlatformAccountBase {
  accountType: 'platformAdmin';
  /** Administradores da plataforma não pertencem a um workspace operacional. */
  workspaceId?: never;
}

export interface SectorAccount extends PlatformAccountBase {
  accountType: 'sector';
  /** Ausente nos registros históricos; significa Aprovisionamento. */
  sectorType?: SectorType;
  /** Cada conta operacional de setor pertence a exatamente um workspace. */
  workspaceId: string;
  /**
   * UG da Organização Militar vinculada ao setor. Novas contas sempre possuem
   * este identificador; a opcionalidade existe apenas para registros legados.
   */
  ug?: string;
}

/** Empresa contratante, independente de UG e de permissões operacionais militares. */
export interface CompanyAccount extends PlatformAccountBase {
  accountType: 'company';
  workspaceId: string;
  firebaseUid: string;
  authProvider: 'password';
}

export type PlatformAccount = PlatformAdminAccount | SectorAccount | CompanyAccount;

export interface WorkspaceInstitutionalProfile {
  /** Nome institucional usado em documentos e cabeçalhos. */
  organizationName: string;
  /** Sigla/nome curto, por exemplo HGeSM. */
  organizationShortName?: string;
  /** Nome do setor operacional. */
  sectionName: string;
  /** Linhas institucionais opcionais para documentos oficiais. */
  documentHeaderLines?: string[];
  defaultDeliveryLocation?: string;
  defaultResponsibleRole?: string;
}

export interface Workspace {
  id: string;
  /** Campos legados sem workspaceType continuam setoriais. */
  workspaceType?: 'sector';
  /** Ausente nos workspaces históricos; significa Aprovisionamento. */
  sectorType?: SectorType;
  name: string;
  status: WorkspaceStatus;
  /**
   * Unidade Gestora da Organização Militar. Novos workspaces sempre possuem UG;
   * ausência é tolerada somente para compatibilidade com cadastros legados.
   */
  ug?: string;
  /**
   * E-mail operacional único do setor. Nos setores externos ele será usado no
   * login Firebase por senha e, posteriormente, deverá coincidir com a conta
   * Google autorizada para o Drive.
   */
  authorizedEmail: string;
  /** Marca temporária para o workspace fundador migrado da arquitetura pré-multi-tenant. */
  legacyWorkspace?: boolean;
  /** Server-owned billing entitlement; Firestore Rules can deny operational reads. */
  billingPolicyId?: string;
  billingEntitlementUntil?: string;
  institutionalProfile: WorkspaceInstitutionalProfile;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Cadastro privado de uma empresa cliente. CNPJ é a chave fiscal única, sem pontuação (numérico ou alfanumérico). */
export interface CompanyProfile {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  responsibleName: string;
  accessEmail: string;
  companyEmail?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city: string;
  state: string;
  registrationStatus: 'active' | 'pending' | 'suspended';
}

export interface CompanyWorkspace {
  id: string;
  workspaceType: 'company';
  name: string;
  status: WorkspaceStatus;
  authorizedEmail: string;
  companyProfile: CompanyProfile;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type PlatformWorkspace = Workspace | CompanyWorkspace;

export function isCompanyWorkspace(workspace: PlatformWorkspace): workspace is CompanyWorkspace {
  return workspace.workspaceType === 'company';
}

/** Workspaces anteriores à expansão são setores por padrão. */
export function isSectorWorkspace(workspace: PlatformWorkspace): workspace is Workspace {
  return workspace.workspaceType !== 'company';
}

const WORKSPACE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIT_UG_PATTERN = /^\d{6}$/;

export function normalizeUnitUg(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\D/g, '');
}

export function isValidUnitUg(value?: string | number | null): boolean {
  return UNIT_UG_PATTERN.test(normalizeUnitUg(value));
}

/**
 * Normaliza o e-mail usado como chave lógica de autorização da plataforma.
 *
 * O valor precisa permanecer compatível com o e-mail devolvido pelo Firebase Auth,
 * pois as Firestore Rules comparam a identidade autenticada com o registro de
 * `platformAccounts`. O nome local é preservado exatamente como cadastrado,
 * alterando apenas caixa/espaços e o domínio histórico
 * `googlemail.com` para `gmail.com`.
 *
 * Não removemos pontos nem aliases `+tag` no cliente. O cadastro administrativo deve
 * usar o e-mail principal definido para a identidade operacional do setor.
 */
export function normalizePlatformEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');

  if (atIndex <= 0) return normalized;

  const localPart = normalized.slice(0, atIndex);
  let domain = normalized.slice(atIndex + 1);

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  return `${localPart}@${domain}`;
}

export function isValidPlatformEmail(value: string): boolean {
  return SIMPLE_EMAIL_PATTERN.test(normalizePlatformEmail(value));
}

/**
 * IDs de workspace são estáveis, legíveis e adequados para uso em caminhos Firestore.
 * A função apenas normaliza caixa e espaços externos; não transforma nomes livres em IDs.
 */
export function normalizeWorkspaceId(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function isValidWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_PATTERN.test(normalizeWorkspaceId(value));
}

export function isPlatformAdminAccount(account: PlatformAccount): account is PlatformAdminAccount {
  return account.accountType === 'platformAdmin';
}

export function isSectorAccount(account: PlatformAccount): account is SectorAccount {
  return account.accountType === 'sector';
}

export function isCompanyAccount(account: PlatformAccount): account is CompanyAccount {
  return account.accountType === 'company';
}

/**
 * Validação estrutural mínima compartilhada pelos próximos blocos.
 * Regras de autorização efetivas também são aplicadas no Firestore.
 */
export function validatePlatformAccount(account: PlatformAccount): string[] {
  const errors: string[] = [];

  if (!isValidPlatformEmail(account.email)) {
    errors.push('E-mail da conta da plataforma é inválido.');
  }

  if (account.accountType === 'sector' && account.sectorType !== undefined && !isSectorType(account.sectorType)) {
    errors.push('Modalidade da conta setorial é inválida.');
  }

  if (account.accountType === 'sector' && !isValidWorkspaceId(account.workspaceId)) {
    errors.push('Conta de setor precisa possuir um workspaceId válido.');
  }

  if (account.accountType === 'sector' && account.ug !== undefined && !isValidUnitUg(account.ug)) {
    errors.push('UG da conta operacional deve possuir exatamente 6 dígitos.');
  }

  if (account.accountType === 'company') {
    if (!isValidWorkspaceId(account.workspaceId)) errors.push('Workspace empresarial inválido.');
    if (!account.firebaseUid?.trim() || account.authProvider !== 'password') errors.push('Conta empresarial exige UID e senha.');
  }

  if (account.status !== 'active' && account.status !== 'disabled') {
    errors.push('Status da conta da plataforma é inválido.');
  }

  if (
    account.authProvider !== undefined
    && account.authProvider !== FOUNDER_AUTH_PROVIDER
    && account.authProvider !== SECTOR_AUTH_PROVIDER
    && account.authProvider !== FOUNDER_GOOGLE_AUTH_PROVIDER
  ) {
    errors.push('Provedor de autenticação da conta da plataforma é inválido.');
  }

  return errors;
}

export function validateWorkspace(workspace: Workspace): string[] {
  const errors: string[] = [];
  if ((workspace as PlatformWorkspace).workspaceType === 'company') return ['Workspace empresarial não pode ser setorial.'];

  if (workspace.sectorType !== undefined && !isSectorType(workspace.sectorType)) {
    errors.push('Modalidade do workspace é inválida.');
  }

  if (!isValidWorkspaceId(workspace.id)) {
    errors.push('Identificador do workspace é inválido.');
  }

  if (!workspace.name.trim()) {
    errors.push('Nome do workspace é obrigatório.');
  }

  if (workspace.ug !== undefined && !isValidUnitUg(workspace.ug)) {
    errors.push('UG do workspace deve possuir exatamente 6 dígitos.');
  }

  if (!isValidPlatformEmail(workspace.authorizedEmail)) {
    errors.push('E-mail operacional autorizado do workspace é inválido.');
  }

  if (!workspace.institutionalProfile.organizationName.trim()) {
    errors.push('Nome institucional da organização é obrigatório.');
  }

  if (!workspace.institutionalProfile.sectionName.trim()) {
    errors.push('Nome do setor é obrigatório.');
  }

  if (workspace.status !== 'active' && workspace.status !== 'disabled') {
    errors.push('Status do workspace é inválido.');
  }

  return errors;
}

/** Validação independente: empresas não têm UG nem perfil institucional militar. */
export function validateCompanyWorkspace(workspace: CompanyWorkspace): string[] {
  const errors: string[] = [];
  const p = workspace.companyProfile;
  if (!isValidWorkspaceId(workspace.id) || workspace.workspaceType !== 'company') {
    errors.push('Identificador ou tipo de workspace empresarial inválido.');
  }
  if (!workspace.name.trim() || !p.legalName.trim() || !p.responsibleName.trim()) {
    errors.push('Razão social, nome e responsável são obrigatórios.');
  }
  if (!/^[A-Z0-9]{12}\d{2}$/.test(p.cnpj)) errors.push('CNPJ deve conter 14 caracteres válidos.');
  if (!isValidPlatformEmail(workspace.authorizedEmail)
      || p.accessEmail !== workspace.authorizedEmail) {
    errors.push('E-mail empresarial inconsistente.');
  }
  if (p.companyEmail && !isValidPlatformEmail(p.companyEmail)) {
    errors.push('E-mail comercial inválido.');
  }
  if (p.postalCode && !/^\d{8}$/.test(p.postalCode)) {
    errors.push('CEP empresarial inválido.');
  }
  if (!p.city.trim() || !/^[A-Z]{2}$/.test(p.state)) {
    errors.push('Cidade ou UF inválida.');
  }
  if (!['active', 'pending', 'suspended'].includes(p.registrationStatus)) {
    errors.push('Situação cadastral inválida.');
  }
  if (!['active', 'disabled'].includes(workspace.status)) {
    errors.push('Status empresarial inválido.');
  }
  return errors;
}
