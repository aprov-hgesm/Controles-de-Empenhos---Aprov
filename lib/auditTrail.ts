import {
  collection,
  doc,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import type { OperationalDataScope } from './operationalPaths';
import { normalizePlatformEmail } from './platformIdentity';

export const AUDIT_EVENT_VERSION = 'emprovex_audit_v1';

export type AuditEventSource =
  | 'sag'
  | 'manual'
  | 'migration'
  | 'system'
  | 'admin';

export type AuditOperation =
  | 'ns.assign'
  | 'ns.replace'
  | 'ns.remove'
  | 'invoice.identity_migrate'
  | 'invoice.delete'
  | 'invoice.bulk_delete'
  | 'supplier_cnpj.migrate'
  | 'sector.create'
  | 'sector.profile_update'
  | 'sector.status_change'
  | 'sector.ug_backfill'
  | 'sector.password_reset'
  | 'sector.delete';

export type AuditEntityType =
  | 'invoice'
  | 'invoice_batch'
  | 'empenho'
  | 'workspace';

export type AuditScalar = string | number | boolean | null;
export type AuditValue =
  | AuditScalar
  | AuditScalar[]
  | { [key: string]: AuditValue };

export type AuditMap = Record<string, AuditValue>;

export interface WorkspaceAuditEventInput {
  operation: AuditOperation;
  source: AuditEventSource;
  entityType: AuditEntityType;
  entityId: string;
  correlationId: string;
  before?: AuditMap;
  after?: AuditMap;
  metadata?: AuditMap;
}

export interface PlatformAuditEventInput extends WorkspaceAuditEventInput {
  workspaceId: string;
  ug?: string | null;
  actorEmail: string;
}

function sanitizeAuditValue(value: unknown): AuditValue | undefined {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .map((entry) => sanitizeAuditValue(entry))
      .filter((entry): entry is AuditValue => entry !== undefined);
    return sanitized as AuditValue;
  }

  if (typeof value === 'object' && value) {
    const result: AuditMap = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeAuditValue(entry);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }

  return undefined;
}

export function sanitizeAuditMap(value?: Record<string, unknown> | AuditMap): AuditMap {
  if (!value) return {};
  const sanitized = sanitizeAuditValue(value);
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === 'object'
    ? sanitized as AuditMap
    : {};
}

function assertAuditActor(expectedUid?: string): { uid: string; email: string } {
  const user = auth.currentUser;
  if (!user?.uid || !user.email) {
    throw new Error('A trilha de auditoria exige uma sessão Firebase autenticada.');
  }
  if (expectedUid && user.uid !== expectedUid) {
    throw new Error('A sessão mudou antes da gravação do evento de auditoria.');
  }
  return {
    uid: user.uid,
    email: normalizePlatformEmail(user.email),
  };
}

export function createWorkspaceAuditCorrelationId(scope: OperationalDataScope): string {
  return doc(collection(db, 'workspaces', scope.workspaceId, 'auditEvents')).id;
}

export function appendWorkspaceAuditEvent(
  transaction: Transaction,
  scope: OperationalDataScope,
  input: WorkspaceAuditEventInput,
  expectedUid?: string
): string {
  const actor = assertAuditActor(expectedUid);
  const ref = doc(collection(db, 'workspaces', scope.workspaceId, 'auditEvents'));

  transaction.set(ref, {
    eventVersion: AUDIT_EVENT_VERSION,
    eventId: ref.id,
    workspaceId: scope.workspaceId,
    ug: scope.ug || null,
    operation: input.operation,
    source: input.source,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    actorUid: actor.uid,
    actorEmail: actor.email,
    before: sanitizeAuditMap(input.before),
    after: sanitizeAuditMap(input.after),
    metadata: sanitizeAuditMap(input.metadata),
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export function createPlatformAuditCorrelationId(): string {
  return doc(collection(db, 'platformAuditEvents')).id;
}

export function appendPlatformAuditEvent(
  transaction: Transaction,
  input: PlatformAuditEventInput
): string {
  const actor = assertAuditActor();
  const actorEmail = normalizePlatformEmail(input.actorEmail);
  if (actor.email !== actorEmail) {
    throw new Error('O ator informado não corresponde à sessão administrativa atual.');
  }

  const ref = doc(collection(db, 'platformAuditEvents'));
  transaction.set(ref, {
    eventVersion: AUDIT_EVENT_VERSION,
    eventId: ref.id,
    workspaceId: input.workspaceId,
    ug: input.ug || null,
    operation: input.operation,
    source: input.source,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    actorUid: actor.uid,
    actorEmail,
    before: sanitizeAuditMap(input.before),
    after: sanitizeAuditMap(input.after),
    metadata: sanitizeAuditMap(input.metadata),
    createdAt: serverTimestamp(),
  });

  return ref.id;
}
