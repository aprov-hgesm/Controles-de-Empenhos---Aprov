import type { Transaction } from 'firebase/firestore';

import type { OperationalDataScope } from '../operationalPaths';
import type { Empenho, Invoice } from '../types';
import { isWarehouseIntegratedInvoice } from './invoiceIntegration';

/**
 * Compatibilidade deliberada para a antiga integração atômica NF -> warehouse.
 *
 * Desde a separação do ADM Depósito para o database `emprovex-warehouse`,
 * uma Transaction do Firestore principal jamais pode ler/gravar documentos do
 * warehouse. O fluxo operacional atual não depende deste serviço: a NF continua
 * canônica no EMPROVEX e a fila do ADM produz a projeção logística sob demanda,
 * persistindo decisões no warehouseDb pelos repositories dedicados.
 *
 * Mantemos as assinaturas temporariamente para que qualquer import legado falhe
 * de forma explícita e segura, em vez de tentar uma transação entre databases.
 */

export interface WarehouseInvoiceReceiptTransactionInput {
  enabled: boolean;
  scope: OperationalDataScope;
  userId: string;
  invoice: Invoice;
  previousInvoice: Invoice | null;
  previousInvoiceRecordKey?: string | null;
  targetEmpenho: Empenho;
  storedTargetEmpenho: Empenho;
  invoiceRecordKey: string;
}

export interface WarehouseInvoiceReceiptTransactionResult {
  invoice: Invoice;
  targetEmpenho: Empenho;
  movementIds: string[];
  integrated: boolean;
}

export interface WarehouseInvoiceDeletionTransactionInput {
  enabled: boolean;
  scope: OperationalDataScope;
  userId: string;
  invoice: Invoice;
  invoiceRecordKey: string;
}

export const WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED =
  'WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED: '
  + 'A integração atômica NF -> estoque foi desativada após a separação de databases. '
  + 'A NF permanece canônica no EMPROVEX; decisões logísticas devem ser persistidas '
  + 'pelos repositories do ADM no warehouseDb.';

/**
 * @deprecated Não use Transaction do banco principal para integrar o warehouse.
 */
export async function integrateInvoiceReceiptInTransaction(
  _transaction: Transaction,
  _input: WarehouseInvoiceReceiptTransactionInput
): Promise<WarehouseInvoiceReceiptTransactionResult> {
  throw new Error(WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED);
}

/**
 * @deprecated Não use Transaction do banco principal para estornar o warehouse.
 */
export async function integrateInvoiceDeletionInTransaction(
  _transaction: Transaction,
  _input: WarehouseInvoiceDeletionTransactionInput
): Promise<string[]> {
  throw new Error(WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED);
}

export function assertBulkInvoiceDeletionDoesNotBypassWarehouse(
  invoices: Invoice[]
): void {
  const integrated = invoices.filter(isWarehouseIntegratedInvoice);
  if (integrated.length > 0) {
    throw new Error(
      'WAREHOUSE_BULK_INVOICE_DELETE_BLOCKED: Exclua NFs integradas individualmente para que cada estorno seja tratado de forma explícita.'
    );
  }
}
