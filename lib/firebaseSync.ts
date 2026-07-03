import { 
  collection, 
  query, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Empenho, Alert, Invoice, Comissao } from './types';

// Seeding function (no-op as data is now fully persistent and shared on Firestore)
export async function seedInitialDataIfNecessary(userId: string) {
  try {
    const q = collection(db, 'empenhos');
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log('No empenhos found in Firestore. Ready to receive data.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// Empenhos operations (shared globally, no longer isolated by userId or stored locally)
export async function getEmpenhos(userId: string): Promise<Empenho[]> {
  try {
    const q = collection(db, 'empenhos');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Empenho);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'empenhos');
    return [];
  }
}

export async function saveEmpenho(userId: string, empenho: Empenho): Promise<void> {
  const path = `empenhos/${empenho.id}`;
  try {
    const docRef = doc(db, 'empenhos', empenho.id);
    // Keep userId on the document metadata if desired, but it's shared
    await setDoc(docRef, { ...empenho, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeEmpenho(userId: string, id: string): Promise<void> {
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
  try {
    const q = collection(db, 'alerts');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Alert);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'alerts');
    return [];
  }
}

export async function saveAlert(userId: string, alert: Alert): Promise<void> {
  const path = `alerts/${alert.id}`;
  try {
    const docRef = doc(db, 'alerts', alert.id);
    await setDoc(docRef, { ...alert, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAlert(userId: string, id: string): Promise<void> {
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
  try {
    const q = collection(db, 'invoices');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Invoice);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'invoices');
    return [];
  }
}

export async function saveInvoice(userId: string, invoice: Invoice): Promise<void> {
  const path = `invoices/${invoice.id}`;
  try {
    const docRef = doc(db, 'invoices', invoice.id);
    await setDoc(docRef, { ...invoice, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeInvoice(userId: string, id: string): Promise<void> {
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
  try {
    const q = collection(db, 'comissoes');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Comissao);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'comissoes');
    return [];
  }
}

export async function saveComissao(userId: string, comissao: Comissao): Promise<void> {
  const path = `comissoes/${comissao.id}`;
  try {
    const docRef = doc(db, 'comissoes', comissao.id);
    await setDoc(docRef, { ...comissao, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeComissao(userId: string, id: string): Promise<void> {
  const path = `comissoes/${id}`;
  try {
    const docRef = doc(db, 'comissoes', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
