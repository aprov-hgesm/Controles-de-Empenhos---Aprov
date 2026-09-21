'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { db } from './firebase';
import {
  operationalCollectionRef,
  operationalDocRef,
  operationalScopeFromContext,
  operationalSettingsDocRef,
  type OperationalCollectionName,
} from './operationalPaths';
import {
  buildNsLockDocument,
  normalizeNsNumber,
  normalizeNsUg,
} from './nsIntegrity';
import type { SectorWorkspaceContext } from './workspaceContext';
import type { WorkspaceDriveSettings } from './workspaceDriveSettings';
import type { WorkspaceGoogleDriveSession } from './googleDriveWorkspace';
import {
  deleteBackupFile,
  ensureWorkspaceBackupFolder,
  fetchBackupBlob,
  listWorkspaceBackupFiles,
  uploadBackupBlob,
  type WorkspaceBackupDriveFile,
} from './workspaceBackupDrive';

export const WORKSPACE_BACKUP_FORMAT = 'emprovex-workspace-backup' as const;
export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_BACKUP_RETENTION_COUNT = 30;
export const WORKSPACE_BACKUP_AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const WORKSPACE_BACKUP_LEASE_MS = 5 * 60 * 1000;
export const WORKSPACE_BACKUP_STATUS_COLLECTION = 'workspaceBackupStatus';
export const WORKSPACE_BACKUP_LEASE_SETTINGS_ID = 'backupLease';

export const WORKSPACE_BACKUP_COLLECTIONS = [
  'empenhos',
  'alerts',
  'invoices',
  'comissoes',
  'cronogramas',
] as const satisfies readonly OperationalCollectionName[];

export const WORKSPACE_BACKUP_SETTINGS_IDS = [
  'termoRecebimentoCounter',
  'empenhoClasses',
] as const;

export const WORKSPACE_BACKUP_EXCLUDED_SETTINGS = [
  'documentStorage',
  'homeSnapshot',
  WORKSPACE_BACKUP_LEASE_SETTINGS_ID,
] as const;

export type WorkspaceBackupTrigger = 'automatic' | 'manual';

type JsonScalar = string | number | boolean | null;
type BackupJsonValue =
  | JsonScalar
  | BackupJsonValue[]
  | { [key: string]: BackupJsonValue };

export interface BackupDocument {
  id: string;
  data: BackupJsonValue;
}

export interface WorkspaceBackupPayload {
  format: typeof WORKSPACE_BACKUP_FORMAT;
  schemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION;
  createdAt: string;
  appVersion: 'commercial-readiness-v1';
  workspace: {
    id: string;
    ug: string;
    accountEmail: string;
  };
  createdBy: {
    uid: string;
    email: string;
  };
  collections: Record<(typeof WORKSPACE_BACKUP_COLLECTIONS)[number], BackupDocument[]>;
  settings: BackupDocument[];
  statistics: {
    recordCount: number;
    collectionCounts: Record<string, number>;
    pdfBytesIncluded: false;
  };
}

export interface WorkspaceBackupEnvelope {
  payload: WorkspaceBackupPayload;
  integrity: {
    algorithm: 'SHA-256';
    sha256: string;
  };
}

export interface WorkspaceBackupStatus {
  workspaceId: string;
  ug: string;
  accountEmail: string;
  status: 'success' | 'failed' | 'in_progress';
  lastAttemptAt: string;
  lastSuccessAt: string;
  latestFileId: string;
  latestFileName: string;
  sizeBytes: number;
  recordCount: number;
  schemaVersion: number;
  sha256: string;
  trigger: WorkspaceBackupTrigger;
  lastError: string;
  updatedBy: string;
}

export interface WorkspaceRestorePlan {
  workspaceId: string;
  ug: string;
  backupCreatedAt: string;
  fileId: string;
  integrityValid: true;
  collectionCounts: Record<string, { backup: number; missing: number; existing: number }>;
  settings: { backup: number; missing: number; existing: number };
  totalMissing: number;
  totalExisting: number;
}

