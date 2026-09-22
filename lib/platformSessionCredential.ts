'use client';

import {
  signInWithCustomToken,
  type IdTokenResult,
  type User,
} from 'firebase/auth';

import { auth } from './firebase';
import {
  SESSION_AUTHORIZATION_VERSION,
  type WorkspaceSessionSlotId,
} from './platformCapacity';
import {
  PlatformSessionLeaseError,
  getLocalWorkspaceSessionIdentity,
  type WorkspaceSessionLeaseIdentity,
} from './platformSessionLease';
import { normalizePlatformEmail, normalizeUnitUg } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';

interface SessionCredentialResponse {
  customToken?: string;
  sessionVersion?: string;
  sessionId?: string;
  slotId?: WorkspaceSessionSlotId;
  code?: string;
  message?: string;
}

function claimString(result: IdTokenResult, name: string): string {
  const value = result.claims[name];
  return typeof value === 'string' ? value : '';
}

function tokenMatchesLease(
  result: IdTokenResult,
  context: SectorWorkspaceContext,
  local: WorkspaceSessionLeaseIdentity
): boolean {
  return result.signInProvider === 'custom'
    && claimString(result, 'emprovexSessionVersion') === SESSION_AUTHORIZATION_VERSION
    && claimString(result, 'emprovexSessionId') === local.sessionId
    && claimString(result, 'emprovexSessionSlotId') === local.slotId
    && claimString(result, 'emprovexBrowserInstanceId') === local.browserInstanceId
    && claimString(result, 'emprovexWorkspaceId') === context.workspaceId
    && normalizeUnitUg(claimString(result, 'emprovexUg')) === context.ug
    && claimString(result, 'emprovexSourceProvider') === 'password';
}

function credentialError(payload: SessionCredentialResponse, status: number): Error {
  if (payload.code === 'SESSION_REVOKED') {
    return new PlatformSessionLeaseError(
      'SESSION_REVOKED',
      payload.message || 'Esta sessão foi encerrada pela administração. Faça login novamente.'
    );
  }

  if (
    payload.code === 'INVALID_SESSION'
    || payload.code === 'SESSION_EXPIRED'
    || status === 409
  ) {
    return new PlatformSessionLeaseError(
      'SESSION_LEASE_LOST',
      payload.message || 'A vaga desta sessão não está mais ativa. Faça login novamente.'
    );
  }

  return new Error(
    payload.message || 'Não foi possível preparar a autorização operacional desta sessão.'
  );
}

/**
 * Converte silenciosamente o login password de um setor em uma credencial
 * Firebase customizada e assinada no servidor. A nova credencial mantém o mesmo
 * UID/e-mail, mas acrescenta a identidade exata do lease que as Firestore Rules
 * conseguem verificar sem confiar em localStorage.
 */
export async function ensureWorkspaceSessionCredential(
  user: User,
  context: SectorWorkspaceContext
): Promise<User> {
  const local = getLocalWorkspaceSessionIdentity(context.workspaceId, user.uid);
  if (!local) {
    throw new PlatformSessionLeaseError(
      'SESSION_LEASE_LOST',
      'A identidade local desta sessão não está disponível. Faça login novamente.'
    );
  }

  const currentToken = await user.getIdTokenResult();
  if (tokenMatchesLease(currentToken, context, local)) {
    return user;
  }

  if (
    currentToken.signInProvider !== 'password'
    && currentToken.signInProvider !== 'custom'
  ) {
    throw new Error('O provedor atual não pode abrir uma sessão operacional de setor.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch('/api/auth/session-credential', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      workspaceId: context.workspaceId,
      ug: context.ug || '',
      slotId: local.slotId,
      sessionId: local.sessionId,
      browserInstanceId: local.browserInstanceId,
    }),
  });

  const payload = await response.json().catch(() => ({})) as SessionCredentialResponse;
  if (!response.ok || !payload.customToken) {
    throw credentialError(payload, response.status);
  }

  if (
    payload.sessionVersion !== SESSION_AUTHORIZATION_VERSION
    || payload.sessionId !== local.sessionId
    || payload.slotId !== local.slotId
  ) {
    throw new Error('O servidor devolveu uma credencial de sessão inconsistente.');
  }

  const credential = await signInWithCustomToken(auth, payload.customToken);
  if (
    credential.user.uid !== user.uid
    || normalizePlatformEmail(credential.user.email || '') !== normalizePlatformEmail(user.email || '')
  ) {
    throw new Error('A credencial operacional não preservou a identidade Firebase original.');
  }

  const confirmedToken = await credential.user.getIdTokenResult(true);
  if (!tokenMatchesLease(confirmedToken, context, local)) {
    throw new Error('A credencial operacional não contém a identidade de sessão esperada.');
  }

  return credential.user;
}
