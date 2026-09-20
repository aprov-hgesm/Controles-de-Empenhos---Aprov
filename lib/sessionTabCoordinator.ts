'use client';

const TAB_ID_KEY = 'emprovex:session-tab-id:v1';
const TAB_ROLE_KEY_PREFIX = 'emprovex:session-tab-role:v1';
const FALLBACK_LEADER_KEY_PREFIX = 'emprovex:session-tab-leader:v1';
const FALLBACK_LEADER_TTL_MS = 12_000;
const FALLBACK_RENEW_INTERVAL_MS = 4_000;

export type WorkspaceSessionTabRole = 'leader' | 'follower';

export interface WorkspaceSessionTabCoordinator {
  tabId: string;
  getRole(): WorkspaceSessionTabRole;
  broadcastSessionInvalidated(reason: string): void;
  stop(): void;
}

interface CoordinatorOptions {
  workspaceId: string;
  uid: string;
  onLeadershipChange(role: WorkspaceSessionTabRole): void;
  onSessionInvalidated(reason: string): void;
}

interface CoordinatorMessage {
  type: 'session-invalidated';
  reason: string;
  senderTabId: string;
  emittedAt: number;
}

interface FallbackLeaderRecord {
  tabId: string;
  expiresAt: number;
}

function sessionStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
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
  const current = storage?.getItem(TAB_ID_KEY)?.trim();
  if (current) return current;
  const created = randomTabId();
  storage?.setItem(TAB_ID_KEY, created);
  return created;
}

function scopedKey(prefix: string, workspaceId: string, uid: string): string {
  return `${prefix}:${workspaceId}:${uid}`;
}

function roleKey(workspaceId: string, uid: string): string {
  return scopedKey(TAB_ROLE_KEY_PREFIX, workspaceId, uid);
}

function fallbackLeaderKey(workspaceId: string, uid: string): string {
  return scopedKey(FALLBACK_LEADER_KEY_PREFIX, workspaceId, uid);
}

function channelName(workspaceId: string, uid: string): string {
  return `emprovex:session-tabs:v1:${workspaceId}:${uid}`;
}

function lockName(workspaceId: string, uid: string): string {
  return `emprovex:session-leader:v1:${workspaceId}:${uid}`;
}

