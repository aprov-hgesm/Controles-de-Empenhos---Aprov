import {
  isValidPlatformEmail,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeWorkspaceId,
  validateCompanyWorkspace,
  validatePlatformAccount,
  type CompanyAccount,
  type CompanyWorkspace,
  type CompanyProfile,
} from './platformIdentity';

export const MIN_COMPANY_PASSWORD_LENGTH = 8;
export const MAX_COMPANY_PASSWORD_LENGTH = 128;

export interface CreateCompanyWorkspaceInput {
  workspaceId: string;
  legalName: string;
  tradeName?: string;
  cnpj: string;
  responsibleName: string;
  authorizedEmail: string;
  companyEmail?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
  initialPassword: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city: string;
  state: string;
  registrationStatus?: CompanyProfile['registrationStatus'];
}

export interface CompanyProvisioningResult {
  workspace: CompanyWorkspace;
  account: CompanyAccount;
}

export function normalizeCompanyCnpj(value: string): string {
  return value.toUpperCase().replace(/[.\/\-\s]/g, '');
}

/** Aceita CNPJ numérico e alfanumérico, ambos com DV módulo 11 (ASCII - 48). */
export function isValidCompanyCnpj(value: string): boolean {
  const digits = normalizeCompanyCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const checksum = (length: number): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, i) => total + (digits.charCodeAt(i) - 48) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checksum(12) === Number(digits[12]) && checksum(13) === Number(digits[13]);
}

export function parseCompanyProvisioningInput(value: unknown): CreateCompanyWorkspaceInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Solicitação empresarial inválida.');
  }
  const source = value as Record<string, unknown>;
  const required = (key: string) => typeof source[key] === 'string' ? source[key] as string : '';
  const optional = (key: string) => typeof source[key] === 'string' ? source[key] as string : undefined;

  return {
    workspaceId: required('workspaceId'),
    legalName: required('legalName'),
    tradeName: optional('tradeName'),
    cnpj: required('cnpj'),
    responsibleName: required('responsibleName'),
    authorizedEmail: required('authorizedEmail'),
    companyEmail: optional('companyEmail'),
    postalCode: optional('postalCode'),
    addressNumber: optional('addressNumber'),
    addressComplement: optional('addressComplement'),
    initialPassword: required('initialPassword'),
    phone: optional('phone'),
    whatsapp: optional('whatsapp'),
    address: optional('address'),
    city: required('city'),
    state: required('state'),
    registrationStatus: source.registrationStatus === undefined
      ? undefined
      : (required('registrationStatus') as CompanyProfile['registrationStatus']),
  };
}

export function validateCompanyProvisioningInput(input: CreateCompanyWorkspaceInput): string[] {
  const errors: string[] = [];
  if (!isValidWorkspaceId(input.workspaceId)) errors.push('Identificador de empresa inválido.');
  if (!input.legalName.trim()) errors.push('Informe a razão social.');
  if (!input.responsibleName.trim()) errors.push('Informe o responsável principal.');
  if (!isValidCompanyCnpj(input.cnpj)) errors.push('CNPJ inválido.');
  if (!isValidPlatformEmail(input.authorizedEmail)) errors.push('E-mail empresarial inválido.');
  if (input.companyEmail?.trim() && !isValidPlatformEmail(input.companyEmail)) errors.push('E-mail comercial inválido.');
  if (input.postalCode?.trim() && !/^\d{8}$/.test(input.postalCode.replace(/\D/g, ''))) errors.push('CEP inválido.');
  if (!input.city.trim()) errors.push('Informe a cidade da empresa.');
  if (!/^[A-Z]{2}$/.test(input.state.trim().toUpperCase())) errors.push('UF inválida.');
  if (input.initialPassword.length < MIN_COMPANY_PASSWORD_LENGTH
      || input.initialPassword.length > MAX_COMPANY_PASSWORD_LENGTH) {
    errors.push('A senha inicial deve ter entre 8 e 128 caracteres.');
  }
  if (input.registrationStatus !== undefined
      && !['active', 'pending', 'suspended'].includes(input.registrationStatus)) {
    errors.push('Situação cadastral inválida.');
  }
  return errors;
}

export function buildProvisionedCompanyRecords(
  input: CreateCompanyWorkspaceInput,
  createdByEmail: string,
  firebaseUid: string,
  now: string = new Date().toISOString()
): CompanyProvisioningResult {
  const errors = validateCompanyProvisioningInput(input);
  if (errors.length) throw new Error(errors[0]);
  if (!firebaseUid.trim()) throw new Error('UID Firebase é obrigatório para empresas.');

  const authorizedEmail = normalizePlatformEmail(input.authorizedEmail);
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const companyProfile: CompanyProfile = {
    legalName: input.legalName.trim(),
    ...(input.tradeName?.trim() ? { tradeName: input.tradeName.trim() } : {}),
    cnpj: normalizeCompanyCnpj(input.cnpj),
    responsibleName: input.responsibleName.trim(),
    accessEmail: authorizedEmail,
    ...(input.companyEmail?.trim() ? { companyEmail: normalizePlatformEmail(input.companyEmail) } : {}),
    ...(input.postalCode?.trim() ? { postalCode: input.postalCode.replace(/\D/g, '') } : {}),
    ...(input.addressNumber?.trim() ? { addressNumber: input.addressNumber.trim() } : {}),
    ...(input.addressComplement?.trim() ? { addressComplement: input.addressComplement.trim() } : {}),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    ...(input.whatsapp?.trim() ? { whatsapp: input.whatsapp.trim() } : {}),
    ...(input.address?.trim() ? { address: input.address.trim() } : {}),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    registrationStatus: input.registrationStatus || 'active',
  };
  const workspace: CompanyWorkspace = {
    id: workspaceId,
    workspaceType: 'company',
    name: companyProfile.tradeName || companyProfile.legalName,
    status: 'active',
    authorizedEmail,
    companyProfile,
    createdAt: now,
    updatedAt: now,
    createdBy: normalizePlatformEmail(createdByEmail),
  };
  const account: CompanyAccount = {
    accountType: 'company',
    workspaceId,
    firebaseUid: firebaseUid.trim(),
    authProvider: 'password',
    email: authorizedEmail,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: workspace.createdBy,
  };
  const recordErrors = [...validateCompanyWorkspace(workspace), ...validatePlatformAccount(account)];
  if (recordErrors.length) throw new Error(recordErrors[0]);
  return { workspace, account };
}
