'use client';

import type { User } from 'firebase/auth';

export interface AuthorizedCompanySession {
  accountType: 'company';
  workspaceType: 'company';
  workspaceId: string;
  firebaseUid: string;
  authorizedEmail: string;
  companyName: string;
  tradeName: string | null;
  legalName: string | null;
}

export type CompanySessionResult =
  | { kind: 'company'; session: AuthorizedCompanySession }
  | { kind: 'not-company' }
  | { kind: 'invalid-auth' };

/**
 * A client token only identifies the caller. The /api/company/session backend
 * authorizes UID, account type, status and workspace before returning any data.
 */
export async function resolveCompanySession(
  user: User,
  signal?: AbortSignal
): Promise<CompanySessionResult> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/company/session', {
    method: 'GET',
    headers: { authorization: 'Bearer ' + idToken },
    cache: 'no-store',
    signal,
  });

  if (response.status === 401) return { kind: 'invalid-auth' };
  if (response.status === 403) return { kind: 'not-company' };
  if (!response.ok) throw new Error('COMPANY_SESSION_UNAVAILABLE');

  const payload: unknown = await response.json();
  if (
    !payload || typeof payload !== 'object' ||
    (payload as Record<string, unknown>).accountType !== 'company' ||
    (payload as Record<string, unknown>).workspaceType !== 'company' ||
    typeof (payload as Record<string, unknown>).workspaceId !== 'string' ||
    typeof (payload as Record<string, unknown>).companyName !== 'string' ||
    (payload as Record<string, unknown>).firebaseUid !== user.uid
  ) {
    throw new Error('COMPANY_SESSION_INVALID');
  }

  return { kind: 'company', session: payload as AuthorizedCompanySession };
}
