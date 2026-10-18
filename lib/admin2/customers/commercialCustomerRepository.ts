'use client';

import {
  collection, doc, getDoc, getDocs, limit, orderBy, query,
  runTransaction, startAfter, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { HGESM_SECTOR_EMAIL } from '../../hgesmWorkspace';
import {
  ADMIN2_COMMERCIAL_PAGE_SIZE,
  buildCommercialCustomer,
  type CommercialCustomer,
  type CommercialCustomerInput,
} from './commercialCustomerContract';

const CUSTOMERS = 'platformCustomers';

/** Somente Emulator em next dev; nunca escreve no Firebase real da prévia. */
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

/** Uma consulta direta para a ficha; o documento tem o MESMO ID do workspace. */
export async function readCommercialCustomerForWorkspace(
  workspaceId: string
): Promise<CommercialCustomer | null> {
  if (!commercialEmulatorWritesEnabled) return null;
  const customer = await getDoc(doc(db, CUSTOMERS, workspaceId));
  if (!customer.exists()) return null;
  const record = customer.data() as CommercialCustomer;
  return record.id === workspaceId && record.workspaceId === workspaceId
    ? record : null;
}

async function founderActor(): Promise<string> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.email?.trim().toLowerCase() !== HGESM_SECTOR_EMAIL) {
    throw new Error('Apenas a conta fundadora verificada pode alterar cadastros comerciais.');
  }
  const token = await user.getIdTokenResult();
  if (token.signInProvider !== 'google.com') throw new Error('Autenticação Google fundadora obrigatória.');
  return HGESM_SECTOR_EMAIL;
}

export async function saveCommercialCustomer(
  value: CommercialCustomerInput,
  existing: CommercialCustomer | null
): Promise<CommercialCustomer> {
  if (!commercialEmulatorWritesEnabled) {
    throw new Error('Gravação desabilitada fora do Firebase Emulator. Nenhum dado real foi alterado.');
  }
  const actor = await founderActor();
  const workspaceId = value.workspaceId.trim().toLowerCase();
  const customerRef = doc(db, CUSTOMERS, workspaceId);
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const now = new Date().toISOString();
  const next = buildCommercialCustomer(workspaceId, value, actor, now, existing || undefined);
  await runTransaction(db, async tx => {
    // Leitura antes de escrita: apenas UMA ficha comercial e UM workspace.
    const [current, workspace] = await Promise.all([tx.get(customerRef), tx.get(workspaceRef)]);
    if (!workspace.exists()) throw new Error('Workspace não encontrado; cadastro não realizado.');
    if (existing) {
      if (!current.exists() || current.data().updatedAt !== existing.updatedAt) {
        throw new Error('Cliente alterado em outra sessão; atualize antes de salvar.');
      }
    } else if (current.exists()) {
      throw new Error('Este workspace já possui um cliente comercial. Abra o cadastro existente.');
    }
    tx.set(customerRef, next);
  });
  return next;
}
