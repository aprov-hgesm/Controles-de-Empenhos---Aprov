import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import {
  SECTOR_AUTH_PROVIDER,
  isValidPlatformEmail,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeWorkspaceId,
  validatePlatformAccount,
  validateWorkspace,
  type SectorAccount,
  type Workspace,
} from './platformIdentity';

export const MIN_SECTOR_PASSWORD_LENGTH = 8;
export const MAX_SECTOR_PASSWORD_LENGTH = 128;

export interface CreateSectorWorkspaceInput {
  workspaceId: string;
  workspaceName: string;
  authorizedEmail: string;
  initialPassword: string;
  organizationName: string;
  organizationShortName?: string;
  sectionName: string;
  defaultDeliveryLocation?: string;
  defaultResponsibleRole?: string;
}

export interface SectorProvisioningResult {
  workspace: Workspace;
  account: SectorAccount;
  authUserReused: boolean;
}

export type SectorInstitutionalProfileInput = Pick<
  CreateSectorWorkspaceInput,
  | 'organizationName'
  | 'organizationShortName'
  | 'sectionName'
  | 'defaultDeliveryLocation'
  | 'defaultResponsibleRole'
>;

function optionalTrimmedField<Key extends string>(
  key: Key,
  value?: string
): Partial<Record<Key, string>> {
  const normalized = value?.trim();
  return normalized ? { [key]: normalized } as Record<Key, string> : {};
}

export function buildSectorInstitutionalProfile(
  input: SectorInstitutionalProfileInput,
  documentHeaderLines?: string[]
): Workspace['institutionalProfile'] {
  return {
    organizationName: input.organizationName.trim(),
    sectionName: input.sectionName.trim(),
    ...(documentHeaderLines?.length
      ? { documentHeaderLines: [...documentHeaderLines] }
      : {}),
    ...optionalTrimmedField('organizationShortName', input.organizationShortName),
    ...optionalTrimmedField('defaultDeliveryLocation', input.defaultDeliveryLocation),
    ...optionalTrimmedField('defaultResponsibleRole', input.defaultResponsibleRole),
  };
}

export function validateSectorProvisioningInput(input: CreateSectorWorkspaceInput): string[] {
  const errors: string[] = [];
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const authorizedEmail = normalizePlatformEmail(input.authorizedEmail);

  if (!isValidWorkspaceId(workspaceId)) {
    errors.push('O identificador do setor é inválido. Use letras minúsculas, números e hífens.');
  }
  if (!input.workspaceName.trim()) {
    errors.push('Informe o nome do setor.');
  }
  if (!isValidPlatformEmail(authorizedEmail)) {
    errors.push('Informe um e-mail de acesso válido para o setor.');
  }
  if (authorizedEmail === HGESM_SECTOR_EMAIL) {
    errors.push('A conta institucional fundadora já está vinculada ao workspace HGeSM.');
  }
  if (!input.organizationName.trim()) {
    errors.push('Informe o nome institucional da organização.');
  }
  if (!input.sectionName.trim()) {
    errors.push('Informe o nome da seção.');
  }
  if (
    input.initialPassword.length < MIN_SECTOR_PASSWORD_LENGTH
    || input.initialPassword.length > MAX_SECTOR_PASSWORD_LENGTH
  ) {
    errors.push(
      `A senha inicial deve possuir entre ${MIN_SECTOR_PASSWORD_LENGTH} e ${MAX_SECTOR_PASSWORD_LENGTH} caracteres.`
    );
  }

  return errors;
}

export function buildProvisionedSectorRecords(
  input: CreateSectorWorkspaceInput,
  createdByEmail: string,
  firebaseUid: string,
  now: string = new Date().toISOString()
): { workspace: Workspace; account: SectorAccount } {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const authorizedEmail = normalizePlatformEmail(input.authorizedEmail);
  const createdBy = normalizePlatformEmail(createdByEmail);

  const validationErrors = validateSectorProvisioningInput(input);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  if (!firebaseUid.trim()) {
    throw new Error('O UID Firebase do setor é obrigatório no provisionamento.');
  }

  const workspace: Workspace = {
    id: workspaceId,
    name: input.workspaceName.trim(),
    status: 'active',
    authorizedEmail,
    institutionalProfile: buildSectorInstitutionalProfile(input),
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const account: SectorAccount = {
    email: authorizedEmail,
    authProvider: SECTOR_AUTH_PROVIDER,
    firebaseUid: firebaseUid.trim(),
    accountType: 'sector',
    workspaceId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const recordErrors = [...validateWorkspace(workspace), ...validatePlatformAccount(account)];
  if (recordErrors.length > 0) {
    throw new Error(recordErrors[0]);
  }

  return { workspace, account };
}
