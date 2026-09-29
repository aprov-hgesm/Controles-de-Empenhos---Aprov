import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { getCurrentOperationalScope } from './operationalPaths';
import { GLOBAL_SUPPLIER_DIRECTORY_SEED } from './supplierDirectorySeed';
import type { SupplierDirectoryEntry } from './types';
import {
  recordWorkspaceDocumentReads,
  recordWorkspaceDocumentWrites,
} from './workspaceUsageTelemetry';

const SUPPLIER_DIRECTORY_PATH = 'supplierDirectory/defaults';
const FOUNDER_EMAIL = 'aprov1hgesm@gmail.com';

function directoryDocumentRef() {
  return doc(db, 'supplierDirectory', 'defaults');
}

function entriesFromMap(value: unknown): SupplierDirectoryEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(
      ([cnpj, email]) =>
        /^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)
        && typeof email === 'string'
        && email.trim().length > 3
    )
    .map(([cnpj, email]) => ({
      cnpj,
      email: String(email).trim().toLowerCase(),
    }));
}

export async function getGlobalSupplierDirectory(
  userId: string
): Promise<SupplierDirectoryEntry[]> {
  const scope = getCurrentOperationalScope(userId);
  try {
    const snapshot = await getDoc(directoryDocumentRef());
    recordWorkspaceDocumentReads(scope, 1);
    if (!snapshot.exists()) return [];
    return entriesFromMap(snapshot.data().entries);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SUPPLIER_DIRECTORY_PATH);
    throw error;
  }
}

/**
 * Seed idempotente e founder-only.
 * Apenas CNPJs ainda ausentes são incluídos. Valores globais já existentes
 * nunca são sobrescritos automaticamente.
 */
export async function ensureGlobalSupplierDirectorySeed(
  userId: string,
  currentEntries: SupplierDirectoryEntry[]
): Promise<SupplierDirectoryEntry[]> {
  const currentUser = auth.currentUser;
  if (
    !currentUser
    || currentUser.uid !== userId
    || currentUser.email?.toLowerCase() !== FOUNDER_EMAIL
  ) {
    return currentEntries;
  }

  const currentMap = Object.fromEntries(
    currentEntries.map((entry) => [entry.cnpj, entry.email.trim().toLowerCase()])
  );
  const missing = GLOBAL_SUPPLIER_DIRECTORY_SEED.filter(
    (entry) => !(entry.cnpj in currentMap)
  );

  if (missing.length === 0) return currentEntries;

  const entries = { ...currentMap };
  missing.forEach((entry) => {
    entries[entry.cnpj] = entry.email;
  });

  const scope = getCurrentOperationalScope(userId);
  try {
    await setDoc(directoryDocumentRef(), { entries });
    recordWorkspaceDocumentWrites(scope, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SUPPLIER_DIRECTORY_PATH);
    throw error;
  }

  return entriesFromMap(entries);
}
