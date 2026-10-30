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
  const responsible = isObject(value.responsible) ? value.responsible : {};
  const access = isObject(value.access) ? value.access : {};
  const location = isObject(value.location) ? value.location : {};
  return {
    workspaceId: pick(value.workspaceId, value.id, value.companyId),
    legalName: pick(value.legalName, value.corporateName, value.razaoSocial),
    tradeName: pick(value.tradeName, value.fantasyName, value.nomeFantasia),
    cnpj: pick(value.cnpj),
    responsibleName: pick(value.responsibleName, responsible.name),
    responsiblePhone: pick(value.responsiblePhone, responsible.phone, responsible.whatsapp),
    companyEmail: pick(value.companyEmail, value.primaryEmail, responsible.email),
    loginEmail: pick(value.loginEmail, value.accessEmail, access.email, value.authorizedEmail),
    status: pick(value.status, value.accountStatus),
    createdAt: value.createdAt ?? value.created_at ?? null,
    postalCode: pick(value.postalCode, value.cep, location.postalCode, location.cep),
    address: pick(value.address, location.address, location.street),
    addressNumber: pick(value.addressNumber, location.number),
    addressComplement: pick(value.addressComplement, location.complement),
    city: pick(value.city, location.city),
    state: pick(value.state, value.uf, location.state, location.uf),
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
        body: JSON.stringify(input),
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