export interface WorkspaceRestoreResult {
  restored: Record<string, number>;
  skippedExisting: Record<string, number>;
  totalRestored: number;
  totalSkippedExisting: number;
}

interface BackupLease {
  leaseId: string;
  ownerUid: string;
  acquiredAt: string;
  expiresAtMs: number;
}

function statusDocRef(workspaceId: string) {
  return doc(db, WORKSPACE_BACKUP_STATUS_COLLECTION, workspaceId);
}

function encodeBackupValue(value: unknown): BackupJsonValue {
  if (value === null) return null;
  if (value === undefined) return null;
  if (value instanceof Timestamp) {
    return {
      __emprovexType: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (value instanceof Date) {
    return {
      __emprovexType: 'date',
      iso: value.toISOString(),
    };
  }
  if (Array.isArray(value)) return value.map(encodeBackupValue);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, BackupJsonValue> = {};
    for (const key of Object.keys(source).sort()) {
      const candidate = source[key];
      if (candidate === undefined || typeof candidate === 'function') continue;
      result[key] = encodeBackupValue(candidate);
    }
    return result;
  }
  return String(value);
}

function decodeBackupValue(value: BackupJsonValue): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(decodeBackupValue);

  const record = value as Record<string, BackupJsonValue>;
  if (record.__emprovexType === 'timestamp') {
    const seconds = Number(record.seconds || 0);
    const nanoseconds = Number(record.nanoseconds || 0);
    return new Timestamp(seconds, nanoseconds);
  }
  if (record.__emprovexType === 'date' && typeof record.iso === 'string') {
    return new Date(record.iso);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, decodeBackupValue(item)])
  );
}

function stableStringify(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate && typeof candidate === 'object') {
      return Object.fromEntries(
        Object.entries(candidate as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)])
      );
    }
    return candidate;
  };
  return JSON.stringify(normalize(value));
}

async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function gzipText(value: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') {
    return new Blob([value], { type: 'application/json' });
  }
  const stream = new Blob([value], { type: 'application/json' })
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' });
}

async function blobToText(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const looksGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  if (!looksGzip) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não suporta descompactação gzip necessária para restaurar o backup.');
  }

  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function assertWorkspaceIdentity(
  context: SectorWorkspaceContext,
  payload: WorkspaceBackupPayload
): void {
  if (payload.workspace.id !== context.workspaceId) {
    throw new Error('Este backup pertence a outro workspace e não pode ser restaurado aqui.');
  }
  const expectedUg = String(context.ug || '').replace(/\D/g, '');
  const backupUg = String(payload.workspace.ug || '').replace(/\D/g, '');
  if (!expectedUg || backupUg !== expectedUg) {
    throw new Error('A UG do backup não corresponde à UG do workspace autenticado.');
  }
}

async function readCollectionBackup(
  context: SectorWorkspaceContext,
  collectionName: (typeof WORKSPACE_BACKUP_COLLECTIONS)[number]
): Promise<BackupDocument[]> {
  const scope = operationalScopeFromContext(context);
  const snapshot = await getDocs(operationalCollectionRef(scope, collectionName));
  return snapshot.docs.map((item) => ({
    id: item.id,
    data: encodeBackupValue(item.data()),
  }));
}

async function readSettingsBackup(
  context: SectorWorkspaceContext
): Promise<BackupDocument[]> {
  const scope = operationalScopeFromContext(context);
  const result: BackupDocument[] = [];

  for (const settingsId of WORKSPACE_BACKUP_SETTINGS_IDS) {
    const snapshot = await getDoc(operationalSettingsDocRef(scope, settingsId));
    if (snapshot.exists()) {
      result.push({
        id: settingsId,
        data: encodeBackupValue(snapshot.data()),
      });
    }
  }
  return result;
}

