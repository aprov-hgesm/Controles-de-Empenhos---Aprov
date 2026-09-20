'use client';

import type { User } from 'firebase/auth';

import {
  SESSION_HEARTBEAT_INTERVAL_MS,
  isFounderCapacityExempt,
} from './platformCapacity';
import {
  isTerminalSessionLeaseError,
  renewWorkspaceSessionLeaseIfDue,
  subscribeWorkspaceSessionRevocation,
} from './platformSessionLease';
import type { SectorWorkspaceContext } from './workspaceContext';

export const SESSION_COORDINATOR_VERSION = 'emprovex_session_coordinator_v1';
export const SESSION_COORDINATOR_RETRY_MS = 4 * 1000;

const CHANNEL_PREFIX = 'emprovex:session-coordinator:v1';
const ROLE_KEY_PREFIX = 'emprovex:session-coordinator-role:v1';
const TAB_ID_KEY = 'emprovex:session-coordinator-tab:v1';

export type WorkspaceSessionCoordinatorRole =
  | 'leader'
  | 'follower'
  | 'fallback';

type SessionInvalidationReason = 'revoked' | 'lease-lost';

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
  const storage = sessionStorageSafe();

  let stopped = false;
  let invalidated = false;
  let role: WorkspaceSessionCoordinatorRole = 'follower';
  let retryTimer: number | null = null;
  let releaseLeadership: (() => void) | null = null;
  let stopLeaderWork: (() => void) | null = null;
  let leadershipRequestInFlight = false;
  let channel: BroadcastChannel | null = null;

  const setRole = (nextRole: WorkspaceSessionCoordinatorRole) => {
    role = nextRole;
    storage?.setItem(roleKey(workspaceId, uid), nextRole);
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
      unsubscribeRevocation();
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
        storage?.removeItem(roleKey(workspaceId, uid));
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

  const attemptLeadership = () => {
    if (stopped || invalidated || leadershipRequestInFlight) return;
    leadershipRequestInFlight = true;

    void navigator.locks.request(
      lockName(workspaceId, uid),
      { ifAvailable: true },
      async (lock) => {
        if (!lock || stopped || invalidated) {
          setRole('follower');
          return;
        }

        stopLeaderWork = startLeaderResponsibilities();

        await new Promise<void>((resolve) => {
          releaseLeadership = resolve;
        });

        stopLeaderWork?.();
        stopLeaderWork = null;
        releaseLeadership = null;
      }
    ).catch((error) => {
      callbacks.onTransientError?.(error);
    }).finally(() => {
      leadershipRequestInFlight = false;
      if (!stopped && !invalidated) setRole('follower');
    });
  };

  setRole('follower');
  attemptLeadership();
  retryTimer = window.setInterval(attemptLeadership, SESSION_COORDINATOR_RETRY_MS);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;

      if (retryTimer !== null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }

      releaseLeadership?.();
      releaseLeadership = null;
      stopLeaderWork?.();
      stopLeaderWork = null;

      channel?.close();
      channel = null;
      storage?.removeItem(roleKey(workspaceId, uid));
    },
    getRole: () => role,
  };
}
