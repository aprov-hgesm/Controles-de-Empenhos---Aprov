import type { Empenho, SupplierContact } from './types';
import { getSupplierContacts, saveSupplierContact } from './firebaseSync';
import { getGlobalSupplierDirectory } from './supplierDirectory';
import { isValidSupplierCnpj, normalizeSupplierCnpj } from './invoiceIdentity';

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


/**
 * Atualiza somente o contato local do setor, nunca o diretório global.
 * A ação deve ser chamada exclusivamente após a escolha explícita do usuário.
 */
export async function saveSupplierEmailForEmpenho(
  userId: string,
  empenho: Empenho,
  emailAddress: string
): Promise<void> {
  const email = normalizeEmail(emailAddress);
  if (!email) throw new Error('Informe um e-mail válido para o fornecedor.');

  const cnpj = normalizeSupplierCnpj(empenho.supplierCnpj);
  if (!cnpj || !isValidSupplierCnpj(cnpj)) {
    throw new Error('É necessário um CNPJ válido no empenho para atualizar o cadastro do fornecedor.');
  }

  const contacts = await getSupplierContacts(userId);
  const existing = contacts.find((contact) => contact.cnpj === cnpj);
  const now = new Date().toISOString();
  const updated: SupplierContact = existing
    ? { ...existing, email, updatedAt: now, updatedBy: userId }
    : {
        id: 'supplier_' + cnpj,
        legalName: empenho.supplier.trim() || 'Fornecedor',
        cnpj,
        email,
        phone: '',
        whatsapp: '',
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      };

  await saveSupplierContact(userId, updated);
}