async function buildPayload(
  user: User,
  context: SectorWorkspaceContext
): Promise<WorkspaceBackupPayload> {
  const entries = await Promise.all(
    WORKSPACE_BACKUP_COLLECTIONS.map(async (collectionName) => [
      collectionName,
      await readCollectionBackup(context, collectionName),
    ] as const)
  );
  const settings = await readSettingsBackup(context);
  const collections = Object.fromEntries(entries) as WorkspaceBackupPayload['collections'];
  const collectionCounts = Object.fromEntries(
    entries.map(([name, documents]) => [name, documents.length])
  );
  const recordCount = Object.values(collections)
    .reduce((total, documents) => total + documents.length, 0)
    + settings.length;

  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: 'commercial-readiness-v1',
    workspace: {
      id: context.workspaceId,
      ug: String(context.ug || ''),
      accountEmail: context.email,
    },
    createdBy: {
      uid: user.uid,
      email: user.email || context.email,
    },
    collections,
    settings,
    statistics: {
      recordCount,
      collectionCounts,
      pdfBytesIncluded: false,
    },
  };
}

async function envelopeForPayload(
  payload: WorkspaceBackupPayload
): Promise<WorkspaceBackupEnvelope> {
  const sha256 = await sha256Text(stableStringify(payload));
  return {
    payload,
    integrity: {
      algorithm: 'SHA-256',
      sha256,
    },
  };
}

function parseEnvelope(value: unknown): WorkspaceBackupEnvelope {
  if (!value || typeof value !== 'object') {
    throw new Error('O arquivo selecionado não contém um backup EMPROVEX válido.');
  }
  const envelope = value as Partial<WorkspaceBackupEnvelope>;
  const payload = envelope.payload;

  if (
    !payload
    || payload.format !== WORKSPACE_BACKUP_FORMAT
    || payload.schemaVersion !== WORKSPACE_BACKUP_SCHEMA_VERSION
    || !envelope.integrity
    || envelope.integrity.algorithm !== 'SHA-256'
    || typeof envelope.integrity.sha256 !== 'string'
  ) {
    throw new Error('O backup possui formato ou versão incompatível com esta versão do EMPROVEX.');
  }

  return envelope as WorkspaceBackupEnvelope;
}

async function validateEnvelope(
  envelope: WorkspaceBackupEnvelope
): Promise<void> {
  const calculated = await sha256Text(stableStringify(envelope.payload));
  if (calculated !== envelope.integrity.sha256) {
    throw new Error('A verificação SHA-256 falhou. O backup pode estar corrompido ou ter sido alterado.');
  }
}

export async function readWorkspaceBackupFromDrive(
  session: WorkspaceGoogleDriveSession,
  context: SectorWorkspaceContext,
  fileId: string
): Promise<WorkspaceBackupEnvelope> {
  const blob = await fetchBackupBlob(session, fileId);
  const text = await blobToText(blob);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('O arquivo de backup contém JSON inválido.');
  }

  const envelope = parseEnvelope(parsed);
  await validateEnvelope(envelope);
  assertWorkspaceIdentity(context, envelope.payload);
  return envelope;
}

async function acquireBackupLease(
  user: User,
  context: SectorWorkspaceContext
): Promise<BackupLease | null> {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_BACKUP_LEASE_SETTINGS_ID);
  const leaseId = crypto.randomUUID();
  const now = Date.now();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? snapshot.data() as Partial<BackupLease> : null;
    if (
      current
      && typeof current.expiresAtMs === 'number'
      && current.expiresAtMs > now
    ) {
      return null;
    }

    const lease: BackupLease = {
      leaseId,
      ownerUid: user.uid,
      acquiredAt: new Date(now).toISOString(),
      expiresAtMs: now + WORKSPACE_BACKUP_LEASE_MS,
    };
    transaction.set(ref, lease, { merge: false });
    return lease;
  });
}

async function releaseBackupLease(
  context: SectorWorkspaceContext,
  lease: BackupLease
): Promise<void> {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_BACKUP_LEASE_SETTINGS_ID);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    if (snapshot.data()?.leaseId === lease.leaseId) {
      transaction.delete(ref);
    }
  }).catch(() => undefined);
}

