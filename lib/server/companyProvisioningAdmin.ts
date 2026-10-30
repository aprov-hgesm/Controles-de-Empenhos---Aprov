import { createHash, randomUUID } from 'node:crypto';

import firebaseConfig from '../../firebase-applet-config.json';
import {
  buildProvisionedCompanyRecords,
  normalizeCompanyCnpj,
  validateCompanyProvisioningInput,
  type CreateCompanyWorkspaceInput,
  type CompanyProvisioningResult,
} from '../companyProvisioning';
import {
  normalizePlatformEmail,
  normalizeWorkspaceId,
  type CompanyAccount,
  type CompanyWorkspace,
} from '../platformIdentity';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

type FailureCode =
  | 'INVALID_INPUT' | 'CONFLICT' | 'UPSTREAM_ERROR' | 'RECOVERY_REQUIRED';

export class CompanyProvisioningFailure extends Error {
  constructor(
    message: string,
    public readonly code: FailureCode,
    public readonly httpStatus: number,
    public readonly recoveryRequired = false
  ) {
    super(message);
    this.name = 'CompanyProvisioningFailure';
  }
}

export interface FounderIdentity {
  uid: string;
  email: string;
}

export interface CompanyDirectoryEntry {
  workspace: CompanyWorkspace;
  account: CompanyAccount | null;
}

const PROJECT_ID = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const documentsRoot = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const firestoreUrl = `https://firestore.googleapis.com/v1/${documentsRoot}`;

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: 'NULL_VALUE' }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

interface FirestoreWrite {
  update?: { name: string; fields: Record<string, FirestoreValue> };
  delete?: string;
  currentDocument?: { exists: boolean };
}
interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}
interface GoogleError {
  error?: { message?: string; status?: string };
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === 'object' && value) {
    return { mapValue: { fields: encodeFirestoreFields(value as Record<string, unknown>) } };
  }
  throw new Error('Campo Firestore empresarial inválido.');
}

function encodeFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(value)
    .filter(([, field]) => field !== undefined)
    .map(([key, field]) => [key, encodeFirestoreValue(field)]));
}

function decodeFirestoreValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  return decodeFirestoreFields(value.mapValue.fields || {});
}

function decodeFirestoreFields(fields: Record<string, FirestoreValue> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

function documentName(path: string): string {
  return `${documentsRoot}/${path}`;
}

function documentPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function readPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

function googleError(payload: GoogleError): string {
  return payload.error?.message || payload.error?.status || 'GOOGLE_API_ERROR';
}

async function authAdmin<T>(
  token: string,
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts${action}?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );
  const data = await readPayload<T & GoogleError>(response);
  if (!response.ok) throw new Error(googleError(data));
  return data;
}

