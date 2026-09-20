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

export const SESSION_COORDINATOR_VERSION = 'emprovex_session_coordinator_v1';
const CHANNEL_PREFIX = 'emprovex:session-coordinator:v1';
const ROLE_KEY_PREFIX = 'emprovex:session-coordinator-role:v1';
const ROLE_OWNER_KEY_PREFIX = 'emprovex:session-coordinator-role-owner:v1';
const TAB_ID_KEY = 'emprovex:session-coordinator-tab:v1';

export type WorkspaceSessionCoordinatorRole =
  | 'leader'
  | 'follower'
  | 'fallback';

type SessionInvalidationReason = 'revoked' | 'lease-lost' | 'access-changed';

interface CoordinatorMessage {
  version: typeof SESSION_COORDINATOR_VERSION;
  type: 'session-invalid';
  reason: SessionInvalidationReason;
  workspaceId: string;
  uid: string;
  senderTabId: string;
  sentAt: number;
}

export interface WorkspaceSessionCoordinatorCallbacks {
  onSessionInvalid: (reason: SessionInvalidationReason) => void;
  onTransientError?: (error: unknown) => void;
}

export interface WorkspaceSessionCoordinatorHandle {
  stop: () => void;
  getRole: () => WorkspaceSessionCoordinatorRole;
}

function sessionStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function randomTabId(): string {
  const value = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `tab-${value}`;
}

function getOrCreateTabId(): string {
  const storage = sessionStorageSafe();
  const existing = storage?.getItem(TAB_ID_KEY)?.trim();
  if (existing) return existing;

  const created = randomTabId();
  storage?.setItem(TAB_ID_KEY, created);
  return storage?.getItem(TAB_ID_KEY)?.trim() || created;
}

function roleKey(workspaceId: string, uid: string): string {
  return `${ROLE_KEY_PREFIX}:${workspaceId}:${uid}`;
}

function roleOwnerKey(workspaceId: string, uid: string): string {
  return `${ROLE_OWNER_KEY_PREFIX}:${workspaceId}:${uid}`;
}

function channelName(workspaceId: string, uid: string): string {
  return `${CHANNEL_PREFIX}:${workspaceId}:${uid}`;
}

function lockName(workspaceId: string, uid: string): string {
  return `emprovex-session-leader:${workspaceId}:${uid}`;
}

function supportsSafeCoordination(): boolean {
  return typeof window !== 'undefined'
    && typeof BroadcastChannel !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.locks)
    && typeof navigator.locks.request === 'function';
}

