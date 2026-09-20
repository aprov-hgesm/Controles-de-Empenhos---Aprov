'use client';

import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from './firebase';
import {
  SESSION_HEARTBEAT_INTERVAL_MS,
  isFounderCapacityExempt,
} from './platformCapacity';
import {
  isTerminalSessionLeaseError,
  renewWorkspaceSessionLeaseIfDue,
  subscribeWorkspaceSessionRevocation,
} from './platformSessionLease';
import {
  recordWorkspaceRealtimeSnapshot,
  trackWorkspaceRealtimeListener,
} from './workspaceUsageTelemetry';
import type { SectorWorkspaceContext } from './workspaceContext';

export const SESSION_CONTROL_VERSION = 'emprovex_session_control_v2';

export type SessionInvalidationReason = 'revoked' | 'lease-lost' | 'access-changed';

export interface WorkspaceSessionControlCallbacks {
  onSessionInvalid: (reason: SessionInvalidationReason) => void;
  onTransientError?: (error: unknown) => void;
}

export interface WorkspaceSessionControlHandle {
  stop: () => void;
}

/**
 * Bloco 17.2 simplificado.
 *
 * Cada aba protege a própria sessão com listeners independentes de lifecycle e
 * revogação. Não há eleição de líder, BroadcastChannel ou lock persistente.
 * A única coordenação entre abas ocorre dentro da renovação do lease, através de
 * um mutex curtíssimo no platformSessionLease.
 */
export function startWorkspaceSessionControl(
  user: User,
  context: SectorWorkspaceContext,
  callbacks: WorkspaceSessionControlCallbacks
): WorkspaceSessionControlHandle {
  if (
    isFounderCapacityExempt(user.email)
    || context.resolutionSource !== 'platform-directory'
  ) {
    return { stop: () => undefined };
  }

  const workspaceId = context.workspaceId;
  const uid = user.uid;
  const telemetryScope = {
    workspaceId,
    ug: context.ug,
  };

  let active = true;
  let invalidated = false;

  const invalidateLocalSession = (reason: SessionInvalidationReason) => {
    if (!active || invalidated) return;
    invalidated = true;
    callbacks.onSessionInvalid(reason);
  };

  const handleLifecycleError = (error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
      invalidateLocalSession('access-changed');
      return;
    }

    callbacks.onTransientError?.(error);
  };

  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const accountRef = doc(db, 'platformAccounts', context.email);

  const stopWorkspaceListenerTelemetry = trackWorkspaceRealtimeListener(telemetryScope);
  const stopAccountListenerTelemetry = trackWorkspaceRealtimeListener(telemetryScope);

  const unsubscribeWorkspace = onSnapshot(
    workspaceRef,
    (snapshot) => {
      recordWorkspaceRealtimeSnapshot(telemetryScope, 1);
      if (!snapshot.exists()) {
        invalidateLocalSession('access-changed');
        return;
      }

      const data = snapshot.data() as {
        id?: string;
        status?: string;
        authorizedEmail?: string;
        ug?: string;
      };

      if (
        data.id !== workspaceId
        || data.status !== 'active'
        || data.authorizedEmail !== context.email
        || (data.ug || null) !== context.ug
      ) {
        invalidateLocalSession('access-changed');
      }
    },
    handleLifecycleError
  );

  const unsubscribeAccount = onSnapshot(
    accountRef,
    (snapshot) => {
      recordWorkspaceRealtimeSnapshot(telemetryScope, 1);
      if (!snapshot.exists()) {
        invalidateLocalSession('access-changed');
        return;
      }

      const data = snapshot.data() as {
        email?: string;
        workspaceId?: string;
        accountType?: string;
        status?: string;
        firebaseUid?: string;
        ug?: string;
      };

      if (
        data.email !== context.email
        || data.workspaceId !== workspaceId
        || data.accountType !== 'sector'
        || data.status !== 'active'
        || data.firebaseUid !== uid
        || (data.ug || null) !== context.ug
      ) {
        invalidateLocalSession('access-changed');
      }
    },
    handleLifecycleError
  );

  const unsubscribeRevocation = subscribeWorkspaceSessionRevocation(
    user,
    context,
    () => invalidateLocalSession('revoked'),
    (error) => callbacks.onTransientError?.(error)
  );

  const renewLease = async () => {
    if (!active || invalidated) return;

    try {
      await renewWorkspaceSessionLeaseIfDue(user, context);
    } catch (error) {
      if (isTerminalSessionLeaseError(error)) {
        invalidateLocalSession('lease-lost');
        return;
      }
      callbacks.onTransientError?.(error);
    }
  };

  const intervalId = window.setInterval(
    () => void renewLease(),
    SESSION_HEARTBEAT_INTERVAL_MS
  );

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') void renewLease();
  };
  const handleOnline = () => void renewLease();

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);

  // Revalidação inicial barata. O marcador compartilhado de renovação evita
  // writes quando o lease ainda está dentro da janela nominal.
  void renewLease();

  return {
    stop: () => {
      if (!active) return;
      active = false;

      unsubscribeWorkspace();
      unsubscribeAccount();
      unsubscribeRevocation();
      stopWorkspaceListenerTelemetry();
      stopAccountListenerTelemetry();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    },
  };
}
