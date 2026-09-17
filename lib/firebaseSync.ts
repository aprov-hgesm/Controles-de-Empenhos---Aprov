import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc, 
  doc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Empenho, Alert, Invoice, Comissao, CronogramaEmpenho } from './types';

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


interface CommitInvoiceReceiptChangesInput {
  targetEmpenho: Empenho;
  previousEmpenho?: Empenho;
  invoice: Invoice;
  alert: Alert;
  previousInvoiceId?: string;
}

export async function commitInvoiceReceiptChanges(
  userId: string,
  changes: CommitInvoiceReceiptChangesInput
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'empenhos', changes.targetEmpenho.id), { ...changes.targetEmpenho, userId });
    if (changes.previousEmpenho && changes.previousEmpenho.id !== changes.targetEmpenho.id) {
      batch.set(doc(db, 'empenhos', changes.previousEmpenho.id), { ...changes.previousEmpenho, userId });
    }
    batch.set(doc(db, 'invoices', changes.invoice.id), { ...changes.invoice, userId });
    batch.set(doc(db, 'alerts', changes.alert.id), { ...changes.alert, userId });
    if (changes.previousInvoiceId && changes.previousInvoiceId !== changes.invoice.id) {
      batch.delete(doc(db, 'invoices', changes.previousInvoiceId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'invoice-receipt-batch');
  }
}

export async function commitInvoiceDeletion(
  userId: string,
  updatedEmpenho: Empenho,
  invoiceId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'empenhos', updatedEmpenho.id), { ...updatedEmpenho, userId });
    batch.delete(doc(db, 'invoices', invoiceId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `invoices/${invoiceId}`);
  }
}

export async function commitAllInvoicesDeletion(
  userId: string,
  updatedEmpenhos: Empenho[],
  invoiceIds: string[]
): Promise<void> {
  try {
    if (updatedEmpenhos.length + invoiceIds.length > 450) {
      throw new Error('Quantidade de operações excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    updatedEmpenhos.forEach((empenho) => {
      batch.set(doc(db, 'empenhos', empenho.id), { ...empenho, userId });
    });
    invoiceIds.forEach((invoiceId) => batch.delete(doc(db, 'invoices', invoiceId)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'invoices/bulk');
  }
}

export async function commitAllComissoesDeletion(userId: string, ids: string[]): Promise<void> {
  try {
    if (ids.length > 450) {
      throw new Error('Quantidade de comissões excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(doc(db, 'comissoes', id)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'comissoes/bulk');
  }
}

export async function ensureTermoRecebimentoAssignment(
  userId: string,
  invoiceId: string,
  observedMaxTermoNumero: number,
  preferredEmissionDate: string
): Promise<Invoice> {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const counterRef = doc(db, 'settings', 'termoRecebimentoCounter');

  try {
    return await runTransaction(db, async (transaction) => {
      const invoiceSnapshot = await transaction.get(invoiceRef);
      const counterSnapshot = await transaction.get(counterRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error(`Nota Fiscal ${invoiceId} não encontrada para numeração do Termo.`);
      }

      const storedInvoice = invoiceSnapshot.data() as Invoice;
      if (storedInvoice.termoNumero) {
        const existingInvoice: Invoice = {
          ...storedInvoice,
          termoEmissaoDate: storedInvoice.termoEmissaoDate || preferredEmissionDate,
        };
        if (!storedInvoice.termoEmissaoDate) {
          transaction.set(invoiceRef, { ...existingInvoice, userId }, { merge: true });
        }
        return existingInvoice;
      }

      const currentCounter = Number(counterSnapshot.data()?.currentNumber || 0);
      const nextNumber = Math.max(currentCounter + 1, observedMaxTermoNumero + 1);
      const updatedInvoice: Invoice = {
        ...storedInvoice,
        termoNumero: nextNumber,
        termoEmissaoDate: storedInvoice.termoEmissaoDate || preferredEmissionDate,
      };

      transaction.set(counterRef, {
        id: 'termoRecebimentoCounter',
        currentNumber: nextNumber,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }, { merge: true });
      transaction.set(invoiceRef, { ...updatedInvoice, userId }, { merge: true });
      return updatedInvoice;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invoices/${invoiceId}/termo`);
    throw error;
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

// Cronogramas operations
export async function getCronogramas(userId: string): Promise<CronogramaEmpenho[]> {
  try {
    const q = collection(db, 'cronogramas');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CronogramaEmpenho);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'cronogramas');
    return [];
  }
}

export async function saveCronograma(userId: string, cronograma: CronogramaEmpenho): Promise<void> {
  const path = `cronogramas/${cronograma.id}`;
  try {
    const docRef = doc(db, 'cronogramas', cronograma.id);
    await setDoc(docRef, { ...cronograma, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeCronograma(userId: string, id: string): Promise<void> {
  const path = `cronogramas/${id}`;
  try {
    const docRef = doc(db, 'cronogramas', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Global Platform Settings (Logotipo e Configurações)
export async function getPlatformLogo(): Promise<string | null> {
  try {
    const docRef = doc(db, 'settings', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return data.logo || null;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/global');
    return null;
  }
}

export async function savePlatformLogo(logo: string | null, userEmail?: string): Promise<void> {
  const path = 'settings/global';
  try {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, {
      id: 'global',
      logo: logo || null,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || 'system'
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

