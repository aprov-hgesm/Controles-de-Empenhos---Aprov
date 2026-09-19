import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const useE2eEmulators = process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1';
const e2eProjectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim();
const effectiveFirebaseConfig = useE2eEmulators && e2eProjectId
  ? {
      ...firebaseConfig,
      projectId: e2eProjectId,
      authDomain: `${e2eProjectId}.firebaseapp.com`,
    }
  : firebaseConfig;

const app = initializeApp(effectiveFirebaseConfig);

export const db = useE2eEmulators
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: production uses the named Firestore database */
export const auth = getAuth();

if (useE2eEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error('Firestore Error:', errMessage, 'Operation:', operationType, 'Path:', path);
  throw new Error(`Firestore Error: ${errMessage} (Operation: ${operationType}, Path: ${path})`);
}
