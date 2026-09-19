import type { Invoice } from './types';

const CNPJ_CANONICAL_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/;
const CNPJ_BASE_PATTERN = /^[0-9A-Z]{12}$/;
const CNPJ_FORMATTING_CHARS_PATTERN = /[.\/\-\s]/g;
const CNPJ_FIRST_DV_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_SECOND_DV_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/**
 * Normaliza apenas a forma do CNPJ.
 *
 * Desde julho de 2026, CNPJs novos podem conter letras nas 12 primeiras
 * posições. Os dois dígitos verificadores permanecem numéricos.
 *
 * Esta função NÃO valida os dígitos verificadores. Isso é intencional para que
 * registros históricos estruturalmente reconhecíveis continuem localizáveis e
 * possam ser diagnosticados/migrados em vez de desaparecerem silenciosamente.
 */
export function normalizeSupplierCnpj(value?: string | null): string {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(CNPJ_FORMATTING_CHARS_PATTERN, '');

  return CNPJ_CANONICAL_PATTERN.test(compact) ? compact : '';
}

export function hasValidSupplierCnpjShape(value?: string | null): boolean {
  return Boolean(normalizeSupplierCnpj(value));
}

function cnpjCharacterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function calculateCnpjDigit(characters: string, weights: readonly number[]): number {
  const sum = Array.from(characters).reduce(
    (total, character, index) => total + cnpjCharacterValue(character) * weights[index],
    0
  );
  const remainder = sum % 11;
  return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
}

export function calculateSupplierCnpjCheckDigits(value?: string | null): string | null {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(CNPJ_FORMATTING_CHARS_PATTERN, '');

  const base = raw.length === 14 ? raw.slice(0, 12) : raw;
  if (!CNPJ_BASE_PATTERN.test(base)) return null;

  const firstDigit = calculateCnpjDigit(base, CNPJ_FIRST_DV_WEIGHTS);
  const secondDigit = calculateCnpjDigit(
    `${base}${firstDigit}`,
    CNPJ_SECOND_DV_WEIGHTS
  );

  return `${firstDigit}${secondDigit}`;
}

export function isValidSupplierCnpj(value?: string | null): boolean {
  const cnpj = normalizeSupplierCnpj(value);
  if (!cnpj || cnpj === '00000000000000') return false;

  const expectedDigits = calculateSupplierCnpjCheckDigits(cnpj.slice(0, 12));
  return Boolean(expectedDigits && cnpj.slice(12) === expectedDigits);
}

export function formatSupplierCnpj(value?: string | null): string {
  const canonical = normalizeSupplierCnpj(value);
  if (!canonical) return '';
  return canonical.replace(
    /^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function normalizeInvoiceNumber(value?: string | null): string {
  const compact = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!compact) return '';
  if (/^\d+$/.test(compact)) {
    return compact.replace(/^0+(?=\d)/, '');
  }
  return compact;
}

export function buildInvoiceRecordKey(
  supplierCnpj?: string | null,
  invoiceNumber?: string | null
): string | null {
  const cnpj = normalizeSupplierCnpj(supplierCnpj);
  const number = normalizeInvoiceNumber(invoiceNumber);
  if (!cnpj || !number) return null;
  return `nf_${cnpj}_${encodeURIComponent(number)}`;
}

export function getInvoiceRecordKey(invoice: Pick<Invoice, 'id' | 'recordKey'>): string {
  return invoice.recordKey?.trim() || invoice.id.trim();
}

export function sameInvoiceNumber(a?: string | null, b?: string | null): boolean {
  const left = normalizeInvoiceNumber(a);
  const right = normalizeInvoiceNumber(b);
  return Boolean(left && right && left === right);
}

export function invoiceBelongsToSupplier(
  invoice: Pick<Invoice, 'supplierCnpj'>,
  supplierCnpj?: string | null
): boolean {
  const invoiceCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
  const expectedCnpj = normalizeSupplierCnpj(supplierCnpj);
  return Boolean(invoiceCnpj && expectedCnpj && invoiceCnpj === expectedCnpj);
}

export function findInvoiceIdentityConflict(
  invoices: Invoice[],
  supplierCnpj: string | null | undefined,
  invoiceNumber: string,
  ignoredRecordKey?: string | null
): Invoice | null {
  const expectedCnpj = normalizeSupplierCnpj(supplierCnpj);
  const expectedNumber = normalizeInvoiceNumber(invoiceNumber);
  if (!expectedNumber) return null;

  for (const invoice of invoices) {
    if (ignoredRecordKey && getInvoiceRecordKey(invoice) === ignoredRecordKey) continue;
    if (!sameInvoiceNumber(invoice.id, expectedNumber)) continue;

    const existingCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);

    // Quando ambos os lados possuem CNPJ, o número só conflita dentro do mesmo fornecedor.
    if (expectedCnpj && existingCnpj) {
      if (expectedCnpj === existingCnpj) return invoice;
      continue;
    }

    // Compatibilidade conservadora: enquanto um registro legado ainda não possuir CNPJ,
    // não permitimos criar outro número igual porque não há como provar que são empresas distintas.
    return invoice;
  }

  return null;
}
