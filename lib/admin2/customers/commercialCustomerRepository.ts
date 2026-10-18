'use client';

import {
  collection, doc, getDoc, getDocs, limit, orderBy, query,
  runTransaction, startAfter, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import {
  ADMIN2_COMMERCIAL_PAGE_SIZE,
  buildCommercialCustomer,
  type CommercialCustomer,
  type CommercialCustomerInput,
  type CommercialWorkspaceIndex,
} from './commercialCustomerContract';

const CUSTOMERS = 'platformCustomers';
const LINKS = 'platformCustomerWorkspaceLinks';

/**
 * REAL persistence is always disabled on live Firebase in the localhost lab.
 * To exercise mutations use E2E Auth+Firestore emulators AND published branch Rules
 * in the emulator. There is no remote-provisioning/migration path from this lab.
 */
export const commercialEmulatorWritesEnabled =
  process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1' &&
  process.env.NODE_ENV === 'development';

export interface CommercialCustomerPage {
  rows: CommercialCustomer[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export async function listCommercialCustomers(
  after: QueryDocumentSnapshot<DocumentData> | null
): Promise<CommercialCustomerPage> {
  if (!commercialEmulatorWritesEnabled) throw new Error('Leitura comercial persistente limitada ao ambiente de homologação.');
  const snapshot = await getDocs(query(
    collection(db, CUSTOMERS),
    orderBy('displayName'),
    ...(after ? [startAfter(after)] : []),
    limit(ADMIN2_COMMERCIAL_PAGE_SIZE + 1)
  ));
  const visible = snapshot.docs.slice(0, ADMIN2_COMMERCIAL_PAGE_SIZE);
  return {
    rows: visible.map(d => d.data() as CommercialCustomer),
    cursor: visible.at(-1) || null,
    hasMore: snapshot.docs.length > ADMIN2_COMMERCIAL_PAGE_SIZE,
  };
}

/** Carregado apenas ao abrir "Vínculos e contato" em homologação Emulator. */
export async function readCommercialCustomerForWorkspace(
  workspaceId: string
): Promise<CommercialCustomer | null> {
  if (!commercialEmulatorWritesEnabled) return null;
  const link = await getDoc(doc(db, LINKS, workspaceId));
  if (!link.exists()) return null;
  const customerId = link.data()?.customerId;
  if (typeof customerId !== 'string' || !customerId) return null;
  const customer = await getDoc(doc(db, CUSTOMERS, customerId));
  if (!customer.exists()) return null;
  const record = customer.data() as CommercialCustomer;
  return record.workspaceIds.includes(workspaceId) ? record : null;
}

function founderActor(): string {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.email !== 'aprov1hgesm@gmail.com') {
    throw new Error('Apenas a conta fundadora verificada pode alterar cadastros comerciais.');
  }
  return user.email;
}

export async function saveCommercialCustomer(
  value: CommercialCustomerInput,
  existing: CommercialCustomer | null
): Promise<CommercialCustomer> {
  if (!commercialEmulatorWritesEnabled) {
    throw new Error('Gravação desabilitada fora do Firebase Emulator. Nenhum dado real foi alterado.');
  }
  const actor = founderActor();
  const customerRef = existing
    ? doc(db, CUSTOMERS, existing.id)
    : doc(collection(db, CUSTOMERS));
  const now = new Date().toISOString();
  const next = buildCommercialCustomer(customerRef.id, value, actor, now, existing || undefined);
  const former = existing?.workspaceIds || [];
  const allIds = Array.from(new Set([...former, ...next.workspaceIds]));
  const workspaceRefs = next.workspaceIds.map(id => doc(db, 'workspaces', id));
  const linkRefs = allIds.map(id => doc(db, LINKS, id));

  await runTransaction(db, async tx => {
    // Read all references BEFORE writes; never modify operational workspaces.
    const old = existing ? await tx.get(customerRef) : null;
    if (existing && (!old?.exists() || old.data().updatedAt !== existing.updatedAt)) {
      throw new Error('Cliente atualizado em outra sessão. Recarregue antes de salvar.');
    }
    const ws = await Promise.all(workspaceRefs.map(ref => tx.get(ref)));
    if (ws.some(snapshot => !snapshot.exists())) {
      throw new Error('Um ou mais workspaces não existem. Revise os vínculos.');
    }
    const currentLinks = await Promise.all(linkRefs.map(ref => tx.get(ref)));
    for (const snapshot of currentLinks) {
      if (!snapshot.exists()) continue;
      const linked = snapshot.data() as CommercialWorkspaceIndex;
      if (linked.customerId !== customerRef.id) {
        throw new Error('Workspace já vinculado a outro cliente comercial.');
      }
    }
    tx.set(customerRef, next);
    for (let index = 0; index < allIds.length; index += 1) {
      const id = allIds[index];
      const ref = linkRefs[index];
      if (next.workspaceIds.includes(id)) {
        if (!currentLinks[index].exists()) tx.set(ref, { workspaceId: id, customerId: customerRef.id });
      } else if (currentLinks[index].exists()) {
        tx.delete(ref);
      }
    }
  });

  return next;
}
