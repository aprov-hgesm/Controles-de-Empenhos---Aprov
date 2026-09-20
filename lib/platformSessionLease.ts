'use client';

import type { User } from 'firebase/auth';
import {
  Timestamp,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT,
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_LEASE_DURATION_MS,
  SESSION_LEASE_VERSION,
  SESSION_SLOT_IDS,
  isFounderCapacityExempt,
  type WorkspaceSessionLease,
  type WorkspaceSessionSlotId,
} from './platformCapacity';
import { normalizePlatformEmail } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';

const BROWSER_INSTANCE_KEY = 'emprovex:browser-instance:v1';
const SESSION_ID_KEY_PREFIX = 'emprovex:workspace-session:v1';
const ACTIVE_LEASE_KEY_PREFIX = 'emprovex:workspace-lease:v1';
const LAST_RENEWED_KEY_PREFIX = 'emprovex:workspace-lease-renewed:v1';

export const SESSION_CAPACITY_EXCEEDED_MESSAGE =
  'Limite de acessos simultâneos atingido. Este setor já possui 2 sessões ativas no EMPROVEX. Encerre uma das sessões existentes para continuar.';

export type PlatformSessionLeaseErrorCode =
  | 'SESSION_CAPACITY_EXCEEDED'
  | 'SESSION_UG_REQUIRED'
  | 'SESSION_INVALID_CONTEXT'
  | 'SESSION_REVOKED';

export class PlatformSessionLeaseError extends Error {
  constructor(
    public readonly code: PlatformSessionLeaseErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PlatformSessionLeaseError';
  }
}

interface StoredWorkspaceSessionLeaseDocument {
  leaseVersion?: string;
  slotId?: string;
  sessionId?: string;
  workspaceId?: string;
  ug?: string;
  uid?: string;
  accountEmail?: string;
  browserInstanceId?: string;
  startedAt?: Timestamp;
  lastSeenAt?: Timestamp;
  expiresAt?: Timestamp;
}

interface LocalLeaseRecord {
  workspaceId: string;
  uid: string;
  slotId: WorkspaceSessionSlotId;
  sessionId: string;
  browserInstanceId: string;
}

export type WorkspaceSessionLeaseAcquisition =
  | {
      status: 'exempt';
      lease: null;
    }
  | {
      status: 'acquired';
      lease: WorkspaceSessionLease;
      slotId: WorkspaceSessionSlotId;
    };

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomId(prefix: string): string {
  const value = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function scopedKey(prefix: string, workspaceId: string, uid: string): string {
  return `${prefix}:${workspaceId}:${uid}`;
}

async function getOrCreateStoredId(
  key: string,
  prefix: string
): Promise<string> {
  const storage = browserStorage();
  const current = storage?.getItem(key)?.trim();
  if (current) return current;

  const createUnderLock = () => {
    const lockedCurrent = storage?.getItem(key)?.trim();
    if (lockedCurrent) return lockedCurrent;

    const created = randomId(prefix);
    storage?.setItem(key, created);
    return storage?.getItem(key)?.trim() || created;
  };

  if (
    typeof navigator !== 'undefined'
    && navigator.locks
    && typeof navigator.locks.request === 'function'
  ) {
    return navigator.locks.request(
      `emprovex-id:${key}`,
      async () => createUnderLock()
    );
  }

  // Fallback para navegadores sem Web Locks. A releitura após o set reduz a
  // janela de corrida e mantém compatibilidade sem impedir o acesso.
  return createUnderLock();
}

async function getOrCreateBrowserInstanceId(): Promise<string> {
  return getOrCreateStoredId(BROWSER_INSTANCE_KEY, 'browser');
}

async function getOrCreateWorkspaceSessionId(
  workspaceId: string,
  uid: string
): Promise<string> {
  return getOrCreateStoredId(
    scopedKey(SESSION_ID_KEY_PREFIX, workspaceId, uid),
    'session'
  );
}

function getLocalLeaseRecord(
  workspaceId: string,
  uid: string
): LocalLeaseRecord | null {
  const storage = browserStorage();
  const raw = storage?.getItem(scopedKey(ACTIVE_LEASE_KEY_PREFIX, workspaceId, uid));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalLeaseRecord>;
    if (
      parsed.workspaceId !== workspaceId
      || parsed.uid !== uid
      || !SESSION_SLOT_IDS.includes(parsed.slotId as WorkspaceSessionSlotId)
      || !parsed.sessionId
      || !parsed.browserInstanceId
    ) {
      return null;
    }
    return parsed as LocalLeaseRecord;
  } catch {
    return null;
  }
}

function rememberLocalLease(record: LocalLeaseRecord): void {
  const storage = browserStorage();
  storage?.setItem(
    scopedKey(ACTIVE_LEASE_KEY_PREFIX, record.workspaceId, record.uid),
    JSON.stringify(record)
  );
}

function markLeaseRenewed(workspaceId: string, uid: string, at = Date.now()): void {
  browserStorage()?.setItem(
    scopedKey(LAST_RENEWED_KEY_PREFIX, workspaceId, uid),
    String(at)
  );
}

