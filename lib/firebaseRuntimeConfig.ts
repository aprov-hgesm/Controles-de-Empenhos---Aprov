import baseline from '../firebase-applet-config.json';
import { resolveFirebaseEnvironment } from './firebaseEnvironment.mjs';

/**
 * Single public Firebase configuration for SDK, JWT checks and admin REST URLs.
 * Cloud Run staging is opt-in AND guarded independently by build/runtime + IAM.
 * The marker is injected by next.config.ts, never inferred from VERCEL_ENV.
 * Legacy Vercel production keeps its original project and named databases.
 */
const staging = process.env.NEXT_PUBLIC_EMPROVEX_DEPLOYMENT_ENVIRONMENT === 'cloud-run-staging';
const cloudRuntime = Boolean(process.env.K_SERVICE || process.env.EMPROVEX_RUNTIME_TARGET);
if (cloudRuntime && !staging) {
  throw new Error('FIREBASE_RUNTIME_CLOUD_TARGET_MISMATCH');
}

const firebaseConfig = resolveFirebaseEnvironment(baseline, {
  environment: staging ? 'cloud-run-staging' : 'legacy',
  publicConfigJson: process.env.NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON,
  legacyWarehouseDatabaseId: process.env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID,
  emulatorEnabled: process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1',
  emulatorProjectId: process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID,
});

export const firebaseEnvironment = staging ? 'cloud-run-staging' : 'legacy';
export default firebaseConfig;