export function startWorkspaceSessionCoordinator(
  user: User,
  context: SectorWorkspaceContext,
  callbacks: WorkspaceSessionCoordinatorCallbacks
): WorkspaceSessionCoordinatorHandle {
  if (
    isFounderCapacityExempt(user.email)
    || context.resolutionSource !== 'platform-directory'
  ) {
    return {
      stop: () => undefined,
      getRole: () => 'fallback',
    };
  }

  const workspaceId = context.workspaceId;
  const uid = user.uid;
  const tabId = getOrCreateTabId();
  const coordinatorInstanceId = randomTabId();
  const storage = sessionStorageSafe();

  let stopped = false;
  let invalidated = false;
  let role: WorkspaceSessionCoordinatorRole = 'follower';
  let releaseLeadership: (() => void) | null = null;
  let stopLeaderWork: (() => void) | null = null;
  const leadershipAbortController = new AbortController();
  let channel: BroadcastChannel | null = null;

  const setRole = (nextRole: WorkspaceSessionCoordinatorRole) => {
    role = nextRole;
    storage?.setItem(roleKey(workspaceId, uid), nextRole);
    storage?.setItem(roleOwnerKey(workspaceId, uid), coordinatorInstanceId);
  };

  const clearStoredRoleIfOwned = () => {
    if (!storage) return;
    if (storage.getItem(roleOwnerKey(workspaceId, uid)) !== coordinatorInstanceId) {
      return;
    }
    storage.removeItem(roleKey(workspaceId, uid));
    storage.removeItem(roleOwnerKey(workspaceId, uid));
  };

  const invalidateLocalSession = (reason: SessionInvalidationReason) => {
    if (stopped || invalidated) return;
    invalidated = true;
    callbacks.onSessionInvalid(reason);
  };

  const publishInvalidation = (reason: SessionInvalidationReason) => {
    const message: CoordinatorMessage = {
      version: SESSION_COORDINATOR_VERSION,
      type: 'session-invalid',
      reason,
      workspaceId,
      uid,
      senderTabId: tabId,
      sentAt: Date.now(),
    };
    channel?.postMessage(message);
  };

  const handleTerminalFailure = (reason: SessionInvalidationReason) => {
    publishInvalidation(reason);
    invalidateLocalSession(reason);
  };

  const startLeaderResponsibilities = (): (() => void) => {
    setRole('leader');
    let active = true;

    const renewLease = async () => {
      if (!active || stopped) return;
      try {
        await renewWorkspaceSessionLeaseIfDue(user, context);
      } catch (error) {
        if (isTerminalSessionLeaseError(error)) {
          handleTerminalFailure('lease-lost');
          return;
        }
        callbacks.onTransientError?.(error);
      }
    };

    const telemetryScope = {
      workspaceId,
      ug: context.ug,
    };
    const stopWorkspaceListenerTelemetry = trackWorkspaceRealtimeListener(telemetryScope);
    const stopAccountListenerTelemetry = trackWorkspaceRealtimeListener(telemetryScope);

    const handleLifecycleError = (error: unknown) => {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        handleTerminalFailure('access-changed');
        return;
      }
      callbacks.onTransientError?.(error);
    };

    const workspaceRef = doc(db, 'workspaces', workspaceId);
    const accountRef = doc(db, 'platformAccounts', context.email);

    const unsubscribeWorkspace = onSnapshot(
      workspaceRef,
      (snapshot) => {
        recordWorkspaceRealtimeSnapshot(telemetryScope, 1);
        if (!snapshot.exists()) {
          handleTerminalFailure('access-changed');
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
          handleTerminalFailure('access-changed');
        }
      },
      handleLifecycleError
    );

    const unsubscribeAccount = onSnapshot(
      accountRef,
      (snapshot) => {
        recordWorkspaceRealtimeSnapshot(telemetryScope, 1);
        if (!snapshot.exists()) {
          handleTerminalFailure('access-changed');
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
          handleTerminalFailure('access-changed');
        }
      },
      handleLifecycleError
    );

    const unsubscribeRevocation = subscribeWorkspaceSessionRevocation(
      user,
      context,
      () => handleTerminalFailure('revoked'),
      (error) => callbacks.onTransientError?.(error)
    );

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

    // Quando uma aba assume a liderança depois de failover, revalida imediatamente
    // se o lease já atingiu a janela de renovação. shouldRenew() mantém isso barato.
    void renewLease();

    return () => {
      active = false;
      unsubscribeWorkspace();
      unsubscribeAccount();
      unsubscribeRevocation();
      stopWorkspaceListenerTelemetry();
      stopAccountListenerTelemetry();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  };

  if (!supportsSafeCoordination()) {
    // Fallback conservador: navegadores sem Web Locks + BroadcastChannel mantêm o
    // comportamento anterior por aba. É menos eficiente, mas não sacrifica
    // revogação remota nem renovação do lease em nome de economia.
    setRole('fallback');
    stopLeaderWork = startLeaderResponsibilities();
    setRole('fallback');

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        stopLeaderWork?.();
        stopLeaderWork = null;
        clearStoredRoleIfOwned();
      },
      getRole: () => role,
    };
  }

  channel = new BroadcastChannel(channelName(workspaceId, uid));
  channel.addEventListener('message', (event: MessageEvent<CoordinatorMessage>) => {
    const message = event.data;
    if (
      !message
      || message.version !== SESSION_COORDINATOR_VERSION
      || message.type !== 'session-invalid'
      || message.workspaceId !== workspaceId
      || message.uid !== uid
      || message.senderTabId === tabId
    ) {
      return;
    }

    invalidateLocalSession(message.reason);
  });

  const queueLeadership = () => {
    setRole('follower');

    // Web Locks já possui fila nativa. Manter a requisição pendente é mais seguro
    // que polling por setInterval: abas em segundo plano podem ter timers
    // estrangulados/congelados, enquanto o LockManager promove automaticamente a
    // próxima aba quando a líder fecha e o lock é liberado.
    void navigator.locks.request(
      lockName(workspaceId, uid),
      { signal: leadershipAbortController.signal },
      async () => {
        if (stopped || invalidated) return;

        stopLeaderWork = startLeaderResponsibilities();

        await new Promise<void>((resolve) => {
          releaseLeadership = resolve;
        });

        stopLeaderWork?.();
        stopLeaderWork = null;
        releaseLeadership = null;
      }
    ).catch((error) => {
      if (stopped || leadershipAbortController.signal.aborted) return;

      // Falha da própria API de coordenação não deixa a sessão sem proteção.
      // Entramos no modelo conservador por aba: pode duplicar listeners, mas
      // preserva revogação, lifecycle e heartbeat.
      callbacks.onTransientError?.(error);
      setRole('fallback');
      stopLeaderWork = startLeaderResponsibilities();
      setRole('fallback');
    });
  };

  queueLeadership();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;

      leadershipAbortController.abort();
      releaseLeadership?.();
      releaseLeadership = null;
      stopLeaderWork?.();
      stopLeaderWork = null;

      channel?.close();
      channel = null;
      clearStoredRoleIfOwned();
    },
    getRole: () => role,
  };
}
