'use client';

import {
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
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
const INVOICE_COUNT_CONCURRENCY = 8;

export interface HistoricalInvoiceQueryResult {
  invoices: Invoice[];
  pages: number;
  documentReads: number;
  truncated: boolean;
}

export interface InvoiceCollectionSummaryCounts {
  total: number;
  completed: number;
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
    const pageQuery: Query<DocumentData> = cursor
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

    const snapshot: QuerySnapshot<DocumentData> = await getDocs(pageQuery);
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

export async function loadAllInvoicesHistory(): Promise<HistoricalInvoiceQueryResult> {
  return loadHistoricalInvoiceSlice([]);
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

export async function loadInvoicesByRecordKeys(
  recordKeys: string[]
): Promise<Invoice[]> {
  const scope = getCurrentOperationalScope();
  const collectionRef = operationalCollectionRef(scope, 'invoices');
  const uniqueKeys = Array.from(new Set(recordKeys.map((key) => key.trim()).filter(Boolean)));
  const invoices: Invoice[] = [];

  for (let index = 0; index < uniqueKeys.length; index += 30) {
    const keys = uniqueKeys.slice(index, index + 30);
    const snapshot = await getDocs(
      query(collectionRef, where(documentId(), 'in', keys))
    );
    recordWorkspaceDocumentReads(scope, snapshot.size);
    invoices.push(...snapshot.docs.map(mapInvoice));
  }

  return invoices;
}

export async function loadInvoiceCountsForEmpenhos(
  empenhoIds: string[]
): Promise<Map<string, number>> {
  const scope = getCurrentOperationalScope();
  const collectionRef = operationalCollectionRef(scope, 'invoices');
  const uniqueIds = Array.from(new Set(empenhoIds.map((id) => id.trim()).filter(Boolean)));
  const counts = new Map<string, number>();

  for (let index = 0; index < uniqueIds.length; index += INVOICE_COUNT_CONCURRENCY) {
    const chunk = uniqueIds.slice(index, index + INVOICE_COUNT_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (empenhoId) => {
        const snapshot = await getCountFromServer(
          query(collectionRef, where('empenhoId', '==', empenhoId))
        );
        return [empenhoId, snapshot.data().count] as const;
      })
    );
    for (const [empenhoId, count] of results) counts.set(empenhoId, count);
  }

  return counts;
}

export async function loadInvoiceCollectionSummaryCounts(): Promise<InvoiceCollectionSummaryCounts> {
  const scope = getCurrentOperationalScope();
  const collectionRef = operationalCollectionRef(scope, 'invoices');
  const [totalSnapshot, completedSnapshot] = await Promise.all([
    getCountFromServer(collectionRef),
    getCountFromServer(
      query(collectionRef, where('localizacaoAtual', '==', 'TESOURARIA'))
    ),
  ]);

  return {
    total: totalSnapshot.data().count,
    completed: completedSnapshot.data().count,
  };
}

export async function loadHighestTermoNumero(): Promise<number> {
  const scope = getCurrentOperationalScope();
  const snapshot = await getDocs(
    query(
      operationalCollectionRef(scope, 'invoices'),
      orderBy('termoNumero', 'desc'),
      limit(1)
    )
  );
  recordWorkspaceDocumentReads(scope, snapshot.size);
  if (snapshot.empty) return 0;
  const value = snapshot.docs[0].data()?.termoNumero;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
