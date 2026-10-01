import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  normalizePlatformEmail,
  normalizeUnitUg,
} from './platformIdentity';
import {
  CURRENT_LEGAL_BUNDLE,
  LEGAL_ACCEPTANCE_SCHEMA_VERSION,
  legalAcceptanceDocumentId,
} from './legalVersions';

export interface LegalAcceptanceIdentity {
  workspaceId: string;
  uid: string;
  email: string;
  ug?: string | null;
}

export interface LegalAcceptanceRecord {
  schemaVersion: typeof LEGAL_ACCEPTANCE_SCHEMA_VERSION;
  workspaceId: string;
  ug: string | null;
  uid: string;
  email: string;
  legalBundleVersion: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: unknown;
}

export interface LegalAcceptanceResult {
  created: boolean;
  documentId: string;
  versions: typeof CURRENT_LEGAL_BUNDLE;
}

function normalizedIdentity(identity: LegalAcceptanceIdentity): LegalAcceptanceIdentity {
  const workspaceId = identity.workspaceId.trim();
  const uid = identity.uid.trim();
  const email = normalizePlatformEmail(identity.email);
  const normalizedUg = normalizeUnitUg(identity.ug);

  if (!workspaceId) throw new Error('Workspace é obrigatório para o aceite legal.');
  if (!uid) throw new Error('UID é obrigatório para o aceite legal.');
  if (!email) throw new Error('E-mail é obrigatório para o aceite legal.');

  return {
    workspaceId,
    uid,
    email,
    ug: normalizedUg || null,
  };
}

function acceptanceRef(identity: LegalAcceptanceIdentity): DocumentReference {
  const normalized = normalizedIdentity(identity);
  return doc(
    db,
    'workspaces',
    normalized.workspaceId,
    'legalAcceptances',
    legalAcceptanceDocumentId(normalized.uid)
  );
}

function matchesCurrentBundle(
  record: Partial<LegalAcceptanceRecord>,
  identity: LegalAcceptanceIdentity
): boolean {
  const normalized = normalizedIdentity(identity);

  return (
    record.schemaVersion === LEGAL_ACCEPTANCE_SCHEMA_VERSION
    && record.workspaceId === normalized.workspaceId
    && (record.ug ?? null) === (normalized.ug ?? null)
    && record.uid === normalized.uid
    && record.email === normalized.email
    && record.legalBundleVersion === CURRENT_LEGAL_BUNDLE.legalBundleVersion
    && record.termsVersion === CURRENT_LEGAL_BUNDLE.termsVersion
    && record.privacyVersion === CURRENT_LEGAL_BUNDLE.privacyVersion
  );
}

export async function hasAcceptedCurrentLegalBundle(
  identity: LegalAcceptanceIdentity
): Promise<boolean> {
  const normalized = normalizedIdentity(identity);
  const snapshot = await getDoc(acceptanceRef(normalized));

  if (!snapshot.exists()) return false;

  return matchesCurrentBundle(snapshot.data() as Partial<LegalAcceptanceRecord>, normalized);
}

export async function acceptCurrentLegalBundle(
  identity: LegalAcceptanceIdentity
): Promise<LegalAcceptanceResult> {
  const normalized = normalizedIdentity(identity);
  const reference = acceptanceRef(normalized);
  const documentId = reference.id;

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (snapshot.exists()) {
      if (!matchesCurrentBundle(snapshot.data() as Partial<LegalAcceptanceRecord>, normalized)) {
        throw new Error('O registro de aceite existente não corresponde ao pacote legal vigente.');
      }

      return {
        created: false,
        documentId,
        versions: CURRENT_LEGAL_BUNDLE,
      };
    }

    transaction.set(reference, {
      schemaVersion: LEGAL_ACCEPTANCE_SCHEMA_VERSION,
      workspaceId: normalized.workspaceId,
      ug: normalized.ug ?? null,
      uid: normalized.uid,
      email: normalized.email,
      legalBundleVersion: CURRENT_LEGAL_BUNDLE.legalBundleVersion,
      termsVersion: CURRENT_LEGAL_BUNDLE.termsVersion,
      privacyVersion: CURRENT_LEGAL_BUNDLE.privacyVersion,
      acceptedAt: serverTimestamp(),
    });

    return {
      created: true,
      documentId,
      versions: CURRENT_LEGAL_BUNDLE,
    };
  });
}
