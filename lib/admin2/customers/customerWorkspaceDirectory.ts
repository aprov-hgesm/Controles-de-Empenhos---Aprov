'use client';

import {
  collection,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '../../firebase';
import type { BillingAccount, BillingAccountStatus } from '../../billing';
import type { Workspace } from '../../platformIdentity';
import {
  ADMIN2_CUSTOMER_PAGE_SIZE,
  buildCustomerBillingSnapshot,
  buildCustomerWorkspaceRecord,
  type CustomerBillingSnapshot,
  type CustomerSearchField,
  type CustomerWorkspaceRecord,
} from './customerWorkspaceContract';

const WORKSPACES_PATH = 'workspaces';
const BILLING_ACCOUNTS_PATH = 'billingAccounts';

export interface CustomerWorkspaceQuery {
  field: CustomerSearchField;
  term: string;
}

export interface CustomerWorkspacePage {
  rows: CustomerWorkspaceRecord[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Consultas reais, limitadas, sem listener e sem writes.
 * As Security Rules existentes exigem isPlatformAdmin() para listar workspaces.
 * A identidade exibida no frontend NÃO concede autorização por si só.
 */
export async function readCustomerWorkspacePage(
  search: CustomerWorkspaceQuery,
  previousPageLast: QueryDocumentSnapshot<DocumentData> | null
): Promise<CustomerWorkspacePage> {
  const term = search.term.trim();
  const constraints: QueryConstraint[] = [];

  if (term) {
    if (term.length > 100) throw new Error('A pesquisa aceita no máximo 100 caracteres.');
    if (search.field === 'ug') {
      if (!/^\d{6}$/.test(term)) {
        throw new Error('Para pesquisar por UG, informe exatamente seis dígitos.');
      }
      constraints.push(where('ug', '==', term));
    } else if (search.field === 'workspaceId') {
      if (!/^[a-z0-9][a-z0-9-]{1,47}$/i.test(term)) {
        throw new Error('Informe um identificador de workspace válido.');
      }
      constraints.push(where(documentId(), '==', term.toLowerCase()));
    } else {
      // Busca por prefixo com ordenação Firestore. Sem scan de todos os workspaces.
      constraints.push(orderBy('name'), startAt(term), endAt(term + '\uf8ff'));
    }
  } else {
    constraints.push(orderBy('name'));
  }

  if (previousPageLast) constraints.push(startAfter(previousPageLast));
  constraints.push(limit(ADMIN2_CUSTOMER_PAGE_SIZE + 1));

  const snapshot = await getDocs(query(collection(db, WORKSPACES_PATH), ...constraints));
  const visible = snapshot.docs.slice(0, ADMIN2_CUSTOMER_PAGE_SIZE);

  return {
    rows: visible.map((record) =>
      buildCustomerWorkspaceRecord(record.id, record.data() as Partial<Workspace>)
    ),
    lastVisible: visible.length > 0 ? visible[visible.length - 1] : null,
    hasMore: snapshot.docs.length > ADMIN2_CUSTOMER_PAGE_SIZE,
  };
}

/** Detalhe comercial carregado SOMENTE quando o administrador abre uma ficha. */
export async function readCustomerBilling(
  workspaceId: string
): Promise<CustomerBillingSnapshot | null> {
  const snapshot = await getDoc(doc(db, BILLING_ACCOUNTS_PATH, workspaceId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<BillingAccount>;
  return buildCustomerBillingSnapshot(workspaceId, data);
}

export type { BillingAccountStatus };
