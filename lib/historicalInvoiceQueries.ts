'use client';

import {
  getDocs,
  limit,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';

import type { Invoice } from './types';
import { normalizeSupplier } from '../features/empenhos/domain/empenhoHelpers';
import { normalizeSupplierCnpj } from './invoiceIdentity';
import {
  getCurrentOperationalScope,
  operationalCollectionRef,
} from './operationalPaths';
import { recordWorkspaceDocumentReads } from './workspaceUsageTelemetry';

export const HISTORICAL_QUERY_PAGE_SIZE = 250;
export const HISTORICAL_QUERY_MAX_PAGES = 40;

export interface HistoricalInvoiceQueryResult {
  invoices: Invoice[];
  pages: number;
  documentReads: number;
  truncated: boolean;
}

function mapInvoice(snapshotDoc: QueryDocumentSnapshot<DocumentData>): Invoice {
  const data = snapshotDoc.data() as Invoice;
  return {
    ...data,
    recordKey: data.recordKey || snapshotDoc.id,
    supplier: normalizeSupplier(data.supplier),
  };
}

async function loadHistoricalInvoiceSlice(
  constraints: QueryConstraint[]
): Promise<HistoricalInvoiceQueryResult> {
  const scope = getCurrentOperationalScope();
  const collectionRef = operationalCollectionRef(scope, 'invoices');

  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let pages = 0;
  let documentReads = 0;
  let truncated = false;
  const invoices: Invoice[] = [];

  while (pages < HISTORICAL_QUERY_MAX_PAGES) {
    const pageQuery = cursor
      ? query(
          collectionRef,
          ...constraints,
          startAfter(cursor),
          limit(HISTORICAL_QUERY_PAGE_SIZE)
        )
      : query(
          collectionRef,
          ...constraints,
          limit(HISTORICAL_QUERY_PAGE_SIZE)
        );

    const snapshot = await getDocs(pageQuery);
    pages += 1;
    documentReads += snapshot.size;
    recordWorkspaceDocumentReads(scope, snapshot.size);

    invoices.push(...snapshot.docs.map(mapInvoice));

    if (snapshot.size < HISTORICAL_QUERY_PAGE_SIZE) {
      return { invoices, pages, documentReads, truncated: false };
    }

    cursor = snapshot.docs.at(-1) || null;
    if (!cursor) break;
  }

  truncated = true;
  return { invoices, pages, documentReads, truncated };
}

export async function loadInvoicesForEmpenho(
  empenhoId: string
): Promise<HistoricalInvoiceQueryResult> {
  const normalized = empenhoId.trim();
  if (!normalized) {
    return { invoices: [], pages: 0, documentReads: 0, truncated: false };
  }

  return loadHistoricalInvoiceSlice([
    where('empenhoId', '==', normalized),
  ]);
}

export async function loadInvoicesForSupplier(
  supplierCnpj: string
): Promise<HistoricalInvoiceQueryResult> {
  const normalized = normalizeSupplierCnpj(supplierCnpj);
  if (!normalized) {
    return { invoices: [], pages: 0, documentReads: 0, truncated: false };
  }

  return loadHistoricalInvoiceSlice([
    where('supplierCnpj', '==', normalized),
  ]);
}
