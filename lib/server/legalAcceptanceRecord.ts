/** Read-only verification of an immutable, versioned legal acceptance.
 *
 * Tenant binding and the exact legal bundle always take precedence.
 * A narrowly scoped founder-only exception recognizes a genuine historical
 * R4 acceptance recorded while the founder's workspace had no UG. The
 * historical document is never rewritten, and an unrelated tenant can never
 * receive the exception.
 */
export type LegalFirestoreField = {
  stringValue?: string;
  nullValue?: null;
  timestampValue?: string;
};

export type LegalAcceptanceFields = Record<string, LegalFirestoreField>;

export interface LegalAcceptanceIdentity {
  workspaceId: string;
  uid: string;
  email: string;
  ug: string;
}

export interface LegalAcceptanceExpected {
  schemaVersion: string;
  legalBundleVersion: string;
  termsVersion: string;
  privacyVersion: string;
}

export interface LegalFounderIdentity {
  workspaceId: string;
  email: string;
  ug: string;
}

export function isVerifiedLegalAcceptance(
  fields: LegalAcceptanceFields | undefined,
  identity: LegalAcceptanceIdentity,
  expected: LegalAcceptanceExpected,
  founder: LegalFounderIdentity,
): boolean {
  if (!fields) return false;

  const text = (key: string) => fields[key]?.stringValue ?? '';
  if (
    text('uid') !== identity.uid
    || text('email') !== identity.email
    || text('workspaceId') !== identity.workspaceId
    || text('schemaVersion') !== expected.schemaVersion
    || text('legalBundleVersion') !== expected.legalBundleVersion
    || text('termsVersion') !== expected.termsVersion
    || text('privacyVersion') !== expected.privacyVersion
  ) {
    return false;
  }

  // Usual, strict, immutable acceptance (including historical workspaces
  // where both the stored and resolved UGs were empty).
  if (text('ug') === identity.ug) return true;

  // Founder migration: the workspace previously lacked the 'ug' field.
  // The acceptance API therefore wrote Firestore nullValue, not a string.
  // Its server-generated timestamp and all other immutable evidence must
  // match exactly. This does NOT grant an exception to other organizations.
  return identity.workspaceId === founder.workspaceId
    && identity.email === founder.email
    && identity.ug === founder.ug
    && fields.ug?.nullValue === null
    && typeof fields.acceptedAt?.timestampValue === 'string'
    && Number.isFinite(Date.parse(fields.acceptedAt.timestampValue));
}