export async function getWorkspaceBackupStatus(
  context: SectorWorkspaceContext
): Promise<WorkspaceBackupStatus | null> {
  const snapshot = await getDoc(statusDocRef(context.workspaceId));
  return snapshot.exists() ? snapshot.data() as WorkspaceBackupStatus : null;
}

export async function isAutomaticWorkspaceBackupDue(
  context: SectorWorkspaceContext,
  nowMs: number = Date.now()
): Promise<boolean> {
  const status = await getWorkspaceBackupStatus(context);
  if (!status?.lastSuccessAt) return true;
  const lastSuccess = Date.parse(status.lastSuccessAt);
  return !Number.isFinite(lastSuccess)
    || nowMs - lastSuccess >= WORKSPACE_BACKUP_AUTO_INTERVAL_MS;
}

async function writeFailureStatus(
  user: User,
  context: SectorWorkspaceContext,
  trigger: WorkspaceBackupTrigger,
  error: unknown
): Promise<void> {
  const current = await getWorkspaceBackupStatus(context).catch(() => null);
  const now = new Date().toISOString();
  const status: WorkspaceBackupStatus = {
    workspaceId: context.workspaceId,
    ug: String(context.ug || ''),
    accountEmail: context.email,
    status: 'failed',
    lastAttemptAt: now,
    lastSuccessAt: current?.lastSuccessAt || '',
    latestFileId: current?.latestFileId || '',
    latestFileName: current?.latestFileName || '',
    sizeBytes: current?.sizeBytes || 0,
    recordCount: current?.recordCount || 0,
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    sha256: current?.sha256 || '',
    trigger,
    lastError: error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida ao gerar backup.',
    updatedBy: user.uid,
  };
  await setDoc(statusDocRef(context.workspaceId), status, { merge: false }).catch(() => undefined);
}

async function enforceRetention(
  session: WorkspaceGoogleDriveSession,
  folderId: string
): Promise<WorkspaceBackupDriveFile[]> {
  const files = await listWorkspaceBackupFiles(session, folderId);
  const obsolete = files.slice(WORKSPACE_BACKUP_RETENTION_COUNT);
  await Promise.all(obsolete.map((file) => deleteBackupFile(session, file.id)));
  return files.slice(0, WORKSPACE_BACKUP_RETENTION_COUNT);
}