async function firestoreCommit(token: string, writes: FirestoreWrite[]): Promise<void> {
  const response = await fetch(`${firestoreUrl}:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ writes }),
    cache: 'no-store',
  });
  const data = await readPayload<GoogleError>(response);
  if (!response.ok) throw new Error(googleError(data));
}

async function firestoreRead(token: string, path: string): Promise<FirestoreDocument | null> {
  const response = await fetch(`${firestoreUrl}/${documentPath(path)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  const data = await readPayload<FirestoreDocument & GoogleError>(response);
  if (!response.ok) throw new Error(googleError(data));
  return data;
}

function createWrite(path: string, record: Record<string, unknown>): FirestoreWrite {
  return {
    update: { name: documentName(path), fields: encodeFirestoreFields(record) },
    currentDocument: { exists: false },
  };
}

const isConflict = (error: unknown) =>
  /ALREADY_EXISTS|FAILED_PRECONDITION|EMAIL_EXISTS/i.test(
    error instanceof Error ? error.message : String(error)
  );

function normalizedFailure(error: unknown, recoveryRequired: boolean): CompanyProvisioningFailure {
  if (error instanceof CompanyProvisioningFailure && !recoveryRequired) return error;
  if (recoveryRequired) return new CompanyProvisioningFailure(
    'Provisionamento interrompido. A conta foi bloqueada; recuperação administrativa necessária.',
    'RECOVERY_REQUIRED', 503, true
  );
  if (isConflict(error)) return new CompanyProvisioningFailure(
    'CNPJ, e-mail ou identificador já vinculado a outra conta.',
    'CONFLICT', 409
  );
  return new CompanyProvisioningFailure(
    'Não foi possível concluir o provisionamento empresarial.',
    'UPSTREAM_ERROR', 502
  );
}

function lockPaths(workspaceId: string, email: string, cnpj: string): string[] {
  const emailHash = createHash('sha256').update(email).digest('hex');
  return [
    `platformProvisioningLocks/email-${emailHash}`,
    `platformProvisioningLocks/workspace-${workspaceId}`,
    `platformProvisioningLocks/cnpj-${cnpj}`,
  ];
}

export async function provisionCompanyWorkspaceWithAuth(
  input: CreateCompanyWorkspaceInput,
  founder: FounderIdentity
): Promise<CompanyProvisioningResult> {
  const errors = validateCompanyProvisioningInput(input);
  if (errors.length) throw new CompanyProvisioningFailure(errors[0], 'INVALID_INPUT', 400);

  const token = await getGoogleAccessToken();
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const email = normalizePlatformEmail(input.authorizedEmail);
  const cnpj = normalizeCompanyCnpj(input.cnpj);
  const operationId = randomUUID();
  const now = new Date().toISOString();
  const locks = lockPaths(workspaceId, email, cnpj);
  const state = {
    operationId, workspaceId, email, cnpj, createdBy: founder.email,
    phase: 'locked', createdAt: now, updatedAt: now,
  };
  let locked = false;
  let uid = '';
  let createdAuth = false;
  let commitAttempted = false;
  let directoryCommitted = false;
  let authEnabled = false;
  let recoveryRequired = false;

  try {
    // Reservas comuns com setor (e-mail e workspace), mais a reserva fiscal (CNPJ).
    await firestoreCommit(token, locks.map((path) => createWrite(path, state)));
    locked = true;

    // Não reutilizamos contas Auth preexistentes: isso evita apropriação de UID,
    // senha ou sessão de um setor/fundador mesmo quando faltam índices legados.
    const lookup = await authAdmin<{ users?: Array<{ localId: string }> }>(
      token, ':lookup', { email: [email] }
    );
    if (lookup.users?.length) throw new CompanyProvisioningFailure(
      'O e-mail já possui uma identidade Firebase. Escolha outro e-mail.',
      'CONFLICT', 409
    );
    const created = await authAdmin<{ localId?: string }>(token, '', {
      email,
      password: input.initialPassword,
      displayName: input.legalName.trim(),
      emailVerified: true,
      disabled: true,
    });
    uid = created.localId || '';
    if (!uid) throw new Error('AUTH_USER_WITHOUT_UID');
    createdAuth = true;

    // Confirma que a identidade não consegue entrar até a conclusão do diretório.
    const verify = await authAdmin<{ users?: Array<{ disabled?: boolean; localId: string }> }>(
      token, ':lookup', { localId: [uid] }
    );
    if (verify.users?.[0]?.localId !== uid || verify.users[0].disabled !== true) {
      throw new Error('AUTH_NOT_DISABLED');
    }

    const records = buildProvisionedCompanyRecords(input, founder.email, uid, now);
    const companyPath = `workspaces/${workspaceId}`;
    const accountPath = `platformAccounts/${email}`;
    const cnpjPath = `platformCnpjIndex/${cnpj}`;
    const uidPath = `platformAuthUidIndex/${uid}`;
    const auditPath = `platformAuditEvents/${randomUUID()}`;

    commitAttempted = true;
    await firestoreCommit(token, [
      createWrite(companyPath, { ...records.workspace, provisioningOperationId: operationId }),
      createWrite(accountPath, { ...records.account, provisioningOperationId: operationId }),
      createWrite(cnpjPath, { cnpj, email, workspaceId, firebaseUid: uid, operationId, createdAt: now }),
      createWrite(uidPath, { firebaseUid: uid, email, workspaceId, accountType: 'company', operationId, createdAt: now }),
      createWrite(auditPath, {
        eventVersion: 'emprovex_audit_v1', eventId: auditPath.split('/')[1],
        workspaceId, ug: null, operation: 'company.create', source: 'admin',
        entityType: 'workspace', entityId: workspaceId, correlationId: operationId,
        actorUid: founder.uid, actorEmail: founder.email,
        before: {}, after: { cnpj, email, firebaseUid: uid, status: 'active' },
        metadata: { workspaceType: 'company', authProvider: 'password' },
        createdAt: now,
      }),
    ]);
    directoryCommitted = true;

    await authAdmin(token, ':update', { localId: uid, disableUser: false });
    authEnabled = true;
    // Limpeza de reserva não é parte crítica; índices persistentes já garantem unicidade.
    try {
      await firestoreCommit(token, locks.map(path => ({ delete: documentName(path) })));
    } catch (error) {
      console.error('EMPROVEX company provisioning lock cleanup failed.', { operationId, error });
    }
    locked = false;
    return records;
  } catch (error) {
    // Se a resposta do commit sumiu na rede, verificamos a titularidade antes do rollback.
    if (commitAttempted && !directoryCommitted && uid) {
      try {
        const index = await firestoreRead(token, `platformAuthUidIndex/${uid}`);
        const fields = index ? decodeFirestoreFields(index.fields) : null;
        directoryCommitted = fields?.operationId === operationId
          && fields?.workspaceId === workspaceId;
      } catch {
        recoveryRequired = true;
      }
    }

    // Um sucesso de habilitação Auth sem resposta pode ter ocorrido. Bloquear sempre
    // antes de desfazer o diretório, para nunca permitir sessão sem cadastro coerente.
    if (createdAuth && uid) {
      try {
        await authAdmin(token, ':update', { localId: uid, disableUser: true });
        authEnabled = false;
      } catch {
        recoveryRequired = true;
      }
    }

    if (directoryCommitted && !authEnabled && !recoveryRequired) {
      try {
        await firestoreCommit(token, [
          `workspaces/${workspaceId}`,
          `platformAccounts/${email}`,
          `platformCnpjIndex/${cnpj}`,
          `platformAuthUidIndex/${uid}`,
        ].map(path => ({ delete: documentName(path), currentDocument: { exists: true } })));
        directoryCommitted = false;
      } catch (rollbackError) {
        recoveryRequired = true;
        console.error('EMPROVEX company directory rollback failed.', { operationId, rollbackError });
      }
    }

    if (createdAuth && uid && !directoryCommitted && !recoveryRequired) {
      try {
        await authAdmin(token, ':delete', { localId: uid });
        createdAuth = false;
      } catch (rollbackError) {
        recoveryRequired = true;
        console.error('EMPROVEX company Auth rollback failed.', { operationId, rollbackError });
      }
    }

    if (locked) {
      try {
        if (recoveryRequired || directoryCommitted) {
          await firestoreCommit(token, locks.map(path => ({
            update: {
              name: documentName(path),
              fields: encodeFirestoreFields({
                ...state, phase: 'recovery-required', firebaseUid: uid,
                recoveryRequired: true, updatedAt: new Date().toISOString(),
              }),
            },
            currentDocument: { exists: true },
          })));
          recoveryRequired = true;
        } else {
          await firestoreCommit(token, locks.map(path => ({ delete: documentName(path) })));
        }
      } catch (lockError) {
        recoveryRequired = true;
        console.error('EMPROVEX company provisioning lock recovery failed.', { operationId, lockError });
      }
    }
    console.error('EMPROVEX company provisioning failure.', {
      operationId, workspaceId, email, recoveryRequired,
      error: error instanceof Error ? error.message : String(error),
    });
    throw normalizedFailure(error, recoveryRequired);
  }
}

async function listCollection(
  token: string,
  collectionName: 'workspaces' | 'platformAccounts'
): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  let pageToken = '';
  let page = 0;
  do {
    if (++page > 100) throw new Error('DIRECTORY_PAGE_LIMIT');
    const qs = new URLSearchParams({ pageSize: '100' });
    if (pageToken) qs.set('pageToken', pageToken);
    const response = await fetch(`${firestoreUrl}/${collectionName}?${qs.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await readPayload<{
      documents?: FirestoreDocument[]; nextPageToken?: string;
    } & GoogleError>(response);
    if (!response.ok) throw new Error(googleError(data));
    for (const doc of data.documents || []) result.push(decodeFirestoreFields(doc.fields));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return result;
}

export async function listCompanyDirectory(): Promise<CompanyDirectoryEntry[]> {
  const token = await getGoogleAccessToken();
  const [workspaces, accounts] = await Promise.all([
    listCollection(token, 'workspaces'),
    listCollection(token, 'platformAccounts'),
  ]);
  const companyAccounts = new Map(
    accounts.filter(account => account.accountType === 'company')
      .map(account => [account.workspaceId as string, account as unknown as CompanyAccount])
  );
  return workspaces
    .filter(workspace => workspace.workspaceType === 'company')
    .map(workspace => ({
      workspace: workspace as unknown as CompanyWorkspace,
      account: companyAccounts.get(workspace.id as string) || null,
    }))
    .sort((a, b) => a.workspace.name.localeCompare(b.workspace.name, 'pt-BR'));
}
