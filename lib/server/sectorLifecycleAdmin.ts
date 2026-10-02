import { randomUUID } from 'node:crypto';

import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import {
  SESSION_REVOCATION_TTL_MS,
  SESSION_REVOCATION_VERSION,
  SESSION_SLOT_IDS,
} from '../platformCapacity';
import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export type SectorLifecycleStatus = 'active' | 'disabled';

export interface SectorLifecycleActor {
  uid: string;
  email: string;
}

export interface SectorLifecycleInput {
  workspaceId: string;
  status: SectorLifecycleStatus;
  reason?: string;
}

export interface SectorLifecycleResult {
  workspaceId: string;
  email: string;
  ug: string;
  previousStatus: SectorLifecycleStatus;
  status: SectorLifecycleStatus;
  revokedSessions: number;
  warehouseAccessStatus: SectorLifecycleStatus;
}

type FailureCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UPSTREAM_ERROR'
  | 'RECOVERY_REQUIRED';

export class SectorLifecycleFailure extends Error {
  constructor(
    message: string,
    public readonly code: FailureCode,
    public readonly httpStatus: number,
    public readonly recoveryRequired = false
  ) {
    super(message);
    this.name = 'SectorLifecycleFailure';
  }
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: 'NULL_VALUE' }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocumentPayload {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreWrite {
  update?: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  delete?: string;
  updateMask?: {
    fieldPaths: string[];
  };
  currentDocument?: {
    exists?: boolean;
    updateTime?: string;
  };
}

interface LifecycleDirectoryState {
  workspaceId: string;
  email: string;
  ug: string;
  workspaceStatus: SectorLifecycleStatus;
  accountStatus: SectorLifecycleStatus;
  workspace: FirestoreDocumentPayload;
  account: FirestoreDocumentPayload;
  slots: Array<{
    slotId: (typeof SESSION_SLOT_IDS)[number];
    document: FirestoreDocumentPayload;
    sessionId: string;
    uid: string;
    accountEmail: string;
    ug: string;
  }>;
}

const PROJECT_ID = firebaseConfig.projectId;
const CORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const WAREHOUSE_DATABASE_ID = 'emprovex-warehouse';
const WAREHOUSE_ACCESS_COLLECTION = 'warehouseAccess';
const WAREHOUSE_ACCESS_SCHEMA = 'warehouse_workspace_access_v1';

function encodeDocumentPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function documentName(databaseId: string, path: string): string {
  return `projects/${PROJECT_ID}/databases/${databaseId}/documents/${path}`;
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'object' && value) {
    return {
      mapValue: {
        fields: toFirestoreFields(value as Record<string, unknown>),
      },
    };
  }
  throw new Error('Valor não suportado pelo encoder Firestore do lifecycle.');
}

function toFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)])
  );
}

function stringField(
  document: FirestoreDocumentPayload | null,
  key: string
): string {
  const value = document?.fields?.[key];
  return value && 'stringValue' in value ? value.stringValue : '';
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function googleErrorMessage(payload: Record<string, unknown>): string {
  const error = payload.error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'GOOGLE_API_ERROR';
}

async function readFirestoreDocument(
  accessToken: string,
  databaseId: string,
  path: string
): Promise<FirestoreDocumentPayload | null> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(databaseId)}/documents/${encodeDocumentPath(path)}`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (response.status === 404) return null;

  const payload = await readJson(response) as FirestoreDocumentPayload & Record<string, unknown>;
  if (!response.ok) {
    throw new SectorLifecycleFailure(
      googleErrorMessage(payload),
      'UPSTREAM_ERROR',
      response.status >= 500 ? 503 : 409
    );
  }

  return payload;
}

async function commitFirestoreWrites(
  accessToken: string,
  databaseId: string,
  writes: FirestoreWrite[]
): Promise<void> {
  if (writes.length === 0) return;

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(databaseId)}/documents:commit`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ writes }),
      cache: 'no-store',
    }
  );

  const payload = await readJson(response);
  if (!response.ok) {
    throw new SectorLifecycleFailure(
      googleErrorMessage(payload),
      response.status === 409 || response.status === 412 ? 'CONFLICT' : 'UPSTREAM_ERROR',
      response.status >= 500 ? 503 : 409
    );
  }
}

