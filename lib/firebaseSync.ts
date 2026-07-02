import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Empenho, Alert, Invoice, Comissao } from './types';
import { INITIAL_EMPENHOS, INITIAL_ALERTS, INITIAL_INVOICES, INITIAL_COMISSOES } from './mockData';

// Local storage helper functions
function getLocalItem<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

function setLocalItem<T>(key: string, data: T[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// Seeding function to populate Firestore if the user doesn't have any data yet.
export async function seedInitialDataIfNecessary(userId: string) {
  if (userId === 'simulado_guest') {
    return;
  }
  try {
    const q = query(collection(db, 'empenhos'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('Seeding initial data to Firestore for user:', userId);
      console.log('Successfully completed seeding initial data.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// Empenhos operations
export async function getEmpenhos(userId: string): Promise<Empenho[]> {
  if (userId === 'simulado_guest') {
    return getLocalItem<Empenho>('local_empenhos');
  }
  try {
    const q = query(collection(db, 'empenhos'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Empenho);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'empenhos');
    return [];
  }
}

export async function saveEmpenho(userId: string, empenho: Empenho): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Empenho>('local_empenhos');
    const filtered = items.filter(i => i.id !== empenho.id);
    setLocalItem<Empenho>('local_empenhos', [{ ...empenho, userId } as any, ...filtered]);
    return;
  }
  const path = `empenhos/${empenho.id}`;
  try {
    const docRef = doc(db, 'empenhos', empenho.id);
    await setDoc(docRef, { ...empenho, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeEmpenho(userId: string, id: string): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Empenho>('local_empenhos');
    setLocalItem<Empenho>('local_empenhos', items.filter(i => i.id !== id));
    return;
  }
  const path = `empenhos/${id}`;
  try {
    const docRef = doc(db, 'empenhos', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Alerts operations
export async function getAlerts(userId: string): Promise<Alert[]> {
  if (userId === 'simulado_guest') {
    return getLocalItem<Alert>('local_alerts');
  }
  try {
    const q = query(collection(db, 'alerts'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Alert);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'alerts');
    return [];
  }
}

export async function saveAlert(userId: string, alert: Alert): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Alert>('local_alerts');
    const filtered = items.filter(i => i.id !== alert.id);
    setLocalItem<Alert>('local_alerts', [{ ...alert, userId } as any, ...filtered]);
    return;
  }
  const path = `alerts/${alert.id}`;
  try {
    const docRef = doc(db, 'alerts', alert.id);
    await setDoc(docRef, { ...alert, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAlert(userId: string, id: string): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Alert>('local_alerts');
    setLocalItem<Alert>('local_alerts', items.filter(i => i.id !== id));
    return;
  }
  const path = `alerts/${id}`;
  try {
    const docRef = doc(db, 'alerts', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Invoices operations
export async function getInvoices(userId: string): Promise<Invoice[]> {
  if (userId === 'simulado_guest') {
    return getLocalItem<Invoice>('local_invoices');
  }
  try {
    const q = query(collection(db, 'invoices'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Invoice);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'invoices');
    return [];
  }
}

export async function saveInvoice(userId: string, invoice: Invoice): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Invoice>('local_invoices');
    const filtered = items.filter(i => i.id !== invoice.id);
    setLocalItem<Invoice>('local_invoices', [{ ...invoice, userId } as any, ...filtered]);
    return;
  }
  const path = `invoices/${invoice.id}`;
  try {
    const docRef = doc(db, 'invoices', invoice.id);
    await setDoc(docRef, { ...invoice, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeInvoice(userId: string, id: string): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Invoice>('local_invoices');
    setLocalItem<Invoice>('local_invoices', items.filter(i => i.id !== id));
    return;
  }
  const path = `invoices/${id}`;
  try {
    const docRef = doc(db, 'invoices', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Comissoes operations
export async function getComissoes(userId: string): Promise<Comissao[]> {
  if (userId === 'simulado_guest') {
    return getLocalItem<Comissao>('local_comissoes');
  }
  try {
    const q = query(collection(db, 'comissoes'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Comissao);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'comissoes');
    return [];
  }
}

export async function saveComissao(userId: string, comissao: Comissao): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Comissao>('local_comissoes');
    const filtered = items.filter(i => i.id !== comissao.id);
    setLocalItem<Comissao>('local_comissoes', [{ ...comissao, userId } as any, ...filtered]);
    return;
  }
  const path = `comissoes/${comissao.id}`;
  try {
    const docRef = doc(db, 'comissoes', comissao.id);
    await setDoc(docRef, { ...comissao, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeComissao(userId: string, id: string): Promise<void> {
  if (userId === 'simulado_guest') {
    const items = getLocalItem<Comissao>('local_comissoes');
    setLocalItem<Comissao>('local_comissoes', items.filter(i => i.id !== id));
    return;
  }
  const path = `comissoes/${id}`;
  try {
    const docRef = doc(db, 'comissoes', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