export function shouldRenewWorkspaceSessionLease(
  workspaceId: string,
  uid: string,
  at = Date.now()
): boolean {
  const raw = browserStorage()?.getItem(
    scopedKey(LAST_RENEWED_KEY_PREFIX, workspaceId, uid)
  );
  const lastRenewed = Number(raw || 0);
  return !Number.isFinite(lastRenewed)
    || lastRenewed <= 0
    || at - lastRenewed >= SESSION_HEARTBEAT_INTERVAL_MS;
}

export function clearLocalWorkspaceSessionLease(
  workspaceId: string,
  uid: string
): void {
  const storage = browserStorage();
  storage?.removeItem(scopedKey(ACTIVE_LEASE_KEY_PREFIX, workspaceId, uid));
  storage?.removeItem(scopedKey(SESSION_ID_KEY_PREFIX, workspaceId, uid));
  storage?.removeItem(scopedKey(LAST_RENEWED_KEY_PREFIX, workspaceId, uid));
}
export function clearAllLocalWorkspaceSessionState(): void {
  const storage = browserStorage();
  if (!storage) return;

  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key
      && (
        key.startsWith(ACTIVE_LEASE_KEY_PREFIX)
        || key.startsWith(SESSION_ID_KEY_PREFIX)
        || key.startsWith(LAST_RENEWED_KEY_PREFIX)
      )
    ) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
}


function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

function leaseBelongsToLogicalSession(
  data: StoredWorkspaceSessionLeaseDocument,
  user: User,
  context: SectorWorkspaceContext,
  sessionId: string,
  browserInstanceId: string
): boolean {
  return data.leaseVersion === SESSION_LEASE_VERSION
    && data.workspaceId === context.workspaceId
    && data.ug === context.ug
    && data.uid === user.uid
    && normalizePlatformEmail(data.accountEmail || '') === normalizePlatformEmail(user.email || '')
    && data.sessionId === sessionId
    && data.browserInstanceId === browserInstanceId;
}

function isExpiredLease(
  data: StoredWorkspaceSessionLeaseDocument,
  at: number
): boolean {
  return !isTimestamp(data.expiresAt) || data.expiresAt.toMillis() <= at;
}

function validateExternalSessionContext(
  user: User,
  context: SectorWorkspaceContext
): string {
  if (
    context.resolutionSource !== 'platform-directory'
    || isFounderCapacityExempt(user.email)
  ) {
    throw new PlatformSessionLeaseError(
      'SESSION_INVALID_CONTEXT',
      'O controle de sessões só é aplicado a setores externos.'
    );
  }

  if (!context.ug) {
    throw new PlatformSessionLeaseError(
      'SESSION_UG_REQUIRED',
      'O setor precisa possuir uma UG válida antes de abrir uma sessão operacional.'
    );
  }

  if (!user.email) {
    throw new PlatformSessionLeaseError(
      'SESSION_INVALID_CONTEXT',
      'A sessão Firebase não possui e-mail operacional.'
    );
  }

  return context.ug;
}

export function isSessionCapacityExceededError(
  error: unknown
): error is PlatformSessionLeaseError {
  return error instanceof PlatformSessionLeaseError
    && error.code === 'SESSION_CAPACITY_EXCEEDED';
}

export function isTerminalSessionLeaseError(error: unknown): boolean {
  if (error instanceof PlatformSessionLeaseError) return true;

  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  return code.includes('permission-denied') || code.includes('unauthenticated');
}