function assertLifecycleStatus(value: string): asserts value is SectorLifecycleStatus {
  if (value !== 'active' && value !== 'disabled') {
    throw new SectorLifecycleFailure(
      'O diretório possui um estado de autorização inválido.',
      'CONFLICT',
      409
    );
  }
}

async function loadLifecycleDirectoryState(
  accessToken: string,
  workspaceId: string
): Promise<LifecycleDirectoryState> {
  const workspacePath = `workspaces/${workspaceId}`;
  const workspace = await readFirestoreDocument(
    accessToken,
    CORE_DATABASE_ID,
    workspacePath
  );

  if (!workspace) {
    throw new SectorLifecycleFailure('O setor informado não existe.', 'NOT_FOUND', 404);
  }

  const storedWorkspaceId = normalizeWorkspaceId(stringField(workspace, 'id'));
  const email = normalizePlatformEmail(stringField(workspace, 'authorizedEmail'));
  const ug = normalizeUnitUg(stringField(workspace, 'ug'));
  const workspaceStatus = stringField(workspace, 'status');

  if (
    storedWorkspaceId !== workspaceId
    || !email
    || !isValidUnitUg(ug)
    || !workspace.updateTime
  ) {
    throw new SectorLifecycleFailure(
      'Os metadados atuais do workspace são inválidos.',
      'CONFLICT',
      409
    );
  }
  assertLifecycleStatus(workspaceStatus);

  const accountPath = `platformAccounts/${email}`;
  const account = await readFirestoreDocument(
    accessToken,
    CORE_DATABASE_ID,
    accountPath
  );

  if (!account) {
    throw new SectorLifecycleFailure(
      'A conta operacional vinculada ao setor não existe.',
      'CONFLICT',
      409
    );
  }

  const accountStatus = stringField(account, 'status');
  const accountWorkspaceId = normalizeWorkspaceId(stringField(account, 'workspaceId'));
  const accountEmail = normalizePlatformEmail(stringField(account, 'email'));
  const accountUg = normalizeUnitUg(stringField(account, 'ug'));
  const accountType = stringField(account, 'accountType');

  assertLifecycleStatus(accountStatus);

  if (
    !account.updateTime
    || accountType !== 'sector'
    || accountWorkspaceId !== workspaceId
    || accountEmail !== email
    || accountUg !== ug
    || accountStatus !== workspaceStatus
  ) {
    throw new SectorLifecycleFailure(
      'Workspace e conta operacional estão inconsistentes.',
      'CONFLICT',
      409
    );
  }

  const slotDocuments = await Promise.all(
    SESSION_SLOT_IDS.map(async (slotId) => ({
      slotId,
      document: await readFirestoreDocument(
        accessToken,
        CORE_DATABASE_ID,
        `workspaces/${workspaceId}/sessionSlots/${slotId}`
      ),
    }))
  );

  const slots = slotDocuments.flatMap(({ slotId, document }) => {
    if (!document) return [];

    const sessionId = stringField(document, 'sessionId');
    const uid = stringField(document, 'uid');
    const slotWorkspaceId = normalizeWorkspaceId(stringField(document, 'workspaceId'));
    const slotUg = normalizeUnitUg(stringField(document, 'ug'));
    const slotEmail = normalizePlatformEmail(stringField(document, 'accountEmail'));
    const storedSlotId = stringField(document, 'slotId');

    if (
      !document.updateTime
      || !sessionId
      || !uid
      || slotWorkspaceId !== workspaceId
      || slotUg !== ug
      || slotEmail !== email
      || storedSlotId !== slotId
    ) {
      throw new SectorLifecycleFailure(
        'Foi encontrada uma sessão ativa com metadados inconsistentes.',
        'CONFLICT',
        409
      );
    }

    return [{
      slotId,
      document,
      sessionId,
      uid,
      accountEmail: slotEmail,
      ug: slotUg,
    }];
  });

  return {
    workspaceId,
    email,
    ug,
    workspaceStatus,
    accountStatus,
    workspace,
    account,
    slots,
  };
}

