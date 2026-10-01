import type { Invoice } from './types';
import { getInvoiceRecordKey } from './invoiceIdentity';

export const INVOICE_HOT_HISTORY_MARKER_ID = 'perf-r3-invoice-hot-history';
export const INVOICE_HOT_HISTORY_SCHEMA_VERSION = 'perf_r3_invoice_hot_history_v1';
export const INVOICE_OPERATIONAL_LOCATIONS = ['APROVISIONAMENTO', 'COMISSAO'] as const;

export type InvoiceOperationalLocation = NonNullable<Invoice['localizacaoAtual']>;

export function getInvoiceOperationalLocation(
  invoice: Pick<Invoice, 'localizacaoAtual' | 'comissaoDate' | 'tesourariaDate'>
): InvoiceOperationalLocation {
  if (invoice.localizacaoAtual) return invoice.localizacaoAtual;
  if (invoice.tesourariaDate) return 'TESOURARIA';
  if (invoice.comissaoDate) return 'COMISSAO';
  return 'APROVISIONAMENTO';
}

export function isInvoiceOperationalRealtime(
  invoice: Pick<Invoice, 'localizacaoAtual' | 'comissaoDate' | 'tesourariaDate'>
): boolean {
  return getInvoiceOperationalLocation(invoice) !== 'TESOURARIA';
}

export function mergeInvoiceCollections(
  primary: Invoice[],
  secondary: Invoice[]
): Invoice[] {
  const byKey = new Map<string, Invoice>();

  for (const invoice of secondary) {
    byKey.set(getInvoiceRecordKey(invoice), invoice);
  }
  for (const invoice of primary) {
    byKey.set(getInvoiceRecordKey(invoice), invoice);
  }

  return [...byKey.values()];
}

export interface InvoiceHotHistoryMarker {
  schemaVersion: typeof INVOICE_HOT_HISTORY_SCHEMA_VERSION;
  workspaceId: string;
  status: 'ready';
}

export function isInvoiceHotHistoryMarker(
  value: unknown,
  workspaceId: string
): value is InvoiceHotHistoryMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<InvoiceHotHistoryMarker>;
  return marker.schemaVersion === INVOICE_HOT_HISTORY_SCHEMA_VERSION
    && marker.workspaceId === workspaceId
    && marker.status === 'ready';
}
