import 'server-only';
import { getCloudRunAccessToken, isCloudRunRuntime } from './cloudRunServiceIdentity.mjs';
import companyConfig from '../../config/empresas-firebase-web.json';

/** All company server transports target the new project. Never use the military database. */
export const COMPANY_PROJECT_ID = companyConfig.projectId;
export const COMPANY_DATABASE_ID = companyConfig.firestoreDatabaseId;
export const COMPANY_FIREBASE_API_KEY = companyConfig.apiKey;

export function isCompanyIsolatedRuntime(): boolean {
  return process.env.EMPROVEX_COMPANY_ISOLATED_RUNTIME === '1'
    && process.env.EMPROVEX_COMPANY_RUNTIME_PROJECT_ID === COMPANY_PROJECT_ID
    && COMPANY_PROJECT_ID === 'emprovex-empresas'
    && COMPANY_DATABASE_ID === '(default)';
}

export function assertCompanyRuntime(): void {
  // Local Auth+Firestore Emulator test suites are isolated by demo-* and loopback.
  if (process.env.EMPROVEX_E2E_SERVER_AUTH === '1') {
    const project = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || '';
    const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
    const store = process.env.FIRESTORE_EMULATOR_HOST || '';
    if (process.env.NODE_ENV !== 'production' && !process.env.K_SERVICE && !process.env.VERCEL
      && /^demo-[a-z0-9-]+$/.test(project)
      && ['127.0.0.1:9099','localhost:9099'].includes(auth)
      && ['127.0.0.1:8080','localhost:8080'].includes(store)) return;
    throw new Error('COMPANY_EMULATOR_RUNTIME_FORBIDDEN');
  }
  if (!isCompanyIsolatedRuntime()) throw new Error('COMPANY_ISOLATED_RUNTIME_REQUIRED');
}

/**
 * Only an attached Cloud Run service identity, scoped by IAM on the NEW project.
 * No JSON key and no fallback to the principal project's service account secret.
 * Calling in local/live development fails closed; use Emulator instead.
 */
export async function getCompanyAccessToken(): Promise<string> {
  assertCompanyRuntime();
  if (!isCloudRunRuntime()) throw new Error('COMPANY_SERVICE_IDENTITY_REQUIRED');
  return getCloudRunAccessToken();
}
