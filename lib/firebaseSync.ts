import {
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
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  getOperationalDocumentPath,
  getOperationalSettingsDocumentPath,
  operationalCollectionRef,
  operationalDocRef,
  operationalSettingsDocRef,
} from './operationalPaths';

// Seeding function (no-op as data is now fully persistent and shared on Firestore)
export async function seedInitialDataIfNecessary(userId: string) {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'empenhos');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'empenhos'));
    if (snapshot.empty) {
      console.log(`No empenhos found in Firestore at ${path}. Ready to receive data.`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/seeding`);
  }
}

export async function getEmpenhos(userId: string): Promise<Empenho[]> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'empenhos');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'empenhos'));
    return snapshot.docs.map(item => item.data() as Empenho);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveEmpenho(userId: string, empenho: Empenho): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'empenhos', empenho.id);
  try {
    await setDoc(operationalDocRef(scope, 'empenhos', empenho.id), { ...empenho, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeEmpenho(userId: string, id: string): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'empenhos', id);
  try {
    await deleteDoc(operationalDocRef(scope, 'empenhos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Alerts operations
export async function getAlerts(userId: string): Promise<Alert[]> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'alerts');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'alerts'));
    return snapshot.docs.map(item => item.data() as Alert);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveAlert(userId: string, alert: Alert): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'alerts', alert.id);
  try {
    await setDoc(operationalDocRef(scope, 'alerts', alert.id), { ...alert, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAlert(userId: string, id: string): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'alerts', id);
  try {
    await deleteDoc(operationalDocRef(scope, 'alerts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Invoices operations
export async function getInvoices(userId: string): Promise<Invoice[]> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'invoices');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'invoices'));
    return snapshot.docs.map((item) => {
      const data = item.data() as Invoice;
      return { ...data, recordKey: data.recordKey || item.id };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveInvoice(userId: string, invoice: Invoice): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const recordKey = getInvoiceRecordKey(invoice);
  const path = getOperationalDocumentPath(scope, 'invoices', recordKey);
  try {
    await setDoc(operationalDocRef(scope, 'invoices', recordKey), { ...invoice, recordKey, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeInvoice(userId: string, recordKey: string): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'invoices', recordKey);
  try {
    await deleteDoc(operationalDocRef(scope, 'invoices', recordKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

interface CommitInvoiceReceiptChangesInput {
  targetEmpenho: Empenho;
  previousEmpenho?: Empenho;
  invoice: Invoice;
  alert: Alert;
  previousInvoiceRecordKey?: string;
}

export async function commitInvoiceReceiptChanges(
  userId: string,
  changes: CommitInvoiceReceiptChangesInput
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  try {
    const batch = writeBatch(db);
    batch.set(operationalDocRef(scope, 'empenhos', changes.targetEmpenho.id), { ...changes.targetEmpenho, userId });
    if (changes.previousEmpenho && changes.previousEmpenho.id !== changes.targetEmpenho.id) {
      batch.set(operationalDocRef(scope, 'empenhos', changes.previousEmpenho.id), { ...changes.previousEmpenho, userId });
    }
    const invoiceRecordKey = getInvoiceRecordKey(changes.invoice);
    batch.set(operationalDocRef(scope, 'invoices', invoiceRecordKey), { ...changes.invoice, recordKey: invoiceRecordKey, userId });
    batch.set(operationalDocRef(scope, 'alerts', changes.alert.id), { ...changes.alert, userId });
    if (changes.previousInvoiceRecordKey && changes.previousInvoiceRecordKey !== invoiceRecordKey) {
      batch.delete(operationalDocRef(scope, 'invoices', changes.previousInvoiceRecordKey));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${getOperationalCollectionPath(scope, 'invoices')}/receipt-batch`);
  }
}

export async function commitInvoiceDeletion(
  userId: string,
  updatedEmpenho: Empenho,
  invoiceRecordKey: string
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  try {
    const batch = writeBatch(db);
    batch.set(operationalDocRef(scope, 'empenhos', updatedEmpenho.id), { ...updatedEmpenho, userId });
    batch.delete(operationalDocRef(scope, 'invoices', invoiceRecordKey));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, getOperationalDocumentPath(scope, 'invoices', invoiceRecordKey));
  }
}

