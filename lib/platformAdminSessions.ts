'use client';

import {
  Timestamp,
  collectionGroup,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  SESSION_REVOCATION_TTL_MS,
  SESSION_REVOCATION_VERSION,
  SESSION_SLOT_IDS,
  type WorkspaceSessionSlotId,
} from './platformCapacity';
import {
  appendPlatformAuditEvent,
  createPlatformAuditCorrelationId,
} from './auditTrail';
import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import { normalizePlatformEmail, normalizeUnitUg } from './platformIdentity';

export interface AdminWorkspaceSession {
  slotId: WorkspaceSessionSlotId;
  sessionId: string;
  workspaceId: string;
  ug: string;
  uid: string;
  accountEmail: string;
  browserInstanceId: string;
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

export function isAdminWorkspaceSessionActive(
  session: AdminWorkspaceSession,
  at = Date.now()
): boolean {
  const expires = Date.parse(session.expiresAt);
  return Number.isFinite(expires) && expires > at;
}

export function subscribePlatformAdminSessions(
  onChange: (sessions: AdminWorkspaceSession[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collectionGroup(db, 'sessionSlots'),
    (snapshot) => {
      const sessions = snapshot.docs
        .map((item) => {
          const data = item.data() as Record<string, unknown>;
          const slotId = String(data.slotId || '') as WorkspaceSessionSlotId;
          if (!SESSION_SLOT_IDS.includes(slotId)) return null;

          return {
            slotId,
            sessionId: String(data.sessionId || ''),
            workspaceId: String(data.workspaceId || ''),
            ug: normalizeUnitUg(String(data.ug || '')),
            uid: String(data.uid || ''),
            accountEmail: normalizePlatformEmail(String(data.accountEmail || '')),
            browserInstanceId: String(data.browserInstanceId || ''),
            startedAt: toIso(data.startedAt),
            lastSeenAt: toIso(data.lastSeenAt),
            expiresAt: toIso(data.expiresAt),
          } satisfies AdminWorkspaceSession;
        })
        .filter((session): session is AdminWorkspaceSession => Boolean(
          session
          && session.sessionId
          && session.workspaceId
          && session.uid
          && session.accountEmail
        ))
        .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

      onChange(sessions);
    },
    (error) => onError(error)
  );
}

export async function terminatePlatformWorkspaceSession(
  session: AdminWorkspaceSession,
  actorEmailInput: string
): Promise<void> {
  const actorEmail = normalizePlatformEmail(actorEmailInput);
  if (actorEmail !== HGESM_SECTOR_EMAIL) {
    throw new Error('A sessão atual não possui permissão para encerrar acessos.');
  }

  const slotRef = doc(
    db,
    'workspaces',
    session.workspaceId,
    'sessionSlots',
    session.slotId
  );
  const revocationRef = doc(
    db,
    'workspaces',
    session.workspaceId,
    'sessionRevocations',
    session.sessionId
  );
  const correlationId = createPlatformAuditCorrelationId();

  await runTransaction(db, async (transaction) => {
    const slotSnapshot = await transaction.get(slotRef);
    if (!slotSnapshot.exists()) return;

    const current = slotSnapshot.data() as Record<string, unknown>;
    if (
      String(current.sessionId || '') !== session.sessionId
      || String(current.uid || '') !== session.uid
      || String(current.workspaceId || '') !== session.workspaceId
      || normalizeUnitUg(String(current.ug || '')) !== session.ug
    ) {
      throw new Error('A sessão mudou antes do encerramento administrativo.');
    }

    transaction.set(revocationRef, {
      revocationVersion: SESSION_REVOCATION_VERSION,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      ug: session.ug,
      uid: session.uid,
      accountEmail: session.accountEmail,
      slotId: session.slotId,
      createdAt: serverTimestamp(),
      createdBy: actorEmail,
      expiresAt: Timestamp.fromMillis(Date.now() + SESSION_REVOCATION_TTL_MS),
    });

    transaction.delete(slotRef);

    appendPlatformAuditEvent(transaction, {
      operation: 'session.terminate',
      source: 'admin',
      entityType: 'session',
      entityId: session.sessionId,
      correlationId,
      workspaceId: session.workspaceId,
      ug: session.ug || null,
      actorEmail,
      before: {
        slotId: session.slotId,
        uid: session.uid,
        accountEmail: session.accountEmail,
        browserInstanceId: session.browserInstanceId,
        expiresAt: session.expiresAt,
      },
      after: {
        status: 'revoked',
      },
      metadata: {
        reason: 'admin_remote_termination',
      },
    });
  });
}
