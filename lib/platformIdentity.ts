export type PlatformAccountType = 'platformAdmin' | 'sector';

export type PlatformAccountStatus = 'active' | 'disabled';

export type WorkspaceStatus = 'active' | 'disabled';

export interface PlatformAccountBase {
  /** E-mail Google normalizado e usado como chave de autorização antes do primeiro login. */
  email: string;
  /** UID do Firebase preenchido somente depois que a conta autenticar pela primeira vez. */
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
  /** Cada conta operacional de setor pertence a exatamente um workspace. */
  workspaceId: string;
}

export type PlatformAccount = PlatformAdminAccount | SectorAccount;

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
  name: string;
  status: WorkspaceStatus;
  /** Conta Google operacional única vinculada ao setor. */
  authorizedEmail: string;
  /** Marca temporária para o workspace fundador migrado da arquitetura pré-multi-tenant. */
  legacyWorkspace?: boolean;
  institutionalProfile: WorkspaceInstitutionalProfile;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const WORKSPACE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliza o e-mail usado como chave lógica de autorização da plataforma.
 *
 * O valor precisa permanecer compatível com o e-mail devolvido pelo Firebase Auth,
 * pois as Firestore Rules comparam a identidade autenticada com o registro de
 * `platformAccounts`. Por isso o Bloco 15 preserva o nome local exatamente como a
 * conta Google o apresenta, alterando apenas caixa/espaços e o domínio histórico
 * `googlemail.com` para `gmail.com`.
 *
 * Não removemos pontos nem aliases `+tag` no cliente. O cadastro administrativo deve
 * usar o e-mail principal exibido pela conta Google que efetivamente fará login.
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

/**
 * Validação estrutural mínima compartilhada pelos próximos blocos.
 * Regras de autorização efetivas também são aplicadas no Firestore.
 */
export function validatePlatformAccount(account: PlatformAccount): string[] {
  const errors: string[] = [];

  if (!isValidPlatformEmail(account.email)) {
    errors.push('E-mail da conta da plataforma é inválido.');
  }

  if (account.accountType === 'sector' && !isValidWorkspaceId(account.workspaceId)) {
    errors.push('Conta de setor precisa possuir um workspaceId válido.');
  }

  if (account.status !== 'active' && account.status !== 'disabled') {
    errors.push('Status da conta da plataforma é inválido.');
  }

  return errors;
}

export function validateWorkspace(workspace: Workspace): string[] {
  const errors: string[] = [];

  if (!isValidWorkspaceId(workspace.id)) {
    errors.push('Identificador do workspace é inválido.');
  }

  if (!workspace.name.trim()) {
    errors.push('Nome do workspace é obrigatório.');
  }

  if (!isValidPlatformEmail(workspace.authorizedEmail)) {
    errors.push('Conta Google autorizada do workspace é inválida.');
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
