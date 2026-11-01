import { NextResponse } from 'next/server';

import firebaseConfig from '../../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL, HGESM_WORKSPACE_ID } from '../../../lib/hgesmWorkspace';
import { CURRENT_LEGAL_BUNDLE, LEGAL_ACCEPTANCE_SCHEMA_VERSION, legalAcceptanceDocumentId } from '../../../lib/legalVersions';
import { normalizePlatformEmail, isValidWorkspaceId } from '../../../lib/platformIdentity';
import { verifyFirebaseRequest, FounderAuthError } from '../../../lib/server/firebaseFounderAuth';
import { getGoogleAccessToken } from '../../../lib/server/sectorProvisioningAdmin';
import { isVerifiedLegalAcceptance } from '../../../lib/server/legalAcceptanceRecord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// O aceite R4 deve consultar o MESMO Firestore usado pela sessão.
// Em E2E, nunca buscar o projeto real. O desvio exige quatro marcadores
// locais simultâneos e não aceita host arbitrário (proteção de produção).
const LEGAL_E2E_EMULATOR = process.env.EMPROVEX_E2E_SERVER_AUTH === '1'
  && process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099'
  && process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080'
  && process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID === 'demo-emprovex-security';
const ROOT = LEGAL_E2E_EMULATOR
  ? 'http://127.0.0.1:8080/v1/projects/demo-emprovex-security/databases/(default)/documents'
  : 'https://firestore.googleapis.com/v1/projects/'
    + encodeURIComponent(firebaseConfig.projectId)
    + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';

type FirebaseIdentity = Awaited<ReturnType<typeof verifyFirebaseRequest>>;

class LegalFailure extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

