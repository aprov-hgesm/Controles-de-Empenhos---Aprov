import type { Empenho, Invoice } from './types';
import {
  buildInvoiceRecordKey,
  getInvoiceRecordKey,
  isValidSupplierCnpj,
  normalizeSupplierCnpj,
} from './invoiceIdentity';

export type SupplierCnpjMigrationErrorCode =
  | 'invalid_target_cnpj'
  | 'cannot_remove_with_invoices'
  | 'invoice_supplier_conflict'
  | 'duplicate_target_identity';

export class SupplierCnpjMigrationError extends Error {
  readonly code: SupplierCnpjMigrationErrorCode;

  constructor(code: SupplierCnpjMigrationErrorCode, message: string) {
    super(message);
    this.name = 'SupplierCnpjMigrationError';
    this.code = code;
  }
}

export interface SupplierCnpjMigrationItem {
  sourceRecordKey: string;
  targetRecordKey: string;
  invoice: Invoice;
  updatedInvoice: Invoice;
}

export interface SupplierCnpjMigrationPlan {
  sourceSupplierCnpj: string;
  targetSupplierCnpj: string;
  updatedEmpenho: Empenho;
  items: SupplierCnpjMigrationItem[];
  isNoOp: boolean;
}

export function buildSupplierCnpjMigrationPlan(
  empenho: Empenho,
  linkedInvoices: Invoice[],
  targetSupplierCnpjInput: string
): SupplierCnpjMigrationPlan {
  const rawTarget = String(targetSupplierCnpjInput || '').trim();
  const targetSupplierCnpj = normalizeSupplierCnpj(rawTarget);
  if (rawTarget && (!targetSupplierCnpj || !isValidSupplierCnpj(targetSupplierCnpj))) {
    throw new SupplierCnpjMigrationError(
      'invalid_target_cnpj',
      'Informe um CNPJ válido, com formato oficial e dígitos verificadores corretos.'
    );
  }

  const sourceSupplierCnpj = normalizeSupplierCnpj(empenho.supplierCnpj);

  if (!targetSupplierCnpj && linkedInvoices.length > 0) {
    throw new SupplierCnpjMigrationError(
      'cannot_remove_with_invoices',
      'Não é possível remover o CNPJ de um empenho que já possui Notas Fiscais vinculadas.'
    );
  }

  const targetKeys = new Set<string>();
  const items = linkedInvoices.map((invoice) => {
    const invoiceCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);

    if (sourceSupplierCnpj) {
      if (invoiceCnpj && invoiceCnpj !== sourceSupplierCnpj) {
        throw new SupplierCnpjMigrationError(
          'invoice_supplier_conflict',
          `A NF ${invoice.id} possui CNPJ divergente do empenho atual.`
        );
      }
    } else if (invoiceCnpj && targetSupplierCnpj && invoiceCnpj !== targetSupplierCnpj) {
      throw new SupplierCnpjMigrationError(
        'invoice_supplier_conflict',
        `A NF ${invoice.id} já possui CNPJ diferente do novo CNPJ informado.`
      );
    }

    if (!targetSupplierCnpj) {
      throw new SupplierCnpjMigrationError(
        'cannot_remove_with_invoices',
        'Notas Fiscais vinculadas exigem CNPJ para manter identidade determinística.'
      );
    }

    const targetRecordKey = buildInvoiceRecordKey(targetSupplierCnpj, invoice.id);
    if (!targetRecordKey) {
      throw new SupplierCnpjMigrationError(
        'invalid_target_cnpj',
        `Não foi possível construir a nova identidade da NF ${invoice.id}.`
      );
    }

    if (targetKeys.has(targetRecordKey)) {
      throw new SupplierCnpjMigrationError(
        'duplicate_target_identity',
        `Mais de uma NF resultaria na mesma identidade ${targetRecordKey}.`
      );
    }
    targetKeys.add(targetRecordKey);

    const sourceRecordKey = getInvoiceRecordKey(invoice);
    const updatedInvoice: Invoice = {
      ...invoice,
      supplierCnpj: targetSupplierCnpj,
      recordKey: targetRecordKey,
    };

    return {
      sourceRecordKey,
      targetRecordKey,
      invoice,
      updatedInvoice,
    };
  });

  const updatedEmpenho: Empenho = {
    ...empenho,
    supplierCnpj: targetSupplierCnpj || undefined,
  };

  return {
    sourceSupplierCnpj,
    targetSupplierCnpj,
    updatedEmpenho,
    items,
    isNoOp:
      sourceSupplierCnpj === targetSupplierCnpj &&
      items.every((item) => item.sourceRecordKey === item.targetRecordKey),
  };
}