export async function commitAllInvoicesDeletion(
  userId: string,
  updatedEmpenhos: Empenho[],
  invoiceRecordKeys: string[]
): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  try {
    if (updatedEmpenhos.length + invoiceRecordKeys.length > 450) {
      throw new Error('Quantidade de operações excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    updatedEmpenhos.forEach((empenho) => {
      batch.set(operationalDocRef(scope, 'empenhos', empenho.id), { ...empenho, userId });
    });
    invoiceRecordKeys.forEach((recordKey) => batch.delete(operationalDocRef(scope, 'invoices', recordKey)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${getOperationalCollectionPath(scope, 'invoices')}/bulk`);
  }
}

export async function commitAllComissoesDeletion(userId: string, ids: string[]): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  try {
    if (ids.length > 450) {
      throw new Error('Quantidade de comissões excede o limite seguro para exclusão em lote.');
    }
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(operationalDocRef(scope, 'comissoes', id)));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${getOperationalCollectionPath(scope, 'comissoes')}/bulk`);
  }
}

export async function ensureTermoRecebimentoAssignment(
  userId: string,
  invoiceId: string,
  observedMaxTermoNumero: number,
  preferredEmissionDate: string
): Promise<Invoice> {
  const scope = getCurrentOperationalScope(userId);
  const invoiceRef = operationalDocRef(scope, 'invoices', invoiceId);
  const counterRef = operationalSettingsDocRef(scope, 'termoRecebimentoCounter');

  try {
    return await runTransaction(db, async (transaction) => {
      const invoiceSnapshot = await transaction.get(invoiceRef);
      const counterSnapshot = await transaction.get(counterRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error(`Nota Fiscal ${invoiceId} não encontrada para numeração do Termo.`);
      }

      const storedInvoice = invoiceSnapshot.data() as Invoice;
      if (storedInvoice.termoNumero) {
        const shouldRefreshEmissionDate = Boolean(preferredEmissionDate) &&
          preferredEmissionDate !== storedInvoice.termoEmissaoDate;
        const existingInvoice: Invoice = {
          ...storedInvoice,
          termoEmissaoDate: shouldRefreshEmissionDate
            ? preferredEmissionDate
            : storedInvoice.termoEmissaoDate || preferredEmissionDate,
        };
        if (!storedInvoice.termoEmissaoDate || shouldRefreshEmissionDate) {
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
    handleFirestoreError(error, OperationType.WRITE, `${getOperationalDocumentPath(scope, 'invoices', invoiceId)}/termo`);
    throw error;
  }
}

// Comissoes operations
export async function getComissoes(userId: string): Promise<Comissao[]> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'comissoes');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'comissoes'));
    return snapshot.docs.map(item => item.data() as Comissao);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveComissao(userId: string, comissao: Comissao): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'comissoes', comissao.id);
  try {
    await setDoc(operationalDocRef(scope, 'comissoes', comissao.id), { ...comissao, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeComissao(userId: string, id: string): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'comissoes', id);
  try {
    await deleteDoc(operationalDocRef(scope, 'comissoes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cronogramas operations
export async function getCronogramas(userId: string): Promise<CronogramaEmpenho[]> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalCollectionPath(scope, 'cronogramas');
  try {
    const snapshot = await getDocs(operationalCollectionRef(scope, 'cronogramas'));
    return snapshot.docs.map(item => item.data() as CronogramaEmpenho);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveCronograma(userId: string, cronograma: CronogramaEmpenho): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'cronogramas', cronograma.id);
  try {
    await setDoc(operationalDocRef(scope, 'cronogramas', cronograma.id), { ...cronograma, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeCronograma(userId: string, id: string): Promise<void> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'cronogramas', id);
  try {
    await deleteDoc(operationalDocRef(scope, 'cronogramas', id));
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