export async function acquireWorkspaceSessionLease(
  user: User,
  context: SectorWorkspaceContext
): Promise<WorkspaceSessionLeaseAcquisition> {
  if (isFounderCapacityExempt(user.email)) {
    return { status: 'exempt', lease: null };
  }

  const ug = validateExternalSessionContext(user, context);
  const accountEmail = normalizePlatformEmail(user.email || '');
  const browserInstanceId = await getOrCreateBrowserInstanceId();
  const sessionId = await getOrCreateWorkspaceSessionId(context.workspaceId, user.uid);
  const nowMs = Date.now();

  const slotRefs = SESSION_SLOT_IDS.map((slotId) => ({
    slotId,
    ref: doc(db, 'workspaces', context.workspaceId, 'sessionSlots', slotId),
  }));
  const revocationRef = doc(
    db,
    'workspaces',
    context.workspaceId,
    'sessionRevocations',
    sessionId
  );

  const result = await runTransaction(db, async (transaction) => {
    const [revocationSnapshot, ...snapshots] = await Promise.all([
      transaction.get(revocationRef),
      ...slotRefs.map(({ ref }) => transaction.get(ref)),
    ]);

    if (revocationSnapshot.exists()) {
      const revocation = revocationSnapshot.data() as { expiresAt?: Timestamp };
      const stillRevoked = !isTimestamp(revocation.expiresAt)
        || revocation.expiresAt.toMillis() > nowMs;
      if (stillRevoked) {
        throw new PlatformSessionLeaseError(
          'SESSION_REVOKED',
          'Esta sessão foi encerrada pela administração. Faça login novamente.'
        );
      }
    }

    const candidates = snapshots.map((snapshot, index) => ({
      slotId: slotRefs[index].slotId,
      ref: slotRefs[index].ref,
      snapshot,
      data: snapshot.exists()
        ? snapshot.data() as StoredWorkspaceSessionLeaseDocument
        : null,
    }));

    const owned = candidates.find(({ data }) => (
      data
      && leaseBelongsToLogicalSession(
        data,
        user,
        context,
        sessionId,
        browserInstanceId
      )
    ));

    const available = owned || candidates.find(({ snapshot, data }) => (
      !snapshot.exists() || (data ? isExpiredLease(data, nowMs) : true)
    ));

    if (!available) {
      throw new PlatformSessionLeaseError(
        'SESSION_CAPACITY_EXCEEDED',
        SESSION_CAPACITY_EXCEEDED_MESSAGE
      );
    }

    const previous = available.data;
    const keepStartedAt = Boolean(
      previous
      && leaseBelongsToLogicalSession(
        previous,
        user,
        context,
        sessionId,
        browserInstanceId
      )
      && isTimestamp(previous.startedAt)
    );

    const expiresAt = Timestamp.fromMillis(nowMs + SESSION_LEASE_DURATION_MS);

    transaction.set(available.ref, {
      leaseVersion: SESSION_LEASE_VERSION,
      slotId: available.slotId,
      sessionId,
      workspaceId: context.workspaceId,
      ug,
      uid: user.uid,
      accountEmail,
      browserInstanceId,
      startedAt: keepStartedAt ? previous!.startedAt! : serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      expiresAt,
    });

    return {
      slotId: available.slotId,
      expiresAt,
      startedAt: keepStartedAt && previous?.startedAt
        ? previous.startedAt
        : Timestamp.fromMillis(nowMs),
    };
  });

  rememberLocalLease({
    workspaceId: context.workspaceId,
    uid: user.uid,
    slotId: result.slotId,
    sessionId,
    browserInstanceId,
  });
  markLeaseRenewed(context.workspaceId, user.uid, nowMs);

  const lease: WorkspaceSessionLease = {
    sessionId,
    workspaceId: context.workspaceId,
    ug,
    uid: user.uid,
    accountEmail,
    browserInstanceId,
    startedAt: result.startedAt.toDate().toISOString(),
    lastSeenAt: new Date(nowMs).toISOString(),
    expiresAt: result.expiresAt.toDate().toISOString(),
  };

  return {
    status: 'acquired',
    slotId: result.slotId,
    lease,
  };
}

export async function releaseWorkspaceSessionLease(
  user: User,
  context: SectorWorkspaceContext
): Promise<void> {
  if (isFounderCapacityExempt(user.email) || context.resolutionSource !== 'platform-directory') {
    return;
  }

  const local = getLocalLeaseRecord(context.workspaceId, user.uid);
  if (!local) {
    clearLocalWorkspaceSessionLease(context.workspaceId, user.uid);
    return;
  }

  const ref = doc(
    db,
    'workspaces',
    context.workspaceId,
    'sessionSlots',
    local.slotId
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;

    const data = snapshot.data() as StoredWorkspaceSessionLeaseDocument;
    if (
      data.uid === user.uid
      && data.sessionId === local.sessionId
      && data.browserInstanceId === local.browserInstanceId
      && data.workspaceId === context.workspaceId
    ) {
      transaction.delete(ref);
    }
  });

  clearLocalWorkspaceSessionLease(context.workspaceId, user.uid);
}

export function subscribeWorkspaceSessionRevocation(
  user: User,
  context: SectorWorkspaceContext,
  onRevoked: () => void,
  onError?: (error: unknown) => void
): () => void {
  if (isFounderCapacityExempt(user.email) || context.resolutionSource !== 'platform-directory') {
    return () => undefined;
  }

  const local = getLocalLeaseRecord(context.workspaceId, user.uid);
  if (!local) return () => undefined;

  const ref = doc(
    db,
    'workspaces',
    context.workspaceId,
    'sessionRevocations',
    local.sessionId
  );

  let firstSnapshot = true;
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        firstSnapshot = false;
        return;
      }

      const data = snapshot.data() as { expiresAt?: Timestamp };
      const activeRevocation = !isTimestamp(data.expiresAt)
        || data.expiresAt.toMillis() > Date.now();

      if (activeRevocation && !firstSnapshot) {
        onRevoked();
        return;
      }
      if (activeRevocation && firstSnapshot) {
        onRevoked();
      }
      firstSnapshot = false;
    },
    (error) => onError?.(error)
  );

  return unsubscribe;
}

export async function renewWorkspaceSessionLeaseIfDue(
  user: User,
  context: SectorWorkspaceContext
): Promise<WorkspaceSessionLeaseAcquisition | null> {
  if (isFounderCapacityExempt(user.email) || context.resolutionSource !== 'platform-directory') {
    return null;
  }

  if (!shouldRenewWorkspaceSessionLease(context.workspaceId, user.uid)) {
    return null;
  }

  return acquireWorkspaceSessionLease(user, context);
}

export function getConfiguredExternalSessionLimit(): number {
  return DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT;
}