function auditWrite(input: {
  actor: SectorLifecycleActor;
  state: LifecycleDirectoryState;
  previousStatus: SectorLifecycleStatus;
  status: SectorLifecycleStatus;
  revokedSessions: number;
  reason: string;
}): FirestoreWrite {
  const eventId = randomUUID();
  const correlationId = randomUUID();

  return {
    update: {
      name: documentName(CORE_DATABASE_ID, `platformAuditEvents/${eventId}`),
      fields: toFirestoreFields({
        eventVersion: 'emprovex_audit_v1',
        eventId,
        workspaceId: input.state.workspaceId,
        ug: input.state.ug,
        operation: 'sector.status_change',
        source: 'admin',
        entityType: 'workspace',
        entityId: input.state.workspaceId,
        correlationId,
        actorUid: input.actor.uid,
        actorEmail: normalizePlatformEmail(input.actor.email),
        before: { status: input.previousStatus },
        after: { status: input.status },
        metadata: {
          authorizedEmail: input.state.email,
          reason: input.reason,
          revokedSessions: input.revokedSessions,
          enforcement: 'saas-r1-ds',
        },
        createdAt: new Date(),
      }),
    },
    currentDocument: { exists: false },
  };
}

async function commitMainLifecycle(
  accessToken: string,
  state: LifecycleDirectoryState,
  status: SectorLifecycleStatus,
  actor: SectorLifecycleActor,
  reason: string
): Promise<{ previousStatus: SectorLifecycleStatus; revokedSessions: number }> {
  const previousStatus = state.workspaceStatus;
  const now = new Date().toISOString();
  const writes: FirestoreWrite[] = [];

  if (previousStatus !== status) {
    writes.push(
      {
        update: {
          name: documentName(CORE_DATABASE_ID, `workspaces/${state.workspaceId}`),
          fields: toFirestoreFields({ status, updatedAt: now }),
        },
        updateMask: { fieldPaths: ['status', 'updatedAt'] },
        currentDocument: { updateTime: state.workspace.updateTime },
      },
      {
        update: {
          name: documentName(CORE_DATABASE_ID, `platformAccounts/${state.email}`),
          fields: toFirestoreFields({ status, updatedAt: now }),
        },
        updateMask: { fieldPaths: ['status', 'updatedAt'] },
        currentDocument: { updateTime: state.account.updateTime },
      }
    );
  }

  const revokedSessions = status === 'disabled' ? state.slots.length : 0;

  if (status === 'disabled') {
    for (const slot of state.slots) {
      writes.push(
        {
          update: {
            name: documentName(
              CORE_DATABASE_ID,
              `workspaces/${state.workspaceId}/sessionRevocations/${slot.sessionId}`
            ),
            fields: toFirestoreFields({
              revocationVersion: SESSION_REVOCATION_VERSION,
              sessionId: slot.sessionId,
              workspaceId: state.workspaceId,
              ug: slot.ug,
              uid: slot.uid,
              accountEmail: slot.accountEmail,
              slotId: slot.slotId,
              createdAt: new Date(),
              createdBy: normalizePlatformEmail(actor.email),
              expiresAt: new Date(Date.now() + SESSION_REVOCATION_TTL_MS),
            }),
          },
          currentDocument: { exists: false },
        },
        {
          delete: documentName(
            CORE_DATABASE_ID,
            `workspaces/${state.workspaceId}/sessionSlots/${slot.slotId}`
          ),
          currentDocument: { updateTime: slot.document.updateTime },
        }
      );
    }
  }

  if (previousStatus !== status || revokedSessions > 0) {
    writes.push(auditWrite({
      actor,
      state,
      previousStatus,
      status,
      revokedSessions,
      reason,
    }));
  }

  await commitFirestoreWrites(accessToken, CORE_DATABASE_ID, writes);
  return { previousStatus, revokedSessions };
}

async function setWarehouseLifecycle(
  accessToken: string,
  state: Pick<LifecycleDirectoryState, 'workspaceId' | 'ug'>,
  status: SectorLifecycleStatus,
  actor: SectorLifecycleActor
): Promise<void> {
  await commitFirestoreWrites(accessToken, WAREHOUSE_DATABASE_ID, [{
    update: {
      name: documentName(
        WAREHOUSE_DATABASE_ID,
        `${WAREHOUSE_ACCESS_COLLECTION}/${state.workspaceId}`
      ),
      fields: toFirestoreFields({
        schemaVersion: WAREHOUSE_ACCESS_SCHEMA,
        workspaceId: state.workspaceId,
        ug: state.ug,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: normalizePlatformEmail(actor.email),
      }),
    },
  }]);
}