function answer(value: object, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function valueOf(fields: Record<string, { stringValue?: string }> | undefined, name: string): string {
  return fields?.[name]?.stringValue || '';
}

async function readAsUser(identity: FirebaseIdentity, path: string) {
  const response = await fetch(ROOT + '/' + path, {
    headers: { Authorization: 'Bearer ' + identity.idToken }, cache: 'no-store',
  });
  if (!response.ok) {
    throw new LegalFailure(response.status === 404 ? 'LEGAL_IDENTITY_NOT_FOUND' : 'LEGAL_IDENTITY_DENIED',
      response.status === 404 ? 403 : response.status === 403 ? 403 : 503);
  }
  return (await response.json() as {
    fields?: Record<string, { stringValue?: string }>;
  }).fields;
}

async function authorize(request: Request, workspaceId: string) {
  if (!isValidWorkspaceId(workspaceId) || workspaceId.length > 48) {
    throw new LegalFailure('LEGAL_WORKSPACE_INVALID', 400);
  }
  const identity = await verifyFirebaseRequest(request.headers.get('authorization'));
  const workspace = await readAsUser(identity, 'workspaces/' + encodeURIComponent(workspaceId));
  const email = normalizePlatformEmail(identity.email);
  const authorizedEmail = normalizePlatformEmail(valueOf(workspace, 'authorizedEmail'));

  if (valueOf(workspace, 'id') !== workspaceId
    || valueOf(workspace, 'status') !== 'active'
    || authorizedEmail !== email) {
    throw new LegalFailure('LEGAL_WORKSPACE_MISMATCH', 403);
  }

  if (identity.signInProvider === 'google.com' && email === HGESM_SECTOR_EMAIL
    && workspaceId === HGESM_WORKSPACE_ID) {
    return { workspaceId, uid: identity.uid, email, ug: valueOf(workspace, 'ug') };
  }

  if (identity.signInProvider !== 'password') {
    throw new LegalFailure('LEGAL_PROVIDER_INVALID', 403);
  }

  const account = await readAsUser(identity, 'platformAccounts/' + encodeURIComponent(email));
  if (valueOf(account, 'accountType') !== 'sector'
    || valueOf(account, 'status') !== 'active'
    || valueOf(account, 'workspaceId') !== workspaceId
    || (valueOf(account, 'firebaseUid') && valueOf(account, 'firebaseUid') !== identity.uid)
    || (valueOf(account, 'authProvider') && valueOf(account, 'authProvider') !== 'password')
    || (valueOf(account, 'ug') && valueOf(account, 'ug') !== valueOf(workspace, 'ug'))) {
    throw new LegalFailure('LEGAL_ACCOUNT_MISMATCH', 403);
  }

  return { workspaceId, uid: identity.uid, email, ug: valueOf(workspace, 'ug') };
}

function documentName(identity: { workspaceId: string; uid: string }) {
  return ROOT + '/workspaces/' + encodeURIComponent(identity.workspaceId)
    + '/legalAcceptances/' + encodeURIComponent(legalAcceptanceDocumentId(identity.uid));
}

type AcceptanceState = 'missing' | 'accepted' | 'conflict';

async function readAcceptance(token: string, document: string,
  identity: { workspaceId: string; uid: string; email: string; ug: string }): Promise<AcceptanceState> {
  const response = await fetch(document, {
    headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
  });
  if (response.status === 404) return 'missing';
  if (!response.ok) {
    // Only upstream HTTP status: no tokens, payloads, UIDs or personal data.
    console.error('EMPROVEX_LEGAL_ACCEPTANCE_READ_UPSTREAM_STATUS', response.status);
    throw new LegalFailure('LEGAL_ACCEPTANCE_READ_FAILED', 503);
  }

  const payload = await response.json() as {
    fields?: Record<string, { stringValue?: string; nullValue?: null; timestampValue?: string }>;
  };
  const verified = isVerifiedLegalAcceptance(
    payload.fields,
    identity,
    {
      schemaVersion: LEGAL_ACCEPTANCE_SCHEMA_VERSION,
      legalBundleVersion: CURRENT_LEGAL_BUNDLE.legalBundleVersion,
      termsVersion: CURRENT_LEGAL_BUNDLE.termsVersion,
      privacyVersion: CURRENT_LEGAL_BUNDLE.privacyVersion,
    },
    { workspaceId: HGESM_WORKSPACE_ID, email: HGESM_SECTOR_EMAIL, ug: '160416' },
  );
  return verified ? 'accepted' : 'conflict';
}

function fields(identity: { workspaceId: string; uid: string; email: string; ug: string }) {
  const string = (s: string) => ({ stringValue: s });
  return {
    schemaVersion: string(LEGAL_ACCEPTANCE_SCHEMA_VERSION),
    workspaceId: string(identity.workspaceId),
    ug: identity.ug ? string(identity.ug) : { nullValue: null },
    uid: string(identity.uid),
    email: string(identity.email),
    legalBundleVersion: string(CURRENT_LEGAL_BUNDLE.legalBundleVersion),
    termsVersion: string(CURRENT_LEGAL_BUNDLE.termsVersion),
    privacyVersion: string(CURRENT_LEGAL_BUNDLE.privacyVersion),
  };
}

async function handler(request: Request, write: boolean) {
  try {
    if (CURRENT_LEGAL_BUNDLE.legalBundleVersion !== 'saas-r4-2026-10-27') {
      throw new LegalFailure('LEGAL_SERVER_BUNDLE_NOT_ACTIVE', 503);
    }
    let workspaceId = '';
    if (write) {
      if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
        throw new LegalFailure('LEGAL_JSON_REQUIRED', 415);
      }
      const raw = await request.text();
      if (raw.length > 160) throw new LegalFailure('LEGAL_BODY_TOO_LARGE', 413);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { throw new LegalFailure('LEGAL_JSON_INVALID', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new LegalFailure('LEGAL_BODY_INVALID', 400);
      }
      const data = body as Record<string, unknown>;
      if (data.confirm !== true || typeof data.workspaceId !== 'string'
        || Object.keys(data).some((key) => !['confirm', 'workspaceId'].includes(key))) {
        throw new LegalFailure('LEGAL_EXPLICIT_CONFIRMATION_REQUIRED', 400);
      }
      workspaceId = data.workspaceId;
    } else {
      workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
    }
    const identity = await authorize(request, workspaceId);
    const adminToken = LEGAL_E2E_EMULATOR ? 'owner' : await getGoogleAccessToken();
    const document = documentName(identity);
    const acceptanceState = await readAcceptance(adminToken, document, identity);
    if (acceptanceState === 'accepted') {
      return answer({ accepted: true, created: false, versions: CURRENT_LEGAL_BUNDLE });
    }
    if (!write) return answer({ accepted: false });
    // Never try to overwrite a legitimate but incompatible historical record.
    // Its exact conflict is a recovery case, not an opaque 503.
    if (acceptanceState === 'conflict') {
      throw new LegalFailure('LEGAL_ACCEPTANCE_RECORD_CONFLICT', 409);
    }

    // Idempotent, create-only server timestamp. No client can choose uid/email,
    // target tenant, bundle, or rewrite any historical acceptance.
    const response = await fetch(ROOT + ':commit', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          update: { name: document.slice(document.indexOf('/v1/') + '/v1/'.length), fields: fields(identity) },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'acceptedAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      // Two browser tabs may accept simultaneously; accept only the matching
      // immutable document, never overwrite it.
      if ([400, 409, 412].includes(response.status)) {
        const raced = await readAcceptance(adminToken, document, identity);
        if (raced === 'accepted') {
          return answer({ accepted: true, created: false, versions: CURRENT_LEGAL_BUNDLE });
        }
        if (raced === 'conflict') {
          throw new LegalFailure('LEGAL_ACCEPTANCE_RECORD_CONFLICT', 409);
        }
      }
      // A real write failure (e.g., insufficient Firestore IAM) must remain
      // observable without logging request bodies or authorization tokens.
      console.error('EMPROVEX_LEGAL_ACCEPTANCE_WRITE_UPSTREAM_STATUS', response.status);
      throw new LegalFailure('LEGAL_ACCEPTANCE_SAVE_FAILED', 503);
    }
    return answer({ accepted: true, created: true, versions: CURRENT_LEGAL_BUNDLE });
  } catch (error) {
    if (error instanceof LegalFailure) return answer({ code: error.code }, error.status);
    if (error instanceof FounderAuthError) return answer({ code: 'LEGAL_AUTH_REJECTED' }, error.status);
    console.error('EMPROVEX LEGAL_ACCEPTANCE_UNAVAILABLE', error instanceof Error ? error.name : 'unknown');
    return answer({ code: 'LEGAL_ACCEPTANCE_UNAVAILABLE' }, 503);
  }
}

export async function GET(request: Request) { return handler(request, false); }
export async function POST(request: Request) { return handler(request, true); }
