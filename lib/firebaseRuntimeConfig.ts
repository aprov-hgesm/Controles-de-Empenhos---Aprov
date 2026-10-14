import baseline from '../firebase-applet-config.json';
import { resolveFirebaseEnvironment } from './firebaseEnvironment.mjs';

// Direct NEXT_PUBLIC accesses are intentional: Next.js bundles these exact values.
export const firebaseDeploymentEnvironment = process.env.NEXT_PUBLIC_EMPROVEX_DEPLOYMENT_ENVIRONMENT || 'local';
const firebaseConfig = resolveFirebaseEnvironment(baseline, {
  environment: firebaseDeploymentEnvironment,
  publicConfigJson: process.env.NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON,
  legacyWarehouseDatabaseId: process.env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID,
});

export default firebaseConfig;
