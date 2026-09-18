import type { Invoice } from './types';

export function normalizeSupplierCnpj(value?: string | null): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 14 ? digits : '';
}

export function isValidSupplierCnpj(value?: string | null): boolean {
  return normalizeSupplierCnpj(value).length === 14;
}

export function formatSupplierCnpj(value?: string | null): string {
  const digits = normalizeSupplierCnpj(value);
  if (!digits) return '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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