function normalizeReason(value?: string): string {
  const normalized = value?.trim().slice(0, 240) || '';
  return normalized || 'admin_manual_lifecycle_change';
}

export function parseSectorLifecycleInput(value: unknown): SectorLifecycleInput {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  const workspaceId = normalizeWorkspaceId(
    typeof source.workspaceId === 'string' ? source.workspaceId : ''
  );
  const status = typeof source.status === 'string' ? source.status : '';
  const reason = typeof source.reason === 'string' ? source.reason : undefined;

  if (
    !isValidWorkspaceId(workspaceId)
    || workspaceId === HGESM_WORKSPACE_ID
    || (status !== 'active' && status !== 'disabled')
  ) {
    throw new SectorLifecycleFailure(
      'A solicitação de suspensão/reativação é inválida.',
      'INVALID_INPUT',
      400
    );
  }

  return { workspaceId, status, reason };
}

export async function applySectorLifecycleStatus(
  input: SectorLifecycleInput,
  actor: SectorLifecycleActor
): Promise<SectorLifecycleResult> {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  if (
    !isValidWorkspaceId(workspaceId)
    || workspaceId === HGESM_WORKSPACE_ID
    || (input.status !== 'active' && input.status !== 'disabled')
  ) {
    throw new SectorLifecycleFailure(
      'A solicitação de suspensão/reativação é inválida.',
      'INVALID_INPUT',
      400
    );
  }

  const accessToken = await getGoogleAccessToken();
  const initial = await loadLifecycleDirectoryState(accessToken, workspaceId);
  const reason = normalizeReason(input.reason);

  if (input.status === 'disabled') {
    await setWarehouseLifecycle(accessToken, initial, 'disabled', actor);

    try {
      const main = await commitMainLifecycle(
        accessToken,
        initial,
        'disabled',
        actor,
        reason
      );

      return {
        workspaceId,
        email: initial.email,
        ug: initial.ug,
        previousStatus: main.previousStatus,
        status: 'disabled',
        revokedSessions: main.revokedSessions,
        warehouseAccessStatus: 'disabled',
      };
    } catch (error) {
      if (initial.workspaceStatus === 'active') {
        try {
          await setWarehouseLifecycle(accessToken, initial, 'active', actor);
        } catch (rollbackError) {
          console.error('EMPROVEX lifecycle warehouse rollback failed.', {
            workspaceId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
          throw new SectorLifecycleFailure(
            'A suspensão falhou e o estado da Central exige recuperação administrativa.',
            'RECOVERY_REQUIRED',
            500,
            true
          );
        }
      }
      throw error;
    }
  }

  const main = await commitMainLifecycle(
    accessToken,
    initial,
    'active',
    actor,
    reason
  );

  try {
    await setWarehouseLifecycle(accessToken, initial, 'active', actor);
  } catch (error) {
    if (initial.workspaceStatus === 'disabled') {
      try {
        const rollbackState = await loadLifecycleDirectoryState(accessToken, workspaceId);
        await commitMainLifecycle(
          accessToken,
          rollbackState,
          'disabled',
          actor,
          'warehouse_reactivation_compensation'
        );
        await setWarehouseLifecycle(accessToken, rollbackState, 'disabled', actor);
      } catch (rollbackError) {
        console.error('EMPROVEX lifecycle reactivation rollback failed.', {
          workspaceId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
        throw new SectorLifecycleFailure(
          'A reativação ficou parcialmente aplicada e exige recuperação administrativa.',
          'RECOVERY_REQUIRED',
          500,
          true
        );
      }

      throw new SectorLifecycleFailure(
        'A Central de Depósitos não pôde ser reativada; o acesso geral permaneceu suspenso.',
        'UPSTREAM_ERROR',
        503
      );
    }

    throw new SectorLifecycleFailure(
      'O acesso principal está ativo, mas a Central de Depósitos exige recuperação administrativa.',
      'RECOVERY_REQUIRED',
      500,
      true
    );
  }

  return {
    workspaceId,
    email: initial.email,
    ug: initial.ug,
    previousStatus: main.previousStatus,
    status: 'active',
    revokedSessions: 0,
    warehouseAccessStatus: 'active',
  };
}
