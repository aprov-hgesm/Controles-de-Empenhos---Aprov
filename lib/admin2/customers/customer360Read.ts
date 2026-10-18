'use client';

import {
  collection,
  documentId,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { BillingCycle } from '../../billing';
import { db } from '../../firebase';
import {
  ADMIN2_AUDIT_SAMPLE_LIMIT,
  ADMIN2_CYCLE_PAGE_SIZE,
  mapCustomerBillingCycle,
  toCustomerAuditRecord,
  type CustomerAuditRecord,
  type CustomerCycleRecord,
} from './customer360Contract';

export interface CustomerCyclePage {
  rows: CustomerCycleRecord[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Billing usa IDs canônicos workspaceId__YYYY-MM.
 * A pesquisa por prefixo de DOCUMENT ID DESC dispensa índice composto,
 * evita baixar a coleção inteira e entrega competências recentes primeiro.
 * Exclui ciclos legados não canônicos, explicitamente documentado.
 */
export async function readCustomerCyclePage(
  workspaceId: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null
): Promise<CustomerCyclePage> {
  const prefix = workspaceId + '__';
  const clauses = [
    orderBy(documentId(), 'desc'),
    startAt(prefix + '\uf8ff'),
    endAt(prefix),
  ];
  const snapshot = await getDocs(query(
    collection(db, 'billingCycles'),
    ...clauses,
    ...(cursor ? [startAfter(cursor)] : []),
    limit(ADMIN2_CYCLE_PAGE_SIZE + 1)
  ));
  const visible = snapshot.docs.slice(0, ADMIN2_CYCLE_PAGE_SIZE);
  return {
    rows: visible.map((entry) => mapCustomerBillingCycle(
      workspaceId,
      entry.id,
      entry.data() as Partial<BillingCycle>
    )).filter((row): row is CustomerCycleRecord => row !== null),
    lastVisible: visible.at(-1) || null,
    hasMore: snapshot.docs.length > ADMIN2_CYCLE_PAGE_SIZE,
  };
}

/**
 * Visão limitada de eventos reais. A collection tem IDs sem ordem temporal:
 * uma query filtrada apenas por workspace é indexável sem índice composto,
 * mas a amostra NÃO é necessariamente dos eventos mais recentes.
 *
 * Nunca buscar globalmente nem inspecionar before/after de auditoria.
 */
export async function readCustomerAuditSample(
  workspaceId: string
): Promise<CustomerAuditRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, 'platformAuditEvents'),
    where('workspaceId', '==', workspaceId),
    limit(ADMIN2_AUDIT_SAMPLE_LIMIT)
  ));
  return snapshot.docs.map((entry) => toCustomerAuditRecord(
    workspaceId,
    entry.id,
    entry.data()
  )).filter((event): event is CustomerAuditRecord => event !== null)
    .sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''));
}