export async function createWorkspaceBackup(input: {
  user: User;
  context: SectorWorkspaceContext;
  session: WorkspaceGoogleDriveSession;
  settings: WorkspaceDriveSettings;
  trigger: WorkspaceBackupTrigger;
}): Promise<{ file: WorkspaceBackupDriveFile; status: WorkspaceBackupStatus }> {
  const { user, context, session, settings, trigger } = input;
  if (session.workspaceId !== context.workspaceId || settings.workspaceId !== context.workspaceId) {
    throw new Error('A autorização do Drive não pertence ao workspace que será protegido.');
  }

  if (trigger === 'automatic' && !(await isAutomaticWorkspaceBackupDue(context))) {
    const current = await getWorkspaceBackupStatus(context);
    if (!current) throw new Error('O estado do backup mudou durante a verificação automática.');
    return {
      file: {
        id: current.latestFileId,
        name: current.latestFileName,
        size: current.sizeBytes,
        mimeType: 'application/gzip',
        createdTime: current.lastSuccessAt,
      },
      status: current,
    };
  }

  const lease = await acquireBackupLease(user, context);
  if (!lease) {
    throw new Error('Já existe um backup deste workspace em andamento.');
  }

  try {
    const startedAt = new Date().toISOString();
    const previous = await getWorkspaceBackupStatus(context).catch(() => null);
    await setDoc(statusDocRef(context.workspaceId), {
      workspaceId: context.workspaceId,
      ug: String(context.ug || ''),
      accountEmail: context.email,
      status: 'in_progress',
      lastAttemptAt: startedAt,
      lastSuccessAt: previous?.lastSuccessAt || '',
      latestFileId: previous?.latestFileId || '',
      latestFileName: previous?.latestFileName || '',
      sizeBytes: previous?.sizeBytes || 0,
      recordCount: previous?.recordCount || 0,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      sha256: previous?.sha256 || '',
      trigger,
      lastError: '',
      updatedBy: user.uid,
    } satisfies WorkspaceBackupStatus, { merge: false });

    const payload = await buildPayload(user, context);
    const envelope = await envelopeForPayload(payload);
    const serialized = stableStringify(envelope);
    const blob = await gzipText(serialized);
    const isGzip = blob.type === 'application/gzip';
    const timestamp = payload.createdAt.replace(/[-:.]/g, '').replace('Z', 'Z');
    const fileName = `emprovex-backup-${context.ug || context.workspaceId}-${timestamp}.${isGzip ? 'json.gz' : 'json'}`;

    const folderId = await ensureWorkspaceBackupFolder(session, settings.rootFolderId);
    const file = await uploadBackupBlob(
      session,
      folderId,
      blob,
      fileName,
      {
        emprovexFileType: 'workspace-backup',
        schemaVersion: String(WORKSPACE_BACKUP_SCHEMA_VERSION),
        sha256: envelope.integrity.sha256,
        createdAt: payload.createdAt,
      }
    );

    const verified = await readWorkspaceBackupFromDrive(session, context, file.id);
    if (verified.integrity.sha256 !== envelope.integrity.sha256) {
      throw new Error('O arquivo enviado ao Google Drive diverge do backup original.');
    }

    await enforceRetention(session, folderId);

    const status: WorkspaceBackupStatus = {
      workspaceId: context.workspaceId,
      ug: String(context.ug || ''),
      accountEmail: context.email,
      status: 'success',
      lastAttemptAt: payload.createdAt,
      lastSuccessAt: payload.createdAt,
      latestFileId: file.id,
      latestFileName: file.name,
      sizeBytes: file.size,
      recordCount: payload.statistics.recordCount,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      sha256: envelope.integrity.sha256,
      trigger,
      lastError: '',
      updatedBy: user.uid,
    };
    await setDoc(statusDocRef(context.workspaceId), status, { merge: false });
    return { file, status };
  } catch (error) {
    await writeFailureStatus(user, context, trigger, error);
    throw error;
  } finally {
    await releaseBackupLease(context, lease);
  }
}

export async function listWorkspaceBackupHistory(input: {
  context: SectorWorkspaceContext;
  session: WorkspaceGoogleDriveSession;
  settings: WorkspaceDriveSettings;
}): Promise<WorkspaceBackupDriveFile[]> {
  const folderId = await ensureWorkspaceBackupFolder(input.session, input.settings.rootFolderId);
  return listWorkspaceBackupFiles(input.session, folderId);
}

function decodedDocumentData(document: BackupDocument): DocumentData {
  const decoded = decodeBackupValue(document.data);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error(`O documento ${document.id} possui estrutura inválida no backup.`);
  }
  return decoded as DocumentData;
}

async function existingIds(
  context: SectorWorkspaceContext,
  collectionName: (typeof WORKSPACE_BACKUP_COLLECTIONS)[number]
): Promise<Set<string>> {
  const scope = operationalScopeFromContext(context);
  const snapshot = await getDocs(operationalCollectionRef(scope, collectionName));
  return new Set(snapshot.docs.map((item) => item.id));
}

