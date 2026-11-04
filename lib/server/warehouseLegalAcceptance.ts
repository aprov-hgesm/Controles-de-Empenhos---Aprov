import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL, HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import {
  CURRENT_LEGAL_BUNDLE,
  LEGAL_ACCEPTANCE_SCHEMA_VERSION,
  legalAcceptanceDocumentId,
} from '../legalVersions';
import { isVerifiedLegalAcceptance } from './legalAcceptanceRecord';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { VerifiedWarehouseRequest } from './warehouseAccess';

// Same target and emulator safety conditions as the canonical legal-acceptance
// endpoint. No writes, cached allow decisions or browser-controlled claims.
const LEGAL_E2E_EMULATOR = process.env.EMPROVEX_E2E_SERVER_AUTH === '1'
  && process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099'
  && process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080'
  && process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID === 'demo-emprovex-security';

const ROOT = LEGAL_E2E_EMULATOR
  ? 'http://127.0.0.1:8080/v1/projects/demo-emprovex-security/databases/(default)/documents'
  : 'https://firestore.googleapis.com/v1/projects/'
    + encodeURIComponent(firebaseConfig.projectId)
    + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';

export async function readWarehouseLegalAcceptance(
  access: VerifiedWarehouseRequest,
): Promise<boolean> {
  const document = ROOT
    + '/workspaces/' + encodeURIComponent(access.workspaceId)
    + '/legalAcceptances/' + encodeURIComponent(legalAcceptanceDocumentId(access.uid));
  const adminToken = LEGAL_E2E_EMULATOR ? 'owner' : await getGoogleAccessToken();
  const response = await fetch(document, {
    headers: { Authorization: 'Bearer ' + adminToken },
    cache: 'no-store',
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    // Do not print document contents, user identity or any auth tokens.
    throw new Error('WAREHOUSE_LEGAL_UPSTREAM_HTTP_' + response.status);
  }
  const payload = await response.json() as {
    fields?: Record<string, { stringValue?: string; nullValue?: null; timestampValue?: string }>;
  };
  return isVerifiedLegalAcceptance(
    payload.fields,
    {
      workspaceId: access.workspaceId,
      uid: access.uid,
      email: access.email,
      ug: access.ug,
    },
    {
      schemaVersion: LEGAL_ACCEPTANCE_SCHEMA_VERSION,
      legalBundleVersion: CURRENT_LEGAL_BUNDLE.legalBundleVersion,
      termsVersion: CURRENT_LEGAL_BUNDLE.termsVersion,
      privacyVersion: CURRENT_LEGAL_BUNDLE.privacyVersion,
    },
    { workspaceId: HGESM_WORKSPACE_ID, email: HGESM_SECTOR_EMAIL, ug: HGESM_UG },
  );
}
