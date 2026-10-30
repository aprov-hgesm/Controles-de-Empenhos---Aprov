'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

/** W2 consome exclusivamente as APIs administrativas do W1. Nenhum SDK Firestore é usado aqui. */
export interface CreateCompanyInput {
  legalName: string;
  tradeName: string;
  cnpj: string;
  workspaceId: string;
  responsibleName: string;
  responsiblePhone: string;
  companyEmail: string;
  loginEmail: string;
  initialPassword: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  city: string;
  state: string;
}

export interface AdminCompany {
  workspaceId: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  responsibleName: string;
  responsiblePhone: string;
  companyEmail: string;
  loginEmail: string;
  status: string;
  createdAt: unknown;
  postalCode: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  city: string;
  state: string;
}

type RecordValue = Record<string, unknown>;
const isObject = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const pick = (...values: unknown[]): string =>
  values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';

/** Normaliza somente campos permitidos para exibição; nunca transporta senha, hash ou tokens. */
function normalizeCompany(value: unknown): AdminCompany | null {
  if (!isObject(value)) return null;
  // W1 devolve CompanyDirectoryEntry = { workspace, account }; também aceita registros achatados.
  const workspace = isObject(value.workspace) ? value.workspace : value;
  const profile = isObject(workspace.companyProfile) ? workspace.companyProfile : workspace;
  const account = isObject(value.account) ? value.account : {};
  const responsible = isObject(profile.responsible) ? profile.responsible : {};
  const access = isObject(profile.access) ? profile.access : {};
  const location = isObject(profile.location) ? profile.location : {};
  return {
    workspaceId: pick(workspace.id, workspace.workspaceId, value.workspaceId, value.companyId),
    legalName: pick(profile.legalName, profile.corporateName, profile.razaoSocial),
    tradeName: pick(profile.tradeName, profile.fantasyName, profile.nomeFantasia),
    cnpj: pick(profile.cnpj),
    responsibleName: pick(profile.responsibleName, responsible.name),
    responsiblePhone: pick(profile.responsiblePhone, profile.phone, profile.whatsapp, responsible.phone),
    companyEmail: pick(profile.companyEmail, profile.primaryEmail, responsible.email),
    loginEmail: pick(account.email, profile.loginEmail, profile.accessEmail, access.email, workspace.authorizedEmail),
    status: pick(workspace.status, account.status, profile.registrationStatus),
    createdAt: workspace.createdAt ?? profile.createdAt ?? null,
    postalCode: pick(profile.postalCode, profile.cep, location.postalCode, location.cep),
    address: pick(profile.address, location.address, location.street),
    addressNumber: pick(profile.addressNumber, location.number),
    addressComplement: pick(profile.addressComplement, location.complement),
    city: pick(profile.city, location.city),
    state: pick(profile.state, profile.uf, location.state, location.uf),
  };
}

function parseCompanies(payload: unknown): AdminCompany[] {
  const record = isObject(payload) ? payload : {};
  if (record.ok === false) {
    throw new Error(pick(record.error, record.message) || 'Não foi possível consultar as empresas.');
  }
  const result = isObject(record.result) ? record.result : {};
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(record.companies) ? record.companies
    : Array.isArray(result.companies) ? result.companies
    : Array.isArray(record.result) ? record.result
    : null;
  if (!rows) throw new Error('O diretório empresarial retornou um formato inesperado. Confira o contrato da API do W1.');
  return rows.map(normalizeCompany).filter((company): company is AdminCompany => company !== null);
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function apiError(response: Response, payload: unknown, operation: 'cadastro' | 'consulta'): Error {
  const record = isObject(payload) ? payload : {};
  if (response.status === 404) return new Error('API empresarial ainda não disponível. Aguarde a integração do Worker W1.');
  if (response.status === 401 || response.status === 403) return new Error('A sessão não possui autorização para esta operação administrativa.');
  if (record.recoveryRequired === true) return new Error('O cadastro exige recuperação administrativa. Não repita a operação antes de verificar a situação.');
  return new Error(pick(record.error, record.message) || `Falha na ${operation} de empresas (HTTP ${response.status}).`);
}

export function usePlatformAdminCompanies(adminUser: User | null, enabled: boolean) {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await adminUser.getIdToken();
      const response = await fetch('/api/admin/companies', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await readPayload(response);
      if (!response.ok) throw apiError(response, payload, 'consulta');
      setCompanies(parseCompanies(payload));
    } catch (cause) {
      setCompanies([]);
      setError(cause instanceof Error ? cause.message : 'Falha ao consultar o diretório empresarial.');
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (enabled && adminUser) void refresh();
    if (!adminUser) {
      setCompanies([]);
      setError(null);
    }
  }, [adminUser, enabled, refresh]);

  const createCompany = useCallback(async (input: CreateCompanyInput) => {
    if (!adminUser) throw new Error('Sessão administrativa inválida.');
    setCreating(true);
    try {
      const token = await adminUser.getIdToken();
      const response = await fetch('/api/admin/provision-company', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        // Campos exigidos pelo W1 atual, preservando campos extras para evolução do contrato.
        // O modelo inicial W1 guarda endereço em texto e possui um e-mail autorizado único.
        body: JSON.stringify({
          ...input,
          authorizedEmail: input.loginEmail,
          phone: input.responsiblePhone,
          whatsapp: input.responsiblePhone,
          address: [
            [input.address, input.addressNumber].filter(Boolean).join(', '),
            input.addressComplement,
            input.postalCode ? 'CEP ' + input.postalCode : '',
          ].filter(Boolean).join(' - '),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok || (isObject(payload) && payload.ok === false)) {
        throw apiError(response, payload, 'cadastro');
      }
      if (!isObject(payload) || payload.ok !== true) {
        throw new Error('O servidor não confirmou a criação da empresa. Confira o contrato da API do W1.');
      }
    } finally {
      setCreating(false);
    }
  }, [adminUser]);

  return { companies, loading, creating, error, refresh, createCompany };
}
