import type { Empenho } from './types';
import { getSupplierContacts } from './firebaseSync';
import { getGlobalSupplierDirectory } from './supplierDirectory';
import { normalizeSupplierCnpj } from './invoiceIdentity';

export type SupplierEmailSource = 'local' | 'global';

export interface ResolvedSupplierEmail {
  email: string;
  source: SupplierEmailSource;
  cnpj: string;
}

function normalizeNameKey(value: string): string {
  return value.trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ');
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export async function resolveSupplierEmailForEmpenho(
  userId: string,
  empenho: Empenho
): Promise<ResolvedSupplierEmail | null> {
  const contacts = await getSupplierContacts(userId);
  const cnpj = normalizeSupplierCnpj(empenho.supplierCnpj);
  const supplierNameKey = normalizeNameKey(empenho.supplier || '');

  const local = cnpj
    ? contacts.find((contact) => contact.cnpj === cnpj)
    : contacts.find((contact) => normalizeNameKey(contact.legalName) === supplierNameKey);

  const localEmail = normalizeEmail(local?.email);
  if (localEmail) {
    return {
      email: localEmail,
      source: 'local',
      cnpj: cnpj || local?.cnpj || '',
    };
  }

  if (!cnpj) return null;

  const directory = await getGlobalSupplierDirectory(userId);
  const globalEmail = normalizeEmail(
    directory.find((entry) => entry.cnpj === cnpj)?.email
  );

  return globalEmail
    ? { email: globalEmail, source: 'global', cnpj }
    : null;
}