export async function planWorkspaceRestore(input: {
  context: SectorWorkspaceContext;
  session: WorkspaceGoogleDriveSession;
  fileId: string;
}): Promise<WorkspaceRestorePlan> {
  const envelope = await readWorkspaceBackupFromDrive(input.session, input.context, input.fileId);
  const collectionCounts: WorkspaceRestorePlan['collectionCounts'] = {};
  let totalMissing = 0;
  let totalExisting = 0;

  for (const collectionName of WORKSPACE_BACKUP_COLLECTIONS) {
    const ids = await existingIds(input.context, collectionName);
    const documents = envelope.payload.collections[collectionName] || [];
    const existing = documents.filter((item) => ids.has(item.id)).length;
    const missing = documents.length - existing;
    collectionCounts[collectionName] = {
      backup: documents.length,
      missing,
      existing,
    };
    totalMissing += missing;
    totalExisting += existing;
  }

  const scope = operationalScopeFromContext(input.context);
  let missingSettings = 0;
  let existingSettings = 0;
  for (const item of envelope.payload.settings) {
    const snapshot = await getDoc(operationalSettingsDocRef(scope, item.id));
    if (snapshot.exists()) existingSettings += 1;
    else missingSettings += 1;
  }
  totalMissing += missingSettings;
  totalExisting += existingSettings;

  return {
    workspaceId: input.context.workspaceId,
    ug: String(input.context.ug || ''),
    backupCreatedAt: envelope.payload.createdAt,
    fileId: input.fileId,
    integrityValid: true,
    collectionCounts,
    settings: {
      backup: envelope.payload.settings.length,
      missing: missingSettings,
      existing: existingSettings,
    },
    totalMissing,
    totalExisting,
  };
}

async function restoreSimpleCollection(
  user: User,
  context: SectorWorkspaceContext,
  collectionName: 'comissoes' | 'alerts' | 'cronogramas',
  documents: BackupDocument[]
): Promise<{ restored: number; skipped: number }> {
  const scope = operationalScopeFromContext(context);
  const ids = await existingIds(context, collectionName);
  const missing = documents.filter((item) => !ids.has(item.id));
  let restored = 0;

  for (let offset = 0; offset < missing.length; offset += 100) {
    const chunk = missing.slice(offset, offset + 100);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const data = decodedDocumentData(item);
      batch.set(operationalDocRef(scope, collectionName, item.id), {
        ...data,
        userId: data.userId || user.uid,
      });
    }
    await batch.commit();
    restored += chunk.length;
  }

  return { restored, skipped: documents.length - restored };
}

async function restoreEmpenhos(
  user: User,
  context: SectorWorkspaceContext,
  documents: BackupDocument[]
): Promise<{ restored: number; skipped: number }> {
  const scope = operationalScopeFromContext(context);
  const ids = await existingIds(context, 'empenhos');
  const missing = documents.filter((item) => !ids.has(item.id));
  let restored = 0;

  for (let offset = 0; offset < missing.length; offset += 100) {
    const chunk = missing.slice(offset, offset + 100);
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const item of chunk) {
      const data = decodedDocumentData(item);
      batch.set(operationalDocRef(scope, 'empenhos', item.id), {
        ...data,
        id: item.id,
        revision: 1,
        updatedAt: now,
        updatedBy: user.uid,
        userId: data.userId || user.uid,
      });
    }
    await batch.commit();
    restored += chunk.length;
  }

  return { restored, skipped: documents.length - restored };
}

async function restoreInvoices(
  user: User,
  context: SectorWorkspaceContext,
  documents: BackupDocument[]
): Promise<{ restored: number; skipped: number }> {
  const scope = operationalScopeFromContext(context);
  const ids = await existingIds(context, 'invoices');
  const missing = documents.filter((item) => !ids.has(item.id));
  let restored = 0;

  for (const item of missing) {
    const data = decodedDocumentData(item);
    const invoice = {
      ...data,
      recordKey: item.id,
      userId: data.userId || user.uid,
    } as DocumentData;

    const numeroNS = normalizeNsNumber(invoice.numeroNS as string | undefined);
    if (!numeroNS) {
      await setDoc(operationalDocRef(scope, 'invoices', item.id), invoice, { merge: false });
      restored += 1;
      continue;
    }

    const ug = normalizeNsUg(context.ug);
    const supplierCnpj = String(invoice.supplierCnpj || '');
    const invoiceId = String(invoice.id || '');
    const empenhoId = String(invoice.empenhoId || '');
    if (!ug || !supplierCnpj || !invoiceId || !empenhoId) {
      throw new Error(`A NF ${item.id} possui NS, mas faltam dados necessários para reconstruir sua reserva de integridade.`);
    }

    invoice.nsUg = ug;
    const now = new Date().toISOString();
    const lock = buildNsLockDocument({
      workspaceId: context.workspaceId,
      mutation: {
        invoiceRecordKey: item.id,
        invoiceId,
        empenhoId,
        supplierCnpj,
        expectedCurrentUg: null,
        expectedCurrentNs: null,
        proposedUg: ug,
        proposedNs: numeroNS,
        source: 'system',
      },
      userId: user.uid,
      createdAt: now,
      updatedAt: now,
    });

    const batch = writeBatch(db);
    batch.set(operationalDocRef(scope, 'invoices', item.id), invoice, { merge: false });
    batch.set(operationalSettingsDocRef(scope, lock.id), lock, { merge: false });
    await batch.commit();
    restored += 1;
  }

  return { restored, skipped: documents.length - restored };
}

