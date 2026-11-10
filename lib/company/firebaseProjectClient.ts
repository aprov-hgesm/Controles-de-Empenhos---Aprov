'use client';

/**
 * SDK WEB do projeto Firebase EMPROVEX Empresas, registrado em 09/11/2026.
 * Isolado por nome de app; nao substituir lib/firebase.ts (militar/fundador).
 *
 * IMPORTANTE: apenas configura app/Auth/Firestore cliente. O backend W0-W15
 * ainda utiliza diversos acessos a firebase-applet-config.json (projeto principal).
 * NAO conectar este Auth ao portal ate separar todos os guards e stores de servidor.
 */
import { getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import config from '../../config/empresas-firebase-web.json';

const APP_NAME = 'emprovex-empresas';
const isDemo = process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1';
const demoProject = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
if (isDemo && !/^demo-[a-z0-9-]{3,80}$/.test(demoProject)) {
  throw new Error('COMPANY_FIREBASE_EMULATOR_PROJECT_REQUIRED');
}
const activeConfig = isDemo
  ? { ...config, projectId: demoProject, authDomain: demoProject + '.firebaseapp.com' }
  : config;

export const COMPANY_FIREBASE_PROJECT_ID = config.projectId;
export const COMPANY_FIRESTORE_DATABASE_ID = config.firestoreDatabaseId;

let companyFirebaseApp: FirebaseApp;
try {
  companyFirebaseApp = getApp(APP_NAME);
  if (companyFirebaseApp.options.projectId !== activeConfig.projectId) {
    throw new Error('COMPANY_FIREBASE_PROJECT_CONFLICT');
  }
} catch (error) {
  if (error instanceof Error && error.message === 'COMPANY_FIREBASE_PROJECT_CONFLICT') {
    throw error;
  }
  companyFirebaseApp = initializeApp(activeConfig, APP_NAME);
}
export { companyFirebaseApp };

export const companyAuth = getAuth(companyFirebaseApp);
export const companyDb = getFirestore(companyFirebaseApp, COMPANY_FIRESTORE_DATABASE_ID);

if (isDemo) {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1') {
    throw new Error('COMPANY_FIREBASE_EMULATOR_ORIGIN_FORBIDDEN');
  }
  connectAuthEmulator(companyAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(companyDb, '127.0.0.1', 8080);
}
