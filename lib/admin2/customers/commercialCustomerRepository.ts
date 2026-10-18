'use client';

import {
  collection, doc, documentId, getDocs, limit, orderBy, query,
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
    for (const id of allIds) {
      const ref = doc(db, LINKS, id);
      if (next.workspaceIds.includes(id)) tx.set(ref, { workspaceId: id, customerId: customerRef.id });
      else tx.delete(ref);
    }
  });

  return next;
}
