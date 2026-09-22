'use client';

import {
  signInWithCustomToken,
  type IdTokenResult,
  type User,
} from 'firebase/auth';

import { auth } from './firebase';
import {
  SESSION_AUTHORIZATION_VERSION,
  SESSION_SLOT_IDS,
  type WorkspaceSessionSlotId,
} from './platformCapacity';
import {
  PlatformSessionLeaseError,
  acquireBoundWorkspaceSessionLease,
  rememberBoundWorkspaceSessionIdentity,
  type WorkspaceSessionLeaseIdentity,
} from './platformSessionLease';
import { normalizePlatformEmail, normalizeUnitUg } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';

interface SessionCredentialResponse {
  customToken?: string;
  sessionVersion?: string;
  sessionId?: string;
  slotId?: WorkspaceSessionSlotId;
  browserInstanceId?: string;
  code?: string;
  message?: string;
}

function claimString(result: IdTokenResult, name: string): string {
  const value = result.claims[name];
  return typeof value === 'string' ? value : '';
}

function identityFromToken(
  result: IdTokenResult,
  context: SectorWorkspaceContext,
  uid: string
): WorkspaceSessionLeaseIdentity | null {
  const slotId = claimString(result, 'emprovexSessionSlotId');
  const sessionId = claimString(result, 'emprovexSessionId');
  const browserInstanceId = claimString(result, 'emprovexBrowserInstanceId');

  if (
    result.signInProvider !== 'custom'
    || claimString(result, 'emprovexSessionVersion') !== SESSION_AUTHORIZATION_VERSION
    || !SESSION_SLOT_IDS.includes(slotId as WorkspaceSessionSlotId)
    || sessionId.length <= 8
    || browserInstanceId.length <= 8
    || claimString(result, 'emprovexWorkspaceId') !== context.workspaceId
    || normalizeUnitUg(claimString(result, 'emprovexUg')) !== context.ug
    || claimString(result, 'emprovexSourceProvider') !== 'password'
  ) {
    return null;
  }

  return {
    workspaceId: context.workspaceId,
    uid,
    slotId: slotId as WorkspaceSessionSlotId,
    sessionId,
    browserInstanceId,
  };
}

function credentialError(payload: SessionCredentialResponse, status: number): Error {
  if (payload.code === 'SESSION_CAPACITY_EXCEEDED' || status === 409) {
    return new PlatformSessionLeaseError(
      'SESSION_CAPACITY_EXCEEDED',
      payload.message || 'Limite de acessos simultâneos atingido.'
    );
  }

  return new Error(
    payload.message || 'Não foi possível preparar a autorização operacional desta sessão.'
  );
}

function responseIdentity(
  payload: SessionCredentialResponse,
  context: SectorWorkspaceContext,
  uid: string
): WorkspaceSessionLeaseIdentity {
  if (
    payload.sessionVersion !== SESSION_AUTHORIZATION_VERSION
    || !payload.slotId
    || !SESSION_SLOT_IDS.includes(payload.slotId)
    || typeof payload.sessionId !== 'string'
    || payload.sessionId.length <= 8
    || typeof payload.browserInstanceId !== 'string'
    || payload.browserInstanceId.length <= 8
  ) {
    throw new Error('O servidor devolveu uma identidade operacional inconsistente.');
  }

  return {
    workspaceId: context.workspaceId,
    uid,
    slotId: payload.slotId,
    sessionId: payload.sessionId,
    browserInstanceId: payload.browserInstanceId,
  };
}

async function requestFreshSessionCredential(
  bootstrapIdToken: string,
  context: SectorWorkspaceContext
): Promise<SessionCredentialResponse> {
  const response = await fetch('/api/auth/session-credential', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bootstrapIdToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      workspaceId: context.workspaceId,
      ug: context.ug || '',
    }),
  });

  const payload = await response.json().catch(() => ({})) as SessionCredentialResponse;
  if (!response.ok || !payload.customToken) {
    throw credentialError(payload, response.status);
  }
  return payload;
}

/**
 * Mantém o login visível email/senha, mas troca silenciosamente a autorização
 * operacional por uma identidade de sessão criada no servidor.
 *
 * O token password nunca escolhe sessionId/browser/slot de uma sessão existente:
 * o servidor seleciona somente uma vaga ausente/expirada e gera identificadores
 * novos. Depois disso, a criação/renovação do lease só é aceita pelo token custom
 * que carrega exatamente aquela identidade.
 */
export async function ensureWorkspaceSessionCredential(
  user: User,
  context: SectorWorkspaceContext
): Promise<User> {
  const currentToken = await user.getIdTokenResult();

  if (currentToken.signInProvider === 'custom') {
    const existingIdentity = identityFromToken(currentToken, context, user.uid);
    if (!existingIdentity) {
      throw new PlatformSessionLeaseError(
        'SESSION_LEASE_LOST',
        'A credencial operacional não corresponde à sessão atual.'
      );
    }

    // localStorage deixa de ser autoridade: se foi limpo, a identidade confiável
    // do ID token restaura apenas o estado local necessário ao heartbeat/multiaba.
    rememberBoundWorkspaceSessionIdentity(existingIdentity);
    return user;
  }

  if (currentToken.signInProvider !== 'password') {
    throw new Error('O provedor atual não pode abrir uma sessão operacional de setor.');
  }

  // Preservado em memória somente durante esta tentativa. Mesmo após a troca para
  // custom auth, ele permite repetir a seleção se houver uma corrida pelo slot.
  const bootstrapIdToken = await user.getIdToken();

  for (let attempt = 0; attempt < SESSION_SLOT_IDS.length + 1; attempt += 1) {
    const payload = await requestFreshSessionCredential(bootstrapIdToken, context);
    const identity = responseIdentity(payload, context, user.uid);

    const credential = await signInWithCustomToken(auth, payload.customToken!);
    if (
      credential.user.uid !== user.uid
      || normalizePlatformEmail(credential.user.email || '') !== normalizePlatformEmail(user.email || '')
    ) {
      throw new Error('A credencial operacional não preservou a identidade Firebase original.');
    }

    const confirmedToken = await credential.user.getIdTokenResult(true);
    const confirmedIdentity = identityFromToken(
      confirmedToken,
      context,
      credential.user.uid
    );
    if (
      !confirmedIdentity
      || confirmedIdentity.slotId !== identity.slotId
      || confirmedIdentity.sessionId !== identity.sessionId
      || confirmedIdentity.browserInstanceId !== identity.browserInstanceId
    ) {
      throw new Error('A credencial operacional não contém a identidade de sessão esperada.');
    }

    try {
      await acquireBoundWorkspaceSessionLease(
        credential.user,
        context,
        confirmedIdentity
      );
      return credential.user;
    } catch (error) {
      const retryableRace = error instanceof PlatformSessionLeaseError
        && error.code === 'SESSION_CAPACITY_EXCEEDED'
        && attempt < SESSION_SLOT_IDS.length;

      if (!retryableRace) throw error;
    }
  }

  throw new PlatformSessionLeaseError(
    'SESSION_CAPACITY_EXCEEDED',
    'Limite de acessos simultâneos atingido.'
  );
}
