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

// Seeding function to populate Firestore if the user doesn't have any data yet.
export async function seedInitialDataIfNecessary(userId: string) {
  try {
    const q = query(collection(db, 'empenhos'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('Seeding initial data to Firestore for user:', userId);
      
      // Seed Empenhos
      // No longer seeding initial empenhos to ensure a clean starting state for testing
      /*
      for (const emp of INITIAL_EMPENHOS) {
        const docRef = doc(db, 'empenhos', emp.id);
        await setDoc(docRef, { ...emp, userId });
      }
      */

      // Seed Alerts
      // No longer seeding initial alerts to ensure a clean starting state for testing
      /*
      for (const alert of INITIAL_ALERTS) {
        const docRef = doc(db, 'alerts', alert.id);
        await setDoc(docRef, { ...alert, userId });
      }
      */

      // No longer seed initial invoices to ensure a clean starting state for testing
      /*
      for (const inv of INITIAL_INVOICES) {
        const docRef = doc(db, 'invoices', inv.id);
        await setDoc(docRef, { ...inv, userId });
      }
      */

      // Seed Comissões
      // No longer seeding initial comissoes to ensure a clean starting state for testing as requested by the user
      /*
      for (const com of INITIAL_COMISSOES) {
        const docRef = doc(db, 'comissoes', com.id);
        await setDoc(docRef, { ...com, userId });
      }
      */
      
      console.log('Successfully completed seeding initial data.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// Empenhos operations
export async function getEmpenhos(userId: string): Promise<Empenho[]> {
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
  const path = `empenhos/${empenho.id}`;
  try {
    const docRef = doc(db, 'empenhos', empenho.id);
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
    const q = query(collection(db, 'alerts'), where('userId', '==', userId));
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
    const q = query(collection(db, 'invoices'), where('userId', '==', userId));
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
    const q = query(collection(db, 'comissoes'), where('userId', '==', userId));
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