async function restoreSettingsMissingOnly(
  context: SectorWorkspaceContext,
  settings: BackupDocument[]
): Promise<{ restored: number; skipped: number }> {
  const scope = operationalScopeFromContext(context);
  let restored = 0;
  let skipped = 0;

  for (const item of settings) {
    if (!WORKSPACE_BACKUP_SETTINGS_IDS.includes(item.id as (typeof WORKSPACE_BACKUP_SETTINGS_IDS)[number])) {
      continue;
    }
    const ref = operationalSettingsDocRef(scope, item.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      skipped += 1;
      continue;
    }

    const data = decodedDocumentData(item);
    if (item.id === 'termoRecebimentoCounter') {
      const target = Math.max(0, Math.floor(Number(data.currentNumber || 0)));
      await setDoc(ref, { currentNumber: 0 }, { merge: false });
      if (target > 0) await setDoc(ref, { currentNumber: target }, { merge: true });
    } else {
      await setDoc(ref, data, { merge: false });
    }
    restored += 1;
  }

  return { restored, skipped };
}

export async function restoreWorkspaceBackupMissingOnly(input: {
  user: User;
  context: SectorWorkspaceContext;
  session: WorkspaceGoogleDriveSession;
  fileId: string;
}): Promise<WorkspaceRestoreResult> {
  const envelope = await readWorkspaceBackupFromDrive(input.session, input.context, input.fileId);
  const restored: Record<string, number> = {};
  const skippedExisting: Record<string, number> = {};

  const empenhos = await restoreEmpenhos(
    input.user,
    input.context,
    envelope.payload.collections.empenhos || []
  );
  restored.empenhos = empenhos.restored;
  skippedExisting.empenhos = empenhos.skipped;

  const invoices = await restoreInvoices(
    input.user,
    input.context,
    envelope.payload.collections.invoices || []
  );
  restored.invoices = invoices.restored;
  skippedExisting.invoices = invoices.skipped;

  for (const collectionName of ['comissoes', 'alerts', 'cronogramas'] as const) {
    const result = await restoreSimpleCollection(
      input.user,
      input.context,
      collectionName,
      envelope.payload.collections[collectionName] || []
    );
    restored[collectionName] = result.restored;
    skippedExisting[collectionName] = result.skipped;
  }

  const settingsResult = await restoreSettingsMissingOnly(
    input.context,
    envelope.payload.settings
  );
  restored.settings = settingsResult.restored;
  skippedExisting.settings = settingsResult.skipped;

  return {
    restored,
    skippedExisting,
    totalRestored: Object.values(restored).reduce((sum, count) => sum + count, 0),
    totalSkippedExisting: Object.values(skippedExisting).reduce((sum, count) => sum + count, 0),
  };
}

export async function removeObsoleteWorkspaceBackupLease(
  context: SectorWorkspaceContext
): Promise<void> {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_BACKUP_LEASE_SETTINGS_ID);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const expiresAtMs = Number(snapshot.data()?.expiresAtMs || 0);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await deleteDoc(ref);
  }
}

export async function countWorkspaceBackupMetadata(): Promise<number> {
  const snapshot = await getDocs(collection(db, WORKSPACE_BACKUP_STATUS_COLLECTION));
  return snapshot.size;
}
