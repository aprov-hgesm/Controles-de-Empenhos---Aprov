import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase client identity for the HGeSM hospital module.
 * This is a SECOND named Firebase app; it must never reuse lib/firebase.ts,
 * which belongs to the financial/logistical EMPROVEX project.
 */
export const HOSPITAL_FIREBASE_PROJECT_ID = 'cozinha-dietetica';
const HOSPITAL_APP_NAME = 'emprovex-hospitalar';
const HOSPITAL_EMULATOR_PROJECT_ID = 'demo-cozinha-dietetica';
function qaEmulatorProjectAllowed() {
  return process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR === '1'
    && process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID === HOSPITAL_EMULATOR_PROJECT_ID;
}

let emulatorConnected = false;

export function isHospitalFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY?.trim()
    && process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID?.trim()
    && (!process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID
      || process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID === HOSPITAL_FIREBASE_PROJECT_ID
      || qaEmulatorProjectAllowed())
  );
}

export function getHospitalFirebaseApp(): FirebaseApp {
  if (!isHospitalFirebaseConfigured()) {
    throw new Error('Firebase hospitalar não configurado.');
  }
  const configuredProject = process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID || HOSPITAL_FIREBASE_PROJECT_ID;
  if (configuredProject !== HOSPITAL_FIREBASE_PROJECT_ID && !qaEmulatorProjectAllowed()) {
    throw new Error('Projeto Firebase hospitalar divergente.');
  }
  if (getApps().some(app => app.name === HOSPITAL_APP_NAME)) {
    const app = getApp(HOSPITAL_APP_NAME);
    if (app.options.projectId !== configuredProject) {
      throw new Error('Identidade Firebase hospitalar divergente.');
    }
    return app;
  }
  return initializeApp({
    projectId: configuredProject,
    authDomain: `${configuredProject}.firebaseapp.com`,
    apiKey: process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY,
    appId: process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID,
  }, HOSPITAL_APP_NAME);
}

export function getHospitalAuth(): Auth {
  const auth = getAuth(getHospitalFirebaseApp());
  // Test-only emulator. Never allow an emulator flag to redirect live sessions.
  if (typeof window !== 'undefined'
    && process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR === '1'
    && !emulatorConnected) {
    emulatorConnected = true;
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}