function parseLeaderRecord(raw: string | null): FallbackLeaderRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FallbackLeaderRecord>;
    if (
      typeof parsed.tabId !== 'string'
      || !parsed.tabId
      || typeof parsed.expiresAt !== 'number'
      || !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return {
      tabId: parsed.tabId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function startWorkspaceSessionTabCoordinator(
  options: CoordinatorOptions
): WorkspaceSessionTabCoordinator {
  const tabId = getOrCreateTabId();
  const roleStorageKey = roleKey(options.workspaceId, options.uid);
  const fallbackKey = fallbackLeaderKey(options.workspaceId, options.uid);
  const localStorage = localStorageSafe();
  const sessionStorage = sessionStorageSafe();

  let stopped = false;
  let role: WorkspaceSessionTabRole = 'follower';
  let releaseHeldLock: (() => void) | null = null;
  let fallbackTimer: number | null = null;
  let lockAbortController: AbortController | null = null;

  const setRole = (next: WorkspaceSessionTabRole) => {
    if (role === next) return;
    role = next;
    sessionStorage?.setItem(roleStorageKey, next);
    options.onLeadershipChange(next);
  };

  // Expor o papel por aba ajuda diagnóstico e E2E sem criar nova fonte de
  // verdade: a exclusão mútua continua pertencendo ao Web Locks/localStorage.
  sessionStorage?.setItem(roleStorageKey, role);

  const broadcastChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(channelName(options.workspaceId, options.uid))
    : null;

  const dispatchInvalidation = (reason: string) => {
    if (stopped) return;
    options.onSessionInvalidated(reason);
  };

  if (broadcastChannel) {
    broadcastChannel.onmessage = (event: MessageEvent<CoordinatorMessage>) => {
      const message = event.data;
      if (
        message?.type === 'session-invalidated'
        && message.senderTabId !== tabId
      ) {
        dispatchInvalidation(message.reason);
      }
    };
  }

  const storageMessageKey = `${channelName(options.workspaceId, options.uid)}:message`;
  const handleStorageMessage = (event: StorageEvent) => {
    if (event.key !== storageMessageKey || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as CoordinatorMessage;
      if (
        message.type === 'session-invalidated'
        && message.senderTabId !== tabId
      ) {
        dispatchInvalidation(message.reason);
      }
    } catch {
      // Mensagem local inválida é ignorada; não altera autenticação.
    }
  };
  window.addEventListener('storage', handleStorageMessage);

  const broadcastSessionInvalidated = (reason: string) => {
    const message: CoordinatorMessage = {
      type: 'session-invalidated',
      reason,
      senderTabId: tabId,
      emittedAt: Date.now(),
    };
    broadcastChannel?.postMessage(message);
    if (localStorage) {
      // storage event é fallback para browsers sem BroadcastChannel e só é
      // entregue às outras abas do mesmo origin.
      localStorage.setItem(storageMessageKey, JSON.stringify(message));
      localStorage.removeItem(storageMessageKey);
    }
  };

  const startWebLockElection = (): boolean => {
    if (
      typeof navigator === 'undefined'
      || !navigator.locks
      || typeof navigator.locks.request !== 'function'
    ) {
      return false;
    }

    lockAbortController = new AbortController();

    void navigator.locks.request(
      lockName(options.workspaceId, options.uid),
      {
        mode: 'exclusive',
        signal: lockAbortController.signal,
      },
      async () => {
        if (stopped) return;

        setRole('leader');
        await new Promise<void>((resolve) => {
          releaseHeldLock = resolve;
        });
        releaseHeldLock = null;
        if (!stopped) setRole('follower');
      }
    ).catch((error) => {
      if (
        !stopped
        && !(error instanceof DOMException && error.name === 'AbortError')
      ) {
        console.warn('Falha na eleição de aba líder via Web Locks.', error);
      }
    });

    return true;
  };

  const evaluateFallbackLeadership = () => {
    if (stopped || !localStorage) return;

    const now = Date.now();
    const current = parseLeaderRecord(localStorage.getItem(fallbackKey));
    const mayClaim = !current || current.expiresAt <= now || current.tabId === tabId;

    if (mayClaim) {
      localStorage.setItem(
        fallbackKey,
        JSON.stringify({
          tabId,
          expiresAt: now + FALLBACK_LEADER_TTL_MS,
        } satisfies FallbackLeaderRecord)
      );

      const confirmed = parseLeaderRecord(localStorage.getItem(fallbackKey));
      setRole(confirmed?.tabId === tabId ? 'leader' : 'follower');
      return;
    }

    setRole('follower');
  };

  const handleFallbackStorage = (event: StorageEvent) => {
    if (event.key === fallbackKey) evaluateFallbackLeadership();
  };

  const startFallbackElection = () => {
    window.addEventListener('storage', handleFallbackStorage);
    evaluateFallbackLeadership();
    fallbackTimer = window.setInterval(
      evaluateFallbackLeadership,
      FALLBACK_RENEW_INTERVAL_MS
    );
  };

  if (!startWebLockElection()) {
    startFallbackElection();
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;

    broadcastChannel?.close();
    window.removeEventListener('storage', handleStorageMessage);
    window.removeEventListener('storage', handleFallbackStorage);

    if (fallbackTimer !== null) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    }

    const current = localStorage
      ? parseLeaderRecord(localStorage.getItem(fallbackKey))
      : null;
    if (localStorage && current?.tabId === tabId) {
      localStorage.removeItem(fallbackKey);
    }

    lockAbortController?.abort();
    lockAbortController = null;
    releaseHeldLock?.();
    releaseHeldLock = null;

    sessionStorage?.removeItem(roleStorageKey);
  };

  return {
    tabId,
    getRole: () => role,
    broadcastSessionInvalidated,
    stop,
  };
}

export function getWorkspaceSessionTabRoleForDiagnostics(
  workspaceId: string,
  uid: string
): WorkspaceSessionTabRole | null {
  const value = sessionStorageSafe()?.getItem(roleKey(workspaceId, uid));
  return value === 'leader' || value === 'follower' ? value : null;
}
